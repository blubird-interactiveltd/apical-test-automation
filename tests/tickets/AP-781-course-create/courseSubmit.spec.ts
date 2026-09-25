import { expect, type Page, test } from "@playwright/test";
import { AddOnsPage } from "../../../pages/course/addOns.page";
import { BasicInformationPage } from "../../../pages/course/basicInformation.page";
import { CourseListPage } from "../../../pages/course/courseList.page";
import { CourseReviewPage } from "../../../pages/course/courseReview.page";
import {
  COURSE_PATHS,
  COURSE_STORAGE,
} from "../../../pages/course/courseWizard.page";
import { CourseTypePage } from "../../../pages/course/courseType.page";
import { DurationPricePage } from "../../../pages/course/durationPrice.page";
import { ItemListStepPage } from "../../../pages/course/itemListStep.page";
import { SliderStepPage } from "../../../pages/course/sliderStep.page";
import { SnackbarComponent } from "../../../pages/shared/snackbar.component";
import {
  type CourseApiMock,
  fixtureIds,
} from "../../../services/course/courseApiMock.service";
import {
  ALL_ADD_ONS,
  basicInfo,
  CourseWizardService,
} from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type { CourseCreateInfo } from "../../../utils/types/course/course.types";
import type { CourseSubmitTestData } from "../../../utils/types/course/courseWizard.types";

const data = DataLoader.load<CourseSubmitTestData>(
  "data/regular/course/courseSubmitRegularTestData.json",
);

const ids = {
  pte: fixtureIds("questions")[data.pick.pte],
  practice: fixtureIds("practiceTests")[data.pick.practice],
  mock: fixtureIds("mockTests")[data.pick.mock],
  quiz: fixtureIds("quizzes")[data.pick.quiz],
  material: fixtureIds("materials")[data.pick.material],
};

/** A wizard filled through Duration & Price, ready to save from Preview. */
const readyToSave = (): CourseCreateInfo =>
  basicInfo({
    thumbnail: data.uploadedPath,
    package_detail: {
      ...ALL_ADD_ONS,
      course_duration: data.duration,
      acceptTerms: true,
    },
  });

const url = (path: string) => new RegExp(`${path}$`);

/** Picks one row on a list step and moves on. */
async function pickOne(
  page: Page,
  path: string,
  row: number,
  section?: string,
): Promise<void> {
  await expect(page).toHaveURL(url(path));
  const step = new ItemListStepPage(page);
  if (section) await step.openSection(section);
  await expect(step.rows.nth(row)).toBeVisible();
  await step.toggleRow(row);
  await step.next();
}

async function setSlider(page: Page, path: string): Promise<void> {
  await expect(page).toHaveURL(url(path));
  const step = new SliderStepPage(page);
  await step.setSlider(data.slider);
  await step.next();
}

/** Every step, filled through the UI, from the course list to Preview's Save. */
async function createThroughTheWizard(
  page: Page,
  api: CourseApiMock,
): Promise<void> {
  await test.step("open the wizard from the course list", async () => {
    const list = new CourseListPage(page);
    await list.goto(COURSE_PATHS.list);
    await list.createButton.click();
  });
  await test.step("Basic Information", () =>
    CourseWizardService.completeBasicInformation(page, data));
  await test.step("Course Type", async () => {
    const step = new CourseTypePage(page);
    await step.choose(data.courseType);
    await step.onlineLink.fill(data.onlineLink);
    await step.next();
  });
  await test.step("AdOns, all on", async () => {
    await expect(page).toHaveURL(url(COURSE_PATHS.addOns));
    await new AddOnsPage(page).next();
  });
  await test.step("list steps", async () => {
    await pickOne(
      page,
      COURSE_PATHS.ptePractice,
      data.pick.pte,
      "Write From Dictation",
    );
    await pickOne(page, COURSE_PATHS.practiceTest, data.pick.practice);
    await pickOne(page, COURSE_PATHS.mockTest, data.pick.mock);
    await pickOne(page, COURSE_PATHS.quiz, data.pick.quiz, "Grammar");
    await pickOne(page, COURSE_PATHS.materials, data.pick.material);
  });
  await test.step("slider steps", async () => {
    await setSlider(page, COURSE_PATHS.liveClass);
    await setSlider(page, COURSE_PATHS.webinars);
    await setSlider(page, COURSE_PATHS.oneToOne);
  });
  await test.step("Duration & Price", async () => {
    await expect(page).toHaveURL(url(COURSE_PATHS.durationPrice));
    const step = new DurationPricePage(page);
    await step.fill({
      duration: data.duration,
      oldPrice: data.oldPrice,
      newPrice: data.newPrice,
    });
    await step.featured.check();
    await step.acceptTerms.check();
    await step.next();
  });
  await test.step("Review, Preview, Save", async () => {
    await expect(page).toHaveURL(url(COURSE_PATHS.review));
    await new CourseReviewPage(page).next();
    await expect(page).toHaveURL(url(COURSE_PATHS.preview));
    await new CourseReviewPage(page).saveButton.click();
    await expect.poll(() => api.updateCalls.length).toBe(1);
  });
}

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts the payloads sent, which are browser-independent.",
);

test.describe("AP-781 course create", () => {
  test("a course is created end to end through the wizard (AP-781-TC-044)", async ({
    page,
  }) => {
    const { api } = await CourseWizardService.open(page, {
      path: COURSE_PATHS.list,
      uploadedPath: data.uploadedPath,
      packages: { packageId: data.packageId, message: data.successMessage },
    });

    await createThroughTheWizard(page, api);

    await expect(page).toHaveURL(url(COURSE_PATHS.list));
    await expect(
      new SnackbarComponent(page).message(data.successMessage),
    ).toBeVisible();
    expect(api.createBodies).toHaveLength(1);
    const slider = data.slider * 10;
    expect(api.createBodies[0]).toMatchObject({
      name: data.name,
      description: `<p>${data.description}</p>`,
      thumbnail: data.uploadedPath,
      type: "COURSE",
      course_type: data.courseType,
      is_online: true,
      is_branch: true,
      online_link: data.onlineLink,
      questions: [ids.pte],
      package_detail: {
        ...ALL_ADD_ONS,
        pte_practice_questions: [ids.pte],
        pte_practice: 1,
        practice_test_tests: [ids.practice],
        practice_test: 1,
        mock_test_tests: [ids.mock],
        mock_test: 1,
        quiz_tests: [ids.quiz],
        quiz_test: 1,
        material_tests: [ids.material],
        material_test: 1,
        live_classes: slider,
        webinars: slider,
        OneToOneAppointment: slider,
        course_duration: data.duration,
        old_price: data.oldPrice,
        new_price: data.newPrice,
        is_featured: 1,
      },
    });
    expect(api.updateCalls[0]?.id).toBe(data.packageId);
  });

  test("the payload lists every selected test (AP-781-TC-044b)", async ({
    page,
  }) => {
    // Expected to fail, finding D-11: Materials seeds its `tests` list from
    // `existData.questions` instead of `existData.tests` (Materials.vue
    // created()), so its submit overwrites `tests` with the materials alone and
    // the practice, mock and quiz ids chosen before are dropped.
    test.fail();

    const { api } = await CourseWizardService.open(page, {
      path: COURSE_PATHS.list,
      uploadedPath: data.uploadedPath,
      packages: { packageId: data.packageId },
    });

    await createThroughTheWizard(page, api);

    expect(api.createBodies[0]?.tests ?? []).toEqual(
      expect.arrayContaining([ids.practice, ids.mock, ids.quiz, ids.material]),
    );
  });

  test("a created course leaves no wizard data behind (AP-781-TC-045)", async ({
    page,
  }) => {
    const { api } = await CourseWizardService.open(page, {
      path: COURSE_PATHS.preview,
      info: readyToSave(),
    });

    await new CourseReviewPage(page).saveButton.click();
    await expect(page).toHaveURL(url(COURSE_PATHS.list));
    await expect.poll(() => api.updateCalls.length).toBe(1);

    const stored = await page.evaluate(
      (keys) => keys.map((key) => window.localStorage.getItem(key)),
      [COURSE_STORAGE.info, COURSE_STORAGE.menu],
    );
    expect(stored).toEqual([null, null]);
    await new CourseListPage(page).createButton.click();
    await expect(new BasicInformationPage(page).name).toHaveValue("");
  });

  test("a double click on Save creates one course (AP-781-TC-046)", async ({
    page,
  }) => {
    // Expected to fail, finding D-09: Save has no in-flight guard - `loading`
    // is never set (Preview.vue:132, submit :146) - so each click posts.
    test.fail();

    const { api } = await CourseWizardService.open(page, {
      path: COURSE_PATHS.preview,
      info: readyToSave(),
      packages: { createDelayMs: 1500 },
    });

    await new CourseReviewPage(page).saveButton.dblclick();
    await expect(page).toHaveURL(url(COURSE_PATHS.list));

    expect(api.createBodies).toHaveLength(1);
  });

  test("a failed create keeps the user on Preview with the data (AP-781-TC-047)", async ({
    page,
  }) => {
    // Expected to fail, finding D-10: the global axios toast shows the message
    // and the user stays on Preview with their data, but submit has no catch
    // (Preview.vue:146-165), so every failed create is an unhandled rejection.
    test.fail();

    const rejections: string[] = [];
    page.on("pageerror", (error) => rejections.push(error.message));
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.preview,
      info: readyToSave(),
      packages: {
        createError: {
          status: 500,
          body: { message: "Could not save the course" },
        },
      },
    });

    await new CourseReviewPage(page).saveButton.click();

    await expect(
      new SnackbarComponent(page).message(/could not save the course/i),
    ).toBeVisible();
    await expect(page).toHaveURL(url(COURSE_PATHS.preview));
    expect(await CourseWizardService.savedInfo(page)).not.toBeNull();
    expect(rejections).toEqual([]);
  });

  test("after create the thumbnail is renamed to the course id (AP-781-TC-048)", async ({
    page,
  }) => {
    const { api } = await CourseWizardService.open(page, {
      path: COURSE_PATHS.preview,
      info: readyToSave(),
      packages: { packageId: data.packageId },
    });

    await new CourseReviewPage(page).saveButton.click();
    await expect.poll(() => api.updateCalls.length).toBe(1);

    expect(api.createBodies[0]?.thumbnail).toBe(data.uploadedPath);
    expect(api.updateCalls[0]).toMatchObject({
      id: data.packageId,
      body: { thumbnail: data.renamedThumbnail },
    });
  });
});
