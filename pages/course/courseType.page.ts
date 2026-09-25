import type { Locator, Page } from "@playwright/test";
import type { CourseType } from "../../utils/types/course/course.types";
import { CourseWizardPage } from "./courseWizard.page";

/** Course Type, `views/courses/CourseTypeView.vue`. */
export class CourseTypePage extends CourseWizardPage {
  readonly onlineLink: Locator;
  readonly typeError: Locator;

  constructor(page: Page) {
    super(page);
    this.onlineLink = page
      .locator("label", { hasText: /online course link/i })
      .locator("xpath=..")
      .locator("input");
    // RadioButtonComponent renders its message in a sibling div.text-danger.
    this.typeError = page
      .locator(".v-radio-group")
      .locator("xpath=..")
      .locator(".text-danger");
  }

  /** Each v-radio carries the `course_type` id as its value (`data/cms.js`). */
  radio(type: CourseType): Locator {
    return this.page.locator(`input[type=radio][value="${type}"]`);
  }

  async choose(type: CourseType): Promise<void> {
    await this.radio(type).check();
  }
}
