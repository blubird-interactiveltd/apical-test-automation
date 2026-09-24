import type { Locator, Page } from "@playwright/test";

/** The app-wide snackbar that `setShowSnackbar` drives (`App.vue:14`). */
export class SnackbarComponent {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = page.locator(".v-snackbar");
  }

  message(text: string | RegExp): Locator {
    return this.root.getByText(text);
  }
}
