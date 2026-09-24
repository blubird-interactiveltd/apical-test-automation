import type { Locator, Page } from "@playwright/test";
import { CourseWizardPage } from "./courseWizard.page";

/**
 * Review and Preview (`views/courses/Review.vue`, `Preview.vue`). Both render
 * the saved `course-create-info` through the `Content` atom - a label <p>, a
 * text <p> and a `v-html` <p> - plus a list of the enabled properties.
 */
export class CourseReviewPage extends CourseWizardPage {
  readonly properties: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.properties = page.locator("ul li.font-bold");
    this.saveButton = page.getByRole("button", { name: /^save$/i });
  }

  /** The `Content` block whose label reads exactly `label`. */
  block(label: string): Locator {
    return this.page
      .locator("div.my-2")
      .filter({
        has: this.page.locator("p", { hasText: new RegExp(`^${label}$`, "i") }),
      })
      .first();
  }

  /**
   * The block's text value (its second <p>), trimmed. Read as textContent:
   * the blocks are `text-uppercase`, and innerText returns the transformed text.
   */
  async value(label: string): Promise<string> {
    return (
      (await this.block(label).locator("p").nth(1).textContent()) ?? ""
    ).trim();
  }

  /** The block's rendered HTML value (its third <p>). */
  htmlValue(label: string): Locator {
    return this.block(label).locator("p").nth(2);
  }

  /** "Number of Quiz" -> "1", from the property list. */
  async property(name: string): Promise<string | null> {
    const item = this.properties.filter({ hasText: name });

    if ((await item.count()) === 0) return null;

    return ((await item.first().textContent()) ?? "").replace(name, "").trim();
  }
}
