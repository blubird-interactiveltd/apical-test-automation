import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { APIResponse, Page, Route } from "@playwright/test";
import { STATE_MAX_AGE_MS, isStateFresh } from "../../utils/storageState";

/** Every Apical API call the app makes, whatever the API host. */
const API_RE = /\/api\/v1\//;
const CACHE_DIR = path.resolve(process.cwd(), "test-results/.api-cache");
const MAX_ATTEMPTS = 6;
const DEFAULT_BACKOFF_MS = 10_000;

interface CachedReply {
  savedAt: number;
  status: number;
  contentType: string;
  body: string;
}

const memory = new Map<string, CachedReply>();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Seconds from `Retry-After`, else the default back-off. */
export function backoffMs(retryAfter: string | undefined): number {
  const seconds = Number(retryAfter);

  return Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : DEFAULT_BACKOFF_MS;
}

/**
 * Whether the API refused `response` for the rate limit. Stage answers a
 * throttled call with 429 *or* with `404 {"message":"Too Many Attempts."}`,
 * so the status alone does not tell.
 */
export async function isThrottled(response: APIResponse): Promise<boolean> {
  if (response.status() === 429) return true;
  if (response.status() !== 404) return false;

  return (await response.text()).includes("Too Many Attempts");
}

function keyOf(route: Route): string {
  const request = route.request();

  return createHash("sha1")
    .update(`${request.url()}\n${request.headers().authorization ?? ""}`)
    .digest("hex");
}

function fromDisk(key: string): CachedReply | null {
  try {
    const reply = JSON.parse(
      fs.readFileSync(path.join(CACHE_DIR, `${key}.json`), "utf-8"),
    ) as CachedReply;

    return isStateFresh(reply.savedAt, STATE_MAX_AGE_MS) ? reply : null;
  } catch {
    return null;
  }
}

function toDisk(key: string, reply: CachedReply): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Written then renamed, so a parallel worker never reads half a file.
  const target = path.join(CACHE_DIR, `${key}.json`);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(reply));
  fs.renameSync(temp, target);
}

/**
 * `route.fetch()`, waiting out the API's 60/min throttle (finding F-12).
 *
 * Exported for routes that must reach the real API uncached, such as a write
 * a spec captures or a list that must show what was just created.
 */
export async function fetchThrottled(route: Route): Promise<APIResponse> {
  for (let attempt = 1; ; attempt++) {
    const response = await route.fetch();

    if (!(await isThrottled(response)) || attempt === MAX_ATTEMPTS) {
      return response;
    }

    await sleep(backoffMs(response.headers()["retry-after"]));
  }
}

/**
 * Serves repeat GETs to the real API from a short-lived cache.
 *
 * The API throttles each user to 60 requests a minute (F-12), and every test
 * boots the whole app — profile, settings, menus — under the same master
 * account. Without this, a few parallel specs exhaust the quota on boot calls
 * alone. Only successful GETs are cached, keyed by URL and Authorization, for
 * as long as a cached session is trusted; the responses are still the real
 * server's, recorded on first use in the run.
 *
 * Install it before any stub: Playwright tries routes newest first, so the
 * specific stubs registered after it win, and their `fallback()` lands here.
 */
export class ApiResponseCache {
  static async install(
    page: Page,
    options: { bypass?: RegExp[] } = {},
  ): Promise<void> {
    const bypass = options.bypass ?? [];

    await page.route(API_RE, async (route) => {
      const request = route.request();

      if (
        request.method() !== "GET" ||
        bypass.some((pattern) => pattern.test(request.url()))
      ) {
        return route.continue();
      }

      let reply: CachedReply;
      try {
        reply = await ApiResponseCache.get(route);
      } catch (error) {
        // The app navigated away while this GET was in flight, so Playwright
        // disposed its response; nobody is waiting for an answer any more.
        if (String(error).includes("Response has been disposed")) return;
        throw error;
      }

      return route.fulfill({
        status: reply.status,
        contentType: reply.contentType,
        body: reply.body,
      });
    });
  }

  /** The cached or freshly fetched reply for `route`'s request. */
  static async get(route: Route): Promise<CachedReply> {
    const key = keyOf(route);
    const cached = memory.get(key) ?? fromDisk(key);

    if (cached) {
      memory.set(key, cached);
      return cached;
    }

    const response = await fetchThrottled(route);
    const reply: CachedReply = {
      savedAt: Date.now(),
      status: response.status(),
      contentType: response.headers()["content-type"] ?? "application/json",
      body: await response.text(),
    };

    if (response.ok()) {
      memory.set(key, reply);
      toDisk(key, reply);
    }

    return reply;
  }

  /** The reply parsed as JSON — for stubs that edit a real response. */
  static async json<T>(route: Route): Promise<T> {
    return JSON.parse((await ApiResponseCache.get(route)).body) as T;
  }
}
