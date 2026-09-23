import type { Locator, Page } from "@playwright/test";
import { activeDialog } from "../shared/dialog.component";

/** Caption of the copy button, from `ShareClasses.vue:18`. */
const COPY_LABEL = /copy link/i;

/**
 * The copy-link dialog — `ShareClasses.vue` composing `ImageSection.vue`
 * (banner, else thumbnail, else a text placeholder) and `CardSummary.vue`.
 */
export class ShareClassDialog {
  readonly root: Locator;
  readonly image: Locator;
  readonly linkInput: Locator;

  constructor(page: Page) {
    this.root = activeDialog(page);
    this.image = this.root.locator('img[alt="logo"]');
    this.linkInput = this.root.locator('input[type="text"]');
  }

  async copyLink(): Promise<void> {
    await this.root.getByRole("button", { name: COPY_LABEL }).click();
  }
}
