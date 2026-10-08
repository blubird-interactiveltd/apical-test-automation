import type { ListResponse } from "../shared/listResponse.types";

/** The seven Speaking question-type codes (`question_types.short_title`). */
export type SpeakingTypeCode =
  | "RA"
  | "RS"
  | "DI"
  | "RL"
  | "ASQ"
  | "SGD"
  | "RTAS";

export type Frequency = "HIGH" | "MODERATE" | "LOW";

/**
 * One row of `GET /api/v1/questions/list`, as `QuestionListResource` shapes it
 * (apical-api `app/Http/Resources/QuestionListResource.php:22-55`).
 */
export interface SpeakingQuestion {
  id: string;
  q_id: string;
  index: string;
  /** `strip_tags(title ?? transcript)` — plain text, brackets kept. */
  title: string | null;
  /** The type's short_title, shown in the ITEM column. */
  item: string;
  question_type_id: string;
  question_type_slug: string;
  frequency: Frequency | null;
  /** Display name, e.g. "Exam Question" — not the enum. */
  source: string;
  active: boolean;
  approve_status: number;
  approve_status_text: string;
  /** `d M, Y h:i a` in Asia/Dhaka, e.g. "02 Oct, 2026 01:07 pm". */
  created_at: string;
  created_by: string;
  /** The creator's user id, or null for system-created rows ("Blubird"). */
  creator: string | null;
  explanations_count: number;
  taken_count: number;
  bookmark_list: unknown;
}

export type SpeakingListResponse = ListResponse<SpeakingQuestion>;

/** One entry of `GET /api/v1/question-types?section=speaking`. */
export interface SpeakingQuestionType {
  id: string;
  slug: string;
  title: string;
  short_title: SpeakingTypeCode;
  section: string;
  display_order: number;
  [field: string]: unknown;
}

export interface SpeakingQuestionTypesResponse {
  items: SpeakingQuestionType[];
}

/** `GET /api/v1/common/dropdowns?status`. */
export interface StatusDropdownResponse {
  status: { id: number; name: string }[];
}

/** The filters the oracle reads off a list request. */
export interface SpeakingListQuery {
  section: string;
  questionTypeId: string | null;
  /** `active` exactly as sent: "0", "1", "true", "false" or null. */
  active: string | null;
  search: string;
  sort: string;
  page: number;
  perPage: number;
}
