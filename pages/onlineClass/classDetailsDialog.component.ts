import type { Locator, Page } from "@playwright/test";
import { activeDialog } from "../shared/dialog.component";

/** Caption of the close button, from `ShowModuleList.vue:20`. */
const BACK_LABEL = "Back";

/**
 * The detail dialog the eye button opens — `ShowDetails.vue` rendering
 * `ShowModuleList.vue`, whose tabs are child routes of the list.
 */
export class ClassDetailsDialog {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = activeDialog(page);
  }

  tab(label: string): Locator {
    return this.root.getByText(label, { exact: true });
  }

  async openTab(label: string): Promise<void> {
    await this.tab(label).click();
  }

  async back(): Promise<void> {
    await this.root.getByRole("button", { name: BACK_LABEL }).click();
  }
}
