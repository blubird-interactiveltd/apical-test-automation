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
const sgd = createType("SGD");
const transcript = data.content.SGD.transcript ?? "";

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

test.describe("AP-807 speaking create — Summarize Group Discussion", () => {
  test("SGD shows the Group Discussion card, Transcript and Keyword (AP-807-TC-601)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "SGD" });

    await expect(form.groupDiscussionTitle).toBeVisible();
    await expect(form.groupDiscussionIcon).toBeVisible();
    await expect(form.groupDiscussionImage).toHaveCount(1);
    await expect(form.groupDiscussionCaption).toBeVisible();
    await expect(form.fileInput("audio")).toHaveCount(1);
    await expect(form.sectionHeading("transcript")).toBeVisible();
    await expect(form.keywordBox).toBeVisible();
    await expect(form.sampleAnswerButton).toBeVisible();
  });

  test("SGD with every field is sent and stored (AP-807-TC-602)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "SGD",
    });
    await SpeakingCreateService.fill(form, api, "SGD", {
      index: qaIndex("SGD"),
      media: "speaking-lecture.mp3",
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload).toMatchObject({
      file_path: uploadedUrl(api.uploads[0]),
      transcript,
      keywords: data.content.SGD.keywords,
    });
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record).toMatchObject({
      file_path: post.payload.file_path,
      transcript,
      keywords: data.content.SGD.keywords,
    });
  });

  test("SGD cannot be published without a transcript (AP-807-TC-603)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "SGD",
    });
    await SpeakingCreateService.fill(form, api, "SGD", {
      index: qaIndex("SGD"),
      media: "speaking-lecture.mp3",
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.transcriptRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("SGD cannot be published without audio (AP-807-TC-604)", async ({
    page,
  }) => {
    // Regression guard for #813.
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "SGD",
    });
    await SpeakingCreateService.fill(form, api, "SGD", {
      index: qaIndex("SGD"),
      transcript,
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    expect(api.posts.filter((post) => post.status === 201)).toEqual([]);
  });

  test("a three-minute discussion is saved and timed (AP-807-TC-605)", async ({
    page,
    request,
  }) => {
    // Regression guard for #812.
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "SGD",
    });
    await SpeakingCreateService.fill(form, api, "SGD", {
      index: qaIndex("SGD"),
      media: "speaking-discussion.mp3",
      transcript,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
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
            sgd.timing,
            data.mediaSeconds["speaking-discussion.mp3"] ?? 0,
          ),
      ),
    ).toBeLessThanOrEqual(1);
  });

  test("the form has no input for an additional file (AP-807-TC-606)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "SGD" });

    // Only the discussion audio; additional_file_path comes from bulk import alone.
    await expect(form.fileInputs).toHaveCount(1);
    await expect(form.fileInput("audio")).toHaveCount(1);
  });

  test("an SGD sample answer from the archive is attached (AP-807-TC-607)", async ({
    page,
    request,
  }) => {
    const client = await SpeakingQuestionApi.as(request);
    const archived = (await client.sampleAnswers(sgd.id))[0];
    test.skip(
      !archived,
      "Stage has no Summarize Group Discussion sample answer in the archive.",
    );
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "SGD",
    });
    await SpeakingCreateService.fill(form, api, "SGD", {
      index: qaIndex("SGD"),
      media: "speaking-short.mp3",
      transcript,
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
