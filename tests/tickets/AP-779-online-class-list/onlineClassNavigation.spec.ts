import { expect, test } from "@playwright/test";
import {
  ONLINE_CLASS_LIST_PATHS,
  ONLINE_CLASS_PARENT_PATH,
  OnlineClassListPage,
} from "../../../pages/onlineClass/onlineClassList.page";
import { ClassDetailsDialog } from "../../../pages/onlineClass/classDetailsDialog.component";
import { ApicalAuthService } from "../../../services/auth/apicalAuth.service";
import { ApicalLoginService } from "../../../services/auth/apicalLogin.service";
import { OnlineClassApiMock } from "../../../services/onlineClass/onlineClassApiMock.service";
import { OnlineClassListService } from "../../../services/onlineClass/onlineClassList.service";

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-779 asserts routing and data binding, which are browser-independent.",
);

test.describe("AP-779 online class list navigation and access", () => {
  test("parent route redirects to the list (AP-779-TC-001)", async ({
    page,
  }) => {
    const api = new OnlineClassApiMock(page);
    await ApicalLoginService.ensureLoggedIn(page, "master");
    await api.list();

    await page.goto(ONLINE_CLASS_PARENT_PATH);

    await expect(page).toHaveURL(/\/master\/online-class\/online-class-list$/);
    await expect(new OnlineClassListPage(page).heading).toBeVisible();
  });

  test("direct URL and reload render without page errors (AP-779-TC-002)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const { listPage } = await OnlineClassListService.open(page);
    await page.reload();
    await expect(listPage.rows.first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("user without online-class permission is denied (AP-779-TC-004)", () => {
    // Needs an admin role provisioned without online-class permission. Worth
    // doing: the master online-class routes carry no requirePermission guard,
    // unlike master.portal (apical router/master/index.js:24 vs :81), finding D-13.
    test.fixme(true, "Needs a restricted-role account.");
  });

  test("layout follows the user after switching accounts without reload (AP-779-TC-007)", () => {
    // Route meta.layout is read from localStorage once, at import time
    // (router/onlineClass.js:1-2). Needs two accounts of different user_type
    // and the in-app logout flow.
    test.fixme(true, "Needs two accounts and an in-app logout/login flow.");
  });
});

test.describe("AP-779 online class list without a session", () => {
  test("unauthenticated visitor is sent away from the list (AP-779-TC-003)", async ({
    page,
  }) => {
    const api = new OnlineClassApiMock(page);
    await api.list();

    await page.goto(ONLINE_CLASS_LIST_PATHS.master);

    await expect(page).not.toHaveURL(/online-class-list/);
    expect(api.listRequests).toHaveLength(0);
  });
});

test.describe("AP-779 online class list, coaching-center view only", () => {
  test.skip(
    !ApicalAuthService.hasCredentials("coaching"),
    "COACHING_EMAIL / COACHING_PASSWORD not set.",
  );

  test("only the view action and no create button are offered (AP-779-TC-005)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page, {
      role: "coaching",
    });
    const row = listPage.rows.first();

    await expect(listPage.action(row, "view")).toBeVisible();
    for (const action of ["duplicate", "link", "edit", "share"] as const) {
      await expect(listPage.action(row, action)).toHaveCount(0);
    }
    await expect(listPage.createButton).toHaveCount(0);
  });

  test("view keeps the user inside coaching-center routing (AP-779-TC-006)", async ({
    page,
  }) => {
    // Expected to fail, finding D-14: `onShowDetails` pushes the master route
    // name `onlineClass.online-class-list.details-modules`
    // (TeacherOnlineClassView.vue:306), and the coaching route
    // `viewOnlineClass.online-class-list` has no details children
    // (router/coachingCenter.js:251-274).
    test.fail();

    const { listPage } = await OnlineClassListService.open(page, {
      role: "coaching",
    });
    await listPage.action(listPage.rows.first(), "view").click();

    await expect(new ClassDetailsDialog(page).root).toBeVisible();
    expect(new URL(page.url()).pathname).toMatch(/^\/coaching-owner\//);
  });
});

test.describe("AP-779 online class list, teacher route regression", () => {
  test.skip(
    !ApicalAuthService.hasCredentials("teacher"),
    "TEACHER_EMAIL / TEACHER_PASSWORD not set.",
  );

  test("teacher list renders the same rows (AP-779-TC-120)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page, {
      role: "teacher",
    });

    await expect(listPage.rows).toHaveCount(20);
  });

  test("teacher view action stays under /teacher (AP-779-TC-120b)", async ({
    page,
  }) => {
    // Expected to fail, finding D-23: router/teacher.js:945-1025 and
    // router/onlineClass.js register the same route names, and master is
    // spread after teacher (router/index.js:15-18), so the name resolves to
    // /master/... and the guard bounces the teacher to their portal.
    test.fail();

    const { listPage } = await OnlineClassListService.open(page, {
      role: "teacher",
    });
    await listPage.action(listPage.rows.first(), "view").click();

    await expect(page).toHaveURL(
      /\/teacher\/online-class\/online-class-list\/class-details\/modules/,
    );
  });
});
