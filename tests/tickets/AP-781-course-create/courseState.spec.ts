import { expect, test } from "@playwright/test";
import { BasicInformationPage } from "../../../pages/course/basicInformation.page";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import { CourseTypePage } from "../../../pages/course/courseType.page";
import {
  basicInfo,
  CourseWizardService,
} from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type { CourseBasicInformationTestData } from "../../../utils/types/course/courseWizard.types";

const basic = DataLoader.load<CourseBasicInformationTestData>(
  "data/regular/course/courseBasicInformationRegularTestData.json",
);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts saved state, which is browser-independent.",
);

test.describe("AP-781 course wizard saved state", () => {
  test("a reload mid-wizard keeps the data and the progress (AP-781-TC-058)", async ({
    page,
  }) => {
    const { wizard } = await CourseWizardService.open(page, {
      uploadedPath: basic.valid.uploadedPath,
    });
    await CourseWizardService.completeBasicInformation(page, basic.valid);
    const before = await CourseWizardService.savedInfo(page);

    await page.reload();
    await wizard.heading.waitFor();

    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.courseType}$`));
    expect(await CourseWizardService.savedInfo(page)).toEqual(before);
    expect(await wizard.isStepDone("Basic Information")).toBe(true);
    await wizard.sidebarLink("Basic Information").click();
    await expect(new BasicInformationPage(page).name).toHaveValue(
      basic.valid.name,
    );
  });

  test("Clear all empties the step and its saved values (AP-781-TC-059)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      info: basicInfo({ name: "To be cleared" }),
    });
    const step = new BasicInformationPage(page);
    await expect(step.name).toHaveValue("To be cleared");

    await step.clearAllButton.click();

    await expect(step.name).toHaveValue("");
    await expect(step.thumbnailLabel).toHaveText("");
    await expect(step.description).toHaveText("");
    expect(await CourseWizardService.savedInfo(page)).toMatchObject({
      name: "",
      thumbnail: "",
      description: "",
    });
  });

  test("an unfinished draft is restored on every step (AP-781-TC-060)", async ({
    page,
  }) => {
    // Partial: the wizard has no "start over" choice, so restoring is the only
    // behaviour to assert; whether a stale draft should be offered or dropped
    // is a product question.
    const draft = basicInfo({
      name: "Old draft",
      course_type: "BRANCH",
      is_branch: true,
    });
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.wizard,
      info: draft,
    });

    await expect(page).toHaveURL(
      new RegExp(`${COURSE_PATHS.basicInformation}$`),
    );
    const step = new BasicInformationPage(page);
    await expect(step.name).toHaveValue("Old draft");
    await expect(step.thumbnailLabel).toHaveText(draft.thumbnail ?? "");
    await page.goto(COURSE_PATHS.courseType);
    await expect(new CourseTypePage(page).radio("BRANCH")).toBeChecked();
  });
});
