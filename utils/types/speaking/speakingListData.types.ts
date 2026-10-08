import type { SpeakingTypeCode } from "./speakingList.types";

export interface SpeakingTypeData {
  code: SpeakingTypeCode;
  title: string;
  id: string;
  /** Questions of this type in the recorded fixture. */
  count: number;
}

/** Contents of data/regular/speaking/speakingListRegularTestData.json. */
export interface SpeakingListTestData {
  type: string;
  recordedOn: string;
  total: number;
  perPage: number;
  headers: string[];
  tabs: string[];
  initialQuery: Record<string, string>;
  types: SpeakingTypeData[];
  allTypeLabel: string;
  statuses: string[];
  draftCount: number;
  repeatSentenceDraftCount: number;
  newest: { qId: string; index: string; createdAt: string };
  oldest: { qId: string; createdAt: string };
  withCreator: { qId: string; creator: string };
  withoutCreator: { qId: string; createdBy: string };
  frequencyColour: Record<"HIGH" | "MODERATE" | "LOW", string>;
  statusLabel: Record<"published" | "draft", { text: string; class: string }>;
  search: {
    placeholder: string;
    qIdTerm: string;
    qIdTermMatches: number;
    fullIndex: { term: string; qId: string };
    shortTerms: string[];
    noMatch: string;
    combined: {
      typeCode: SpeakingTypeCode;
      status: string;
      term: string;
      matches: number;
    };
    pageResetTerm: string;
  };
  pagination: {
    firstLabel: string;
    secondLabel: string;
    lastLabel: string;
    lastPage: number;
    lastPageRows: number;
    singlePageType: SpeakingTypeCode;
    singlePageLabel: string;
    emptyLabel: string;
  };
  permissionIds: Record<
    "QUESTION_STORE" | "QUESTION_SHOW" | "QUESTION_UPDATE" | "QUESTION_DESTROY",
    number
  >;
}

/** Contents of data/edge/speaking/speakingListEdgeTestData.json. */
export interface SpeakingListEdgeTestData {
  type: string;
  longIndexLength: number;
  htmlTitle: string;
  lowFrequency: { qId: string; frequency: "LOW" };
  nullFrequency: { qId: string };
  specialSearchTerms: string[];
  caseSearch: { term: string; matchesWhenInsensitive: number };
  unknownSortColumn: string;
  listError: { status: number; message: string };
  slowListMs: number;
}
