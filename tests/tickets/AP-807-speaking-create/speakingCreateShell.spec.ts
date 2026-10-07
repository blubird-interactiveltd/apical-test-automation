import { expect, test } from "@playwright/test";
import {
  PTE_QUESTION_PATHS,
  SPEAKING_LIST_PATHS,
} from "../../../pages/speaking/speakingList.page";
import { SpeakingCreateService } from "../../../services/speaking/speakingCreate.service";
import { uploadedUrl } from "../../../services/speaking/speakingCreateApiMock.service";
import {
  CreatedQuestions,
  SpeakingQuestionApi,
} from "../../../services/speaking/speakingQuestionApi.service";
import { qaIndex } from "../../../utils/speakingCreate";
import {
  createType,
  speakingCreateData,
} from "../../../utils/speakingTestData";
import type { SpeakingTypeCode } from "../../../utils/types/speaking/speakingList.types";

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

/** What each type's form shows below the common fields (business doc §5). */
const LAYOUT: Record<
  SpeakingTypeCode,
  {
    title: number;
    transcript: number;
    audio: number;
    image: number;
    mediaCard: number;
    groupDiscussion: number;
  }
> = {
  RA: {
    title: 1,
    transcript: 0,
    audio: 0,
    image: 0,
    mediaCard: 0,
    groupDiscussion: 0,
  },
  RS: {
    title: 0,
    transcript: 1,
    audio: 1,
    image: 0,
    mediaCard: 0,
    groupDiscussion: 0,
  },
  DI: {
    title: 0,
    transcript: 0,
    audio: 0,
    image: 1,
    mediaCard: 0,
    groupDiscussion: 0,
  },
  RL: {
    title: 0,
    transcript: 1,
    audio: 1,
    image: 0,
    mediaCard: 1,
    groupDiscussion: 0,
  },
  ASQ: {
    title: 0,
    transcript: 1,
    audio: 1,
    image: 0,
    mediaCard: 0,
    groupDiscussion: 0,
  },
  SGD: {
    title: 0,
    transcript: 1,
    audio: 1,
    image: 0,
    mediaCard: 0,
    groupDiscussion: 1,
  },
  RTAS: {
    title: 0,
    transcript: 1,
    audio: 1,
    image: 0,
    mediaCard: 0,
    groupDiscussion: 0,
  },
};

test.describe("AP-807 speaking create — form shell & navigation", () => {
  test("Create on the Speaking list opens the create form (AP-807-TC-001)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    await expect(page).toHaveURL(
      new RegExp(`${PTE_QUESTION_PATHS.create}\\?${data.createQuery}$`),
    );
    await expect(form.heading).toContainText(new RegExp(data.heading, "i"));
    await expect(form.headingSection).toHaveText(data.headingSection);
    await expect(form.backButton).toContainText(data.backLabel);
  });

  test("the form opens on Read Aloud (AP-807-TC-002)", async ({ page }) => {
    const { form } = await SpeakingCreateService.open(page);

    expect(await form.selectedLabel(form.typeSelect)).toBe(
      createType("RA").title,
    );
    await expect(form.sectionHeading("title")).toBeVisible();
    await expect(form.keywordBox).toBeVisible();
  });

  test("the type select lists the 7 Speaking types in order (AP-807-TC-003)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    expect(await form.optionLabels(form.typeSelect)).toEqual(
      data.types.map((type) => type.title),
    );
  });

  test("switching type swaps the type form and the prompt (AP-807-TC-004)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    for (const type of data.types) {
      await test.step(type.title, async () => {
        await SpeakingCreateService.selectType(form, type.code);
        const layout = LAYOUT[type.code];

        await expect(form.sectionHeading("title")).toHaveCount(layout.title);
        await expect(form.sectionHeading("transcript")).toHaveCount(
          layout.transcript,
        );
        await expect(form.fileInput("image")).toHaveCount(layout.image);
        await expect(form.mediaCard).toHaveCount(layout.mediaCard);
        await expect(form.groupDiscussionTitle).toHaveCount(
          layout.groupDiscussion,
        );
        expect(
          await form.fileInputs.and(page.locator('[accept="audio/*"]')).count(),
        ).toBe(layout.audio);
      });
    }
  });

  test("each type shows its default prompt exactly (AP-807-TC-005)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    for (const type of data.types) {
      await test.step(type.title, async () => {
        await SpeakingCreateService.selectType(form, type.code);

        await expect(form.prompt.locator("p").first()).toHaveText(type.prompt);
      });
    }
  });

  test("Retell Lecture shows the audio prompt, OR, then the video prompt (AP-807-TC-006)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page, { type: "RL" });
    const rl = createType("RL");

    await expect(form.prompt.locator("p").first()).toHaveText(rl.prompt);
    await expect(form.promptOr).toBeVisible();
    await expect(form.prompt.locator("p").nth(1)).toHaveText(
      rl.videoPrompt ?? "",
    );
  });

  test("Choose Sample Answer shows only for RA, DI, RL, SGD and RTAS (AP-807-TC-007)", async ({
    page,
  }) => {
    const { form } = await SpeakingCreateService.open(page);

    for (const type of data.types) {
      await test.step(type.title, async () => {
        await SpeakingCreateService.selectType(form, type.code);

        if (type.sampleAnswer) {
          await expect(form.sampleAnswerButton).toBeVisible();
        } else {
          await expect(form.sampleAnswerButton).toBeHidden();
        }
      });
    }
  });

  test("Back To Question List returns to the list without saving (AP-807-TC-008)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page);
    await SpeakingCreateService.fill(form, api, "RA", {
      index: qaIndex("RA"),
      title: data.content.RA.title ?? "",
    });

    await form.backButton.click();

    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await SpeakingCreateService.settle(page);
    expect(api.posts).toEqual([]);
  });

  test("the create URL without ?type does not crash or mix sections (AP-807-TC-009)", async ({
    page,
  }) => {
    // F-17 (new, seen on stage): with no ?type, CreateView asks for
    // `question-types?section=undefined` and commits its first item; the
    // `setSelectedQuestionType` mutation then destructures `find(...)` of
    // nothing and throws "Cannot destructure property 'component'"
    // (store/modules/question.js:110, CreateView.vue:591).
    test.fail();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const typesResponse = page.waitForResponse((response) =>
      response.url().includes("/api/v1/question-types?"),
    );

    const { form } = await SpeakingCreateService.open(page, {
      viaList: false,
      query: "",
      waitForReady: false,
    });
    const types = (await (await typesResponse).json()) as {
      items?: { section?: string }[];
    };
    await SpeakingCreateService.settle(page);

    // Either the form renders or the app sends the user elsewhere — never a blank page.
    const onCreate = page.url().includes(PTE_QUESTION_PATHS.create);
    if (onCreate) {
      await expect(form.heading).toBeVisible();
    }
    expect(
      new Set((types.items ?? []).map((item) => item.section)).size,
    ).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });

  test("switching RS → DI sends only the DI fields (AP-807-TC-010)", async ({
    page,
  }) => {
    const { form, api } = await SpeakingCreateService.open(page, {
      type: "RS",
    });
    await SpeakingCreateService.fill(form, api, "RS", {
      media: "speaking-short.mp3",
      transcript: data.content.RS.transcript ?? "",
    });

    await SpeakingCreateService.selectType(form, "DI");
    const image = await SpeakingCreateService.upload(
      form,
      api,
      "image",
      "describe-image.png",
    );
    await form.fillIndex(qaIndex("DI"));
    const post = await SpeakingCreateService.submit(form, api);

    expect(post.status).toBe(201);
    expect(post.payload.transcript).toBeUndefined();
    expect(post.payload.file_path).toBe(uploadedUrl(image));
    expect(post.payload.file_type).toBe("image");
    expect(post.payload.question_type_id).toBe(createType("DI").id);
  });
});
