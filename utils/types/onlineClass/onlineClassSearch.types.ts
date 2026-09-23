/** A search term and the titles the backend's LIKE rules return for it. */
export interface SearchRegularCase {
  id: string;
  scenario: string;
  term: string;
  /** In API order, as `scopeOfSearch` + `created_at desc` return them. */
  expectedTitles: string[];
}

/** Contents of data/regular/onlineClass/onlineClassSearchRegularTestData.json. */
export interface OnlineClassSearchTestData {
  type: string;
  cases: SearchRegularCase[];
}

/** One front-end search edge case. Fields beyond `term` apply to some cases only. */
export interface SearchEdgeCase {
  id: string;
  scenario: string;
  term: string;
  /** Term typed first, before shrinking to `term` (TC-047). */
  from?: string;
  /** Prefix whose response is delayed to force an out-of-order reply (TC-052). */
  slowPrefix?: string;
  slowPrefixDelayMs?: number;
  finding: string | null;
}

/** One backend-only search case, run against real data. */
export interface SearchLiveCase {
  id: string;
  scenario: string;
  terms: string[];
  /** Whether every term must return no rows; false checks only the status. */
  expectEmpty: boolean;
  finding: string | null;
}

/** Contents of data/edge/onlineClass/onlineClassSearchEdgeTestData.json. */
export interface OnlineClassSearchEdgeTestData {
  type: string;
  cases: SearchEdgeCase[];
  live: SearchLiveCase[];
}
