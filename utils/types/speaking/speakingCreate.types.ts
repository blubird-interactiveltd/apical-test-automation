import type { Frequency, SpeakingTypeCode } from "./speakingList.types";

export type QuestionSource = "EXAM_QUESTION" | "PRACTICE";

/** How a type's media is stored: `file_type` on the question. */
export type MediaKind = "audio" | "image" | "video";

/** One entry of a question's `sample_answers` map, keyed by sample-answer id. */
export interface SampleAnswerLink {
  is_default: boolean;
  selected_from_archive: boolean;
}

/**
 * The body `CreateView.onSubmit` sends to `POST /api/v1/questions`, after
 * `cleanPayload` has dropped null, undefined and empty arrays/objects.
 */
export interface QuestionPayload {
  index?: string;
  question_type_id?: string;
  prompt_type?: string;
  prompt?: string;
  preparation_time_type?: string;
  preparation_time?: number;
  answer_time_type?: string;
  answer_time?: number;
  source?: QuestionSource | string;
  frequency?: Frequency | string;
  active?: boolean;
  type?: string;
  is_requested?: boolean;
  title?: string;
  transcript?: string;
  keywords?: string;
  file_path?: string;
  file_type?: MediaKind | string;
  study_guide_id?: string;
  sample_answer_id?: string;
  sample_answers?: Record<string, SampleAnswerLink>;
  question_options?: unknown[];
  explanations?: unknown;
  [key: string]: unknown;
}

/** `201` reply of `POST /api/v1/questions`. */
export interface QuestionCreatedResponse {
  question_id: string;
  message: string;
}

/** The validation reply the API sends on `422`. */
export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string[]>;
  status?: string;
  [key: string]: unknown;
}

/** One sample answer as `QuestionShowResource` nests it. */
export interface SampleAnswerRecord {
  id?: string;
  sample_answer_id?: string;
  [key: string]: unknown;
}

/**
 * `GET /api/v1/questions/{id}` (`QuestionShowResource`). The `edit` read keeps
 * `[brackets]` and adds keywords, status and creator; the plain read strips them.
 */
export interface QuestionRecord {
  id: string;
  q_id: string;
  index: string;
  question_type_id: string;
  title: string | null;
  transcript?: string | null;
  keywords?: string | null;
  frequency: Frequency | null;
  source: QuestionSource | null;
  prompt: string | null;
  total_answer_time: number | string;
  file_path: string | null;
  file_type: MediaKind | null;
  additional_file_path?: string | null;
  question_type: {
    id: string;
    slug: string;
    title: string;
    short_title: SpeakingTypeCode;
  };
  sample_answers: SampleAnswerRecord[] | "";
  active?: boolean | number;
  approve_status?: number;
  created_by?: string;
  [key: string]: unknown;
}

export interface QuestionRecordResponse {
  items: QuestionRecord;
}

/** `POST /api/v1/common/upload-file` reply. */
export interface UploadResponse {
  message: string;
  data: { filepath: string; [key: string]: unknown };
}

/** One entry of `GET /api/v1/sample-answer/list`. */
export interface SampleAnswerListItem {
  sample_answer_id: string;
  sa_id?: string | number;
  index?: string;
  question_type?: string;
  [key: string]: unknown;
}

export interface SampleAnswerListResponse {
  items: SampleAnswerListItem[];
}

/** What a type's server timing rule needs (`question_types` columns). */
export interface TypeTiming {
  preparation_time: number;
  preparation_time_pre_audio: number;
  answer_time: number;
  is_beep: boolean;
  answer_time_calculation_type:
    | "fixed_answer_time"
    | "pre_post_answer_time"
    | "pre_post_file_length_answer_time";
}

/** The media files the suite generates (see `utils/speakingMedia.ts`). */
export type SpeakingMediaName =
  | "speaking-short.mp3"
  | "speaking-short-2.mp3"
  | "speaking-lecture.mp3"
  | "speaking-discussion.mp3"
  | "speaking-short.wav"
  | "speaking-short.aac"
  | "speaking-lecture.mp4"
  | "describe-image.png"
  | "describe-image.jpg"
  | "describe-image.gif"
  | "describe-image.webp"
  | "invalid.pdf";
