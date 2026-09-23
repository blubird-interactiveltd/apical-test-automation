/**
 * One row of `GET /api/v1/online-class`, as `OnlineClassListResource` shapes it
 * (apical-api `app/Http/Resources/OnlineClassListResource.php`).
 */
export interface OnlineClass {
  id: string;
  title: string;
  tags: string[];
  /** Raw HTML from the rich-text editor. */
  description: string;
  /** `prepareResource` returns null when the class has no such image. */
  banner: string | null;
  thumbnail: string | null;
  is_featured: boolean;
  properties: string[];
  /** "0" draft, "1" published — a string, not a number. */
  status: string;
  total_modules: number;
  total_chapters: number;
  /** Seconds. The list header says hours; see finding D-01. */
  total_duration: number;
  total_materials: number;
  total_pte_practices: number;
  total_practice_tests: number;
  total_quizes: number;
  total_full_mock: number;
  total_section_wise_mock: number;
  total_partial_mock: number;
  completion_rate: string;
}

export interface ListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

/** Laravel resource-collection envelope the list page reads. */
export interface OnlineClassListResponse {
  items: OnlineClass[];
  links: { prev: string | null; next: string | null };
  meta: ListMeta;
}

/** `GET /api/v1/online-class/{id}` — the list row plus detail-only fields. */
export interface OnlineClassDetailResponse {
  items: OnlineClass & {
    modules: unknown[];
    faqs: unknown[];
    why_important: string;
    total_student_taken: number;
  };
}

/** A stubbed error reply for the list endpoint. */
export interface StubbedError {
  status: number;
  body?: Record<string, unknown>;
}
