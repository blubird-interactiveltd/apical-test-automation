import type { CourseAddOn, CourseCreateInfo, CourseType } from "./course.types";

/** Contents of data/regular/course/courseBasicInformationRegularTestData.json. */
export interface CourseBasicInformationTestData {
  type: string;
  valid: {
    name: string;
    thumbnailFile: string;
    /** Path the stubbed upload returns; the step stores it as `thumbnail`. */
    uploadedPath: string;
    description: string;
  };
  richDescription: { html: string; boldText: string; listItem: string };
}

/** One Basic Information field left empty (TC-006..008). */
export interface RequiredFieldCase {
  id: string;
  scenario: string;
  omit: "name" | "thumbnail" | "description";
}

export interface CourseBasicInformationEdgeTestData {
  type: string;
  required: RequiredFieldCase[];
  whitespaceName: string;
  unicodeName: string;
  /** Longer than the 255 characters a VARCHAR name column holds. */
  overLengthName: string;
  invalidFile: { name: string; mimeType: string };
  tooLargeMessage: string;
}

/** One course type and the flags Course Type must derive from it (TC-014..016). */
export interface CourseTypeCase {
  id: string;
  scenario: string;
  courseType: CourseType;
  onlineLink: string;
  expected: { is_online: boolean; is_branch: boolean };
}

export interface CourseTypeTestData {
  type: string;
  cases: CourseTypeCase[];
  invalidLink: string;
}

/** Wizard step as the sidebar names it and the route it lives on. */
export interface WizardStep {
  name: string;
  path: string;
}

export interface CourseAddOnsTestData {
  type: string;
  /** Add-ons in the order the step lists them, with their row label. */
  addOns: { key: CourseAddOn; label: string; step: WizardStep | null }[];
  partial: {
    id: string;
    disable: CourseAddOn[];
    expectedFirstStep: string;
    hiddenSteps: string[];
  };
}

/** One slider step: its route and the `package_detail` fields it writes (TC-028..030). */
export interface SliderStepCase {
  id: string;
  scenario: string;
  path: string;
  countField: string;
  allAccessField: string;
  slider: number;
  expectedFromSlider: number;
  typed: number;
  expectedSliderFromTyped: number;
}

export interface CourseSliderTestData {
  type: string;
  cases: SliderStepCase[];
}

/** One list step: route, fixture, and the fields its selection writes (TC-022..027). */
export interface ListStepCase {
  id: string;
  scenario: string;
  path: string;
  /** Section label to click first, when the step lists nothing until one is chosen. */
  section: string | null;
  pick: number[];
  idsField: string;
  countField: string;
}

export interface CoursePropertiesTestData {
  type: string;
  cases: ListStepCase[];
  searchTerm: string;
}

export interface CourseDurationPriceTestData {
  type: string;
  valid: { duration: string; oldPrice: string; newPrice: string };
}

export interface DurationPriceEdgeCase {
  id: string;
  field: "duration" | "oldPrice" | "newPrice";
  value: string;
}

export interface CourseDurationPriceEdgeTestData {
  type: string;
  invalidNumbers: DurationPriceEdgeCase[];
}

/** Every value TC-044 enters, and the payload it must produce. */
export interface CourseSubmitTestData {
  type: string;
  name: string;
  description: string;
  uploadedPath: string;
  courseType: CourseType;
  onlineLink: string;
  pick: {
    pte: number;
    practice: number;
    mock: number;
    quiz: number;
    material: number;
  };
  slider: number;
  duration: string;
  oldPrice: string;
  newPrice: string;
  packageId: string;
  renamedThumbnail: string;
  successMessage: string;
}

/** Contents of data/regular/course/courseApiRegularTestData.json. */
export interface CourseApiTestData {
  type: string;
  /** A course with no add-ons, so it references no other records. */
  payload: CourseCreateInfo;
  updatedThumbnail: string;
}

/** One field removed from the create payload (TC-050). */
export interface MissingFieldCase {
  id: string;
  scenario: string;
  path: string[];
}

export interface CourseApiEdgeTestData {
  type: string;
  missingFields: MissingFieldCase[];
  scriptDescription: string;
  foreignOrganizationId: string;
  unknownPackageId: string;
}
