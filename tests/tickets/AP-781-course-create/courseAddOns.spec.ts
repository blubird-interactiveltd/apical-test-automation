import { expect, test } from "@playwright/test";
import { AddOnsPage } from "../../../pages/course/addOns.page";
import { CourseReviewPage } from "../../../pages/course/courseReview.page";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import {
  ALL_ADD_ONS,
  basicInfo,
  CourseWizardService,
} from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type { CourseAddOnsTestData } from "../../../utils/types/course/courseWizard.types";

const data = DataLoader.load<CourseAddOnsTestData>(
  "data/regular/course/courseAddOnsRegularTestData.json",
);

const allSteps = data.addOns.flatMap((addOn) =>
  addOn.step ? [addOn.step.name] : [],
);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts routing and saved state, which are browser-independent.",
);

test.describe("AP-781 course AdOns", () => {
  test("every add-on starts switched on (AP-781-TC-018)", async ({ page }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.addOns,
      info: basicInfo(),
    });
    const step = new AddOnsPage(page);

    await expect(step.switches).toHaveCount(data.addOns.length);
    for (const addOn of data.addOns) {
      await expect(step.switchFor(addOn.label), addOn.label).toBeChecked();
    }
  });

  test("only the enabled add-ons become property steps (AP-781-TC-019)", async ({
    page,
  }) => {
    const { wizard } = await CourseWizardService.open(page, {
      path: COURSE_PATHS.addOns,
      info: basicInfo(),
    });
    const step = new AddOnsPage(page);
    const disabled = data.addOns.filter((addOn) =>
      data.partial.disable.includes(addOn.key),
    );

    for (const addOn of disabled) await step.setAddOn(addOn.label, false);
    await step.next();

    await expect(page).toHaveURL(
      new RegExp(`${data.partial.expectedFirstStep}$`),
    );
    const shown = await wizard.sidebarSteps();
    for (const name of allSteps) {
      expect(shown.includes(name), name).toBe(
        !data.partial.hiddenSteps.includes(name),
      );
    }
  });

  test("with every add-on off the wizard goes to Duration & Price (AP-781-TC-020)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.addOns,
      info: basicInfo(),
    });
    const step = new AddOnsPage(page);

    for (const addOn of data.addOns) await step.setAddOn(addOn.label, false);
    await step.next();

    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.durationPrice}$`));
    const detail =
      (await CourseWizardService.savedInfo(page))?.package_detail ?? {};
    for (const addOn of data.addOns)
      expect(detail[addOn.key], addOn.key).toBe(false);
  });

  test("switching an add-on off later removes it from Review (AP-781-TC-021)", async ({
    page,
  }) => {
    const filled = basicInfo({
      package_detail: {
        ...ALL_ADD_ONS,
        quiz_tests: ["5f0c1c1e-0000-4000-8000-000000000601"],
        quiz_test: 1,
        course_duration: "30",
      },
    });
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.addOns,
      info: filled,
    });
    const step = new AddOnsPage(page);

    await step.setAddOn("Quiz", false);
    await step.next();
    await page.goto(COURSE_PATHS.review);

    const review = new CourseReviewPage(page);
    await expect(review.properties.first()).toBeVisible();
    expect(await review.property("Number of Quiz")).toBeNull();
    expect(
      (await CourseWizardService.savedInfo(page))?.package_detail?.is_quiz,
    ).toBe(false);
  });
});
