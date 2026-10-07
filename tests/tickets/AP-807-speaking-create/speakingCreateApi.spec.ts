import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ApicalAuthService } from "../../../services/auth/apicalAuth.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import { minimalPayload, qaIndex } from "../../../utils/speakingCreate";
import { mediaFile } from "../../../utils/speakingMedia";
import {
  createType,
  speakingCreateData,
  speakingCreateEdgeData,
} from "../../../utils/speakingTestData";
import type {
  QuestionCreatedResponse,
  QuestionPayload,
} from "../../../utils/types/speaking/speakingCreate.types";
import type { SpeakingTypeCode } from "../../../utils/types/speaking/speakingList.types";

const data = speakingCreateData();
const edge = speakingCreateEdgeData();
const ra = createType("RA");

/** A valid Read Aloud body, minus nothing. */
const raBody = (fields: QuestionPayload = {}) =>
  minimalPayload(ra, qaIndex("RA"), {
    title: data.content.RA.plainTitle ?? "",
    ...fields,
  });

test.skip(
  process.env.RUN_LIVE !== "1",
  "AP-807 creates and deletes questions on stage; set RUN_LIVE=1.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "API checks do not depend on a browser; one project is enough.",
);

test.afterEach(async ({ request }) => {
  await CreatedQuestions.deleteAll(await SpeakingQuestionApi.as(request));
});

test.describe("AP-807 speaking create — POST /api/v1/questions contract", () => {
  test("the minimum body of each type is saved and read back (AP-807-TC-900)", async ({
    request,
  }) => {
    const api = await SpeakingQuestionApi.as(request);
    const audio = await api.upload(
      mediaFile("speaking-short.mp3"),
      data.upload.audioType,
    );
    const image = await api.upload(
      mediaFile("describe-image.png"),
      data.upload.imageType,
    );
    const fields: Record<SpeakingTypeCode, QuestionPayload> = {
      RA: { title: data.content.RA.title ?? "" },
      RS: { transcript: data.content.RS.transcript ?? "", file_path: audio },
      DI: {
        file_path: image,
        file_type: "image",
        keywords: data.content.DI.keywords ?? "",
      },
      RL: {
        transcript: data.content.RL.transcript ?? "",
        file_path: audio,
        file_type: "audio",
      },
      ASQ: { transcript: data.content.ASQ.transcript ?? "", file_path: audio },
      SGD: { transcript: data.content.SGD.transcript ?? "", file_path: audio },
      RTAS: {
        transcript: data.content.RTAS.transcript ?? "",
        file_path: audio,
      },
    };

    for (const type of data.types) {
      await test.step(type.title, async () => {
        const body = minimalPayload(
          type,
          qaIndex(type.code),
          fields[type.code],
        );

        const response = await api.create(body);

        expect(response.status(), type.code).toBe(201);
        const created = (await response.json()) as QuestionCreatedResponse;
        expect(created.message).toBe(data.messages.saved);
        const record = await api.get(created.question_id, "edit");
        expect(record.question_type_id).toBe(type.id);
        expect(record.index).toBe(body.index);
        for (const key of ["title", "transcript", "file_path"] as const) {
          if (body[key] !== undefined)
            expect(record[key], `${type.code} ${key}`).toBe(body[key]);
        }
      });
    }
  });

  test("each required key is named when it is missing (AP-807-TC-901)", async ({
    request,
  }) => {
    const api = await SpeakingQuestionApi.as(request);

    for (const key of edge.api.missingKeys) {
      await test.step(key, async () => {
        const body = raBody();
        delete body[key];

        const response = await api.create(body);

        expect(response.status(), key).toBe(422);
        expect(
          ((await response.json()) as { errors?: Record<string, string[]> })
            .errors?.[key],
          key,
        ).toBeDefined();
      });
    }
  });

  test("values outside each enum are refused (AP-807-TC-902)", async ({
    request,
  }) => {
    const api = await SpeakingQuestionApi.as(request);

    for (const { key, value } of edge.api.badEnums) {
      await test.step(`${key}=${value}`, async () => {
        const response = await api.create(raBody({ [key]: value }));

        expect(response.status(), key).toBe(422);
        expect(
          ((await response.json()) as { errors?: Record<string, string[]> })
            .errors?.[key],
          key,
        ).toBeDefined();
      });
    }
  });

  test("a file_path that is not a URL is refused (AP-807-TC-903)", async ({
    request,
  }) => {
    const api = await SpeakingQuestionApi.as(request);

    const response = await api.create(
      raBody({ file_path: edge.api.nonUrlFilePath }),
    );

    expect(response.status()).toBe(422);
    expect(
      ((await response.json()) as { errors?: Record<string, string[]> }).errors
        ?.file_path,
    ).toBeDefined();
  });

  test("an unknown question type is a 404 (AP-807-TC-904)", async ({
    request,
  }) => {
    const api = await SpeakingQuestionApi.as(request);

    const response = await api.create(
      raBody({ question_type_id: randomUUID() }),
    );

    // QuestionStoreRequest::rules() calls QuestionType::findOrFail before validating.
    expect(response.status()).toBe(404);
  });

  test("a user without Store Question cannot create (AP-807-TC-905)", async ({
    request,
  }) => {
    test.skip(
      !ApicalAuthService.hasCredentials("coaching"),
      "Set COACHING_EMAIL/COACHING_PASSWORD for an account without Store Question.",
    );
    const api = await SpeakingQuestionApi.as(request, "coaching");

    const response = await api.create(raBody());

    expect(response.status()).not.toBe(201);
    expect([403, 404]).toContain(response.status());
    expect(edge.api.permissionMessages).toContain(
      ((await response.json()) as { message?: string }).message,
    );
  });

  test("a validation error has the documented shape and leaks nothing (AP-807-TC-906)", async ({
    request,
  }) => {
    const api = await SpeakingQuestionApi.as(request);
    const body = raBody();
    delete body.index;

    const response = await api.create(body);

    expect(response.status()).toBe(422);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({
      message: edge.api.errorMessage,
      status: edge.api.errorStatus,
      errors: { index: expect.any(Array) },
    });
    for (const marker of edge.api.leakMarkers) {
      expect(text, marker).not.toContain(marker);
    }
  });
});
