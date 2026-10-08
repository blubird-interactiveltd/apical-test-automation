import { expect, test } from "@playwright/test";
import { SpeakingCreatePage } from "../../../pages/speaking/speakingCreate.page";
import {
  PTE_QUESTION_PATHS,
  SPEAKING_LIST_PATHS,
} from "../../../pages/speaking/speakingList.page";
import { SnackbarComponent } from "../../../pages/shared/snackbar.component";
import { ApicalLoginService } from "../../../services/auth/apicalLogin.service";
import { SpeakingCreateService } from "../../../services/speaking/speakingCreate.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import { ApiResponseCache } from "../../../services/shared/apiResponseCache.service";
import { minimalPayload, qaIndex } from "../../../utils/speakingCreate";
import {
  createType,
  speakingCreateData,
} from "../../../utils/speakingTestData";

const data = speakingCreateData();

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

test.describe("AP-807 speaking create — draft, publish, create another", () => {
  test("Publish saves active, returns to the list and shows Published (AP-807-TC-040)", async ({
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
      transcript: data.content.RS.transcript ?? "",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.payload.active).toBe(true);
    await expect(
      new SnackbarComponent(page).message(data.messages.created),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    // Searched by its unique index: under parallel runs "first row" can be another worker's question.
    await listPage.search.fill(index);
    await expect(listPage.statusLabel(listPage.row(record.q_id))).toHaveText(
      data.statusLabels.published,
    );
  });

  test("Save as Draft saves inactive and lists it under Draft (AP-807-TC-041)", async ({
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
      transcript: data.content.RS.transcript ?? "",
    });

    const post = await SpeakingCreateService.submit(form, api, "draft");
    await SpeakingCreateService.settle(page);

    expect(api.posts).toHaveLength(1);
    expect(post.payload.active).toBe(false);
    await expect(
      new SnackbarComponent(page).message(data.messages.created),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    const record = await (
      await SpeakingQuestionApi.as(request)
    ).get(String(post.body.question_id), "edit");
    await listPage.choose(listPage.statusFilter, data.statusLabels.draft);
    await listPage.search.fill(index);
    await expect(listPage.statusLabel(listPage.row(record.q_id))).toHaveText(
      data.statusLabels.draft,
    );
  });

  test("Save as Draft still requires an index (AP-807-TC-042)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await SpeakingCreateService.fill(form, api, "RS", {
      transcript: data.content.RS.transcript ?? "",
    });

    await form.draftButton.click();

    await expect(form.indexError).toHaveText(data.messages.indexRequired);
    await SpeakingCreateService.settle(page);
    expect(api.posts).toEqual([]);
  });

  test("Create another stays on the form and clears it (AP-807-TC-043)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await form.createAnother.check();
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: data.content.RA.title ?? "",
      sourceLabel: "Practice",
      frequencyLabel: "High",
    });

    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    await expect(
      new SnackbarComponent(page).message(data.messages.created),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(PTE_QUESTION_PATHS.create));
    await expect(form.indexInput).toHaveValue("");
    await expect.poll(() => form.richText("title")).toBe("");
    await expect(form.keywordBox).toHaveValue("");
    expect(await form.selectedLabel(form.sourceSelect)).toBe(
      data.defaults.sourceLabel,
    );
    expect(await form.selectedLabel(form.frequencySelect)).toBe(
      data.defaults.frequencyLabel,
    );
    await expect(form.form.locator(".text-danger")).toHaveCount(0);
  });

  test("a second create after Create another is a new question (AP-807-TC-044)", async ({
    page,
    request,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await form.createAnother.check();
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: data.content.RA.title ?? "",
    });
    const first = await SpeakingCreateService.submit(form, api);
    await expect(form.indexInput).toHaveValue("");

    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: data.content.RA.plainTitle ?? "",
    });
    const second = await SpeakingCreateService.submit(form, api);

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(second.body.question_id).not.toBe(first.body.question_id);
    const client = await SpeakingQuestionApi.as(request);
    const [one, two] = [
      await client.get(String(first.body.question_id), "edit"),
      await client.get(String(second.body.question_id), "edit"),
    ];
    expect(two.q_id).not.toBe(one.q_id);
  });

  test("Create another empties the audio uploader (AP-807-TC-045)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await form.createAnother.check();
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      media: "speaking-short.mp3",
      transcript: data.content.RS.transcript ?? "",
    });
    const first = await SpeakingCreateService.submit(form, api);
    expect(first.status).toBe(201);

    await expect(form.audioPlayer).toBeHidden();
    await SpeakingCreateService.fill(form, api, "RS", {
      index: qaIndex("RS"),
      transcript: data.content.RS.transcript ?? "",
    });
    // RS requires audio (#813): if the first file_path had carried over, this
    // Publish would save a second question with it.
    await form.publishButton.click();
    await SpeakingCreateService.settle(page);

    expect(api.posts.filter((post) => post.status === 201)).toHaveLength(1);
  });

  test("Create another is not offered when editing (AP-807-TC-046)", async ({
    page,
    request,
  }) => {
    const id = await (
      await SpeakingQuestionApi.as(request)
    ).createOk(
      minimalPayload(createType("RA"), qaIndex("RA"), {
        title: data.content.RA.plainTitle ?? "",
      }),
    );
    await ApicalLoginService.ensureLoggedIn(page, "master");
    await ApiResponseCache.install(page);
    const form = new SpeakingCreatePage(page);

    await page.goto(`${PTE_QUESTION_PATHS.edit}/${id}?type=speaking`, {
      waitUntil: "domcontentloaded",
    });
    await form.waitForReady();

    await expect(form.heading).toContainText(/update question/i);
    await expect(form.createAnother).toHaveCount(0);
  });
});
