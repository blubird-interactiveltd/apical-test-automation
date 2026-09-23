import type { Locator, Page } from "@playwright/test";

/**
 * The open Vuetify dialog (`atom/Dialog.vue` wraps `v-dialog`).
 *
 * Scoped to the active overlay: Vuetify keeps closed overlays in the DOM, so an
 * unscoped `.v-overlay__content` can match a dialog that is no longer shown.
 */
export function activeDialog(page: Page): Locator {
  return page.locator(".v-overlay--active .v-overlay__content");
}
