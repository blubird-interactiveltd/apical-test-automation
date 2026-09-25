import type { Locator, Page } from "@playwright/test";
import { CourseWizardPage } from "./courseWizard.page";

/** AdOns, `views/courses/adOns.vue`: one labelled row and v-switch per add-on. */
export class AddOnsPage extends CourseWizardPage {
  readonly switches: Locator;

  constructor(page: Page) {
    super(page);
    this.switches = page.locator(".v-switch input[type=checkbox]");
  }

  /**
   * The switch on the row labelled `label`. The label is matched exactly
   * because "PTE Practice" and "Practice Test" share a word.
   */
  switchFor(label: string): Locator {
    // Innermost rows only: the wizard's own layout is also `md-layout md-gutter`.
    return this.page
      .locator(".md-layout.md-gutter:not(:has(.md-layout.md-gutter))")
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator(".v-switch input[type=checkbox]");
  }

  async setAddOn(label: string, on: boolean): Promise<void> {
    await this.switchFor(label).setChecked(on);
  }
}
