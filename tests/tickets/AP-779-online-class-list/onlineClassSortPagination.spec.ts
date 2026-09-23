import { expect, test } from "@playwright/test";
import { OnlineClassListService } from "../../../services/onlineClass/onlineClassList.service";
import {
  sampleItem,
  sampleList,
} from "../../../services/onlineClass/onlineClassApiMock.service";
import { DataLoader } from "../../../utils/dataLoader";
import { makeClasses, pageOf } from "../../../utils/listResponse";
import { backendSearch, pageParamOf } from "../../../utils/onlineClassSearch";
import type { OnlineClassPaginationTestData } from "../../../utils/types/onlineClass/onlineClassPagination.types";

const data = DataLoader.load<OnlineClassPaginationTestData>(
  "data/regular/onlineClass/onlineClassPaginationRegularTestData.json",
);

const multi = data.multiPage;
const manyClasses = makeClasses(
  sampleItem(),
  multi.totalClasses,
  multi.titlePrefix,
);

/** Serves `manyClasses`, filtered by `?search=` and sliced by `?page=`. */
const pagedOracle = (url: URL) =>
  pageOf(
    backendSearch(manyClasses, url.searchParams.get("search") ?? ""),
    pageParamOf(url.toString()),
    multi.perPage,
  );

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-779 asserts request behaviour, which is browser-independent.",
);

test.describe("AP-779 online class list sort", () => {
  test("sort dropdown reads SORT BY DATE and shows its selection (AP-779-TC-060)", async ({
    page,
  }) => {
    // Expected to fail, finding D-04: the option reads "SHORT BY DATE", the
    // model is the string "1" against an option id of the number 1, and no
    // watcher acts on a change (TeacherOnlineClassView.vue:210-212).
    test.fail();

    const { listPage } = await OnlineClassListService.open(page);

    await expect(listPage.sortSelect.locator("option").first()).toHaveText(
      "SORT BY DATE",
    );
    await expect(listPage.sortSelect).toHaveValue("1");
  });

  test("sort dropdown hides in share mode, search stays (AP-779-TC-061)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);

    await listPage.action(listPage.rows.first(), "share").click();

    await expect(listPage.sortSelect).toBeHidden();
    await expect(listPage.search).toBeVisible();
  });

  test("title column sorts one way, then the other (AP-779-TC-062)", async ({
    page,
  }) => {
    const ascending = sampleList()
      .items.map((item) => item.title)
      .sort();
    const descending = [...ascending].reverse();
    const { listPage } = await OnlineClassListService.open(page);

    await listPage.sortByTitle();
    const first = await listPage.titles();
    expect([ascending, descending]).toContainEqual(first);

    const startedAscending =
      JSON.stringify(first) === JSON.stringify(ascending);
    await listPage.sortByTitle();

    expect(await listPage.titles()).toEqual(
      startedAscending ? descending : ascending,
    );
  });
});

test.describe("AP-779 online class list pagination", () => {
  test(`paginator shows the record range (${data.singlePage.id})`, async ({
    page,
  }) => {
    // Expected to fail, finding D-03: the view binds start/end/total to
    // current_page, last_page and last_page (TeacherOnlineClassView.vue:126),
    // so a 20-record page reads "1 - 1 Of 1".
    test.fail();

    const { listPage } = await OnlineClassListService.open(page);

    await expect(listPage.paginator).toContainText(
      data.singlePage.expectedLabel,
    );
  });

  test("single page: Next and Previous send nothing (AP-779-TC-071)", async ({
    page,
  }) => {
    // Expected to fail, finding D-02: Paginate never receives `next`/`prev`
    // (defaults 1 and 100, Paginate.vue:41-48), so Next is always enabled and
    // requests page 2.
    test.fail();

    const { listPage, api } = await OnlineClassListService.open(page);

    await listPage.next();
    await listPage.previous();
    await OnlineClassListService.settle(page);

    expect(api.listRequests).toHaveLength(1);
  });

  test(`multi-page navigation goes 2 → 3 → 2 (${multi.id})`, async ({
    page,
  }) => {
    // Expected to fail, finding D-02: Next always emits `next + 1` = 2 and
    // Previous never fires, because `next` is stuck at its default of 1.
    test.fail();

    const { listPage } = await OnlineClassListService.open(page, {
      list: pagedOracle,
    });

    for (const step of multi.steps) {
      await (step.action === "next" ? listPage.next() : listPage.previous());
      await expect(listPage.row(step.expectFirstTitle)).toBeVisible();
      await expect(listPage.rows).toHaveCount(step.expectRows);
    }
  });

  test(`a new search resets to page 1 (${data.searchResetsPage.id})`, async ({
    page,
  }) => {
    const { listPage, api } = await OnlineClassListService.open(page, {
      list: pagedOracle,
    });
    await listPage.next();
    await expect
      .poll(() => api.lastListRequest()?.searchParams.get("page"))
      .toBe("2");

    await listPage.typeSearch(data.searchResetsPage.term);

    await expect
      .poll(() => api.lastListRequest()?.searchParams.get("search"))
      .toBe(data.searchResetsPage.term);
    expect(api.lastListRequest()?.searchParams.get("page")).toBe("1");
  });

  test(`paging keeps the search term (${data.searchKeptWhenPaging.id})`, async ({
    page,
  }) => {
    const term = data.searchKeptWhenPaging.term;
    const { listPage, api } = await OnlineClassListService.open(page, {
      list: pagedOracle,
    });
    await listPage.typeSearch(term);
    await expect.poll(() => api.searchTerms().at(-1)).toBe(term);

    await listPage.next();

    await expect
      .poll(() => api.lastListRequest()?.searchParams.get("page"))
      .toBe("2");
    expect(api.lastListRequest()?.searchParams.get("search")).toBe(term);
  });
});
