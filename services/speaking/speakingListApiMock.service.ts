import type { Page, Route } from "@playwright/test";
import { Fixtures } from "../../utils/fixtures";
import { recordedSpeakingQuestions } from "../../utils/speakingFixtures";
import { answerListRequest } from "../../utils/speakingListOracle";
import type { StubbedError } from "../../utils/types/shared/listResponse.types";
import type {
  SpeakingListResponse,
  SpeakingQuestion,
  SpeakingQuestionTypesResponse,
  StatusDropdownResponse,
} from "../../utils/types/speaking/speakingList.types";
import { ApiResponseCache } from "../shared/apiResponseCache.service";

export const TYPES_FIXTURE = "speakingQuestionTypes.response.json";
export const STATUS_FIXTURE = "speakingStatusDropdown.response.json";

/** `GET /api/v1/questions/list[?query]` — not `/questions/{id}`. */
export const LIST_RE = /\/api\/v1\/questions\/list(\?.*)?$/;
const TYPES_RE = /\/api\/v1\/question-types\?section=speaking$/;
const STATUS_RE = /\/api\/v1\/common\/dropdowns\?status$/;
const PROFILE_RE = /\/api\/v1\/users\/profile(\?.*)?$/;

export type ListHandler = (
  url: URL,
) =>
  | SpeakingListResponse
  | StubbedError
  | Promise<SpeakingListResponse | StubbedError>;

/** A profile as `/users/profile` returns it, as far as `can()` reads it. */
export interface ProfileReply {
  data: { role?: string; permissions?: string[]; [field: string]: unknown };
  [field: string]: unknown;
}

const isError = (
  reply: SpeakingListResponse | StubbedError,
): reply is StubbedError => "status" in reply;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Every recorded Speaking question (118, stage, 2026-10-05), freshly cloned.
 * Stubs page and filter them with the backend oracle.
 */
export function sampleQuestions(): SpeakingQuestion[] {
  return recordedSpeakingQuestions();
}

/** One recorded question by q_id, optionally with fields replaced. */
export function sampleQuestion(
  qId: string,
  override: Partial<SpeakingQuestion> = {},
): SpeakingQuestion {
  const found = sampleQuestions().find((item) => item.q_id === qId);

  if (!found) {
    throw new Error(`The recorded list has no question ${qId}.`);
  }

  return { ...found, ...override };
}

export function sampleTypes(): SpeakingQuestionTypesResponse {
  return Fixtures.api<SpeakingQuestionTypesResponse>(TYPES_FIXTURE);
}

/** Answers every list request from `items` the way the API would. */
export function oracle(items: SpeakingQuestion[] = sampleQuestions()) {
  return (url: URL) => answerListRequest(items, url);
}

/**
 * Stubs the endpoints the Speaking list reads, and records what it asked.
 *
 * Only these are stubbed. Everything else — login, settings, menus — reaches
 * the real backend through `ApiResponseCache`, so the list renders inside a
 * genuine session and only its data is controlled.
 */
export class SpeakingListApiMock {
  readonly listRequests: URL[] = [];

  constructor(private readonly page: Page) {}

  /** Serves the list. Default: the recorded questions through the oracle. */
  async list(
    handler: ListHandler = oracle(),
    options: { delayMs?: number } = {},
  ): Promise<void> {
    await this.page.unroute(LIST_RE);
    await this.page.route(LIST_RE, async (route: Route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }

      const url = new URL(route.request().url());
      this.listRequests.push(url);

      if (options.delayMs) await delay(options.delayMs);

      const reply = await handler(url);

      if (isError(reply)) {
        return route.fulfill({
          status: reply.status,
          json: reply.body ?? { message: "error" },
        });
      }

      return route.fulfill({ json: reply });
    });
  }

  /** Serves the recorded Speaking question types. */
  async questionTypes(): Promise<void> {
    await this.page.route(TYPES_RE, (route) =>
      route.fulfill({ json: sampleTypes() }),
    );
  }

  /** Serves the recorded status dropdown (Draft / Published). */
  async statuses(): Promise<void> {
    await this.page.route(STATUS_RE, (route) =>
      route.fulfill({
        json: Fixtures.api<StatusDropdownResponse>(STATUS_FIXTURE),
      }),
    );
  }

  /**
   * Serves the signed-in user's real profile, edited by `edit`.
   *
   * `can()` lets a SUPER_ADMIN through every check, so a permission case has to
   * demote the role and choose the permission ids itself.
   */
  async profile(edit: (profile: ProfileReply) => ProfileReply): Promise<void> {
    await this.page.route(PROFILE_RE, async (route) => {
      const real = await ApiResponseCache.json<ProfileReply>(route);

      return route.fulfill({ json: edit(real) });
    });
  }

  lastListRequest(): URL | null {
    return this.listRequests.at(-1) ?? null;
  }

  /** Values of one query parameter across every list request, in order. */
  paramHistory(name: string): (string | null)[] {
    return this.listRequests.map((url) => url.searchParams.get(name));
  }
}
