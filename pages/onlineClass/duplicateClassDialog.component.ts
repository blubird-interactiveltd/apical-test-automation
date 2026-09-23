import type { Locator, Page } from "@playwright/test";
import { activeDialog } from "../shared/dialog.component";

/** Captions, from `DuplicateClass.vue:28` and `:35`. */
const CANCEL_LABEL = /cancel/i;
const SAVE_LABEL = "Save";

/** The duplicate confirmation — `views/teacher/online-class/DuplicateClass.vue`. */
export class DuplicateClassDialog {
  readonly root: Locator;
  readonly thumbnail: Locator;
  private readonly saveButton: Locator;

  constructor(page: Page) {
    this.root = activeDialog(page);
    this.thumbnail = this.root.locator('img[alt="Class thumbnail"]');
    this.saveButton = this.root.getByRole("button", { name: SAVE_LABEL });
  }

  async cancel(): Promise<void> {
    await this.root.getByRole("button", { name: CANCEL_LABEL }).click();
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async doubleClickSave(): Promise<void> {
    await this.saveButton.dblclick();
  }
}
