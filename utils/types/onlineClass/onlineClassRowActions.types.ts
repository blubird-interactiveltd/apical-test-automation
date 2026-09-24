/** Contents of data/regular/onlineClass/onlineClassRowActionsRegularTestData.json. */
export interface OnlineClassRowActionsTestData {
  type: string;
  /** mdi icon classes of the row buttons, in on-screen order. */
  actionIcons: string[];
  details: {
    title: string;
    tabs: { label: string; pathSuffix: string }[];
  };
  duplicate: {
    title: string;
    confirmText: string;
    successText: string;
    copyId: string;
    copySuffix: string;
    slowSaveDelayMs: number;
  };
  duplicateWhileSearching: { term: string; title: string };
  share: {
    title: string;
    expectedSummary: string[];
    hardcodedLink: string;
    copiedText: string;
    noImageText: string;
  };
  edit: { title: string };
  xssDescription: string;
  rapidClicks: {
    slowRowIndex: number;
    fastRowIndex: number;
    slowDelayMs: number;
  };
}

/** Contents of data/regular/onlineClass/onlineClassUiRegularTestData.json. */
export interface OnlineClassUiTestData {
  type: string;
  viewportHeight: number;
  viewportWidths: number[];
  axe: { scope: string; blockingImpacts: string[]; finding: string };
}
