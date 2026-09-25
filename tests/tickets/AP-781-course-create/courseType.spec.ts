import { expect, test } from "@playwright/test";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import { CourseTypePage } from "../../../pages/course/courseType.page";
import {
  basicInfo,
  CourseWizardService,
} from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type { CourseTypeTestData } from "../../../utils/types/course/courseWizard.types";

const data = DataLoader.load<CourseTypeTestData>(
  "data/regular/course/courseTypeRegularTestData.json",
);

// Basic Information done, Course Type not yet chosen.
const seeded = basicInfo({
  course_type: "",
  online_link: "",
  is_online: false,
  is_branch: false,
});

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts form state and saved data, which are browser-independent.",
);

test.describe("AP-781 course Course Type", () => {
  test("a course type must be chosen (AP-781-TC-013)", async ({ page }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.courseType,
      info: seeded,
    });
    const step = new CourseTypePage(page);

    await step.next();

    await expect(step.typeError).toHaveText("Field is required");
    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.courseType}$`));
  });

  for (const scenario of data.cases) {
    test(`${scenario.scenario} sets the online and branch flags (${scenario.id})`, async ({
      page,
    }) => {
      await CourseWizardService.open(page, {
        path: COURSE_PATHS.courseType,
        info: seeded,
      });
      const step = new CourseTypePage(page);

      await step.choose(scenario.courseType);
      await step.onlineLink.fill(scenario.onlineLink);
      await step.next();

      await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.addOns}$`));
      expect(await CourseWizardService.savedInfo(page)).toMatchObject({
        course_type: scenario.courseType,
        online_link: scenario.onlineLink,
        ...scenario.expected,
      });
    });
  }

  test("an online link that is not a URL is refused (AP-781-TC-017)", async ({
    page,
  }) => {
    // Expected to fail, finding D-04: Online Course Link has no validation
    // (CourseTypeView.vue:33-37, validations :139 cover course_type only), so
    // any text is saved as the course link.
    test.fail();

    await CourseWizardService.open(page, {
      path: COURSE_PATHS.courseType,
      info: seeded,
    });
    const step = new CourseTypePage(page);
    await step.choose("ONLINE");
    await step.onlineLink.fill(data.invalidLink);

    await step.next();

    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.courseType}$`), {
      timeout: 3000,
    });
    await expect(step.errorMessages()).toHaveCount(1);
  });
});
