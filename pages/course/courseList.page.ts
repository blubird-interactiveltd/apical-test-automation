import type { Locator, Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";

/** The course list, `views/courses/IndexView.vue` (route `courses`). */
export class CourseListPage {
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", { name: /^course$/i });
    // v-btn with `:to` renders an <a>.
    this.createButton = page.getByRole("link", { name: /create new course/i });
    this.rows = page.locator("table tbody tr.table-row");
  }

  async goto(path = "/courses"): Promise<void> {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    await this.heading.waitFor({ timeout: timeouts.uiRenderTimeout });
  }

  /** The edit (pencil) action of a row. */
  editAction(row: Locator): Locator {
    return row.locator("button:has(.mdi-pencil)");
  }
}
