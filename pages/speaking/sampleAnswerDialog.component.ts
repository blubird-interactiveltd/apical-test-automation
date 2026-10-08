import type { Locator, Page } from "@playwright/test";
import { activeDialog } from "../shared/dialog.component";

/**
 * The "Choose Sample Answer" dialog of the create form
 * (`molecule/question/ChooseSampleAnswer.vue`): a "Create New" form
 * (`SampleAnswer/CreateNew.vue`) or the archive list
 * (`SampleAnswer/ArchiveList.vue`).
 */
export class SampleAnswerDialog {
  readonly root: Locator;
  readonly heading: Locator;
  readonly sectionChip: Locator;
  readonly createNewRadio: Locator;
  readonly archiveRadio: Locator;
  readonly closeButton: Locator;
  readonly archiveItems: Locator;
  readonly setButton: Locator;
  readonly maleVoiceInput: Locator;
  readonly femaleVoiceInput: Locator;
  readonly saveAndSetButton: Locator;

  constructor(page: Page) {
    this.root = activeDialog(page);
    this.heading = this.root.locator("h2", { hasText: "Create Sample Answer" });
    this.sectionChip = this.heading.locator("small");
    this.createNewRadio = this.root.getByRole("radio", { name: "Create New" });
    this.archiveRadio = this.root.getByRole("radio", {
      name: "Choose From Archive",
    });
    this.closeButton = this.root.locator("button:has(i.mdi-close)").first();
    this.archiveItems = this.root.locator(".archive li");
    this.setButton = this.root.getByRole("button", {
      name: "SET",
      exact: true,
    });
    // CreateNew renders a Male and a Female MultiFileUpload, in that order.
    this.maleVoiceInput = this.root
      .locator('input[type="file"][accept="audio/*"]')
      .nth(0);
    this.femaleVoiceInput = this.root
      .locator('input[type="file"][accept="audio/*"]')
      .nth(1);
    this.saveAndSetButton = this.root.getByRole("button", {
      name: "Save & SET",
    });
  }

  /** The question-type line an archive entry shows under its index. */
  itemType(item: Locator): Locator {
    return item.locator("p").first();
  }
}
