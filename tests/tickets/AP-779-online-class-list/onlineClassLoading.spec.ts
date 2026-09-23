import { expect, test } from "@playwright/test";
import { OnlineClassListService } from "../../../services/onlineClass/onlineClassList.service";
import {
  sampleItem,
  sampleList,
} from "../../../services/onlineClass/onlineClassApiMock.service";
import { DataLoader } from "../../../utils/dataLoader";
import { buildListResponse } from "../../../utils/listResponse";
import { caseById } from "../../../utils/testData";
import type { OnlineClassLoadingEdgeTestData } from "../../../utils/types/onlineClass/onlineClassLoading.types";

const data = DataLoader.load<OnlineClassLoadingEdgeTestData>(
  "data/edge/onlineClass/onlineClassLoadingEdgeTestData.json",
);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-779 asserts data binding, which is browser-independent.",
);

test.describe("AP-779 online class list loading", () => {
  test("sends exactly one list request, without a query, on mount (AP-779-TC-010)", async ({
    page,
  }) => {
    const { api } = await OnlineClassListService.open(page);
    await OnlineClassListService.settle(page);

    expect(api.listRequests).toHaveLength(1);
    expect(api.lastListRequest()?.search).toBe("");
  });

  test("opening the list clears stale class-creation data (AP-779-TC-015)", async ({
    page,
  }) => {
    // Expected to fail, finding D-05: `removeAllClassInfo` commits
    // setClassInfo(null) and then setClassInfo(faq), so classBasicInfo ends up
    // holding {why_important, faqs} instead of being removed
    // (store/modules/onlineClass.js:330-340).
    test.fail();

    const { listPage } = await OnlineClassListService.open(page);
    await page.evaluate(
      (item) => localStorage.setItem("classBasicInfo", JSON.stringify(item)),
      sampleItem(),
    );
    await page.reload();
    await expect(listPage.rows.first()).toBeVisible();

    expect(
      await page.evaluate(() => localStorage.getItem("classBasicInfo")),
    ).toBeNull();
  });
});

test.describe("AP-779 online class list loading edge cases", () => {
  const slow = caseById(data.cases, "AP-779-TC-011");
  test(`shows the loader while waiting: ${slow.scenario} (${slow.id})`, async ({
    page,
  }) => {
    // The heading is static, so `open` returns while the stub is still holding
    // the list response back.
    const { listPage } = await OnlineClassListService.open(page, {
      list: async () => {
        await new Promise((resolve) => setTimeout(resolve, slow.delayMs));
        return sampleList();
      },
      waitForRows: false,
    });

    await expect(listPage.loader).toBeVisible();
    await expect(listPage.rows.first()).toBeVisible();
    await expect(listPage.loader).toBeHidden();
  });

  const serverError = caseById(data.cases, "AP-779-TC-012");
  test(`${serverError.scenario} (${serverError.id})`, async ({ page }) => {
    // Expected to fail, finding D-06: fetchOnLineClassList rejects and the
    // view never catches it (TeacherOnlineClassView.vue:362), leaving an
    // unhandled rejection. The action also never resolves on success.
    test.fail();

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const { listPage } = await OnlineClassListService.open(page, {
      list: () => ({ status: serverError.status }),
      waitForRows: false,
    });
    await expect(listPage.loader).toBeHidden();
    await OnlineClassListService.settle(page);

    expect(errors).toEqual([]);
  });

  const empty = caseById(data.cases, "AP-779-TC-013");
  test(`${empty.scenario} (${empty.id})`, async ({ page }) => {
    const { listPage } = await OnlineClassListService.open(page, {
      list: () => buildListResponse([], 1, 20, 0),
      waitForRows: false,
    });

    await expect(listPage.emptyAlert).toBeVisible();
    await expect(listPage.rows).toHaveCount(0);
  });

  const emptyText = caseById(data.cases, "AP-779-TC-013b");
  test(`${emptyText.scenario} (${emptyText.id})`, async ({ page }) => {
    // Expected to fail, finding D-20: the list passes no `label` to Table, so
    // the empty alert reads "undefined not found" (atom/table/Index.vue:102).
    test.fail();

    const { listPage } = await OnlineClassListService.open(page, {
      list: () => buildListResponse([], 1, 20, 0),
      waitForRows: false,
    });

    await expect(listPage.emptyAlert).toBeVisible();
    await expect(listPage.emptyAlert).not.toContainText(
      emptyText.forbiddenText ?? "",
    );
  });

  const unauthorised = caseById(data.cases, "AP-779-TC-014");
  test(`${unauthorised.scenario} (${unauthorised.id})`, async ({ page }) => {
    // Expected to fail, finding D-21: the 401 handler does location.replace("/")
    // without clearing the token (store/api.js errorHandler), and the router
    // sends a user with user_type back to /master/portal (router/index.js:49).
    test.fail();

    await OnlineClassListService.open(page, {
      list: () => ({
        status: unauthorised.status,
        body: { message: "Unauthenticated." },
      }),
      waitForRows: false,
    }).catch(() => undefined);

    await expect(page).toHaveURL(
      new RegExp(unauthorised.expectedUrl ?? "/login"),
    );
  });
});
