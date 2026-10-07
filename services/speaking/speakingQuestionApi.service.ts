import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { ApiHeaders } from "../../utils/apiHeaders";
import { EnvLoader } from "../../utils/envLoader";
import { SlidingWindowLimiter } from "../../utils/rateLimiter";
import type { InMemoryFile } from "../../utils/speakingMedia";
import type { ApicalRole } from "../../utils/types/auth/auth.types";
import type {
  QuestionCreatedResponse,
  QuestionPayload,
  QuestionRecord,
  QuestionRecordResponse,
  SampleAnswerListItem,
  SampleAnswerListResponse,
  UploadResponse,
} from "../../utils/types/speaking/speakingCreate.types";
import type {
  SpeakingListResponse,
  SpeakingQuestion,
} from "../../utils/types/speaking/speakingList.types";
import { ApicalLoginService } from "../auth/apicalLogin.service";
import { backoffMs, isThrottled } from "../shared/apiResponseCache.service";

/**
 * Requests one worker may start per minute. The API allows 60 per user
 * (F-12), and the app under test makes its own calls on the same account,
 * so the suite's helpers keep to a third of it.
 */
export const API_REQUESTS_PER_MINUTE = 20;
const MAX_ATTEMPTS = 6;

const limiter = new SlidingWindowLimiter(API_REQUESTS_PER_MINUTE, 60_000);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

type Method = "get" | "post" | "delete";

interface SendOptions {
  data?: unknown;
  multipart?: Record<
    string,
    string | { name: string; mimeType: string; buffer: Buffer }
  >;
}

/**
 * Every question the suite has created in this worker and not yet deleted.
 *
 * Specs delete them in `afterEach`, so stage keeps its own questions and
 * nothing more. Only ids that came back from a create the suite made are ever
 * here: a stage question that already existed can never be deleted by it.
 */
export class CreatedQuestions {
  private static readonly ids = new Set<string>();

  static track(id: string): void {
    CreatedQuestions.ids.add(id);
  }

  static forget(id: string): void {
    CreatedQuestions.ids.delete(id);
  }

  static pending(): string[] {
    return [...CreatedQuestions.ids];
  }

  /** Deletes every tracked question. A 404 counts as already gone. */
  static async deleteAll(api: SpeakingQuestionApi): Promise<void> {
    for (const id of CreatedQuestions.pending()) {
      const response = await api.remove(id);

      if (!response.ok() && response.status() !== 404) {
        throw new Error(
          `Could not delete question ${id}: ${response.status()} ${await response.text()}`,
        );
      }
      CreatedQuestions.forget(id);
    }
  }
}

/**
 * Calls to the real questions API as one signed-in role.
 *
 * These write to stage. Every create goes through `create`, which registers
 * the new id with `CreatedQuestions` for the spec's `afterEach`.
 */
export class SpeakingQuestionApi {
  private constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  /** An API client signed in as `role`, reusing the cached session. */
  static async as(
    request: APIRequestContext,
    role: ApicalRole = "master",
  ): Promise<SpeakingQuestionApi> {
    return new SpeakingQuestionApi(
      request,
      await ApicalLoginService.token(request, role),
    );
  }

  private url(apiPath: string): string {
    return `${EnvLoader.get("API_URL")}/api/v1/${apiPath}`;
  }

  /** One request, inside the per-worker budget, retried while the API says it is throttled. */
  private async send(
    method: Method,
    apiPath: string,
    options: SendOptions = {},
  ): Promise<APIResponse> {
    for (let attempt = 1; ; attempt++) {
      await limiter.acquire();
      const response = await this.request[method](this.url(apiPath), {
        headers: ApiHeaders.tenant(this.token),
        ...(options.data === undefined ? {} : { data: options.data }),
        ...(options.multipart === undefined
          ? {}
          : { multipart: options.multipart }),
      });

      if (!(await isThrottled(response)) || attempt === MAX_ATTEMPTS) {
        return response;
      }

      await sleep(backoffMs(response.headers()["retry-after"]));
    }
  }

  /** `POST /questions`. A 201 is tracked for deletion before it is returned. */
  async create(payload: QuestionPayload): Promise<APIResponse> {
    const response = await this.send("post", "questions", { data: payload });

    if (response.status() === 201) {
      const body = (await response.json()) as QuestionCreatedResponse;
      CreatedQuestions.track(body.question_id);
    }

    return response;
  }

  /** `POST /questions`, failing unless it is created; returns the new id. */
  async createOk(payload: QuestionPayload): Promise<string> {
    const response = await this.create(payload);

    if (response.status() !== 201) {
      throw new Error(
        `Create failed: ${response.status()} ${await response.text()}`,
      );
    }

    return ((await response.json()) as QuestionCreatedResponse).question_id;
  }

  /** `GET /questions/{id}`, raw. `intention=edit` keeps `[brackets]`. */
  async fetch(id: string, intention?: "edit" | "show"): Promise<APIResponse> {
    return this.send(
      "get",
      `questions/${id}${intention ? `?intention=${intention}` : ""}`,
    );
  }

  async get(id: string, intention?: "edit" | "show"): Promise<QuestionRecord> {
    const response = await this.fetch(id, intention);

    if (!response.ok()) {
      throw new Error(
        `GET question ${id} failed: ${response.status()} ${await response.text()}`,
      );
    }

    return ((await response.json()) as QuestionRecordResponse).items;
  }

  async remove(id: string): Promise<APIResponse> {
    return this.send("delete", `questions/${id}`);
  }

  /** `GET /questions/list` for a section, filtered as the list page filters. */
  async list(
    section: string,
    query: Record<string, string> = {},
  ): Promise<SpeakingQuestion[]> {
    const params = new URLSearchParams({ type: "question", section, ...query });
    const response = await this.send("get", `questions/list?${params}`);

    if (!response.ok()) {
      throw new Error(
        `List failed: ${response.status()} ${await response.text()}`,
      );
    }

    return ((await response.json()) as SpeakingListResponse).items;
  }

  /** The Speaking questions whose q_id, index or title contains `term`. */
  async search(
    term: string,
    section = "speaking",
  ): Promise<SpeakingQuestion[]> {
    return this.list(section, { search: term });
  }

  /** The archived sample answers of one question type. */
  async sampleAnswers(questionTypeId: string): Promise<SampleAnswerListItem[]> {
    const response = await this.send(
      "get",
      `sample-answer/list?question_type_id=${questionTypeId}`,
    );

    if (!response.ok()) {
      throw new Error(
        `Sample-answer list failed: ${response.status()} ${await response.text()}`,
      );
    }

    return ((await response.json()) as SampleAnswerListResponse).items;
  }

  /** `POST /common/upload-file`; returns the stored file's URL. */
  async upload(file: string | InMemoryFile, type: string): Promise<string> {
    const part =
      typeof file === "string"
        ? {
            name: path.basename(file),
            mimeType: mimeOf(file),
            buffer: fs.readFileSync(file),
          }
        : file;
    const response = await this.send("post", "common/upload-file", {
      multipart: { file: part, type },
    });

    if (!response.ok()) {
      throw new Error(
        `Upload failed: ${response.status()} ${await response.text()}`,
      );
    }

    return ((await response.json()) as UploadResponse).data.filepath;
  }

  /** The signed-in user's display name, from `/users/profile`. */
  async profileName(): Promise<string> {
    const response = await this.send("get", "users/profile");
    // Unwrapped, with the name split: { first_name: "Apical", last_name: null, … }
    const body = (await response.json()) as {
      first_name?: string | null;
      last_name?: string | null;
    };

    return [body.first_name, body.last_name].filter(Boolean).join(" ");
  }
}

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function mimeOf(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}
