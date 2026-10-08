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
const asq = createType("ASQ");
const content = data.content.ASQ;
const transcript = content.transcript ?? "";

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

test.describe("AP-807 speaking create — Answer Short Question", () => {
  test("ASQ shows Audio, Transcript and Keyword, and no sample answer (AP-807-TC-501)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "ASQ" });

    await expect(form.fileInput("audio")).toHaveCount(1);
    await expect(form.sectionHeading("transcript")).toBeVisible();
    await expect(form.keywordBox).toBeVisible();
    await expect(form.sampleAnswerButton).toBeHidden();
  });

  test("ASQ with every field is sent and stored with file_type audio (AP-807-TC-502)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "ASQ",
    });
    await SpeakingCreateService.fill(form, api, "ASQ", {
      index: qaIndex("ASQ"),
      media: "speaking-short.mp3",
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload).toMatchObject({
      file_path: uploadedUrl(api.uploads[0]),
      transcript,
      keywords: content.keywords,
    });
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record).toMatchObject({
      file_type: "audio",
      file_path: post.payload.file_path,
      transcript,
      keywords: content.keywords,
    });
  });

  test("a manual keyword is saved verbatim as the expected answer (AP-807-TC-503)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "ASQ",
    });
    await SpeakingCreateService.fill(form, api, "ASQ", {
      index: qaIndex("ASQ"),
      media: "speaking-short.mp3",
      transcript: content.plainTranscript ?? "",
      keywords: content.manualKeyword ?? "",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload.keywords).toBe(content.manualKeyword);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.keywords).toBe(content.manualKeyword);
  });

  test("ASQ cannot be published without a transcript (AP-807-TC-504)", async ({
    page,
  }) => {
    // F-01: AnswerShortQuestion.vue's transcript rule never runs (CreateView.vue:406-411).
    // F-02: its message tests `!v$.value.transcript.required`, always truthy (AnswerShortQuestion.vue:104).
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "ASQ",
    });
    await SpeakingCreateService.fill(form, api, "ASQ", {
      index: qaIndex("ASQ"),
      media: "speaking-short.mp3",
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.transcriptRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("ASQ cannot be published without audio (AP-807-TC-505)", async ({
    page,
  }) => {
    // F-01: no file_path rule for ASQ in the UI or in QuestionStoreRequest.
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "ASQ",
    });
    await SpeakingCreateService.fill(form, api, "ASQ", {
      index: qaIndex("ASQ"),
      transcript,
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    expect(api.posts.filter((post) => post.status === 201)).toEqual([]);
  });

  test("ASQ's total answer time adds the question audio, with no beep (AP-807-TC-506)", async ({
    page,
    request,
  }) => {
    // F-18 (new, seen on stage): the form sends no file_type for this type, and the server
    // only measures file_duration when file_type is sent, so total_answer_time leaves out the media.
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "ASQ",
    });
    await SpeakingCreateService.fill(form, api, "ASQ", {
      index: qaIndex("ASQ"),
      media: "speaking-short.mp3",
      transcript,
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
            asq.timing,
            data.mediaSeconds["speaking-short.mp3"] ?? 0,
          ),
      ),
    ).toBeLessThanOrEqual(1);
  });
});
