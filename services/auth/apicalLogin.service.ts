import fs from "node:fs";
import type { Page } from "@playwright/test";
import { EnvLoader } from "../../utils/envLoader";
import {
  STATE_MAX_AGE_MS,
  ensureStateDir,
  isStateFresh,
  statePath,
  stateSavedAt,
} from "../../utils/storageState";
import type {
  ApicalRole,
  ApicalSession,
  SavedState,
  StorageEntry,
} from "../../utils/types/auth/auth.types";
import { ApicalAuthService } from "./apicalAuth.service";

/** The keys `Login.vue` writes after a successful login. */
function toEntries(session: ApicalSession): StorageEntry[] {
  const entries: StorageEntry[] = [{ name: "token", value: session.token }];

  if (session.token2) entries.push({ name: "token2", value: session.token2 });
  if (session.user_id !== undefined)
    entries.push({ name: "user_id", value: String(session.user_id) });
  if (session.user_type)
    entries.push({ name: "user_type", value: session.user_type });
  if (session.organization_id !== undefined)
    entries.push({
      name: "organization_id",
      value: String(session.organization_id),
    });

  return entries;
}

/** Puts a role's session into the page before the app boots. */
export class ApicalLoginService {
  /**
   * Signs `page` in as `role`, reusing a cached session when it is fresh.
   *
   * The token lives in localStorage, and `src/store/api.js` reads it once, when
   * the axios instance is created. It must therefore be in place before the
   * first script of the app runs, which is what `addInitScript` guarantees -
   * setting it after navigating would be one load too late.
   *
   * Only the auth keys are replayed. Other keys, such as `classBasicInfo`, are
   * left to the app, so the specs that assert on them see its real behaviour.
   */
  static async ensureLoggedIn(page: Page, role: ApicalRole): Promise<void> {
    const entries =
      ApicalLoginService.cachedEntries(role) ??
      (await ApicalLoginService.freshEntries(page, role));

    await page.context().addInitScript((items: StorageEntry[]) => {
      for (const item of items) {
        window.localStorage.setItem(item.name, item.value);
      }
    }, entries);
  }

  /**
   * The cached entries, or null whenever the cache cannot be trusted.
   *
   * Returns null rather than throwing on every failure mode, so the caller's
   * one response to "the cache did not work" is to log in properly.
   */
  private static cachedEntries(role: ApicalRole): StorageEntry[] | null {
    if (!isStateFresh(stateSavedAt(role), STATE_MAX_AGE_MS)) {
      return null;
    }

    try {
      const state = JSON.parse(
        fs.readFileSync(statePath(role), "utf-8"),
      ) as SavedState;
      const entries = state.origins[0]?.localStorage ?? [];

      return entries.some((entry) => entry.name === "token") ? entries : null;
    } catch {
      return null;
    }
  }

  private static async freshEntries(
    page: Page,
    role: ApicalRole,
  ): Promise<StorageEntry[]> {
    const session = await ApicalAuthService.getSession(page.request, role);
    const entries = toEntries(session);
    const state: SavedState = {
      cookies: [],
      origins: [
        {
          origin: new URL(EnvLoader.get("BASE_URL")).origin,
          localStorage: entries,
        },
      ],
    };

    ensureStateDir(role);
    fs.writeFileSync(statePath(role), JSON.stringify(state, null, 2));

    return entries;
  }
}
