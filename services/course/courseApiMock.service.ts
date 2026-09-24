import type { Page, Route } from "@playwright/test";
import { Fixtures } from "../../utils/fixtures";
import type {
  CourseCreateInfo,
  CourseListItem,
  ItemListResponse,
  StubbedError,
} from "../../utils/types/course/course.types";

/** The recorded response each list endpoint is served from. */
export const COURSE_FIXTURES = {
  questionTypes: "courseQuestionTypes.response.json",
  questions: "courseQuestions.response.json",
  practiceTests: "coursePracticeTests.response.json",
  mockTests: "courseMockTests.response.json",
  quizTypes: "courseQuizTypes.response.json",
  quizzes: "courseQuizzes.response.json",
  materials: "courseMaterials.response.json",
  courseList: "courseList.response.json",
} as const;

export type CourseFixture = keyof typeof COURSE_FIXTURES;

// Anchored at the path so `/quiz` does not also catch `/quiz-types`, and
// `/packages` (create, list) is kept apart from `/packages/{id}` (update).
const RE = {
  questionTypes: /\/api\/v1\/question-types(\?.*)?$/,
  questions: /\/api\/v1\/questions\/list(\?.*)?$/,
  practiceTests: /\/api\/v1\/practice-tests\/list(\?.*)?$/,
  quizTypes: /\/api\/v1\/quiz-types(\?.*)?$/,
  quizzes: /\/api\/v1\/quiz(\?.*)?$/,
  materials: /\/api\/v1\/materials(\?.*)?$/,
  upload: /\/api\/v1\/common\/upload-file$/,
  packages: /\/api\/v1\/packages(\?.*)?$/,
  packageById: /\/api\/v1\/packages\/[^/?]+$/,
} as const;

/** A fixture's list, freshly cloned. */
export function fixtureList<T>(name: CourseFixture): ItemListResponse<T> {
  return Fixtures.api<ItemListResponse<T>>(COURSE_FIXTURES[name]);
}

/** The ids of a fixture's items, in order. */
export function fixtureIds(name: CourseFixture): string[] {
  return fixtureList<{ id: string }>(name).items.map((item) => item.id);
}

const empty = <T>(): ItemListResponse<T> => ({
  items: [],
  meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
});

export interface PackageStubOptions {
  /** Answers the create call with this error instead of success. */
  createError?: StubbedError;
  createDelayMs?: number;
  packageId?: string;
  message?: string;
}

/**
 * Stubs every endpoint the course wizard reads or writes, and records what it
 * was sent.
 *
 * Login, profile and permissions still reach the backend, so the wizard runs
 * inside a genuine session and only its data is controlled - and nothing a
 * spec does writes a course.
 */
export class CourseApiMock {
  readonly createBodies: CourseCreateInfo[] = [];
  readonly updateCalls: { id: string; body: CourseCreateInfo }[] = [];
  readonly listRequests: { endpoint: string; url: URL }[] = [];
  readonly uploads: number[] = [];

  constructor(private readonly page: Page) {}

  /** Serves every list from its fixture, or empty for the names in `emptyLists`. */
  async lists(emptyLists: CourseFixture[] = []): Promise<void> {
    const serve =
      (endpoint: string, pick: (url: URL) => CourseFixture) =>
      async (route: Route) => {
        const url = new URL(route.request().url());
        this.listRequests.push({ endpoint, url });
        const name = pick(url);

        return route.fulfill({
          json: emptyLists.includes(name) ? empty() : fixtureList(name),
        });
      };

    await this.page.route(
      RE.questionTypes,
      serve("questionTypes", () => "questionTypes"),
    );
    await this.page.route(
      RE.questions,
      serve("questions", () => "questions"),
    );
    // Practice Test and Mock Test share one endpoint, told apart by `type`.
    await this.page.route(
      RE.practiceTests,
      serve("practiceTests", (url) =>
        url.searchParams.get("type") === "PRACTICE"
          ? "practiceTests"
          : "mockTests",
      ),
    );
    await this.page.route(
      RE.quizTypes,
      serve("quizTypes", () => "quizTypes"),
    );
    await this.page.route(
      RE.quizzes,
      serve("quizzes", () => "quizzes"),
    );
    await this.page.route(
      RE.materials,
      serve("materials", () => "materials"),
    );
  }

  /** Serves `POST /common/upload-file` with `filePath`, or an error. */
  async upload(filePath: string, error?: StubbedError): Promise<void> {
    await this.page.route(RE.upload, (route) => {
      this.uploads.push(Date.now());

      if (error) {
        return route.fulfill({
          status: error.status,
          json: error.body ?? { message: "error" },
        });
      }

      // FileUploadComponent reads `response.data.filepath`.
      return route.fulfill({ json: { data: { filepath: filePath } } });
    });
  }

  /** Serves the course list, and create / update of a package. */
  async packages(
    options: PackageStubOptions = {},
    courses?: CourseListItem[],
  ): Promise<void> {
    const packageId =
      options.packageId ?? "5f0c1c1e-0000-4000-8000-000000000999";

    await this.page.route(RE.packages, async (route) => {
      const method = route.request().method();

      if (method === "GET") {
        const list = fixtureList<CourseListItem>("courseList");
        return route.fulfill({
          json: { ...list, items: courses ?? list.items },
        });
      }
      if (method !== "POST") return route.fallback();

      this.createBodies.push(
        route.request().postDataJSON() as CourseCreateInfo,
      );
      if (options.createDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.createDelayMs),
        );
      }
      if (options.createError) {
        return route.fulfill({
          status: options.createError.status,
          json: options.createError.body ?? { message: "Server error" },
        });
      }

      return route.fulfill({
        json: {
          message: options.message ?? "Course created successfully",
          package_id: packageId,
        },
      });
    });

    await this.page.route(RE.packageById, (route) => {
      if (route.request().method() !== "PUT") return route.fallback();

      const id = new URL(route.request().url()).pathname.split("/").pop() ?? "";
      this.updateCalls.push({
        id,
        body: route.request().postDataJSON() as CourseCreateInfo,
      });

      return route.fulfill({
        json: { message: "Course updated successfully" },
      });
    });
  }

  requestsTo(endpoint: string): URL[] {
    return this.listRequests
      .filter((entry) => entry.endpoint === endpoint)
      .map((entry) => entry.url);
  }
}
