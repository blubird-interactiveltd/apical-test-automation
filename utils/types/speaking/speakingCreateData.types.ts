import type { StubbedError } from "../shared/listResponse.types";
import type { SpeakingMediaName, TypeTiming } from "./speakingCreate.types";
import type { SpeakingTypeCode } from "./speakingList.types";

export interface SpeakingCreateType {
  code: SpeakingTypeCode;
  id: string;
  slug: string;
  title: string;
  /** Whether the form offers "Choose Sample Answer" (`is_sample_answer`). */
  sampleAnswer: boolean;
  prompt: string;
  videoPrompt: string | null;
  timing: TypeTiming;
}

export interface OptionData {
  id: string;
  label: string;
}

/** The text and keywords one type's "create with all fields" case uses. */
export interface TypeContentData {
  title?: string;
  transcript?: string;
  keywords?: string;
  plainTitle?: string;
  plainTranscript?: string;
  manualKeyword?: string;
  literalKeyword?: string;
}

export interface KeywordCase {
  text: string;
  manual?: string;
  expected?: string;
  contains?: string;
  synced?: string;
  after?: string;
  expectedText?: string;
  edited?: string;
}

/** Contents of data/regular/speaking/speakingCreateRegularTestData.json. */
export interface SpeakingCreateTestData {
  type: string;
  createQuery: string;
  heading: string;
  headingSection: string;
  backLabel: string;
  types: SpeakingCreateType[];
  defaults: {
    source: string;
    sourceLabel: string;
    frequency: string;
    frequencyLabel: string;
  };
  sourceOptions: OptionData[];
  frequencyOptions: OptionData[];
  hiddenDefaults: Record<string, string | boolean>;
  absentFromPayload: string[];
  approveStatus: number;
  qIdPattern: string;
  messages: Record<
    | "created"
    | "indexRequired"
    | "indexTaken"
    | "sourceRequired"
    | "titleRequired"
    | "transcriptRequired"
    | "imageRequired"
    | "filePathRequired"
    | "keywordHint"
    | "bracketHint"
    | "saved"
    | "invalidSampleAnswer",
    string
  >;
  upload: {
    audioType: string;
    imageType: string;
    videoType: string;
    accept: Record<"audio" | "image" | "video", string>;
    audioUrlPattern: string;
    httpsUrlPattern: string;
  };
  mediaSeconds: Partial<Record<SpeakingMediaName, number>>;
  content: Record<SpeakingTypeCode, TypeContentData>;
  keywordCases: Record<
    | "single"
    | "multiWord"
    | "specialCharacters"
    | "duplicates"
    | "manualKept"
    | "doubleBrackets"
    | "removeKeyword"
    | "removeBrackets"
    | "savedVerbatim",
    KeywordCase
  >;
  statusLabels: Record<"published" | "draft", string>;
  frequencyColour: Record<"HIGH" | "MODERATE" | "LOW", string>;
  sampleAnswerDialog: Record<
    "heading" | "chip" | "createNew" | "archive" | "set" | "saveAndSet",
    string
  >;
  longTitleLength: number;
  otherSections: string[];
}

/** A stubbed upload reply with the file name a case picks. */
export interface StubbedUpload extends StubbedError {
  fileName: string;
  mimeType: string;
}

/** Contents of data/edge/speaking/speakingCreateEdgeTestData.json. */
export interface SpeakingCreateEdgeTestData {
  type: string;
  whitespaceIndex: string;
  maxIndexLength: number;
  unicodeIndexSuffix: string;
  whitespaceTitle: string;
  richTitle: { html: string; bold: string; italic: string };
  serverError: StubbedError;
  slowUploadMs: number;
  uploadForbidden: StubbedError;
  bigAudio: StubbedUpload;
  bigImage: StubbedUpload;
  /** Ids a stubbed "Save & SET" and question create answer with; nothing is saved. */
  stubbedSampleAnswer: { id: string; fileUrl: string; questionId: string };
  invalidType: Record<"audio" | "image" | "video" | "generic", string>;
  api: {
    missingKeys: string[];
    badEnums: { key: string; value: string }[];
    nonUrlFilePath: string;
    errorMessage: string;
    errorStatus: string;
    leakMarkers: string[];
    permissionMessages: string[];
  };
}
