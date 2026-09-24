import { expect, test } from "@playwright/test";
import { ClassDetailsDialog } from "../../../pages/onlineClass/classDetailsDialog.component";
import {
  CLASS_INFORMATION_PATH,
  ClassInformationPage,
} from "../../../pages/onlineClass/classInformation.page";
import { DuplicateClassDialog } from "../../../pages/onlineClass/duplicateClassDialog.component";
import { ShareClassDialog } from "../../../pages/onlineClass/shareClassDialog.component";
import { SnackbarComponent } from "../../../pages/shared/snackbar.component";
import {
  sampleItem,
  sampleList,
} from "../../../services/onlineClass/onlineClassApiMock.service";
import { OnlineClassListService } from "../../../services/onlineClass/onlineClassList.service";
import { DataLoader } from "../../../utils/dataLoader";
import { buildListResponse } from "../../../utils/listResponse";
import { backendSearch } from "../../../utils/onlineClassSearch";
import type { OnlineClass } from "../../../utils/types/onlineClass/onlineClass.types";
import type { OnlineClassRowActionsTestData } from "../../../utils/types/onlineClass/onlineClassRowActions.types";

const data = DataLoader.load<OnlineClassRowActionsTestData>(
  "data/regular/onlineClass/onlineClassRowActionsRegularTestData.json",
);

const items = sampleList().items;

function byTitle(title: string): OnlineClass {
  const item = items.find((entry) => entry.title === title);

  if (!item) {
    throw new Error(`Sample fixture has no class titled "${title}".`);
  }

  return item;
}

const readClassBasicInfo = (): string | null =>
  localStorage.getItem("classBasicInfo");

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-779 asserts data binding and requests, which are browser-independent.",
);

test.describe("AP-779 online class list row actions", () => {
  test("a master row offers five actions in order (AP-779-TC-080)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);

    expect(await listPage.actionIcons(listPage.rows.first())).toEqual(
      data.actionIcons,
    );
  });

  test("view opens the detail dialog on the Modules tab (AP-779-TC-081)", async ({
    page,
  }) => {
    const target = byTitle(data.details.title);
    const { listPage, api } = await OnlineClassListService.open(page);

    await listPage.action(listPage.row(target.title), "view").click();

    const dialog = new ClassDetailsDialog(page);
    await expect(dialog.root).toContainText(target.title);
    expect(api.detailRequests).toEqual([target.id]);
    await expect(page).toHaveURL(
      /\/online-class-list\/class-details\/modules$/,
    );
  });

  test("detail dialog tabs switch child routes (AP-779-TC-082)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);
    await listPage.action(listPage.row(data.details.title), "view").click();
    const dialog = new ClassDetailsDialog(page);
    await expect(dialog.root).toBeVisible();

    for (const tab of data.details.tabs) {
      await dialog.openTab(tab.label);
      await expect(page).toHaveURL(new RegExp(`${tab.pathSuffix}$`));
    }
  });

  test("closing the detail dialog restores the list URL (AP-779-TC-083)", async ({
    page,
  }) => {
    // Expected to fail, finding D-17: `onShowDetails` pushes the details
    // route (TeacherOnlineClassView.vue:306) and nothing pushes it back when
    // the dialog closes.
    test.fail();

    const { listPage } = await OnlineClassListService.open(page);
    await listPage.action(listPage.row(data.details.title), "view").click();
    const dialog = new ClassDetailsDialog(page);
    await expect(dialog.root).toBeVisible();

    await dialog.back();

    await expect(dialog.root).toBeHidden();
    await expect(page).toHaveURL(/\/online-class-list$/);
  });

  test("duplicate dialog shows the class and Cancel sends nothing (AP-779-TC-084)", async ({
    page,
  }) => {
    const target = byTitle(data.duplicate.title);
    const { listPage, api } = await OnlineClassListService.open(page);
    await api.duplicate();

    await listPage.action(listPage.row(target.title), "duplicate").click();

    const dialog = new DuplicateClassDialog(page);
    await expect(dialog.root).toContainText(data.duplicate.confirmText);
    await expect(dialog.root).toContainText(target.title);
    await expect(dialog.thumbnail).toHaveAttribute(
      "src",
      target.thumbnail ?? "",
    );

    await dialog.cancel();

    await expect(dialog.root).toBeHidden();
    expect(api.duplicateBodies).toEqual([]);
  });

  test("duplicate → Save posts, confirms and reloads the list (AP-779-TC-085)", async ({
    page,
  }) => {
    const target = byTitle(data.duplicate.title);
    const copy = {
      ...target,
      id: data.duplicate.copyId,
      title: `${target.title}${data.duplicate.copySuffix}`,
    };
    const { listPage, api } = await OnlineClassListService.open(page);
    await api.duplicate({ copyId: data.duplicate.copyId });
    // Once the copy exists, the reload returns it at the top, as created_at
    // desc would.
    await api.list(() =>
      api.duplicateBodies.length
        ? buildListResponse(
            [copy, ...items].slice(0, 20),
            1,
            20,
            items.length + 1,
          )
        : sampleList(),
    );
    const before = api.listRequests.length;

    await listPage.action(listPage.row(target.title), "duplicate").click();
    const dialog = new DuplicateClassDialog(page);
    await dialog.save();

    await expect(
      new SnackbarComponent(page).message(data.duplicate.successText),
    ).toBeVisible();
    await expect(dialog.root).toBeHidden();
    expect(api.duplicateBodies).toEqual([{ online_class_id: target.id }]);
    await expect.poll(() => api.listRequests.length).toBeGreaterThan(before);
    await expect(listPage.rows.first()).toContainText(copy.title);
  });

  test("double-clicking Save sends one request (AP-779-TC-086)", async ({
    page,
  }) => {
    const { listPage, api } = await OnlineClassListService.open(page);
    await api.duplicate({ delayMs: data.duplicate.slowSaveDelayMs });

    await listPage
      .action(listPage.row(data.duplicate.title), "duplicate")
      .click();
    await new DuplicateClassDialog(page).doubleClickSave();
    await page.waitForTimeout(data.duplicate.slowSaveDelayMs + 500);

    expect(api.duplicateBodies).toHaveLength(1);
  });

  test("a failed duplicate reports an error and keeps the dialog (AP-779-TC-087)", async ({
    page,
  }) => {
    const { listPage, api } = await OnlineClassListService.open(page);
    await api.duplicate({ status: 500 });
    const snackbar = new SnackbarComponent(page);

    await listPage
      .action(listPage.row(data.duplicate.title), "duplicate")
      .click();
    const dialog = new DuplicateClassDialog(page);
    await dialog.save();

    await expect(snackbar.root).toBeVisible();
    await expect(snackbar.message(data.duplicate.successText)).toHaveCount(0);
    await expect(dialog.root).toBeVisible();
  });

  test("duplicating while searching keeps the filter (AP-779-TC-088)", async ({
    page,
  }) => {
    // Expected to fail, finding D-12: `onReload` dispatches
    // fetchOnLineClassList with no query (TeacherOnlineClassView.vue:342),
    // dropping the search while the box still shows it.
    test.fail();

    const { term, title } = data.duplicateWhileSearching;
    const { listPage, api } = await OnlineClassListService.open(page, {
      list: (url) =>
        buildListResponse(
          backendSearch(items, url.searchParams.get("search") ?? ""),
        ),
    });
    await api.duplicate();
    await listPage.typeSearch(term);
    await expect.poll(() => api.searchTerms().at(-1)).toBe(term);

    await listPage.action(listPage.row(title), "duplicate").click();
    const dialog = new DuplicateClassDialog(page);
    await dialog.save();
    await expect(dialog.root).toBeHidden();

    await expect
      .poll(() => api.lastListRequest()?.searchParams.get("search"))
      .toBe(term);
  });

  test("copy-link dialog shows the class summary (AP-779-TC-089, AP-779-TC-123)", async ({
    page,
  }) => {
    const target = byTitle(data.share.title);
    const { listPage } = await OnlineClassListService.open(page);

    await listPage.action(listPage.row(target.title), "link").click();

    const dialog = new ShareClassDialog(page);
    await expect(dialog.image).toHaveAttribute("src", target.banner ?? "");
    await expect(dialog.root).toContainText(target.title);
    for (const line of data.share.expectedSummary) {
      await expect(dialog.root).toContainText(line);
    }
  });

  test("the share link is the class URL and is copied (AP-779-TC-089b)", async ({
    page,
    context,
  }) => {
    // Expected to fail, finding D-07: the link is the literal
    // "https://demo-frontendtest" (ShareClasses.vue:35).
    test.fail();

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const { listPage } = await OnlineClassListService.open(page);

    await listPage.action(listPage.row(data.share.title), "link").click();
    const dialog = new ShareClassDialog(page);
    await expect(dialog.linkInput).not.toHaveValue(data.share.hardcodedLink);
    await dialog.copyLink();

    await expect(
      new SnackbarComponent(page).message(data.share.copiedText),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await dialog.linkInput.inputValue(),
    );
  });

  test("edit loads the class and opens the prefilled wizard (AP-779-TC-092)", async ({
    page,
  }) => {
    const target = byTitle(data.edit.title);
    const { listPage, api } = await OnlineClassListService.open(page);

    await listPage.action(listPage.row(target.title), "edit").click();

    await expect(page).toHaveURL(new RegExp(`${CLASS_INFORMATION_PATH}$`));
    expect(api.detailRequests).toEqual([target.id]);
    const stored = JSON.parse(
      (await page.evaluate(readClassBasicInfo)) ?? "null",
    ) as { id?: string } | null;
    expect(stored?.id).toBe(target.id);
    await expect(new ClassInformationPage(page).titleInput).toHaveValue(
      target.title,
    );
  });

  test("share toggles the side panel and the reduced columns (AP-779-TC-093)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);
    const share = listPage.action(listPage.rows.first(), "share");

    await share.click();

    await expect(listPage.headerCells).toHaveCount(2);
    await expect(listPage.sharePanel).toBeVisible();
    expect(await listPage.actionIcons(listPage.rows.first())).toEqual([
      "mdi-navigation",
    ]);
    await expect(share).toHaveClass(/arrow-plane-rotated/);

    await share.click();

    await expect(listPage.headerCells).toHaveCount(7);
    await expect(listPage.sharePanel).toBeHidden();
  });

  test("rapid view clicks keep the last clicked class (AP-779-TC-095)", async ({
    page,
  }) => {
    const { slowRowIndex, fastRowIndex, slowDelayMs } = data.rapidClicks;
    const slow = sampleItem({}, slowRowIndex);
    const fast = sampleItem({}, fastRowIndex);
    const { listPage, api } = await OnlineClassListService.open(page);
    await api.detail(items, (id) => (id === slow.id ? slowDelayMs : 0));

    await listPage.action(listPage.rows.nth(slowRowIndex), "view").click();
    await listPage
      .action(listPage.rows.nth(fastRowIndex), "view")
      .click({ force: true });
    await page.waitForTimeout(slowDelayMs + 500);

    const stored = JSON.parse(
      (await page.evaluate(readClassBasicInfo)) ?? "null",
    ) as { id?: string } | null;
    expect(stored?.id).toBe(fast.id);
  });

  test("the + button opens a blank create wizard (AP-779-TC-100)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);

    await listPage.createButton.click();

    await expect(page).toHaveURL(new RegExp(`${CLASS_INFORMATION_PATH}$`));
  });
});

test.describe("AP-779 online class list row actions, edge data", () => {
  test("copy-link image falls back to thumbnail, then to text (AP-779-TC-090)", async ({
    page,
  }) => {
    const thumbnailOnly = sampleItem({ banner: null }, 0);
    const noImage = sampleItem({ banner: null, thumbnail: null }, 1);
    const { listPage } = await OnlineClassListService.open(page, {
      details: [thumbnailOnly, noImage],
    });
    const dialog = new ShareClassDialog(page);

    await listPage.action(listPage.row(thumbnailOnly.title), "link").click();
    await expect(dialog.image).toHaveAttribute(
      "src",
      thumbnailOnly.thumbnail ?? "",
    );
    await page.keyboard.press("Escape");
    await expect(dialog.root).toBeHidden();

    await listPage.action(listPage.row(noImage.title), "link").click();
    await expect(dialog.root).toContainText(data.share.noImageText);
  });

  test("a clipboard failure does not report success (AP-779-TC-091)", async ({
    page,
  }) => {
    // Expected to fail, finding D-16: `copyLink` does not await writeText
    // (ShareClasses.vue:39-42), so the success snackbar shows regardless.
    test.fail();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => Promise.reject(new Error("denied")),
          readText: () => Promise.resolve(""),
        },
      });
    });
    const { listPage } = await OnlineClassListService.open(page);

    await listPage.action(listPage.rows.first(), "link").click();
    await new ShareClassDialog(page).copyLink();
    await OnlineClassListService.settle(page);

    await expect(
      new SnackbarComponent(page).message(data.share.copiedText),
    ).toHaveCount(0);
  });

  test("description HTML is sanitised in the dialogs (AP-779-TC-096)", async ({
    page,
  }) => {
    // Expected to fail, finding D-15: the description is rendered with v-html
    // (DuplicateClass.vue:22, CardSummary.vue:29). Stubbed here, so this
    // proves the front-end executes it; whether the backend sanitises first
    // is a separate check.
    test.fail();

    const evil = sampleItem({ description: data.xssDescription });
    const { listPage } = await OnlineClassListService.open(page, {
      list: () => buildListResponse([evil]),
      details: [evil],
    });

    await listPage.action(listPage.rows.first(), "duplicate").click();
    await expect(new DuplicateClassDialog(page).root).toBeVisible();
    await page.keyboard.press("Escape");
    await listPage.action(listPage.rows.first(), "link").click();
    await expect(new ShareClassDialog(page).root).toBeVisible();
    await OnlineClassListService.settle(page);

    expect(
      await page.evaluate(
        () => (window as unknown as { __xss?: number }).__xss,
      ),
    ).toBeUndefined();
  });

  test("the wizard is blank after an edit and a return to the list (AP-779-TC-121)", async ({
    page,
  }) => {
    // Expected to fail, finding D-05: see AP-779-TC-015.
    test.fail();

    const { listPage } = await OnlineClassListService.open(page);
    await listPage.action(listPage.row(data.edit.title), "edit").click();
    await expect(page).toHaveURL(new RegExp(`${CLASS_INFORMATION_PATH}$`));

    const { listPage: again } = await OnlineClassListService.open(page);
    await again.createButton.click();

    await expect(page).toHaveURL(new RegExp(`${CLASS_INFORMATION_PATH}$`));
    await expect(new ClassInformationPage(page).titleInput).toHaveValue("");
    expect(await page.evaluate(readClassBasicInfo)).toBeNull();
  });

  test("coaching-center class selection is unaffected by list state (AP-779-TC-122)", () => {
    // OnlineClassSelection.vue dispatches `?status=1` into the same
    // store.classes the list uses. Needs its own page object.
    test.fixme(
      true,
      "Needs Master › Coaching Center › edit › Online Class Selection selectors.",
    );
  });

  test("shared atoms still work on other list screens (AP-779-TC-124)", () => {
    test.fixme(
      true,
      "Belongs to those screens' own tickets; run when Paginate, Table or SearchBox change.",
    );
  });
});
