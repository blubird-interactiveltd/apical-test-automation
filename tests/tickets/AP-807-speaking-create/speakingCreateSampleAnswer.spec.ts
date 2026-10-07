import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { SampleAnswerDialog } from "../../../pages/speaking/sampleAnswerDialog.component";
import {
  SpeakingCreateService,
  WRITE_TIMEOUT_MS,
} from "../../../services/speaking/speakingCreate.service";
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

const data = speakingCreateData();
const edge = speakingCreateEdgeData();
const labels = data.sampleAnswerDialog;

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

test.describe("AP-807 speaking create — sample-answer dialog", () => {
  test("the dialog opens on Create New, labelled SPEAKING (AP-807-TC-800)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);
    const dialog = new SampleAnswerDialog(page);

    await form.sampleAnswerButton.click();

    await expect(dialog.heading).toContainText(labels.heading);
    await expect(dialog.sectionChip).toHaveText(labels.chip);
    await expect(dialog.createNewRadio).toBeChecked();
    await expect(dialog.archiveRadio).not.toBeChecked();
  });

  test("the archive lists only the chosen type's sample answers (AP-807-TC-801)", async ({
    page,
  }) => {
    const di = createType("DI");
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "DI",
    });
    await api.recordSampleAnswerLists();
    const dialog = new SampleAnswerDialog(page);

    await form.sampleAnswerButton.click();
    await dialog.archiveRadio.check();

    await expect
      .poll(() =>
        api.sampleAnswerListUrls.at(-1)?.searchParams.get("question_type_id"),
      )
      .toBe(di.id);
    for (const item of await dialog.archiveItems.all()) {
      await expect(dialog.itemType(item)).toHaveText(di.title);
    }
  });

  test("a new sample answer is attached on Save & SET (AP-807-TC-802)", async ({
    page,
  }) => {
    // "Save & SET" and the question create are stubbed: the case is about the
    // payload the form builds, and a real save would leave a sample answer on
    // stage that nothing deletes.
    const stub = edge.stubbedSampleAnswer;
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RL",
      postReply: {
        status: 201,
        body: { question_id: stub.questionId, message: data.messages.saved },
      },
    });
    await api.sampleAnswerSave(stub.id, stub.fileUrl);
    await SpeakingCreateService.fill(form, api, "RL", {
      index: qaIndex("RL"),
      media: "speaking-short.mp3",
      transcript: data.content.RL.transcript ?? "",
    });
    const dialog = new SampleAnswerDialog(page);

    await form.sampleAnswerButton.click();
    await dialog.maleVoiceInput.setInputFiles(mediaFile("speaking-short.mp3"));
    await api.upload(2, WRITE_TIMEOUT_MS);
    await dialog.femaleVoiceInput.setInputFiles(
      mediaFile("speaking-short-2.mp3"),
    );
    await api.upload(3, WRITE_TIMEOUT_MS);
    await dialog.saveAndSetButton.click();
    await expect(dialog.heading).toBeHidden();
    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload.sample_answers).toEqual({
      [stub.id]: { is_default: true, selected_from_archive: false },
    });
  });

  test("closing the dialog attaches nothing (AP-807-TC-803)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: data.content.RA.title ?? "",
    });
    const dialog = new SampleAnswerDialog(page);

    await form.sampleAnswerButton.click();
    await expect(dialog.heading).toBeVisible();
    await dialog.closeButton.click();
    await expect(dialog.heading).toBeHidden();
    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload).not.toHaveProperty("sample_answers");
  });

  test("the API rejects a sample answer id that does not exist (AP-807-TC-804)", async ({
    request,
  }) => {
    const api = await SpeakingQuestionApi.as(request);
    const unknown = randomUUID();

    const response = await api.create(
      minimalPayload(createType("RA"), qaIndex("RA"), {
        title: data.content.RA.plainTitle ?? "",
        sample_answers: {
          [unknown]: { is_default: true, selected_from_archive: true },
        },
      }),
    );

    expect(response.status()).toBe(422);
    const body = (await response.json()) as {
      errors?: Record<string, string[]>;
    };
    expect(body.errors?.sample_answers).toContain(
      `${data.messages.invalidSampleAnswer}${unknown}`,
    );
  });
});
