import { expect, test } from "@playwright/test";
import {
  PTE_QUESTION_PATHS,
  SPEAKING_LIST_PATHS,
  SpeakingListPage,
} from "../../../pages/speaking/speakingList.page";
import { SpeakingListService } from "../../../services/speaking/speakingList.service";
import { LIST_RE } from "../../../services/speaking/speakingListApiMock.service";
import {
  speakingListData,
  speakingListEdgeData,
} from "../../../utils/speakingTestData";

const data = speakingListData();
const edge = speakingListEdgeData();

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-806 asserts routing and request behaviour, which is browser-independent.",
);

test.describe("AP-806 speaking list access & navigation", () => {
  test("opens the Speaking list by URL (AP-806-TC-001)", async ({ page }) => {
    const { listPage } = await SpeakingListService.open(page);

    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await expect(listPage.heading).toBeVisible();
    await expect(listPage.headerIcon).toBeVisible();
    await expect(listPage.activeTab).toHaveText(/speaking/i);
    await expect(listPage.rows).toHaveCount(data.perPage);
  });

  test("Question Management → PTE Question lands on Speaking (AP-806-TC-002)", async ({
    page,
  }) => {
    // The sidebar's Question Management entry is `master.questionManagement`,
    // which redirects to the question-creation cards; "PTE Question" links to
    // `master-pte-question.speaking` (data/question-creation/data.js:186).
    await SpeakingListService.open(page, {
      path: PTE_QUESTION_PATHS.questionManagement,
      waitForList: false,
    });
    const listPage = new SpeakingListPage(page);

    await page.getByText("PTE Question", { exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await listPage.waitForRows();
  });

  test("pte-question without a section redirects to Reading (AP-806-TC-003)", async ({
    page,
  }) => {
    await SpeakingListService.open(page, {
      path: PTE_QUESTION_PATHS.parent,
      waitForList: false,
    });

    await expect(page).toHaveURL(
      new RegExp(`${PTE_QUESTION_PATHS.parent}/reading$`),
    );
  });

  test("tabs read Speaking · Writing · Reading · Listening and switch sections (AP-806-TC-004)", async ({
    page,
  }) => {
    const { listPage, api } = await SpeakingListService.open(page);

    await expect(listPage.tabs).toHaveText(data.tabs);

    await listPage.tabs.filter({ hasText: "Writing" }).click();
    await expect(page).toHaveURL(
      new RegExp(`${PTE_QUESTION_PATHS.parent}/writing$`),
    );
    await expect
      .poll(() => api.lastListRequest()?.searchParams.get("section"))
      .toBe("writing");

    await listPage.tabs.filter({ hasText: "Speaking" }).click();
    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await expect
      .poll(() => api.lastListRequest()?.searchParams.get("section"))
      .toBe("speaking");
  });

  test("an unauthenticated visitor is sent to login (AP-806-TC-005)", async ({
    page,
  }) => {
    const listRequests: string[] = [];
    page.on("request", (request) => {
      if (LIST_RE.test(request.url())) listRequests.push(request.url());
    });

    await page.goto(SPEAKING_LIST_PATHS.master, {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL(/\/login$/);
    expect(listRequests).toEqual([]);
  });

  test("first load sends type, section and sort, and loads types and statuses (AP-806-TC-006)", async ({
    page,
  }) => {
    const typeRequests: string[] = [];
    const statusRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/v1/question-types?")) typeRequests.push(url);
      if (url.includes("/api/v1/common/dropdowns?")) statusRequests.push(url);
    });

    const { api } = await SpeakingListService.open(page);
    const first = api.listRequests[0];

    expect(first && Object.fromEntries(first.searchParams)).toEqual(
      data.initialQuery,
    );
    expect(typeRequests.some((url) => url.endsWith("?section=speaking"))).toBe(
      true,
    );
    expect(statusRequests.some((url) => url.endsWith("?status"))).toBe(true);
  });

  test("a skeleton shows while the list loads (AP-806-TC-007)", async ({
    page,
  }) => {
    const { listPage } = await SpeakingListService.open(page, {
      listDelayMs: edge.slowListMs,
      waitForRows: false,
    });

    await expect(listPage.skeleton).toBeVisible();
    await listPage.waitForRows();
    await expect(listPage.skeleton).toBeHidden();
  });
});
