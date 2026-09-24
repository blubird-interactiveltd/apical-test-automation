import type { Page, Route } from "@playwright/test";
import { Fixtures } from "../../utils/fixtures";
import { searchTermsOf } from "../../utils/onlineClassSearch";
import type {
  OnlineClass,
  OnlineClassDetailResponse,
  OnlineClassListResponse,
  StubbedError,
} from "../../utils/types/onlineClass/onlineClass.types";

/** The recorded list response every stub starts from. */
export const LIST_FIXTURE = "onlineClassList.response.json";

// `GET /api/v1/online-class[?query]` only. The three patterns are disjoint:
// the list pattern stops at the path, the detail one needs a UUID, and neither
// matches `/online-class-ribbons` or `/online-class/duplicate`.
const LIST_RE = /\/api\/v1\/online-class(\?.*)?$/;
const DETAIL_RE = /\/api\/v1\/online-class\/[0-9a-f-]{36}$/;
const DUPLICATE_RE = /\/api\/v1\/online-class\/duplicate$/;

export type ListHandler = (
  url: URL,
) =>
  | OnlineClassListResponse
  | StubbedError
  | Promise<OnlineClassListResponse | StubbedError>;

const isError = (
  reply: OnlineClassListResponse | StubbedError,
): reply is StubbedError => "status" in reply;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** The sample list, freshly cloned. */
export function sampleList(): OnlineClassListResponse {
  return Fixtures.api<OnlineClassListResponse>(LIST_FIXTURE);
}

/** One sample class, optionally with fields replaced. Throws if the fixture lacks it. */
export function sampleItem(
  override: Partial<OnlineClass> = {},
  index = 0,
): OnlineClass {
  const item = sampleList().items[index];

  if (!item) {
    throw new Error(`${LIST_FIXTURE} has no item at index ${index}.`);
  }

  return { ...item, ...override };
}

export function detailOf(item: OnlineClass): OnlineClassDetailResponse {
  return {
    items: {
      ...item,
      modules: [],
      faqs: [],
      why_important: "",
      total_student_taken: 0,
    },
  };
}

/**
 * Stubs the online-class endpoints on one page and records what it was asked.
 *
 * Only these three endpoints are stubbed. Everything else - profile,
 * permissions, ribbons - still reaches the real backend with a real token, so
 * the list renders inside a genuine session and only its data is controlled.
 * What each spec asserts is therefore independent of what the database holds.
 */
export class OnlineClassApiMock {
  readonly listRequests: string[] = [];
  readonly detailRequests: string[] = [];
  readonly duplicateBodies: { online_class_id: string }[] = [];

  constructor(private readonly page: Page) {}

  /** Serves the list. Default: the sample fixture for every request. */
  async list(handler: ListHandler = () => sampleList()): Promise<void> {
    await this.page.unroute(LIST_RE);
    await this.page.route(LIST_RE, async (route: Route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }

      this.listRequests.push(route.request().url());
      const reply = await handler(new URL(route.request().url()));

      if (isError(reply)) {
        return route.fulfill({
          status: reply.status,
          json: reply.body ?? { message: "error" },
        });
      }

      return route.fulfill({ json: reply });
    });
  }

  /** Serves `GET /online-class/{id}` from `items`, optionally slowed per id. */
  async detail(
    items: OnlineClass[] = sampleList().items,
    delayFor: (id: string) => number = () => 0,
  ): Promise<void> {
    await this.page.unroute(DETAIL_RE);
    await this.page.route(DETAIL_RE, async (route) => {
      const id = route.request().url().split("/").pop() ?? "";
      this.detailRequests.push(id);

      const wait = delayFor(id);
      if (wait) await delay(wait);

      const item = items.find((entry) => entry.id === id);

      if (!item) {
        return route.fulfill({ status: 404, json: { message: "Not found" } });
      }

      return route.fulfill({ json: detailOf(item) });
    });
  }

  /** Serves `POST /online-class/duplicate` with a copy of the source class. */
  async duplicate(
    options: { status?: number; delayMs?: number; copyId?: string } = {},
  ): Promise<void> {
    await this.page.route(DUPLICATE_RE, async (route) => {
      const body = route.request().postDataJSON() as {
        online_class_id: string;
      };
      this.duplicateBodies.push(body);

      if (options.delayMs) await delay(options.delayMs);

      if (options.status && options.status >= 400) {
        return route.fulfill({
          status: options.status,
          json: { message: "Failed to duplicate class" },
        });
      }

      const source =
        sampleList().items.find((item) => item.id === body.online_class_id) ??
        sampleList().items[0];

      return route.fulfill({
        json: {
          items: {
            ...source,
            id: options.copyId ?? "11111111-1111-4111-8111-111111111111",
            title: `${source?.title ?? ""} Copy`,
          },
        },
      });
    });
  }

  searchTerms(): string[] {
    return searchTermsOf(this.listRequests);
  }

  lastListRequest(): URL | null {
    const last = this.listRequests.at(-1);

    return last ? new URL(last) : null;
  }
}
