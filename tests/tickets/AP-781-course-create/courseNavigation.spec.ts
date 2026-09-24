import { expect, test } from "@playwright/test";
import { BasicInformationPage } from "../../../pages/course/basicInformation.page";
import { CourseListPage } from "../../../pages/course/courseList.page";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import { SnackbarComponent } from "../../../pages/shared/snackbar.component";
import { ApicalLoginService } from "../../../services/auth/apicalLogin.service";
import { CourseApiMock } from "../../../services/course/courseApiMock.service";
import { CourseWizardService } from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type { CourseBasicInformationTestData } from "../../../utils/types/course/courseWizard.types";

const basic = DataLoader.load<CourseBasicInformationTestData>(
  "data/regular/course/courseBasicInformationRegularTestData.json",
);

const WIZARD_STEPS = [
  "Basic Information",
  "Course Type",
  "AdOns",
  "Properties",
  "Duration & Price",
  "Review",
  "Preview",
];

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts routing and saved state, which are browser-independent.",
);

test.describe("AP-781 course wizard navigation", () => {
  test("Create New Course opens the wizard at Basic Information (AP-781-TC-001)", async ({
    page,
  }) => {
    const api = new CourseApiMock(page);
    await ApicalLoginService.ensureLoggedIn(page, "master");
    await CourseWizardService.seed(page, null);
    await api.packages();
    const list = new CourseListPage(page);
    await list.goto(COURSE_PATHS.list);

    await list.createButton.click();

    await expect(page).toHaveURL(
      new RegExp(`${COURSE_PATHS.basicInformation}$`),
    );
    const wizard = new BasicInformationPage(page);
    await expect(wizard.heading).toBeVisible();
    expect(await wizard.sidebarSteps()).toEqual(WIZARD_STEPS);
  });

  test("a step that is not done yet cannot be opened from the sidebar (AP-781-TC-002)", async ({
    page,
  }) => {
    const { wizard } = await CourseWizardService.open(page);

    await wizard.sidebarLink("Duration & Price").click();

    await expect(
      new SnackbarComponent(page).message(/please complete .* form first/i),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`${COURSE_PATHS.basicInformation}$`),
    );
  });

  test("a completed step reopens with its values (AP-781-TC-003)", async ({
    page,
  }) => {
    const { wizard } = await CourseWizardService.open(page, {
      uploadedPath: basic.valid.uploadedPath,
    });
    await CourseWizardService.completeBasicInformation(page, basic.valid);

    await wizard.sidebarLink("Basic Information").click();

    const step = new BasicInformationPage(page);
    await expect(page).toHaveURL(
      new RegExp(`${COURSE_PATHS.basicInformation}$`),
    );
    await expect(step.name).toHaveValue(basic.valid.name);
    await expect(step.thumbnailLabel).toHaveText(basic.valid.uploadedPath);
    expect(await wizard.isStepDone("Basic Information")).toBe(true);
  });

  test("a course can be edited from the list (AP-781-TC-004)", async ({
    page,
  }) => {
    // Expected to fail, finding D-01: the edit button is commented out of the
    // course list (views/courses/IndexView.vue:75-85), its handler pushes the
    // route name `admin.course.create`, which has never existed (:159), and the
    // wizard has no code to load an existing course.
    test.fail();

    const api = new CourseApiMock(page);
    await ApicalLoginService.ensureLoggedIn(page, "master");
    await api.packages();
    const list = new CourseListPage(page);
    await list.goto(COURSE_PATHS.list);
    const row = list.rows.first();
    await expect(row).toBeVisible();

    await list.editAction(row).click({ timeout: 5000 });

    await expect(new BasicInformationPage(page).name).toHaveValue(
      "IELTS Foundation",
    );
  });
});
