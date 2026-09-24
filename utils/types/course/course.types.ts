/** The eight add-ons the wizard can enable, as `package_detail` flags. */
export type CourseAddOn =
  | "is_pte_practice"
  | "is_practice_test"
  | "is_mock_test"
  | "is_quiz"
  | "is_materials"
  | "is_live_class"
  | "is_webinars"
  | "is_one_to_one_appointment";

/** `course_type` values offered by Course Type (`data/cms.js` courseType). */
export type CourseType = "ONLINE" | "BRANCH" | "BOTH";

/**
 * `package_detail` as the wizard builds it across its steps. Every field is
 * optional because each step adds its own and a step that is skipped or left
 * empty adds nothing.
 */
export interface CoursePackageDetail extends Partial<
  Record<CourseAddOn, boolean>
> {
  pte_practice_questions?: string[];
  pte_practice?: number | string;
  pte_practice_all_access?: boolean;
  practice_test_tests?: string[];
  practice_test?: number | string;
  mock_test_tests?: string[];
  mock_test?: number | string;
  quiz_tests?: string[];
  quiz_test?: number | string;
  material_tests?: string[];
  material_test?: number | string;
  live_classes?: number | string;
  live_class_all_access?: boolean;
  webinars?: number | string;
  webinars_all_access?: boolean;
  OneToOneAppointment?: number | string;
  one_to_one_appointment_all_access?: boolean;
  course_duration?: string | number;
  old_price?: string | number;
  new_price?: string | number;
  is_featured?: number | string;
  is_show_double_price?: number | string;
  acceptTerms?: boolean;
}

/**
 * localStorage `course-create-info`, which every step reads and writes and
 * Preview posts as the create payload.
 */
export interface CourseCreateInfo {
  name?: string;
  description?: string;
  thumbnail?: string;
  type?: string;
  organization_id?: string;
  organizations?: string[];
  course_type?: CourseType | "";
  online_link?: string;
  is_online?: boolean;
  is_branch?: boolean;
  questions?: string[];
  tests?: string[];
  package_detail?: CoursePackageDetail;
}

/** `POST /api/v1/packages` success body (`Preview.vue:146`). */
export interface CreatePackageResponse {
  message: string;
  package_id: string;
}

/** A course as `GET /api/v1/packages?type=COURSE` lists it. */
export interface CourseListItem {
  id: string;
  name: string;
  online_link: string | null;
  package_detail: {
    course_duration: string | number;
    old_price: string | number;
    new_price: string | number;
    created_at: string;
  } | null;
}

/** One page of any list endpoint the wizard reads. */
export interface ItemListResponse<T> {
  items: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface QuestionType {
  id: string;
  title: string;
  /** Must match a slug in the app's `cms.questionTypes`, or the store throws. */
  slug: string;
  section: string;
}

export interface PteQuestion {
  id: string;
  q_id: string;
  index: string;
  item: string;
}

export interface PracticeTest {
  id: string;
  t_id: string;
  title: string;
}

export interface QuizType {
  id: string;
  name: string;
}

export interface Quiz {
  id: string;
  quiz_id: string;
  title: string;
}

export interface Material {
  id: string;
  m_id: string;
  file_type: string;
  file_name: string;
}

/** A stubbed failure: the status to answer with and an optional body. */
export interface StubbedError {
  status: number;
  body?: Record<string, unknown>;
}
