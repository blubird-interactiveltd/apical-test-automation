import type { Locator, Page } from "@playwright/test";
import { CourseWizardPage } from "./courseWizard.page";

/** Duration & Price, `views/courses/DurationAndPrice.vue`. */
export class DurationPricePage extends CourseWizardPage {
  readonly duration: Locator;
  readonly durationError: Locator;
  readonly oldPrice: Locator;
  readonly newPrice: Locator;
  readonly featured: Locator;
  readonly acceptTerms: Locator;

  constructor(page: Page) {
    super(page);
    const field = (label: RegExp) =>
      page.locator("label", { hasText: label }).locator("xpath=..");
    const checkbox = (text: string) =>
      page
        .locator(".v-checkbox")
        .filter({ hasText: text })
        .locator("input[type=checkbox]");

    this.duration = field(/duration \(days\)/i).locator("input");
    this.durationError = field(/duration \(days\)/i).locator(".text-danger");
    this.oldPrice = field(/^\s*old price/i).locator("input");
    this.newPrice = field(/^\s*new price/i).locator("input");
    this.featured = checkbox("Marked as Feature");
    this.acceptTerms = checkbox("I agree with the terms");
  }

  async fill(values: {
    duration?: string;
    oldPrice?: string;
    newPrice?: string;
  }): Promise<void> {
    if (values.duration !== undefined)
      await this.duration.fill(values.duration);
    if (values.oldPrice !== undefined)
      await this.oldPrice.fill(values.oldPrice);
    if (values.newPrice !== undefined)
      await this.newPrice.fill(values.newPrice);
  }
}
