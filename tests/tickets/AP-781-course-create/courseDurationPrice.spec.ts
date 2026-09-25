import { expect, test } from "@playwright/test";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import { DurationPricePage } from "../../../pages/course/durationPrice.page";
import {
  ALL_ADD_ONS,
  basicInfo,
  CourseWizardService,
} from "../../../services/course/courseWizard.service";
import { DataLoader } from "../../../utils/dataLoader";
import type {
  CourseDurationPriceEdgeTestData,
  CourseDurationPriceTestData,
} from "../../../utils/types/course/courseWizard.types";

const data = DataLoader.load<CourseDurationPriceTestData>(
  "data/regular/course/courseDurationPriceRegularTestData.json",
);
const edge = DataLoader.load<CourseDurationPriceEdgeTestData>(
  "data/edge/course/courseDurationPriceEdgeTestData.json",
);

const seeded = () => basicInfo({ package_detail: { ...ALL_ADD_ONS } });
const STEP_URL = new RegExp(`${COURSE_PATHS.durationPrice}$`);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts form state and saved data, which are browser-independent.",
);

test.describe("AP-781 course Duration & Price", () => {
  test("duration is required, and Next waits for the terms (AP-781-TC-034)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.durationPrice,
      info: seeded(),
    });
    const step = new DurationPricePage(page);

    await expect(step.nextButton).toBeDisabled();
    await step.acceptTerms.check();
    await expect(step.nextButton).toBeEnabled();
    await step.next();

    await expect(step.durationError).toHaveText("Field is required");
    await expect(page).toHaveURL(STEP_URL);
  });

  test("duration, prices and the featured flag are saved (AP-781-TC-035)", async ({
    page,
  }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.durationPrice,
      info: seeded(),
    });
    const step = new DurationPricePage(page);

    await step.fill(data.valid);
    await step.featured.check();
    await step.acceptTerms.check();
    await step.next();

    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.review}$`));
    expect(
      (await CourseWizardService.savedInfo(page))?.package_detail,
    ).toMatchObject({
      ...ALL_ADD_ONS,
      course_duration: data.valid.duration,
      old_price: data.valid.oldPrice,
      new_price: data.valid.newPrice,
      is_featured: 1,
      acceptTerms: true,
    });
  });

  for (const scenario of edge.invalidNumbers) {
    test(`${scenario.field} "${scenario.value}" is refused (${scenario.id})`, async ({
      page,
    }) => {
      // Expected to fail, finding D-06: only `course_duration: { required }` is
      // validated (DurationAndPrice.vue validations), and the inputs are plain
      // text, so zero, negative and non-numeric values are all saved.
      test.fail();

      await CourseWizardService.open(page, {
        path: COURSE_PATHS.durationPrice,
        info: seeded(),
      });
      const step = new DurationPricePage(page);
      await step.fill({ ...data.valid, [scenario.field]: scenario.value });
      await step.acceptTerms.check();

      await step.next();

      await expect(page).toHaveURL(STEP_URL, { timeout: 3000 });
      await expect(step.errorMessages()).toHaveCount(1, { timeout: 3000 });
    });
  }

  test("a new price above the old price (AP-781-TC-037)", () => {
    // No rule says whether this is an error, a warning or allowed (a price
    // rise). Asserting any of them would invent the rule.
    test.fixme(true, "Needs a product decision on new price > old price.");
  });

  test("weekly and monthly prices and start and end dates (AP-781-TC-038)", () => {
    // The weekly / monthly inputs render only for packages (`v-if="is_package"`,
    // DurationAndPrice.vue:56-88, is_package is false here) and there are no
    // start or end date inputs at all, although the form carries both fields.
    test.fixme(
      true,
      "Needs a product decision: should courses have these fields?",
    );
  });
});
