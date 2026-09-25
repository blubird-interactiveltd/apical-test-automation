import { expect, test } from "@playwright/test";
import { CourseReviewPage } from "../../../pages/course/courseReview.page";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import { ItemListStepPage } from "../../../pages/course/itemListStep.page";
import { SliderStepPage } from "../../../pages/course/sliderStep.page";
import {
  type CourseFixture,
  fixtureIds,
} from "../../../services/course/courseApiMock.service";
import {
  ALL_ADD_ONS,
  basicInfo,
  CourseWizardService,
} from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type { CoursePackageDetail } from "../../../utils/types/course/course.types";
import type {
  CoursePropertiesTestData,
  CourseSliderTestData,
} from "../../../utils/types/course/courseWizard.types";

const lists = DataLoader.load<CoursePropertiesTestData>(
  "data/regular/course/coursePropertiesRegularTestData.json",
);
const sliders = DataLoader.load<CourseSliderTestData>(
  "data/regular/course/courseSliderRegularTestData.json",
);

/** Basic Information, Course Type and AdOns done, every add-on on. */
const seeded = () => basicInfo({ package_detail: { ...ALL_ADD_ONS } });

/** Which fixture each list step shows its rows from. */
const FIXTURE_FOR: Record<string, CourseFixture> = {
  [COURSE_PATHS.ptePractice]: "questions",
  [COURSE_PATHS.practiceTest]: "practiceTests",
  [COURSE_PATHS.mockTest]: "mockTests",
  [COURSE_PATHS.quiz]: "quizzes",
  [COURSE_PATHS.materials]: "materials",
};

const detailField = (detail: CoursePackageDetail | undefined, field: string) =>
  (detail as Record<string, unknown> | undefined)?.[field];

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts selections and saved data, which are browser-independent.",
);

test.describe("AP-781 course Properties, list steps", () => {
  for (const scenario of lists.cases) {
    test(`selecting ${scenario.scenario} saves their ids and count (${scenario.id})`, async ({
      page,
    }) => {
      await CourseWizardService.open(page, {
        path: scenario.path,
        info: seeded(),
      });
      const step = new ItemListStepPage(page);
      if (scenario.section) await step.openSection(scenario.section);
      await expect(step.rows.first()).toBeVisible();
      const ids = fixtureIds(FIXTURE_FOR[scenario.path] ?? "questions");

      for (const index of scenario.pick) await step.toggleRow(index);

      expect(await step.ticks()).toEqual(
        ids.map((_, index) => scenario.pick.includes(index)),
      );
      await step.next();
      await expect(page).not.toHaveURL(new RegExp(`${scenario.path}$`));
      const detail = (await CourseWizardService.savedInfo(page))
        ?.package_detail;
      expect(detailField(detail, scenario.idsField)).toEqual(
        scenario.pick.map((index) => ids[index]),
      );
      expect(detailField(detail, scenario.countField)).toBe(
        scenario.pick.length,
      );
    });
  }

  test("All Access selects every listed question and clears them again (AP-781-TC-023)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.ptePractice,
      info: seeded(),
    });
    const step = new ItemListStepPage(page);
    await step.openSection("Write From Dictation");
    await expect(step.rows.first()).toBeVisible();
    const count = fixtureIds("questions").length;

    await step.allAccess.check();
    expect(await step.ticks()).toEqual(Array(count).fill(true));

    await step.allAccess.uncheck();
    expect(await step.ticks()).toEqual(Array(count).fill(false));
  });

  test("a section filters the list and search keeps the selection (AP-781-TC-031)", async ({
    page,
  }) => {
    const { api } = await CourseWizardService.open(page, {
      path: COURSE_PATHS.ptePractice,
      info: seeded(),
    });
    const step = new ItemListStepPage(page);
    const [firstType] = fixtureIds("questionTypes");

    await step.openSection("Write From Dictation");
    await expect(step.rows.first()).toBeVisible();
    expect(
      api.requestsTo("questions").at(-1)?.searchParams.get("question_type_id"),
    ).toBe(firstType);
    await step.toggleRow(0);

    const searched = page.waitForRequest(
      (request) =>
        new URL(request.url()).searchParams.get("search") === lists.searchTerm,
    );
    await step.search.pressSequentially(lists.searchTerm, { delay: 40 });
    await searched;

    await expect(step.rows.first()).toBeVisible();
    expect((await step.ticks())[0]).toBe(true);
  });

  test("moving on with nothing selected records a count of zero (AP-781-TC-032)", async ({
    page,
  }) => {
    // Expected to fail, finding D-05: each list step only writes its fields
    // when something is selected (`if (this.questions.length > 0)`,
    // PtePractice.vue submit), so an empty step saves no count and Review
    // shows a blank instead of 0.
    test.fail();

    await CourseWizardService.open(page, {
      path: COURSE_PATHS.ptePractice,
      info: seeded(),
    });
    const step = new ItemListStepPage(page);
    await step.openSection("Write From Dictation");
    await expect(step.rows.first()).toBeVisible();

    await step.next();
    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.practiceTest}$`));
    await page.goto(COURSE_PATHS.review);

    await expect(new CourseReviewPage(page).properties.first()).toBeVisible();
    expect(
      await new CourseReviewPage(page).property("Number of PTE Practice"),
    ).toBe("0");
  });

  test("an empty list shows its empty state and the step can still be left (AP-781-TC-033)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.quiz,
      info: seeded(),
      emptyLists: ["quizzes"],
    });
    const step = new ItemListStepPage(page);

    await step.openSection("Grammar");

    await expect(step.emptyAlert).toHaveText(/not found/i);
    await expect(step.rows).toHaveCount(0);
    await step.next();
    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.materials}$`));
  });
});

test.describe("AP-781 course Properties, slider steps", () => {
  for (const scenario of sliders.cases) {
    test(`${scenario.scenario}: slider, number box and All Access (${scenario.id})`, async ({
      page,
    }) => {
      await CourseWizardService.open(page, {
        path: scenario.path,
        info: seeded(),
      });
      const step = new SliderStepPage(page);

      await step.setSlider(scenario.slider);
      await expect(step.count).toHaveValue(String(scenario.expectedFromSlider));

      await step.typeCount(scenario.typed);
      await expect(step.slider).toHaveValue(
        String(scenario.expectedSliderFromTyped),
      );

      await step.allAccess.check();
      await step.allAccess.uncheck();
      await expect(step.count).toHaveValue("0");
      await expect(step.slider).toHaveValue("0");

      await step.allAccess.check();
      await step.next();
      await expect(page).not.toHaveURL(new RegExp(`${scenario.path}$`));
      const detail = (await CourseWizardService.savedInfo(page))
        ?.package_detail;
      expect(detailField(detail, scenario.countField)).toBe("ALL");
      expect(detailField(detail, scenario.allAccessField)).toBe(true);
    });
  }
});
