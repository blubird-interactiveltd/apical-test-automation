import type { Locator, Page } from "@playwright/test";

/** First step of the create/edit wizard. */
export const CLASS_INFORMATION_PATH =
  "/master/online-class-create/class-information";

/**
 * Step one of the online-class wizard — `create/ClassInformationView.vue`.
 *
 * Only what the list's Edit and + buttons hand over to is modelled here: the
 * class-name field, which shows whether the wizard opened prefilled or blank.
 */
export class ClassInformationPage {
  readonly titleInput: Locator;

  constructor(page: Page) {
    // "Online Class Name" is the first InputFieldComponent in the view (`:5`).
    this.titleInput = page.locator(".class-information-view input").first();
  }
}
