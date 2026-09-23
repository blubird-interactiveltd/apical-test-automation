import type { Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";
import {
  ONLINE_CLASS_LIST_PATHS,
  OnlineClassListPage,
} from "../../pages/onlineClass/onlineClassList.page";
import type { ApicalRole } from "../../utils/types/auth/auth.types";
import type { OnlineClass } from "../../utils/types/onlineClass/onlineClass.types";
import { ApicalLoginService } from "../auth/apicalLogin.service";
import {
  type ListHandler,
  OnlineClassApiMock,
} from "./onlineClassApiMock.service";

export interface OpenListOptions {
  role?: ApicalRole;
  /** Defaults to the role's own portal path. */
  path?: string;
  /** Serves the list; defaults to the sample fixture. */
  list?: ListHandler;
  /** Classes the detail stub can serve; defaults to the sample. */
  details?: OnlineClass[];
  /** Waits for the first row. Off for cases that expect no rows. */
  waitForRows?: boolean;
}

export interface OpenedList {
  listPage: OnlineClassListPage;
  api: OnlineClassApiMock;
}

/** Workflows over the online class list that more than one spec needs. */
export class OnlineClassListService {
  /**
   * Signs in, installs the stubs, opens the list.
   *
   * Stubs go in before navigating: the list request fires from `onMounted`,
   * so a route added after `goto` would miss it.
   */
  static async open(
    page: Page,
    options: OpenListOptions = {},
  ): Promise<OpenedList> {
    const role = options.role ?? "master";
    const api = new OnlineClassApiMock(page);

    await ApicalLoginService.ensureLoggedIn(page, role);
    await api.list(options.list);
    await api.detail(options.details);

    const listPage = new OnlineClassListPage(page);
    await listPage.goto(options.path ?? ONLINE_CLASS_LIST_PATHS[role]);

    if (options.waitForRows ?? true) {
      await listPage.rows
        .first()
        .waitFor({ timeout: timeouts.uiRenderTimeout });
    }

    return { listPage, api };
  }

  /**
   * Waits out the quiet window, then returns.
   *
   * For negative cases that assert a request was *not* sent: absence cannot be
   * awaited, only observed, so requests are counted after this window rather
   * than awaited with `waitForRequest`, which would burn its full timeout on
   * every case that passes.
   */
  static async settle(page: Page): Promise<void> {
    await page.waitForTimeout(timeouts.quietWindow);
  }
}
