import { expect, test } from "@playwright/test";
import { SnackbarComponent } from "../../../pages/shared/snackbar.component";
import {
  SpeakingCreateService,
  WRITE_TIMEOUT_MS,
} from "../../../services/speaking/speakingCreate.service";
import { uploadedUrl } from "../../../services/speaking/speakingCreateApiMock.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import { anyOf, qaIndex } from "../../../utils/speakingCreate";
import { mediaFile, placeholderFile } from "../../../utils/speakingMedia";
import {
  speakingCreateData,
  speakingCreateEdgeData,
} from "../../../utils/speakingTestData";

const data = speakingCreateData();
const edge = speakingCreateEdgeData();

/**
 * The rejection a picker shows for a file of the wrong type. A PDF is not an
 * audio, image or video mime at all, so `FileUploadRequest` (lines 40-62)
 * answers it with the generic "Unsupported file type." rather than the
 * per-kind message; either tells the user the file was refused.
 */
const wrongType = (kind: "audio" | "image") =>
  anyOf(edge.invalidType[kind], edge.invalidType.generic);

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

test.describe("AP-807 speaking create — media upload", () => {
  test("an audio upload sends the file as question_audio (AP-807-TC-070)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });

    const upload = await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      "speaking-short.mp3",
    );

    expect(upload).toMatchObject({
      type: data.upload.audioType,
      fileName: "speaking-short.mp3",
      status: 201,
    });
    expect(upload.body.message).toBe("Uploaded successfully.");
    await expect(form.audioDuration).toHaveText("00:05");
  });

  test("the uploaded URL is sent as file_path (AP-807-TC-071)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    const upload = await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      "speaking-short.mp3",
    );
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      transcript: data.content.RS.transcript ?? "",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload.file_path).toBe(uploadedUrl(upload));
    expect(post.payload.file_path).toMatch(
      new RegExp(data.upload.audioUrlPattern),
    );
  });

  test("the audio picker takes audio files and offers no recording (AP-807-TC-072)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "RS" });

    await expect(form.fileInput("audio")).toHaveAttribute(
      "accept",
      data.upload.accept.audio,
    );
    await expect(form.recordTab).toHaveCount(0);
    await expect(form.form.locator(".mic-container")).toHaveCount(0);
  });

  test("a non-audio file is refused and leaves no file (AP-807-TC-073)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });

    const upload = await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      "invalid.pdf",
    );

    expect(upload.status).toBe(422);
    await expect(page.getByText(wrongType("audio")).first()).toBeVisible();
    await expect(form.audioPlayer).toBeHidden();
  });

  test("an audio over 100 MB is refused (AP-807-TC-074)", async ({ page }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
      uploads: { reply: edge.bigAudio },
    });

    await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      placeholderFile(edge.bigAudio.fileName, edge.bigAudio.mimeType),
    );

    await expect(
      new SnackbarComponent(page).message(String(edge.bigAudio.body?.message)),
    ).toBeVisible();
    await expect(form.audioPlayer).toBeHidden();
  });

  test("choosing a second audio replaces the first (AP-807-TC-075)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      "speaking-short.mp3",
    );

    const second = await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      "speaking-short-2.mp3",
    );
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      transcript: data.content.RS.transcript ?? "",
    });
    const post = await SpeakingCreateService.submit(form, api);

    expect(api.uploads).toHaveLength(2);
    expect(post.payload.file_path).toBe(uploadedUrl(second));
  });

  test("an image upload shows its preview (AP-807-TC-076)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });

    const upload = await SpeakingCreateService.upload(
      form,
      api,
      "image",
      "describe-image.png",
    );

    expect(upload.status).toBe(201);
    expect(upload.type).toBe(data.upload.imageType);
    await expect(form.imagePreview).toBeVisible();
  });

  test("a non-image file is refused with no preview (AP-807-TC-077)", async ({
    page,
  }) => {
    // F-21 (new, seen on stage): the global 422 handler shows "File: Unsupported file type."
    // (validation/backendMessages.js:63), then the uploader's own catch replaces it with
    // data.message, "The given data was invalid." (ImageUploader.vue:111-114, VideoRecordAndUploader.vue:235-238).
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });

    const upload = await SpeakingCreateService.upload(
      form,
      api,
      "image",
      "invalid.pdf",
    );

    expect(upload.status).toBe(422);
    await expect(
      new SnackbarComponent(page).message(wrongType("image")),
    ).toBeVisible();
    await expect(form.imagePreview).toBeHidden();
  });

  test("an image over 10 MB is refused (AP-807-TC-078)", async ({ page }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
      uploads: { reply: edge.bigImage },
    });

    await SpeakingCreateService.upload(
      form,
      api,
      "image",
      placeholderFile(edge.bigImage.fileName, edge.bigImage.mimeType),
    );

    await expect(
      new SnackbarComponent(page).message(String(edge.bigImage.body?.message)),
    ).toBeVisible();
  });

  test("a video upload on the RL Video tab shows its preview (AP-807-TC-079)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
    });
    await form.videoTab.click();

    const upload = await SpeakingCreateService.upload(
      form,
      api,
      "video",
      "speaking-lecture.mp4",
    );

    expect(upload.status).toBe(201);
    await expect(form.videoPreview).toBeVisible();
  });

  test("Publish during an upload never saves an empty or blob file_path (AP-807-TC-080)", async ({
    page,
  }) => {
    // F-01: Publish does not wait for the upload, and RS has no file_path rule
    // in the UI (RepeatSentence.vue: rules only list transcript; the rule is
    // never run anyway, CreateView.vue:406-411) or the API, so the question
    // is saved with file_path "" while the upload is still running.
    test.fail();
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
      uploads: { delayMs: edge.slowUploadMs },
    });
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      transcript: data.content.RS.transcript ?? "",
    });

    await form
      .fileInput("audio")
      .setInputFiles(mediaFile("speaking-short.mp3"));
    await form.publishButton.click();
    await api.upload(1, WRITE_TIMEOUT_MS);
    await SpeakingCreateService.settle(page);

    for (const post of api.posts) {
      expect(post.payload.file_path ?? "").toMatch(
        new RegExp(data.upload.httpsUrlPattern),
      );
    }
  });

  test("an upload refused for permission shows the server message (AP-807-TC-081)", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
      uploads: { reply: edge.uploadForbidden },
    });

    await SpeakingCreateService.upload(
      form,
      api,
      "audio",
      "speaking-short.mp3",
    );

    await expect(
      new SnackbarComponent(page).message(
        String(edge.uploadForbidden.body?.message),
      ),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
