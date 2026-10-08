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
const di = createType("DI");
const keywords = data.content.DI.keywords ?? "";

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

test.describe("AP-807 speaking create — Describe Image", () => {
  test("DI shows the image uploader and Keyword only (AP-807-TC-301)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "DI" });

    await expect(form.fileInput("image")).toHaveCount(1);
    await expect(form.keywordBox).toBeVisible();
    await expect(form.sectionHeading("transcript")).toHaveCount(0);
    await expect(form.sectionHeading("title")).toHaveCount(0);
    await expect(form.sampleAnswerButton).toBeVisible();
  });

  test("DI with every field is sent as an image (AP-807-TC-302)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });
    await SpeakingCreateService.fill(form, api, "DI", {
      index: qaIndex("DI"),
      media: "describe-image.png",
      keywords,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload).toMatchObject({
      file_path: uploadedUrl(api.uploads[0]),
      file_type: "image",
      keywords,
    });
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record).toMatchObject({
      file_type: "image",
      file_path: post.payload.file_path,
      keywords,
    });
  });

  test("DI cannot be published without an image (AP-807-TC-303)", async ({
    page,
  }) => {
    // F-01: DescribeImage.vue's `file_path: { required }` never runs
    // (CreateView.vue:406-411), and the API requires file_path only for RL.
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });
    await form.fillIndex(qaIndex("DI"));

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.imageRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("a DI made in the form is stored as file_type image (AP-807-TC-304)", async ({
    page,
    request,
  }) => {
    // Regression guard for F-07 (7 stage DIs stored as audio): the form must send image.
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });
    await SpeakingCreateService.fill(form, api, "DI", {
      index: qaIndex("DI"),
      media: "describe-image.png",
      keywords,
    });

    const post = await SpeakingCreateService.submit(form, api);

    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.file_type).toBe("image");
  });

  test("DI keywords are not synced from anywhere (AP-807-TC-305)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "DI" });
    const literal = data.content.DI.literalKeyword ?? "";

    await form.setKeywords(literal);

    await expect(form.keywordBox).toHaveValue(literal);
    await expect(form.form.locator(".ck-editor__editable")).toHaveCount(0);
  });

  test("JPEG, GIF and WEBP images upload and preview (AP-807-TC-306)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });

    for (const media of [
      "describe-image.jpg",
      "describe-image.gif",
      "describe-image.webp",
    ] as const) {
      await test.step(media, async () => {
        const upload = await SpeakingCreateService.upload(
          form,
          api,
          "image",
          media,
        );

        expect(upload.status, media).toBe(201);
        await expect(form.imagePreview).toBeVisible();
      });
    }
  });

  test("a DI sample answer from the archive is attached (AP-807-TC-307)", async ({
    page,
    request,
  }) => {
    const client = await SpeakingQuestionApi.as(request);
    const archived = (await client.sampleAnswers(di.id))[0];
    test.skip(
      !archived,
      "Stage has no Describe Image sample answer in the archive.",
    );
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });
    await SpeakingCreateService.fill(form, api, "DI", {
      index: qaIndex("DI"),
      media: "describe-image.png",
      keywords,
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

  test("DI's total answer time is the fixed 66 s (AP-807-TC-308)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });
    await SpeakingCreateService.fill(form, api, "DI", {
      index: qaIndex("DI"),
      media: "describe-image.png",
      keywords,
    });

    const post = await SpeakingCreateService.submit(form, api);

    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(Number(record.total_answer_time)).toBe(
      expectedTotalAnswerTime(di.timing),
    );
  });
});
