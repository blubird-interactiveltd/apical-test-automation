import type { Page, Request, Route } from "@playwright/test";
import { multipartField, multipartFileName } from "../../utils/speakingCreate";
import type { StubbedError } from "../../utils/types/shared/listResponse.types";
import type {
  QuestionCreatedResponse,
  QuestionPayload,
} from "../../utils/types/speaking/speakingCreate.types";
import { fetchThrottled } from "../shared/apiResponseCache.service";
import { LIST_RE } from "./speakingListApiMock.service";
import { CreatedQuestions } from "./speakingQuestionApi.service";

/** `POST /api/v1/questions` — not `/questions/list` or `/questions/{id}`. */
export const QUESTIONS_RE = /\/api\/v1\/questions$/;
export const UPLOAD_RE = /\/api\/v1\/common\/upload-file$/;
export const SAMPLE_ANSWER_SAVE_RE = /\/api\/v1\/sample-answer$/;
export const SAMPLE_ANSWER_LIST_RE = /\/api\/v1\/sample-answer\/list/;

/** One `POST /questions` the form sent, and what came back. */
export interface CapturedPost {
  payload: QuestionPayload;
  status: number;
  body: Record<string, unknown>;
}

/** One `POST /common/upload-file` the form sent, and what came back. */
export interface CapturedUpload {
  type: string | null;
  fileName: string | null;
  status: number;
  body: Record<string, unknown>;
}

/** The stored file URL an upload reply carries (`data.filepath`), or "". */
export function uploadedUrl(upload: CapturedUpload | undefined): string {
  const data = upload?.body.data as { filepath?: string } | undefined;

  return data?.filepath ?? "";
}

/** The field errors a 422 reply carries (`errors`), or none. */
export function fieldErrors(
  post: CapturedPost | undefined,
): Record<string, string[]> {
  return (post?.body.errors as Record<string, string[]> | undefined) ?? {};
}

/** How a spec wants uploads answered. Default: the real API. */
export interface UploadBehaviour {
  /** Replies with this instead of uploading. */
  reply?: StubbedError;
  /** Holds every upload this long before answering. */
  delayMs?: number;
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** A waitable log: `next(n)` resolves once `n` entries have arrived. */
class Log<T> {
  readonly entries: T[] = [];
  private waiters: { count: number; resolve: () => void }[] = [];

  push(entry: T): void {
    this.entries.push(entry);
    this.waiters = this.waiters.filter((waiter) => {
      if (this.entries.length < waiter.count) return true;
      waiter.resolve();
      return false;
    });
  }

  /** The `count`-th entry (1-based), once it exists. */
  async nth(count: number, timeoutMs: number): Promise<T> {
    if (this.entries.length < count) {
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          this.waiters = this.waiters.filter(
            (waiter) => waiter.resolve !== done,
          );
          reject(
            new Error(
              `Timed out after ${timeoutMs} ms waiting for request #${count}; saw ${this.entries.length}.`,
            ),
          );
        }, timeoutMs);
        this.waiters.push({ count, resolve: done });
      });
    }

    return this.entries[count - 1] as T;
  }
}

async function bodyOf(response: {
  text: () => Promise<string>;
}): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await response.text()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** The `type` field and file name an upload sent, as far as its post data shows them. */
function sentUpload(request: Request): {
  type: string | null;
  fileName: string | null;
} {
  const raw = request.postDataBuffer()?.toString("latin1") ?? "";

  return {
    type: multipartField(raw, "type"),
    fileName: multipartFileName(raw, "file"),
  };
}

function postedJson(request: Request): QuestionPayload {
  return (request.postDataJSON() ?? {}) as QuestionPayload;
}

/**
 * The create form's writes, observed and — where a case needs it — stubbed.
 *
 * Every `POST /questions` and upload goes through a route that records the
 * request and the reply. Unless a spec stubs it, the route forwards to the
 * real API (waiting out 429s), so a case asserts both what the front-end
 * sent and what the server did with it. A 201 is tracked for deletion.
 */
export class SpeakingCreateApiMock {
  private readonly postLog = new Log<CapturedPost>();
  private readonly uploadLog = new Log<CapturedUpload>();
  private readonly stubbedUploads = new WeakSet<Request>();
  private watchingUploads = false;
  readonly sampleAnswerListUrls: URL[] = [];

  constructor(private readonly page: Page) {}

  get posts(): CapturedPost[] {
    return this.postLog.entries;
  }

  get uploads(): CapturedUpload[] {
    return this.uploadLog.entries;
  }

  /** Records every question create; `reply` stubs the answer instead of saving. */
  async questionPosts(
    reply?: StubbedError | { status: number; body: Record<string, unknown> },
  ): Promise<void> {
    await this.page.unroute(QUESTIONS_RE);
    await this.page.route(QUESTIONS_RE, async (route: Route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.fallback();

      const payload = postedJson(request);

      if (reply) {
        const body = reply.body ?? { message: "error" };
        this.postLog.push({ payload, status: reply.status, body });
        return route.fulfill({ status: reply.status, json: body });
      }

      const response = await fetchThrottled(route);
      const body = await bodyOf(response);
      if (response.status() === 201) {
        CreatedQuestions.track(
          (body as unknown as QuestionCreatedResponse).question_id,
        );
      }
      this.postLog.push({ payload, status: response.status(), body });

      return route.fulfill({ response });
    });
  }

  /**
   * Records every upload; `behaviour` can stub or delay it.
   *
   * A real upload is passed on with `route.continue()` and recorded from its
   * response. It cannot go through `route.fetch()`: an intercepted request
   * does not carry the browser's file part, so a re-sent upload reaches the
   * API with an empty file ("Unsupported file type.").
   */
  async uploadRequests(behaviour: UploadBehaviour = {}): Promise<void> {
    if (!this.watchingUploads) {
      this.watchingUploads = true;
      this.page.on("response", (response) => {
        const request = response.request();
        if (
          request.method() !== "POST" ||
          !UPLOAD_RE.test(request.url()) ||
          this.stubbedUploads.has(request)
        )
          return;

        void bodyOf(response).then((body) =>
          this.uploadLog.push({
            ...sentUpload(request),
            status: response.status(),
            body,
          }),
        );
      });
    }

    await this.page.unroute(UPLOAD_RE);
    await this.page.route(UPLOAD_RE, async (route: Route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.fallback();

      if (behaviour.delayMs) await delay(behaviour.delayMs);

      if (behaviour.reply) {
        const body = behaviour.reply.body ?? { message: "error" };
        this.stubbedUploads.add(request);
        this.uploadLog.push({
          ...sentUpload(request),
          status: behaviour.reply.status,
          body,
        });
        return route.fulfill({ status: behaviour.reply.status, json: body });
      }

      return route.continue();
    });
  }

  /**
   * Serves the Speaking list from the real API, uncached, so the row a case
   * just created is there when the form returns to the list.
   */
  async liveList(): Promise<void> {
    await this.page.route(LIST_RE, async (route: Route) => {
      if (route.request().method() !== "GET") return route.fallback();

      return route.fulfill({ response: await fetchThrottled(route) });
    });
  }

  /**
   * Answers "Save & SET" of a new sample answer with `id`, without creating
   * one on stage, and accepts its voice uploads the same way.
   */
  async sampleAnswerSave(id: string, fileUrl: string): Promise<void> {
    await this.page.route(SAMPLE_ANSWER_SAVE_RE, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 201,
            json: { sample_answer_id: id, message: "Successfully Saved" },
          })
        : route.fallback(),
    );
    await this.uploadRequests({
      reply: {
        status: 201,
        body: {
          message: "Uploaded successfully.",
          data: { filepath: fileUrl },
        },
      },
    });
  }

  /** Records the archive list requests the sample-answer dialog makes. */
  async recordSampleAnswerLists(): Promise<void> {
    this.page.on("request", (request) => {
      if (SAMPLE_ANSWER_LIST_RE.test(request.url())) {
        this.sampleAnswerListUrls.push(new URL(request.url()));
      }
    });
  }

  /** The `count`-th question POST (1-based), once it has been answered. */
  async post(count: number, timeoutMs: number): Promise<CapturedPost> {
    return this.postLog.nth(count, timeoutMs);
  }

  /** The `count`-th upload (1-based), once it has been answered. */
  async upload(count: number, timeoutMs: number): Promise<CapturedUpload> {
    return this.uploadLog.nth(count, timeoutMs);
  }
}
