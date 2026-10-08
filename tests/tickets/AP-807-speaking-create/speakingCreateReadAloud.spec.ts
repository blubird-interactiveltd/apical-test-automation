import { expect, test } from "@playwright/test";
import { activeDialog } from "../../../pages/shared/dialog.component";
import { SPEAKING_LIST_PATHS } from "../../../pages/speaking/speakingList.page";
import { SpeakingCreateService } from "../../../services/speaking/speakingCreate.service";
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
  speakingCreateEdgeData,
} from "../../../utils/speakingTestData";

const data = speakingCreateData();
const edge = speakingCreateEdgeData();
const ra = createType("RA");

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

test.describe("AP-807 speaking create — Read Aloud", () => {
  test("RA shows Title and Keyword, and no media (AP-807-TC-101)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await expect(form.sectionHeading("title")).toBeVisible();
    await expect(form.editor("title")).toBeVisible();
    await expect(form.bracketHints).toHaveText([data.messages.bracketHint]);
    await expect(form.keywordBox).toBeVisible();
    await expect(form.sectionHeading("transcript")).toHaveCount(0);
    await expect(form.fileInputs).toHaveCount(0);
  });

  test("RA with every field is sent and stored as typed (AP-807-TC-102)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      sourceLabel: "Practice",
      frequencyLabel: "High",
      title: data.content.RA.title ?? "",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload.title).toContain("<strong>[Domestication]</strong>");
    expect(post.payload.keywords).toBe(data.content.RA.keywords);
    expect(post.payload).not.toHaveProperty("file_path");
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.title).toBe(post.payload.title);
    expect(record.keywords).toBe(data.content.RA.keywords);
  });

  test("RA cannot be published without a title (AP-807-TC-103)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await form.fillIndex(qaIndex("RA"));

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.titleRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("RA cannot be published with a title of spaces only (AP-807-TC-104)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: edge.whitespaceTitle,
    });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    await expect(form.message(data.messages.titleRequired)).toBeVisible();
    expect(api.posts).toEqual([]);
  });

  test("bold, italic and line breaks render in the details dialog (AP-807-TC-105)", async ({
    page,
    request,
  }) => {
    // Regression guard for #818.
    const { form, api, listPage } = await SpeakingCreateService.open(page, {
      liveList: true,
    });
    const index = qaIndex("RA");
    await SpeakingCreateService.fill(form, api, "RA", {
      index,
      title: edge.richTitle.html,
    });
    const post = await SpeakingCreateService.submit(form, api);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");

    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await listPage.search.fill(index);
    await listPage.action(listPage.row(record.q_id), "details").click();
    const dialog = activeDialog(page);

    await expect(
      dialog.locator("strong, b", { hasText: edge.richTitle.bold }),
    ).toBeVisible();
    await expect(
      dialog.locator("i, em", { hasText: edge.richTitle.italic }),
    ).toBeVisible();
    await expect(dialog).not.toContainText("<strong>");
  });

  test("a long passage is saved whole (AP-807-TC-106)", async ({
    page,
    request,
  }) => {
    const passage = `<p>${"Domestication shaped many species over time. ".repeat(40).slice(0, data.longTitleLength).trim()}</p>`;
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: passage,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.title).toBe(post.payload.title);
    expect((record.title ?? "").length).toBeGreaterThanOrEqual(
      data.longTitleLength,
    );
  });

  test("RA needs no keyword (AP-807-TC-107)", async ({ page, request }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: `<p>${data.content.RA.plainTitle}</p>`,
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.keywords ?? "").toBe("");
  });

  test("a sample answer from the archive is attached (AP-807-TC-108)", async ({
    page,
    request,
  }) => {
    const client = await SpeakingQuestionApi.as(request);
    const archived = (await client.sampleAnswers(ra.id))[0];
    test.skip(
      !archived,
      "Stage has no Read Aloud sample answer in the archive.",
    );
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: data.content.RA.title ?? "",
    });

    await SpeakingCreateService.attachFromArchive(page, form);
    const post = await SpeakingCreateService.submit(form, api);

    const id = archived?.sample_answer_id ?? "";
    expect(post.payload.sample_answers).toEqual({
      [id]: { is_default: true, selected_from_archive: true },
    });
    const record = await client.get(String(post.body.question_id), "edit");
    expect(JSON.stringify(record.sample_answers)).toContain(id);
  });

  test("RA's total answer time is the fixed 81 s (AP-807-TC-109)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: data.content.RA.title ?? "",
    });

    const post = await SpeakingCreateService.submit(form, api);

    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(Number(record.total_answer_time)).toBe(
      expectedTotalAnswerTime(ra.timing),
    );
  });
});
