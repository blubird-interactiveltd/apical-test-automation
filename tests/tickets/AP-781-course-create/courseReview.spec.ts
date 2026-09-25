import { expect, test } from "@playwright/test";
import { CourseReviewPage } from "../../../pages/course/courseReview.page";
import { COURSE_PATHS } from "../../../pages/course/courseWizard.page";
import {
  ALL_ADD_ONS,
  basicInfo,
  CourseWizardService,
} from "../../../services/course/courseWizard.service";
import type { CourseCreateInfo } from "../../../utils/types/course/course.types";

/** A wizard filled through Duration & Price, with Mock Test and Webinars off. */
const filled = (
  overrides: Partial<CourseCreateInfo["package_detail"]> = {},
): CourseCreateInfo =>
  basicInfo({
    name: "Review Course",
    description: "<p><strong>Bold</strong> intro</p>",
    online_link: "https://meet.example.com/review",
    package_detail: {
      ...ALL_ADD_ONS,
      is_mock_test: false,
      is_webinars: false,
      pte_practice: 2,
      practice_test: 1,
      quiz_test: 3,
      material_test: 1,
      live_classes: "ALL",
      OneToOneAppointment: 20,
      course_duration: "30",
      is_featured: 1,
      old_price: "100",
      new_price: "80",
      ...overrides,
    },
  });

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-781 asserts rendered values, which are browser-independent.",
);

test.describe("AP-781 course Review", () => {
  test("Review shows everything entered (AP-781-TC-039)", async ({ page }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.review,
      info: filled(),
    });
    const review = new CourseReviewPage(page);

    expect(await review.value("Name of The Course")).toBe("Review Course");
    await expect(
      review.htmlValue("Course Description").locator("strong"),
    ).toHaveText("Bold");
    expect(await review.value("Course Link")).toBe(
      "https://meet.example.com/review",
    );
    expect(await review.property("Number of PTE Practice")).toBe("2");
    expect(await review.property("Number of Practice Test")).toBe("1");
    expect(await review.property("Number of Quiz")).toBe("3");
    expect(await review.property("Materials")).toBe("1");
    expect(await review.property("Live Class")).toBe("ALL");
    expect(await review.property("One To One Appointment")).toBe("20");
    expect(await review.value("Duration")).toBe("30 Days");
    expect(await review.value("Feature Status")).toBe("Featured");
    expect(await review.value("Old Price")).toBe("$100");
    expect(await review.value("New Price")).toBe("$80");
  });

  test("disabled add-ons are left out (AP-781-TC-040)", async ({ page }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.review,
      info: filled(),
    });
    const review = new CourseReviewPage(page);

    await expect(review.properties.first()).toBeVisible();
    expect(await review.property("Number of Mock Test")).toBeNull();
    expect(await review.property("Webinars")).toBeNull();
  });

  test("empty prices show no dangling currency sign (AP-781-TC-041)", async ({
    page,
  }) => {
    // Expected to fail, finding D-07: Review prints `'$' + old_price`
    // unconditionally (Review.vue:121, :130), so a blank price renders as "$".
    test.fail();

    await CourseWizardService.open(page, {
      path: COURSE_PATHS.review,
      info: filled({ old_price: "", new_price: "" }),
    });
    const review = new CourseReviewPage(page);

    expect(await review.value("Old Price")).not.toBe("$");
    expect(await review.value("New Price")).not.toBe("$");
  });

  test("with nothing saved, Review sends the user to the first step (AP-781-TC-042)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await CourseWizardService.open(page, { path: COURSE_PATHS.review });

    await expect(page).toHaveURL(
      new RegExp(`${COURSE_PATHS.basicInformation}$`),
    );
    expect(errors).toEqual([]);
  });

  test("Next goes to Preview (AP-781-TC-043)", async ({ page }) => {
    await CourseWizardService.open(page, {
      path: COURSE_PATHS.review,
      info: filled(),
    });

    await new CourseReviewPage(page).next();

    await expect(page).toHaveURL(new RegExp(`${COURSE_PATHS.preview}$`));
  });

  test("markup in the description cannot run script (AP-781-TC-056)", async ({
    page,
  }) => {
    // Expected to fail, finding D-08: the Content atom renders the description
    // with `v-html` (atom/Content.vue:5), so an event-handler attribute saved in
    // the description runs on Review. TC-056b checks what the API stores.
    test.fail();

    await CourseWizardService.open(page, {
      path: COURSE_PATHS.review,
      info: basicInfo({
        description: '<img src="x" onerror="window.__ap781Xss = true">',
        package_detail: { ...ALL_ADD_ONS, course_duration: "30" },
      }),
    });
    await expect(new CourseReviewPage(page).properties.first()).toBeVisible();

    expect(
      await page.evaluate(
        () => (window as { __ap781Xss?: boolean }).__ap781Xss,
      ),
    ).toBeUndefined();
  });
});
