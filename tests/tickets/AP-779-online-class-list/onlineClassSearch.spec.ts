import { expect, test } from "@playwright/test";
import { OnlineClassListService } from "../../../services/onlineClass/onlineClassList.service";
import { sampleList } from "../../../services/onlineClass/onlineClassApiMock.service";
import { DataLoader } from "../../../utils/dataLoader";
import { buildListResponse } from "../../../utils/listResponse";
import { backendSearch } from "../../../utils/onlineClassSearch";
import { caseById } from "../../../utils/testData";
import type {
  OnlineClassSearchEdgeTestData,
  OnlineClassSearchTestData,
} from "../../../utils/types/onlineClass/onlineClassSearch.types";

const data = DataLoader.load<OnlineClassSearchTestData>(
  "data/regular/onlineClass/onlineClassSearchRegularTestData.json",
);
const edge = DataLoader.load<OnlineClassSearchEdgeTestData>(
  "data/edge/onlineClass/onlineClassSearchEdgeTestData.json",
);

const items = sampleList().items;

/** Answers `?search=` the way the backend would, over the sample data. */
const searchOracle = (url: URL) =>
  buildListResponse(backendSearch(items, url.searchParams.get("search") ?? ""));

const titlesFor = (term: string) =>
  backendSearch(items, term).map((item) => item.title);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-779 asserts request behaviour, which is browser-independent.",
);

test.describe("AP-779 online class list search", () => {
  for (const scenario of data.cases) {
    test(`renders results that ${scenario.scenario} (${scenario.id})`, async ({
      page,
    }) => {
      const { listPage } = await OnlineClassListService.open(page, {
        list: searchOracle,
      });

      await listPage.typeSearch(scenario.term);

      await expect(listPage.rows).toHaveCount(scenario.expectedTitles.length);
      expect(await listPage.titles()).toEqual(scenario.expectedTitles);
    });
  }

  test("clearing the search restores the full list (AP-779-TC-046)", async ({
    page,
  }) => {
    const first = data.cases[0];
    if (!first)
      throw new Error(
        "onlineClassSearchRegularTestData.json carries no cases.",
      );

    const { listPage, api } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });
    await listPage.typeSearch(first.term);
    await expect(listPage.rows).toHaveCount(first.expectedTitles.length);

    await listPage.replaceSearch("");

    await expect(listPage.rows).toHaveCount(items.length);
    expect(api.lastListRequest()?.searchParams.get("search")).toBe("");
  });
});

test.describe("AP-779 online class list search edge cases", () => {
  const belowMin = caseById(edge.cases, "AP-779-TC-040");
  test(`${belowMin.scenario} (${belowMin.id})`, async ({ page }) => {
    const { listPage, api } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });

    await listPage.typeSearch(belowMin.term);
    await OnlineClassListService.settle(page);

    expect(api.searchTerms()).toEqual([]);
    expect(api.listRequests).toHaveLength(1);
  });

  const third = caseById(edge.cases, "AP-779-TC-041");
  test(`${third.scenario} (${third.id})`, async ({ page }) => {
    const { listPage } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });
    const request = page.waitForRequest(
      (candidate) =>
        /\/api\/v1\/online-class\?/.test(candidate.url()) &&
        new URL(candidate.url()).searchParams.get("search") === third.term,
    );

    await listPage.typeSearch(third.term);

    const url = new URL((await request).url());
    expect(url.searchParams.get("page")).toBe("1");
  });

  const shrink = caseById(edge.cases, "AP-779-TC-047");
  test(`${shrink.scenario} (${shrink.id})`, async ({ page }) => {
    // Expected to fail, finding D-09: the watcher only searches at length >= 3
    // or on reaching 0 (TeacherOnlineClassView.vue:350-356), so results for
    // the longer term stay on screen once it is shortened to two characters.
    test.fail();

    const from = shrink.from ?? "";
    const { listPage } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });
    await listPage.typeSearch(from);
    await expect(listPage.rows).toHaveCount(titlesFor(from).length);

    for (let index = from.length; index > shrink.term.length; index--) {
      await listPage.pressSearchKey("Backspace");
    }
    await OnlineClassListService.settle(page);

    expect(await listPage.titles()).toEqual(titlesFor(shrink.term));
  });

  const enter = caseById(edge.cases, "AP-779-TC-048");
  test(`${enter.scenario} (${enter.id})`, async ({ page }) => {
    const { listPage } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });
    await listPage.typeSearch(enter.term);
    const request = page.waitForRequest(
      (candidate) =>
        new URL(candidate.url()).searchParams.get("search") === enter.term,
    );

    await listPage.pressSearchKey("Enter");
    await request;

    await expect(listPage.rows).toHaveCount(titlesFor(enter.term).length);
  });

  const script = caseById(edge.cases, "AP-779-TC-049");
  test(`${script.scenario} (${script.id})`, async ({ page }) => {
    let dialogFired = false;
    page.on("dialog", async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    const { listPage } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });
    const request = page.waitForRequest((candidate) =>
      candidate.url().includes("search="),
    );

    await listPage.replaceSearch(script.term);

    expect(new URL((await request).url()).searchParams.get("search")).toBe(
      script.term,
    );
    await OnlineClassListService.settle(page);
    expect(dialogFired).toBe(false);
  });

  const noMatch = caseById(edge.cases, "AP-779-TC-050");
  test(`${noMatch.scenario} (${noMatch.id})`, async ({ page }) => {
    const { listPage } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });

    await listPage.typeSearch(noMatch.term);

    await expect(listPage.rows).toHaveCount(0);
    await expect(listPage.emptyAlert).toBeVisible();
  });

  const race = caseById(edge.cases, "AP-779-TC-052");
  test(`${race.scenario} (${race.id})`, async ({ page }) => {
    // Expected to fail, finding D-09: no debounce and no cancellation. Every
    // keystroke from the third character dispatches a request, and whichever
    // response arrives last wins - here the slowed first one.
    test.fail();

    const { listPage } = await OnlineClassListService.open(page, {
      list: async (url) => {
        if (url.searchParams.get("search") === race.slowPrefix) {
          await new Promise((resolve) =>
            setTimeout(resolve, race.slowPrefixDelayMs ?? 0),
          );
        }
        return searchOracle(url);
      },
    });

    await listPage.typeSearch(race.term);
    await page.waitForTimeout((race.slowPrefixDelayMs ?? 0) + 1000);

    expect(await listPage.titles()).toEqual(titlesFor(race.term));
  });

  const debounce = caseById(edge.cases, "AP-779-TC-052b");
  test(`${debounce.scenario} (${debounce.id})`, async ({ page }) => {
    // Expected to fail, finding D-09: see AP-779-TC-052.
    test.fail();

    const { listPage, api } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });

    await listPage.typeSearch(debounce.term);
    await OnlineClassListService.settle(page);

    expect(api.searchTerms()).toHaveLength(1);
  });

  const whitespace = caseById(edge.cases, "AP-779-TC-054");
  test(`${whitespace.scenario} (${whitespace.id})`, async ({ page }) => {
    // Expected to fail, finding D-09: the keyword is never trimmed, so three
    // spaces pass the length check and are sent as a term.
    test.fail();

    const { listPage, api } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });

    await listPage.typeSearch(whitespace.term);
    await OnlineClassListService.settle(page);

    expect(api.searchTerms().filter((term) => term.length > 0)).toEqual([]);
  });

  test("search params do not leak into another screen (AP-779-TC-053)", async ({
    page,
  }) => {
    const first = data.cases[0];
    if (!first)
      throw new Error(
        "onlineClassSearchRegularTestData.json carries no cases.",
      );

    const { listPage } = await OnlineClassListService.open(page, {
      list: searchOracle,
    });
    await listPage.typeSearch(first.term);
    await expect(listPage.rows).toHaveCount(first.expectedTitles.length);

    const leaked: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/api/v1/") &&
        new URL(request.url()).searchParams.get("search") === first.term
      ) {
        leaked.push(request.url());
      }
    });

    // In-app navigation, so the utils/queryString singleton survives - a
    // page.goto would reload the bundle and prove nothing.
    await page.evaluate(() => {
      const root = document.querySelector("#app") as unknown as {
        __vue_app__: {
          config: {
            globalProperties: { $router: { push: (path: string) => void } };
          };
        };
      };
      root.__vue_app__.config.globalProperties.$router.push(
        "/master/student-management",
      );
    });
    await expect(page).toHaveURL(/student-management/);
    await page.waitForLoadState("networkidle");

    expect(leaked).toEqual([]);
  });
});
