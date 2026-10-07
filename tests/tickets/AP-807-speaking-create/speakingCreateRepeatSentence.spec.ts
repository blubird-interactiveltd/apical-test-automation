import { expect, test } from "@playwright/test";
import { SPEAKING_LIST_PATHS } from "../../../pages/speaking/speakingList.page";
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
const rs = createType("RS");
const transcript = data.content.RS.transcript ?? "";

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

test.describe("AP-807 speaking create — Repeat Sentence", () => {
  test("RS shows Audio, then Transcript, then Keyword, and no sample answer (AP-807-TC-201)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "RS" });

    const audioBox = await form
      .fileInput("audio")
      .locator("xpath=..")
      .boundingBox();
    const transcriptBox = await form.sectionHeading("transcript").boundingBox();
    const keywordBox = await form.keywordBox.boundingBox();
    expect(audioBox?.y ?? 0).toBeLessThan(transcriptBox?.y ?? 0);
    expect(transcriptBox?.y ?? 0).toBeLessThan(keywordBox?.y ?? 0);
    await expect(form.bracketHints).toHaveText([data.messages.bracketHint]);
    await expect(form.sampleAnswerButton).toBeHidden();
  });

  test("RS with every field is sent and stored with file_type audio (AP-807-TC-202)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      media: "speaking-short.mp3",
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload.file_path).toBe(uploadedUrl(api.uploads[0]));
    expect(post.payload.transcript).toBe(transcript);
    expect(post.payload.keywords).toBe(data.content.RS.keywords);
    expect(post.payload).not.toHaveProperty("file_type");
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record).toMatchObject({
      file_type: "audio",
      file_path: post.payload.file_path,
      transcript,
      keywords: data.content.RS.keywords,
    });
  });

  test("RS cannot be published without a transcript (AP-807-TC-203)", async ({
    page,
  }) => {
    // F-01: RepeatSentence.vue's `transcript: { required }` never runs
    // (CreateView.vue:406-411 reads a $v the component does not expose).
    // F-02: even then its message tests `!v$.value.transcript.required`,
    // a rule object that is always truthy (RepeatSentence.vue:103).
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      media: "speaking-short.mp3",
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.transcriptRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("RS cannot be published without audio (AP-807-TC-204)", async ({
    page,
  }) => {
    // F-01: neither the UI (RepeatSentence.vue rules list only transcript)
    // nor QuestionStoreRequest requires file_path for RS.
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      transcript,
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    expect(api.posts.filter((post) => post.status === 201)).toEqual([]);
  });

  test("RS's total answer time adds the audio length (AP-807-TC-205)", async ({
    page,
    request,
  }) => {
    // F-18 (new, seen on stage): the form sends no file_type for this type, and the server
    // only measures file_duration when file_type is sent, so total_answer_time leaves out the media.
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
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
    expect(total).toBeGreaterThan(rs.timing.answer_time);
    expect(
      Math.abs(
        total -
          expectedTotalAnswerTime(
            rs.timing,
            data.mediaSeconds["speaking-short.mp3"] ?? 0,
          ),
      ),
    ).toBeLessThanOrEqual(1);
  });

  test("RS saved as Draft is listed as Draft (AP-807-TC-206)", async ({
    page,
    request,
  }) => {
    const { form, api, listPage } = await SpeakingCreateService.open(page, {
      liveList: true,
      type: "RS",
    });
    const index = qaIndex("RS");
    await SpeakingCreateService.fill(form, api, "RS", {
      index,
      media: "speaking-short.mp3",
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api, "draft");
    await SpeakingCreateService.settle(page);

    expect(api.posts).toHaveLength(1);
    expect(post.payload.active).toBe(false);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.active).toBeFalsy();
    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await listPage.search.fill(index);
    await expect(listPage.statusLabel(listPage.row(record.q_id))).toHaveText(
      data.statusLabels.draft,
    );
  });

  test("RS accepts WAV and AAC audio (AP-807-TC-207)", async ({ page }) => {
    // F-19 (new, seen on stage): FileUploadRequest sniffs an ADTS .aac as audio/x-hx-aac-adts,
    // which is not in its allow-list, so AAC is refused although its own message lists aac.
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await form.createAnother.check();

    for (const media of ["speaking-short.wav", "speaking-short.aac"] as const) {
      await test.step(media, async () => {
        await SpeakingCreateService.fill(form, api, "RS", {
          index: qaIndex("RS"),
          media,
          transcript,
        });
        const upload = api.uploads.at(-1);
        expect(upload?.status, `${media} upload`).toBe(201);

        const post = await SpeakingCreateService.submit(form, api);

        expect(post.status, `${media} save`).toBe(201);
        expect(post.payload.file_path).toBe(uploadedUrl(upload));
        await expect(form.indexInput).toHaveValue("");
      });
    }
  });
});
