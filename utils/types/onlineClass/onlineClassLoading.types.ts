/** One way the list request can come back. */
export interface LoadingEdgeCase {
  id: string;
  scenario: string;
  status: number;
  delayMs: number;
  /** Text the empty state must not contain (TC-013b). */
  forbiddenText?: string;
  /** Path the user must end on (TC-014). */
  expectedUrl?: string;
  finding: string | null;
}

/** Contents of data/edge/onlineClass/onlineClassLoadingEdgeTestData.json. */
export interface OnlineClassLoadingEdgeTestData {
  type: string;
  cases: LoadingEdgeCase[];
}
