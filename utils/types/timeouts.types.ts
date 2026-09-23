export interface TimeoutConfig {
  testTimeout: number;
  expectTimeout: number;
  actionTimeout: number;
  navigationTimeout: number;
  /** Budget for the Vue SPA to render the list after its first API call. */
  uiRenderTimeout: number;
  /**
   * How long a negative case watches for a request that must not be sent.
   * Absence cannot be awaited, only observed over a window; this is that window.
   */
  quietWindow: number;
}
