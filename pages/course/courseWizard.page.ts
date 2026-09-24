import type { Locator, Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";

/** Wizard routes, from apical `src/router/course.js`. */
export const COURSE_PATHS = {
  list: "/courses",
  wizard: "/course",
  basicInformation: "/course/basic-information",
  courseType: "/course/type",
  addOns: "/course/adons",
  ptePractice: "/course/properties/pte-practice",
  practiceTest: "/course/properties/practice-test",
  mockTest: "/course/properties/mock-test",
  quiz: "/course/properties/quiz",
  materials: "/course/properties/materials",
  liveClass: "/course/properties/live-class",
  webinars: "/course/properties/webinars",
  oneToOne: "/course/properties/one-to-one-appointment",
  durationPrice: "/course/duration-price",
  review: "/course/review",
  preview: "/course/preview",
} as const;

/** localStorage keys the wizard keeps its state in (`CreateView.vue`, every step). */
export const COURSE_STORAGE = {
  info: "course-create-info",
  menu: "course-create-menu",
} as const;

/**
 * The wizard shell, `views/courses/CreateView.vue`: heading, step sidebar and
 * the Next / Clear all buttons every step renders.
 *
 * The app ships no `data-testid`, so locators key off the view's classes and
 * visible labels.
 */
export class CourseWizardPage {
  readonly heading: Locator;
  readonly sidebarLinks: Locator;
  readonly nextButton: Locator;
  readonly clearAllButton: Locator;

  constructor(protected readonly page: Page) {
    this.heading = page.getByRole("heading", { name: /add new course/i });
    // The step list is the first `md-size-20` column of the wizard layout.
    this.sidebarLinks = page.locator(".md-layout-item.md-size-20 ul a");
    this.nextButton = page.getByRole("button", { name: /^next$/i });
    this.clearAllButton = page.getByRole("button", { name: /clear all/i });
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    await this.heading.waitFor({ timeout: timeouts.uiRenderTimeout });
  }

  sidebarLink(name: string): Locator {
    return this.sidebarLinks.filter({ hasText: new RegExp(`^\\s*${name}\\b`) });
  }

  /** Step names in the sidebar, in order, without the completion tick. */
  async sidebarSteps(): Promise<string[]> {
    const texts = await this.sidebarLinks.allInnerTexts();

    return texts.map((text) => text.replace("✓", "").trim());
  }

  /** Whether the sidebar marks a step as done (the ✓ after its name). */
  async isStepDone(name: string): Promise<boolean> {
    return (await this.sidebarLink(name).innerText()).includes("✓");
  }

  async next(): Promise<void> {
    await this.nextButton.click();
  }

  /** Every "Field is required"-style message currently shown on the step. */
  errorMessages(): Locator {
    return this.page.locator(".text-danger").filter({ hasText: /\S/ });
  }
}
