import { expect, test } from "@playwright/test";
import { SpeakingCreateService } from "../../../services/speaking/speakingCreate.service";
import { uploadedUrl } from "../../../services/speaking/speakingCreateApiMock.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import {
  expectedTotalAnswerTime,
  qaIndex,
} from "../../../utils/speakingCreate";
import {
  createType,
  speakingCreateData,
} from "../../../utils/speakingTestData";

const data = speakingCreateData();
const rtas = createType("RTAS");
const transcript = data.content.RTAS.transcript ?? "";

test.skip(
  process.env.RUN_LIVE !== "1",
  "AP-807 creates and deletes questions on stage; set RUN_LIVE=1.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-807 asserts requests and stored data, which are browser-independent.",
);

test.afterEach(async ({ request }) => {
  await CreatedQuestions.deleteAll(await SpeakingQuestionApi.as(request));
});

test.describe("AP-807 speaking create — Respond To A Situation", () => {
  test("RTAS shows Transcript above Audio, then Keyword (AP-807-TC-701)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "RTAS" });

    const transcriptBox = await form.sectionHeading("transcript").boundingBox();
    const audioBox = await form
      .fileInput("audio")
      .locator("xpath=..")
      .boundingBox();
    const keywordBox = await form.keywordBox.boundingBox();
    expect(transcriptBox?.y ?? 0).toBeLessThan(audioBox?.y ?? 0);
    expect(audioBox?.y ?? 0).toBeLessThan(keywordBox?.y ?? 0);
    await expect(form.sampleAnswerButton).toBeVisible();
  });

  test("RTAS with every field is sent and stored (AP-807-TC-702)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RTAS",
    });
    await SpeakingCreateService.fill(form, api, "RTAS", {
      index: qaIndex("RTAS"),
      transcript,
      media: "speaking-lecture.mp3",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload).toMatchObject({
      transcript,
      file_path: uploadedUrl(api.uploads[0]),
      keywords: data.content.RTAS.keywords,
    });
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record).toMatchObject({
      transcript,
      file_path: post.payload.file_path,
      keywords: data.content.RTAS.keywords,
    });
  });

  test("RTAS cannot be published without a transcript (AP-807-TC-703)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RTAS",
    });
    await SpeakingCreateService.fill(form, api, "RTAS", {
      index: qaIndex("RTAS"),
      media: "speaking-lecture.mp3",
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.transcriptRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("RTAS cannot be published without audio (AP-807-TC-704)", async ({
    page,
  }) => {
    // Regression guard for #813.
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RTAS",
    });
    await SpeakingCreateService.fill(form, api, "RTAS", {
      index: qaIndex("RTAS"),
      transcript,
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    expect(api.posts.filter((post) => post.status === 201)).toEqual([]);
  });

  test("RTAS's total answer time adds the situation audio (AP-807-TC-705)", async ({
    page,
    request,
  }) => {
    // Regression guard for #812.
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RTAS",
    });
    await SpeakingCreateService.fill(form, api, "RTAS", {
      index: qaIndex("RTAS"),
      transcript,
      media: "speaking-lecture.mp3",
    });

    const post = await SpeakingCreateService.submit(form, api);

    const total = Number(
      (
        await (
          await SpeakingQuestionApi.as(request)
        ).get(String(post.body.question_id), "edit")
      ).total_answer_time,
    );
    expect(
      Math.abs(
        total -
          expectedTotalAnswerTime(
            rtas.timing,
            data.mediaSeconds["speaking-lecture.mp3"] ?? 0,
          ),
      ),
    ).toBeLessThanOrEqual(1);
  });

  test("an RTAS sample answer from the archive is attached (AP-807-TC-706)", async ({
    page,
    request,
  }) => {
    const client = await SpeakingQuestionApi.as(request);
    const archived = (await client.sampleAnswers(rtas.id))[0];
    test.skip(
      !archived,
      "Stage has no Respond To A Situation sample answer in the archive.",
    );
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RTAS",
    });
    await SpeakingCreateService.fill(form, api, "RTAS", {
      index: qaIndex("RTAS"),
      transcript,
      media: "speaking-short.mp3",
    });

    await SpeakingCreateService.attachFromArchive(page, form);
    const post = await SpeakingCreateService.submit(form, api);

    const id = archived?.sample_answer_id ?? "";
    expect(post.payload.sample_answers).toEqual({
      [id]: { is_default: true, selected_from_archive: true },
    });
    expect(
      JSON.stringify(
        (await client.get(String(post.body.question_id), "edit"))
          .sample_answers,
      ),
    ).toContain(id);
  });
});
