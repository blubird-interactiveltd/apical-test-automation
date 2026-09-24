import { expect, test } from "@playwright/test";
import { BasicInformationPage } from "../../../pages/course/basicInformation.page";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import { SnackbarComponent } from "../../../pages/shared/snackbar.component";
import { CourseWizardService } from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type {
  CourseBasicInformationEdgeTestData,
  CourseBasicInformationTestData,
} from "../../../utils/types/course/courseWizard.types";

const data = DataLoader.load<CourseBasicInformationTestData>(
  "data/regular/course/courseBasicInformationRegularTestData.json",
);
const edge = DataLoader.load<CourseBasicInformationEdgeTestData>(
  "data/edge/course/courseBasicInformationEdgeTestData.json",
);

const TYPE_URL = new RegExp(`${COURSE_PATHS.courseType}$`);
const BASIC_URL = new RegExp(`${COURSE_PATHS.basicInformation}$`);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts form state and saved data, which are browser-independent.",
);

test.describe("AP-781 course Basic Information", () => {
  test("valid basic information is saved and the wizard moves on (AP-781-TC-005)", async ({
    page,
  }) => {
    const { wizard } = await CourseWizardService.open(page, {
      uploadedPath: data.valid.uploadedPath,
    });

    await CourseWizardService.completeBasicInformation(page, data.valid);

    await expect(page).toHaveURL(TYPE_URL);
    expect(await CourseWizardService.savedInfo(page)).toMatchObject({
      name: data.valid.name,
      thumbnail: data.valid.uploadedPath,
      description: `<p>${data.valid.description}</p>`,
      type: "COURSE",
    });
    expect(await wizard.isStepDone("Basic Information")).toBe(true);
  });

  for (const scenario of edge.required) {
    test(`${scenario.scenario} (${scenario.id})`, async ({ page }) => {
      await CourseWizardService.open(page, {
        uploadedPath: data.valid.uploadedPath,
      });
      const step = new BasicInformationPage(page);

      if (scenario.omit !== "name") await step.fillName(data.valid.name);
      if (scenario.omit !== "thumbnail") {
        await step.chooseThumbnail(data.valid.thumbnailFile);
        await expect(step.thumbnailLabel).toHaveText(data.valid.uploadedPath);
      }
      if (scenario.omit !== "description")
        await step.fillDescription(data.valid.description);
      await step.next();

      await expect(step.fieldError(scenario.omit)).toHaveText(
        "Field is required",
      );
      await expect(step.errorMessages()).toHaveCount(1);
      await expect(page).toHaveURL(BASIC_URL);
    });
  }

  test("the thumbnail is saved as the path the upload returns (AP-781-TC-009)", async ({
    page,
  }) => {
    // Written as "lower-cased path" before #780. The step now stores the path
    // FileUploadComponent emits from the upload response, so naming it is the
    // server's job; what the UI must do is keep that path exactly.
    const { api } = await CourseWizardService.open(page, {
      uploadedPath: data.valid.uploadedPath,
    });
    const step = new BasicInformationPage(page);

    await step.chooseThumbnail(data.valid.thumbnailFile);

    await expect(step.thumbnailLabel).toHaveText(data.valid.uploadedPath);
    expect(api.uploads).toHaveLength(1);
    await step.fillName(data.valid.name);
    await step.fillDescription(data.valid.description);
    await step.next();
    await expect(page).toHaveURL(TYPE_URL);
    expect((await CourseWizardService.savedInfo(page))?.thumbnail).toBe(
      data.valid.uploadedPath,
    );
  });

  test("a formatted description keeps its markup (AP-781-TC-010)", async ({
    page,
  }) => {
    const { wizard } = await CourseWizardService.open(page, {
      uploadedPath: data.valid.uploadedPath,
    });
    const step = new BasicInformationPage(page);
    await step.fillName(data.valid.name);
    await step.chooseThumbnail(data.valid.thumbnailFile);
    await expect(step.thumbnailLabel).toHaveText(data.valid.uploadedPath);
    await step.setDescriptionHtml(data.richDescription.html);

    await step.next();
    await expect(page).toHaveURL(TYPE_URL);
    await wizard.sidebarLink("Basic Information").click();

    expect((await CourseWizardService.savedInfo(page))?.description).toBe(
      data.richDescription.html,
    );
    await expect(step.description.locator("strong")).toHaveText(
      data.richDescription.boldText,
    );
    await expect(step.description.locator("li")).toHaveText(
      data.richDescription.listItem,
    );
  });

  test("a name of only spaces counts as empty (AP-781-TC-011)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      uploadedPath: data.valid.uploadedPath,
    });
    const step = new BasicInformationPage(page);
    await step.fillName(edge.whitespaceName);
    await step.chooseThumbnail(data.valid.thumbnailFile);
    await expect(step.thumbnailLabel).toHaveText(data.valid.uploadedPath);
    await step.fillDescription(data.valid.description);

    await step.next();

    await expect(step.fieldError("name")).toHaveText("Field is required");
    await expect(page).toHaveURL(BASIC_URL);
  });

  test("a name with accents, CJK and symbols is kept as typed (AP-781-TC-011b)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      uploadedPath: data.valid.uploadedPath,
    });

    await CourseWizardService.completeBasicInformation(page, {
      ...data.valid,
      name: edge.unicodeName,
    });

    expect((await CourseWizardService.savedInfo(page))?.name).toBe(
      edge.unicodeName,
    );
  });

  test("a name over 255 characters is rejected (AP-781-TC-011c)", async ({
    page,
  }) => {
    // Expected to fail, finding D-02: the name input has no maxlength and no
    // length rule (BasicInformationView.vue:13-21, validations :159), so an
    // over-long name is only caught, if at all, by the API on the final save.
    test.fail();

    await CourseWizardService.open(page, {
      uploadedPath: data.valid.uploadedPath,
    });
    const step = new BasicInformationPage(page);
    await step.fillName(edge.overLengthName);
    await step.chooseThumbnail(data.valid.thumbnailFile);
    await expect(step.thumbnailLabel).toHaveText(data.valid.uploadedPath);
    await step.fillDescription(data.valid.description);

    await step.next();

    await expect(page).toHaveURL(BASIC_URL);
    await expect(step.fieldError("name")).toBeVisible();
  });

  test("a file that is not an image is refused (AP-781-TC-012)", async ({
    page,
  }) => {
    // Expected to fail, finding D-03: FileUploadComponent's <input type=file>
    // has no `accept` and the component checks no type before uploading
    // (atom/form/FileUploadComponent.vue:25-30, getFileContent), so any file
    // becomes the course thumbnail.
    test.fail();

    const { api } = await CourseWizardService.open(page, {
      uploadedPath: "course/thumbnails/notes.pdf",
    });
    const step = new BasicInformationPage(page);

    await step.chooseThumbnail(
      edge.invalidFile.name,
      edge.invalidFile.mimeType,
    );
    await page.waitForTimeout(1000);

    expect(api.uploads).toHaveLength(0);
    await expect(step.thumbnailLabel).not.toHaveText(
      "course/thumbnails/notes.pdf",
    );
  });

  test("a rejected upload shows the server message and saves no thumbnail (AP-781-TC-012b)", async ({
    page,
  }) => {
    // The size limit itself is the server's; this stubs its 413 answer.
    await CourseWizardService.open(page);
    await page.unroute(/\/api\/v1\/common\/upload-file$/);
    await page.route(/\/api\/v1\/common\/upload-file$/, (route) =>
      route.fulfill({ status: 413, json: { message: edge.tooLargeMessage } }),
    );
    const step = new BasicInformationPage(page);

    await step.chooseThumbnail("huge.png");

    await expect(
      new SnackbarComponent(page).message(edge.tooLargeMessage),
    ).toBeVisible();
    await step.fillName(data.valid.name);
    await step.fillDescription(data.valid.description);
    await step.next();
    await expect(step.fieldError("thumbnail")).toHaveText("Field is required");
    await expect(page).toHaveURL(BASIC_URL);
  });
});
