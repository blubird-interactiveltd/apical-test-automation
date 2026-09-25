import type { Locator, Page } from "@playwright/test";
import { CourseWizardPage } from "./courseWizard.page";

/**
 * The five list steps - PTE Practice, Practice Test, Mock Test, Quiz and
 * Materials (`views/courses/{PtePractice,PracticeTest,MockTest,Quiz,Materials}.vue`).
 * Each shows a section or type list on the left and the `Table` atom on the right.
 */
export class ItemListStepPage extends CourseWizardPage {
  readonly sections: Locator;
  readonly headerCells: Locator;
  readonly rows: Locator;
  readonly emptyAlert: Locator;
  readonly allAccess: Locator;
  readonly search: Locator;

  constructor(page: Page) {
    super(page);
    this.sections = page.locator("li label");
    this.headerCells = page.locator("table thead th:not([hidden])");
    this.rows = page.locator("table tbody tr.table-row");
    // `atom/table/Index.vue` renders a VAlert after the table when it is empty.
    this.emptyAlert = page.locator(".v-alert");
    this.allAccess = page
      .locator(".v-checkbox")
      .filter({ hasText: "All Access" })
      .locator("input[type=checkbox]");
    this.search = page.locator("input.search-box");
  }

  async openSection(name: string): Promise<void> {
    await this.sections.filter({ hasText: name }).first().click();
  }

  /** Toggles a row; every cell carries the same click handler. */
  async toggleRow(index: number): Promise<void> {
    await this.rows.nth(index).locator("td").first().click();
  }

  /** Whether each row shows the green tick of a selected item, in order. */
  async ticks(): Promise<boolean[]> {
    return this.rows.evaluateAll((rows) =>
      rows.map((row) => row.querySelector("svg") !== null),
    );
  }

  async headers(): Promise<string[]> {
    return (await this.headerCells.allInnerTexts()).map((text) => text.trim());
  }
}
