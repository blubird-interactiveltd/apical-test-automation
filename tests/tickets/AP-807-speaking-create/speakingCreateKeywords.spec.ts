import { expect, test } from "@playwright/test";
import { SpeakingCreateService } from "../../../services/speaking/speakingCreate.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import { minimalPayload, qaIndex } from "../../../utils/speakingCreate";
import {
  createType,
  speakingCreateData,
} from "../../../utils/speakingTestData";

const data = speakingCreateData();
const cases = data.keywordCases;

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

test.describe("AP-807 speaking create — [bracket] keyword sync", () => {
  test("a bracketed word becomes a keyword (AP-807-TC-050)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await form.setRichText("title", cases.single.text);

    await expect(form.keywordBox).toHaveValue(cases.single.expected ?? "");
  });

  test("a multi-word bracket is one keyword (AP-807-TC-051)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await form.setRichText("title", cases.multiWord.text);

    await expect(form.keywordBox).toHaveValue(
      new RegExp(cases.multiWord.contains ?? ""),
    );
  });

  test("special characters inside brackets are stripped (AP-807-TC-052)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await form.setRichText("title", cases.specialCharacters.text);

    await expect(form.keywordBox).toHaveValue(
      cases.specialCharacters.expected ?? "",
    );
  });

  test("a repeated bracket is added once (AP-807-TC-053)", async ({ page }) => {
    const { form } = await SpeakingCreateService.open(page);

    await form.setRichText("title", cases.duplicates.text);

    await expect(form.keywordBox).toHaveValue(cases.duplicates.expected ?? "");
  });

  test("manually typed keywords are kept (AP-807-TC-054)", async ({ page }) => {
    const { form } = await SpeakingCreateService.open(page);

    await form.setKeywords(cases.manualKept.manual ?? "");
    await form.setRichText("title", cases.manualKept.text);

    await expect(form.keywordBox).toHaveValue(cases.manualKept.expected ?? "");
  });

  test("[[double]] brackets are not keywords (AP-807-TC-055)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await form.setRichText("title", cases.doubleBrackets.text);

    await expect(form.keywordBox).toHaveValue(
      cases.doubleBrackets.expected ?? "",
    );
  });

  test("removing a keyword un-brackets it in the text (AP-807-TC-056)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);
    await form.setRichText("title", cases.removeKeyword.text);
    await expect(form.keywordBox).toHaveValue(cases.removeKeyword.synced ?? "");

    await form.setKeywords(cases.removeKeyword.after ?? "");

    await expect
      .poll(() => form.richText("title"))
      .toContain(cases.removeKeyword.expectedText ?? "");
  });

  test("removing brackets from the text keeps the keyword (AP-807-TC-057)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);
    await form.setRichText("title", cases.removeBrackets.text);
    await expect(form.keywordBox).toHaveValue(
      cases.removeBrackets.expected ?? "",
    );

    await form.setRichText("title", cases.removeBrackets.edited ?? "");

    // Current behaviour: the sync only ever adds in this direction.
    await expect(form.keywordBox).toHaveValue(
      cases.removeBrackets.expected ?? "",
    );
  });

  test("keywords are saved as the form built them, brackets kept for edit (AP-807-TC-058)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await form.setKeywords(cases.savedVerbatim.manual ?? "");
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      media: "speaking-short.mp3",
      transcript: cases.savedVerbatim.text,
    });
    await expect(form.keywordBox).toHaveValue(
      cases.savedVerbatim.expected ?? "",
    );

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload.keywords).toBe(cases.savedVerbatim.expected);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.keywords).toBe(cases.savedVerbatim.expected);
    expect(record.transcript).toContain("[a]");
  });

  test("the display read strips the brackets (AP-807-TC-059)", async ({
    request,
  }) => {
    // The question TC-058 builds, created through the API: this case is about
    // the read, not the form.
    const api = await SpeakingQuestionApi.as(request);
    const id = await api.createOk(
      minimalPayload(createType("RS"), qaIndex("RS"), {
        transcript: cases.savedVerbatim.text,
        keywords: cases.savedVerbatim.expected ?? "",
      }),
    );

    const record = await api.get(id);

    expect(record.transcript ?? "").not.toMatch(/[[\]]/);
  });

  test("the Keyword info icon explains the semicolons (AP-807-TC-060)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await form.keywordInfoIcon.hover();

    await expect(form.tooltip).toHaveText(data.messages.keywordHint);
  });
});
