import type { OnlineClass } from "./onlineClass.types";

/** What one sample row should render as. */
export interface ExpectedRow {
  id: string;
  title: string;
  /** Index among rows sharing this title — the sample has four "sdds Copy". */
  occurrence: number;
  modules: string;
  chapters: string;
  /** HH:MM via `secondToHour`; null when the class has no duration to show. */
  expectedDuration: string | null;
  /** Comma-joined tags; null when the class has none (see the edge data). */
  expectedTags: string | null;
  featured: boolean;
}

/** Contents of data/regular/onlineClass/onlineClassTableRegularTestData.json. */
export interface OnlineClassTableTestData {
  type: string;
  listFixture: string;
  headers: string[];
  shareModeHeaders: string[];
  thumbnailSize: { width: number; height: number };
  rows: ExpectedRow[];
  duplicateTitleTarget: { title: string; occurrence: number; id: string };
}

/** One edge row: a sample class with some fields replaced. */
export interface TableEdgeCase {
  id: string;
  scenario: string;
  override: Partial<OnlineClass>;
  /** Finding ID when the case is expected to fail until the defect is fixed. */
  finding: string | null;
}

/** Contents of data/edge/onlineClass/onlineClassTableEdgeTestData.json. */
export interface OnlineClassTableEdgeTestData {
  type: string;
  cases: TableEdgeCase[];
  emptyTags: {
    id: string;
    scenario: string;
    titles: string[];
    expected: string;
    finding: string;
  };
}
