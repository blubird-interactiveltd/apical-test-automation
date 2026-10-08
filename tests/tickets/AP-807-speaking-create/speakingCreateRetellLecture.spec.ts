import { expect, test } from "@playwright/test";
import { activeDialog } from "../../../pages/shared/dialog.component";
import { SnackbarComponent } from "../../../pages/shared/snackbar.component";
import { SPEAKING_LIST_PATHS } from "../../../pages/speaking/speakingList.page";
import { SpeakingCreateService } from "../../../services/speaking/speakingCreate.service";
import {
  fieldErrors,
  uploadedUrl,
} from "../../../services/speaking/speakingCreateApiMock.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import {
  anyOf,
  expectedTotalAnswerTime,
  qaIndex,
} from "../../../utils/speakingCreate";
import {
  createType,
  speakingCreateData,
  speakingCreateEdgeData,
} from "../../../utils/speakingTestData";

const data = speakingCreateData();
const edge = speakingCreateEdgeData();
const rl = createType("RL");
const transcript = data.content.RL.transcript ?? "";

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

test.describe("AP-807 speaking create — Retell Lecture", () => {
  test("RL shows Media Content with Audio and Video tabs, then Transcript and Keyword (AP-807-TC-401)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "RL" });

    await expect(form.mediaCard).toBeVisible();
    await expect(form.audioTab).toHaveAttribute("aria-selected", "true");
    await expect(form.videoTab).toBeVisible();
    await expect(form.sectionHeading("transcript")).toBeVisible();
    await expect(form.keywordBox).toBeVisible();
  });

  test("RL with an audio lecture is sent and stored as audio (AP-807-TC-402)", async ({
    page,
    request,
  }) => {
    // Regression guard for #815.
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await SpeakingCreateService.fill(form, api, "RL", {
      index: qaIndex("RL"),
      media: "speaking-lecture.mp3",
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload).toMatchObject({
      file_path: uploadedUrl(api.uploads[0]),
      file_type: "audio",
      transcript,
      keywords: data.content.RL.keywords,
    });
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record).toMatchObject({
      file_type: "audio",
      file_path: post.payload.file_path,
      transcript,
      keywords: data.content.RL.keywords,
    });
  });

  test("RL with a video lecture is stored as video and plays as video (AP-807-TC-403)", async ({
    page,
    request,
  }) => {
    const { form, api, listPage } = await SpeakingCreateService.open(page, {
      liveList: true,
      type: "RL",
    });
    const index = qaIndex("RL");
    await SpeakingCreateService.fill(form, api, "RL", {
      index,
      media: "speaking-lecture.mp4",
      mediaTab: "video",
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload.file_type).toBe("video");
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.file_type).toBe("video");
    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await listPage.search.fill(index);
    await listPage.action(listPage.row(record.q_id), "details").click();
    await expect(activeDialog(page).locator("video")).toHaveCount(1);
  });

  test("RL without media is refused by the server, visibly (AP-807-TC-404)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await SpeakingCreateService.fill(form, api, "RL", {
      index: qaIndex("RL"),
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(422);
    expect(fieldErrors(post).file_path).toContain(
      data.messages.filePathRequired,
    );
    await expect(page.getByText(data.messages.filePathRequired)).toBeVisible();
  });

  test("RL cannot be published without a transcript (AP-807-TC-405)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await SpeakingCreateService.fill(form, api, "RL", {
      index: qaIndex("RL"),
      media: "speaking-lecture.mp3",
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.transcriptRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("switching from audio to video keeps only the video (AP-807-TC-406)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await SpeakingCreateService.fill(form, api, "RL", {
      index: qaIndex("RL"),
      media: "speaking-lecture.mp3",
      transcript,
    });

    await form.videoTab.click();
    const video = await SpeakingCreateService.upload(
      form,
      api,
      "video",
      "speaking-lecture.mp4",
    );
    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload).toMatchObject({
      file_type: "video",
      file_path: uploadedUrl(video),
    });
  });

  test("switching from video to audio keeps only the audio (AP-807-TC-407)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await SpeakingCreateService.fill(form, api, "RL", {
      index: qaIndex("RL"),
      media: "speaking-lecture.mp4",
      mediaTab: "video",
      transcript,
    });

    await form.audioTab.click();
    const audio = await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      "speaking-lecture.mp3",
    );
    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload).toMatchObject({
      file_type: "audio",
      file_path: uploadedUrl(audio),
    });
  });

  test("a non-video file on the Video tab is refused (AP-807-TC-408)", async ({
    page,
  }) => {
    // Regression guard for #820.
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await form.videoTab.click();

    const upload = await SpeakingCreateService.upload(
      form,
      api,
      "video",
      "invalid.pdf",
    );

    expect(upload.status).toBe(422);
    // A PDF is not a video mime, so FileUploadRequest may answer with the generic message.
    await expect(
      new SnackbarComponent(page).message(
        anyOf(edge.invalidType.video, edge.invalidType.generic),
      ),
    ).toBeVisible();
  });

  test("RL's total answer time adds the lecture length (AP-807-TC-409)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await SpeakingCreateService.fill(form, api, "RL", {
      index: qaIndex("RL"),
      media: "speaking-lecture.mp3",
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
    expect(total).toBeGreaterThan(50);
    expect(
      Math.abs(
        total -
          expectedTotalAnswerTime(
            rl.timing,
            data.mediaSeconds["speaking-lecture.mp3"] ?? 0,
          ),
      ),
    ).toBeLessThanOrEqual(1);
  });
});
