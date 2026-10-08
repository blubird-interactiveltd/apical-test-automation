import { expect, test } from "@playwright/test";
import {
  PTE_QUESTION_PATHS,
  SPEAKING_LIST_PATHS,
} from "../../../pages/speaking/speakingList.page";
import type { SpeakingCreatePage } from "../../../pages/speaking/speakingCreate.page";
import {
  type QuestionContent,
  SpeakingCreateService,
} from "../../../services/speaking/speakingCreate.service";
import {
  fieldErrors,
  type SpeakingCreateApiMock,
} from "../../../services/speaking/speakingCreateApiMock.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import {
  minimalPayload,
  QA_INDEX_PREFIX,
  qaIndex,
  qaIndexOfLength,
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

/** A valid Read Aloud: a unique index and the data file's title, plus `content`. */
async function fillRa(
  form: SpeakingCreatePage,
  api: SpeakingCreateApiMock,
  content: QuestionContent = {},
): Promise<void> {
  await SpeakingCreateService.fill(form, api, "RA", {
    index: qaIndex("RA"),
    title: data.content.RA.title ?? "",
    ...content,
  });
}

/** An existing index on stage that this suite did not create. */
async function existingIndex(
  api: SpeakingQuestionApi,
  section: string,
  query: Record<string, string> = {},
): Promise<string> {
  const found = (await api.list(section, query)).find(
    (item) => !item.index.startsWith(QA_INDEX_PREFIX),
  );

  if (!found) {
    throw new Error(
      `Stage has no ${section} question to borrow an index from.`,
    );
  }

  return found.index;
}

test.describe("AP-807 speaking create — common fields", () => {
  test("Index, Source, Frequency and Create another start at their defaults (AP-807-TC-020)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await expect(form.indexInput).toHaveValue("");
    expect(await form.selectedLabel(form.sourceSelect)).toBe(
      data.defaults.sourceLabel,
    );
    expect(await form.selectedLabel(form.frequencySelect)).toBe(
      data.defaults.frequencyLabel,
    );
    await expect(form.createAnother).not.toBeChecked();
  });

  test("Source offers Exam Question and Practice (AP-807-TC-021)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    expect(await form.optionLabels(form.sourceSelect)).toEqual(
      data.sourceOptions.map((option) => option.label),
    );
  });

  test("Frequency offers High, Moderate and low (AP-807-TC-022)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    expect(await form.optionLabels(form.frequencySelect)).toEqual(
      data.frequencyOptions.map((option) => option.label),
    );
  });

  test("Publish with no index shows the required message and sends nothing (AP-807-TC-023)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api, { index: "" });

    await form.publishButton.click();

    await expect(form.indexError).toHaveText(data.messages.indexRequired);
    await SpeakingCreateService.settle(page);
    expect(api.posts).toEqual([]);
  });

  test("an index of spaces only is refused (AP-807-TC-024)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api, { index: edge.whitespaceIndex });

    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    // Refused by the UI (Vuelidate trims) or by the API (422 on index) — never created.
    if (api.posts.length === 0) {
      await expect(form.indexError).toHaveText(data.messages.indexRequired);
    } else {
      expect(api.posts[0]?.status).toBe(422);
      expect(fieldErrors(api.posts[0]).index).toBeDefined();
    }
    expect(api.posts.filter((post) => post.status === 201)).toEqual([]);
  });

  test("a Read Aloud index already on stage is refused with 422 (AP-807-TC-025)", async ({
    page,
    request,
  }) => {
    const taken = await existingIndex(
      await SpeakingQuestionApi.as(request),
      "speaking",
      { question_type_id: ra.id },
    );
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api, { index: taken });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(422);
    await expect(form.indexError).toHaveText(data.messages.indexTaken);
    await expect(form.indexError).toBeInViewport();
    await expect(form.indexInput).toHaveValue(taken);
    expect(await form.richText("title")).toContain("[Domestication]");
  });

  test("an index used by another section is refused too (AP-807-TC-026)", async ({
    page,
    request,
  }) => {
    const taken = await existingIndex(
      await SpeakingQuestionApi.as(request),
      data.otherSections[0] ?? "reading",
    );
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    // RS requires audio (#813), so the save reaches the server's index check.
    await SpeakingCreateService.fill(form, api, "RS", {
      index: taken,
      media: "speaking-short.mp3",
      transcript: data.content.RS.transcript ?? "",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(422);
    await expect(form.indexError).toHaveText(data.messages.indexTaken);
  });

  test("typing in Index clears the server error (AP-807-TC-027)", async ({
    page,
    request,
  }) => {
    const taken = await existingIndex(
      await SpeakingQuestionApi.as(request),
      "speaking",
      { question_type_id: ra.id },
    );
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api, { index: taken });
    await SpeakingCreateService.submit(form, api);
    await expect(form.indexError).toHaveText(data.messages.indexTaken);

    await form.indexInput.press("End");
    await form.indexInput.pressSequentially("x");

    await expect(form.indexError).toBeHidden();
  });

  test("Index accepts 255 characters and refuses 256 (AP-807-TC-028)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    const tooLong = qaIndexOfLength("RA", edge.maxIndexLength + 1);
    await fillRa(form, api, { index: tooLong });

    const refused = await SpeakingCreateService.submit(form, api);
    expect(refused.status).toBe(422);
    expect(fieldErrors(refused).index).toBeDefined();
    await expect(form.indexError).toBeVisible();

    const longest = qaIndexOfLength("RA", edge.maxIndexLength);
    await form.fillIndex(longest);
    const saved = await SpeakingCreateService.submit(form, api);

    expect(saved.status).toBe(201);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(saved.body.question_id), "edit");
    expect(record.index).toBe(longest);
  });

  test("Index keeps unicode and symbols (AP-807-TC-029)", async ({
    page,
    request,
  }) => {
    const index = `${qaIndex("RA")}${edge.unicodeIndexSuffix}`;
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api, { index });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.index).toBe(index);
  });

  test("Source cannot be emptied, so it is always sent (AP-807-TC-030)", async ({
    page,
  }) => {
    // The case clears Source "if clearable". SelectComponent renders its
    // placeholder as a disabled option, so a user cannot pick an empty Source
    // and "Field is required" cannot be reached from the UI. Assert the guard.
    const { form } = await SpeakingCreateService.open(page);
    const placeholder = form.sourceSelect.locator("option[disabled]");

    await expect(placeholder).toHaveCount(1);
    await expect(placeholder).toBeDisabled();
    await expect(form.sourceError).toHaveCount(0);
  });

  test("Practice and High are sent, stored and shown green on the list (AP-807-TC-031)", async ({
    page,
    request,
  }) => {
    const { form, api, listPage } = await SpeakingCreateService.open(page, {
      liveList: true,
    });
    const index = qaIndex("RA");
    await fillRa(form, api, {
      index,
      sourceLabel: "Practice",
      frequencyLabel: "High",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload).toMatchObject({
      source: "PRACTICE",
      frequency: "HIGH",
    });
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record).toMatchObject({ source: "PRACTICE", frequency: "HIGH" });

    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await listPage.search.fill(index);
    const row = listPage.row(record.q_id);
    await expect(row).toHaveCount(1);
    expect(await listPage.frequencyIconClasses(row)).toContain(
      data.frequencyColour.HIGH,
    );
  });

  test("Frequency low is sent as LOW and shown grey (AP-807-TC-032)", async ({
    page,
    request,
  }) => {
    const { form, api, listPage } = await SpeakingCreateService.open(page, {
      liveList: true,
    });
    const index = qaIndex("RA");
    await fillRa(form, api, { index, frequencyLabel: "low" });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload.frequency).toBe("LOW");
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await listPage.search.fill(index);
    expect(
      await listPage.frequencyIconClasses(listPage.row(record.q_id)),
    ).toContain(data.frequencyColour.LOW);
  });

  test("the payload carries the hidden defaults and no empty arrays (AP-807-TC-033)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api);

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload).toMatchObject({
      ...data.hiddenDefaults,
      question_type_id: ra.id,
    });
    expect(typeof post.payload.answer_time).toBe("number");
    expect(typeof post.payload.preparation_time).toBe("number");
    for (const key of data.absentFromPayload) {
      expect(post.payload, `payload key ${key}`).not.toHaveProperty(key);
    }
  });

  test("the server fills the Read Aloud prompt (AP-807-TC-034)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api);

    const post = await SpeakingCreateService.submit(form, api);

    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    expect(record.prompt).toBe(ra.prompt);
  });

  test("q_id is the type acronym plus digits and is unique (AP-807-TC-035)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api);

    const post = await SpeakingCreateService.submit(form, api);

    const client = await SpeakingQuestionApi.as(request);
    const record = await client.get(String(post.body.question_id), "edit");
    expect(record.q_id).toMatch(new RegExp(data.qIdPattern));
    const sameQId = (await client.search(record.q_id)).filter(
      (item) => item.q_id === record.q_id,
    );
    expect(sameQId).toHaveLength(1);
  });

  test("a q_id is not reused after a delete (AP-807-TC-036)", async ({
    request,
  }) => {
    // F-08: QuestionService::prepareInput (lines 45-49) numbers q_id as the
    // count of non-deleted questions + 1, so a delete frees the number the
    // next question was already given.
    test.fail();
    const api = await SpeakingQuestionApi.as(request);
    const body = (index: string) =>
      minimalPayload(ra, index, { title: data.content.RA.plainTitle ?? "" });

    const q1 = await api.createOk(body(qaIndex("RA")));
    const q2 = await api.createOk(body(qaIndex("RA")));
    const q2QId = (await api.get(q2, "edit")).q_id;
    expect((await api.remove(q1)).ok()).toBe(true);
    CreatedQuestions.forget(q1);
    const q3 = await api.createOk(body(qaIndex("RA")));

    expect((await api.get(q3, "edit")).q_id).not.toBe(q2QId);
  });

  test("a new question is approved and credited to the signed-in user (AP-807-TC-037)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api);

    const post = await SpeakingCreateService.submit(form, api);

    const client = await SpeakingQuestionApi.as(request);
    const record = await client.get(String(post.body.question_id), "edit");
    expect(record.approve_status).toBe(data.approveStatus);
    expect(record.created_by).toBe(await client.profileName());
  });

  test("double-clicking Publish creates one question (AP-807-TC-038)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await fillRa(form, api);

    await form.publishButton.dblclick();
    await api.post(1, 90_000);
    await SpeakingCreateService.settle(page);

    expect(api.posts).toHaveLength(1);
    expect(api.posts[0]?.status).toBe(201);
  });

  test("a server error keeps the form and its values (AP-807-TC-039)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      postReply: edge.serverError,
    });
    const index = qaIndex("RA");
    await fillRa(form, api, { index });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(edge.serverError.status);
    await expect(page).toHaveURL(new RegExp(PTE_QUESTION_PATHS.create));
    await expect(form.indexInput).toHaveValue(index);
    await expect(form.publishButton).toBeEnabled();
    await expect(form.publishButton).toHaveText(/publish/i);
  });
});
