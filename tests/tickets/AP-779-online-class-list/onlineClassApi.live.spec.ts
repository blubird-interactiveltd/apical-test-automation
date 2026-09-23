import { expect, test } from "@playwright/test";
import { ApicalAuthService } from "../../../services/auth/apicalAuth.service";
import { OnlineClassApiService } from "../../../services/onlineClass/onlineClassApi.service";
import { DataLoader } from "../../../utils/dataLoader";
import type {
  OnlineClassSearchEdgeTestData,
  OnlineClassSearchTestData,
} from "../../../utils/types/onlineClass/onlineClassSearch.types";

const regular = DataLoader.load<OnlineClassSearchTestData>(
  "data/regular/onlineClass/onlineClassSearchRegularTestData.json",
);
const edge = DataLoader.load<OnlineClassSearchEdgeTestData>(
  "data/edge/onlineClass/onlineClassSearchEdgeTestData.json",
);

// Real backend, real data. These assume the environment holds the AP-779
// sample dataset (the same titles as fixtures/api/onlineClassList.response.json),
// and they only read, so nothing needs tearing down.
test.skip(
  process.env.RUN_LIVE !== "1",
  "Set RUN_LIVE=1 to run live backend checks.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "API checks do not depend on a browser; one project is enough.",
);

test.describe("AP-779 online class search on the backend", () => {
  for (const scenario of regular.cases) {
    test(`backend search ${scenario.scenario} (${scenario.id})`, async ({
      request,
    }) => {
      const token = await ApicalAuthService.getToken(request, "master");

      const titles = await OnlineClassApiService.searchTitles(
        request,
        token,
        scenario.term,
      );

      expect(titles).toEqual(expect.arrayContaining(scenario.expectedTitles));
    });
  }

  for (const scenario of edge.live) {
    test(`backend search ${scenario.scenario} (${scenario.id})`, async ({
      request,
    }) => {
      // Findings on these cases: D-10 — LIKE runs on the raw HTML description
      // and does not escape % or _ (apical-api OnlineClass::scopeOfSearch).
      test.fail(
        scenario.finding !== null,
        `${scenario.finding}: see test-cases/AP-779-online-class-list.md`,
      );

      const token = await ApicalAuthService.getToken(request, "master");

      for (const term of scenario.terms) {
        const response = await OnlineClassApiService.search(
          request,
          token,
          term,
        );
        expect(response.status(), `search=${term}`).toBe(200);

        if (scenario.expectEmpty) {
          const body = (await response.json()) as { items: unknown[] };
          expect(body.items, `search=${term}`).toEqual([]);
        }
      }
    });
  }
});

test.describe("AP-779 online class tenant isolation", () => {
  test.skip(
    !ApicalAuthService.hasCredentials("coaching"),
    "COACHING_EMAIL / COACHING_PASSWORD not set.",
  );

  test("a coaching user lists only its organisation's classes (AP-779-TC-016)", async ({
    request,
  }) => {
    const master = await ApicalAuthService.getToken(request, "master");
    const coaching = await ApicalAuthService.getToken(request, "coaching");

    const all = new Set(await OnlineClassApiService.allIds(request, master));
    const own = await OnlineClassApiService.allIds(request, coaching);

    expect(own.length).toBeLessThanOrEqual(all.size);
    expect(own.filter((id) => !all.has(id))).toEqual([]);
  });

  test("a coaching user cannot read another organisation's class (AP-779-TC-097)", async ({
    request,
  }) => {
    const master = await ApicalAuthService.getToken(request, "master");
    const coaching = await ApicalAuthService.getToken(request, "coaching");
    const own = new Set(await OnlineClassApiService.allIds(request, coaching));
    const foreign = (await OnlineClassApiService.allIds(request, master)).find(
      (id) => !own.has(id),
    );
    test.skip(!foreign, "Every class is assigned to this organisation.");

    const response = await OnlineClassApiService.fetchById(
      request,
      coaching,
      foreign ?? "",
    );

    expect([403, 404]).toContain(response.status());
  });
});
