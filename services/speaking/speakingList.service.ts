import type { Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";
import {
  SPEAKING_LIST_PATHS,
  SpeakingListPage,
} from "../../pages/speaking/speakingList.page";
import type { ApicalRole } from "../../utils/types/auth/auth.types";
import { ApicalLoginService } from "../auth/apicalLogin.service";
import { ApiResponseCache } from "../shared/apiResponseCache.service";
import {
  LIST_RE,
  type ListHandler,
  type ProfileReply,
  SpeakingListApiMock,
} from "./speakingListApiMock.service";

export interface OpenSpeakingListOptions {
  role?: ApicalRole;
  /** Defaults to the role's own portal path. */
  path?: string;
  /** Serves the list; defaults to the recorded questions through the oracle. */
  list?: ListHandler;
  /** Slows every list reply, to observe the loading state. */
  listDelayMs?: number;
  /**
   * Leaves the list to the real API. For cases whose point is what the server
   * does with a request — the F-03 sorts — where a stub would only replay the
   * oracle's guess.
   */
  liveList?: boolean;
  /** Edits the real `/users/profile` reply, to choose roles and permissions. */
  profile?: (profile: ProfileReply) => ProfileReply;
  /** Waits for the first row. Off for cases that expect no rows. */
  waitForRows?: boolean;
  /**
   * Waits for the Speaking heading. Off for paths that are not the list,
   * such as a parent route that redirects elsewhere.
   */
  waitForList?: boolean;
}

export interface OpenedSpeakingList {
  listPage: SpeakingListPage;
  api: SpeakingListApiMock;
}

/** Workflows over the Speaking question list that more than one spec needs. */
export class SpeakingListService {
  /**
   * Signs in, installs the cache and stubs, opens the list.
   *
   * Stubs go in before navigating: the list request fires from `created()`,
   * so a route added after `goto` would miss it.
   */
  static async open(
    page: Page,
    options: OpenSpeakingListOptions = {},
  ): Promise<OpenedSpeakingList> {
    const role = options.role ?? "master";
    const api = new SpeakingListApiMock(page);

    await ApicalLoginService.ensureLoggedIn(page, role);
    await ApiResponseCache.install(page, {
      bypass: options.liveList ? [LIST_RE] : [],
    });

    if (!options.liveList) {
      await api.list(options.list, { delayMs: options.listDelayMs ?? 0 });
    }
    await api.questionTypes();
    await api.statuses();
    if (options.profile) {
      await api.profile(options.profile);
    }

    const listPage = new SpeakingListPage(page);
    const path = options.path ?? SPEAKING_LIST_PATHS[role];

    if (options.waitForList === false) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      return { listPage, api };
    }

    await listPage.goto(path);

    if (options.waitForRows ?? true) {
      await listPage.waitForRows();
    }

    return { listPage, api };
  }

  /**
   * Waits out the quiet window, then returns.
   *
   * For negative cases that assert a request was *not* sent: absence cannot be
   * awaited, only observed, so requests are counted after this window.
   */
  static async settle(page: Page): Promise<void> {
    await page.waitForTimeout(timeouts.quietWindow);
  }

  /**
   * A profile reply demoted from SUPER_ADMIN, holding the real permission ids
   * minus `without`.
   */
  static withoutPermissions(...without: number[]) {
    return (profile: ProfileReply): ProfileReply => ({
      ...profile,
      data: {
        ...profile.data,
        role: "QA_RESTRICTED_ADMIN",
        permissions: (profile.data.permissions ?? []).filter(
          (id) => !without.includes(Number(id)),
        ),
      },
    });
  }
}
