import type { Page } from "@playwright/test";
import { BasicInformationPage } from "../../pages/course/basicInformation.page";
import { CourseListPage } from "../../pages/course/courseList.page";
import {
  COURSE_PATHS,
  COURSE_STORAGE,
  CourseWizardPage,
} from "../../pages/course/courseWizard.page";
import type { CourseCreateInfo } from "../../utils/types/course/course.types";
import type { ApicalRole } from "../../utils/types/auth/auth.types";
import { ApicalLoginService } from "../auth/apicalLogin.service";
import {
  CourseApiMock,
  type CourseFixture,
  type PackageStubOptions,
} from "./courseApiMock.service";

export interface OpenWizardOptions {
  role?: ApicalRole;
  /** Step to open; defaults to Basic Information. */
  path?: string;
  /** Saved wizard state to start from, as `course-create-info`. */
  info?: CourseCreateInfo;
  /** Path the stubbed upload answers with. */
  uploadedPath?: string;
  emptyLists?: CourseFixture[];
  packages?: PackageStubOptions;
}

export interface OpenedWizard {
  wizard: CourseWizardPage;
  api: CourseApiMock;
}

/** Every add-on on, as the step defaults - the state a fresh wizard reaches Properties in. */
export const ALL_ADD_ONS = {
  is_pte_practice: true,
  is_practice_test: true,
  is_mock_test: true,
  is_quiz: true,
  is_materials: true,
  is_live_class: true,
  is_webinars: true,
  is_one_to_one_appointment: true,
} as const;

/** Saved state as it stands once Basic Information and Course Type are done. */
export function basicInfo(overrides: CourseCreateInfo = {}): CourseCreateInfo {
  return {
    name: "Seeded Course",
    description: "<p>Seeded description</p>",
    thumbnail: "course/thumbnails/seeded.png",
    type: "COURSE",
    organization_id: "hb53361b-06bf-495b-bddf-626fc3216310",
    organizations: ["hb53361b-06bf-495b-bddf-626fc3216310"],
    course_type: "ONLINE",
    online_link: "https://meet.example.com/seeded",
    is_online: true,
    is_branch: false,
    ...overrides,
  };
}

/** Workflows over the course create wizard that more than one spec needs. */
export class CourseWizardService {
  /**
   * Signs in, installs the stubs, seeds the saved state, opens a step.
   *
   * The state is seeded by an init script that runs once per page, guarded by
   * a sessionStorage flag, so a reload inside the spec behaves like a user's
   * reload instead of restoring the seed.
   */
  static async open(
    page: Page,
    options: OpenWizardOptions = {},
  ): Promise<OpenedWizard> {
    const api = new CourseApiMock(page);

    await ApicalLoginService.ensureLoggedIn(page, options.role ?? "master");
    await CourseWizardService.seed(page, options.info ?? null);
    await api.lists(options.emptyLists);
    await api.upload(options.uploadedPath ?? "course/thumbnails/stub.png");
    await api.packages(options.packages);

    const wizard = new CourseWizardPage(page);
    if (options.path === COURSE_PATHS.list) {
      await new CourseListPage(page).goto(COURSE_PATHS.list);
    } else {
      await wizard.goto(options.path ?? COURSE_PATHS.basicInformation);
    }

    return { wizard, api };
  }

  static async seed(page: Page, info: CourseCreateInfo | null): Promise<void> {
    await page.context().addInitScript(
      ({ key, menuKey, value }) => {
        if (window.sessionStorage.getItem("__course_seeded")) return;
        window.sessionStorage.setItem("__course_seeded", "1");
        window.localStorage.removeItem(menuKey);
        if (value) window.localStorage.setItem(key, JSON.stringify(value));
        else window.localStorage.removeItem(key);
      },
      { key: COURSE_STORAGE.info, menuKey: COURSE_STORAGE.menu, value: info },
    );
  }

  /** `course-create-info` as the app last saved it. */
  static async savedInfo(page: Page): Promise<CourseCreateInfo | null> {
    return page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as CourseCreateInfo) : null;
    }, COURSE_STORAGE.info);
  }

  /** Fills Basic Information and waits for the thumbnail upload to land. */
  static async completeBasicInformation(
    page: Page,
    values: {
      name: string;
      description: string;
      thumbnailFile?: string;
      uploadedPath: string;
    },
  ): Promise<void> {
    const step = new BasicInformationPage(page);

    await step.fillName(values.name);
    await step.chooseThumbnail(values.thumbnailFile ?? "thumb.png");
    await step.thumbnailLabel
      .filter({ hasText: values.uploadedPath })
      .waitFor();
    await step.fillDescription(values.description);
    await step.next();
    await page.waitForURL(`**${COURSE_PATHS.courseType}`);
  }
}
