import { expect, test } from "@playwright/test";
import { OnlineClassListService } from "../../../services/onlineClass/onlineClassList.service";
import { sampleItem } from "../../../services/onlineClass/onlineClassApiMock.service";
import { DataLoader } from "../../../utils/dataLoader";
import { buildListResponse } from "../../../utils/listResponse";
import { caseById } from "../../../utils/testData";
import type {
  OnlineClassTableEdgeTestData,
  OnlineClassTableTestData,
} from "../../../utils/types/onlineClass/onlineClassTable.types";

const data = DataLoader.load<OnlineClassTableTestData>(
  "data/regular/onlineClass/onlineClassTableRegularTestData.json",
);
const edge = DataLoader.load<OnlineClassTableEdgeTestData>(
  "data/edge/onlineClass/onlineClassTableEdgeTestData.json",
);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-779 asserts data binding, which is browser-independent.",
);

test.describe("AP-779 online class list table", () => {
  test("renders the column headers in order (AP-779-TC-020)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);

    await expect(listPage.headerCells).toHaveText(data.headers);
  });

  test("renders one row per API item, in API order (AP-779-TC-021, AP-779-TC-022)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);

    await expect(listPage.rows).toHaveCount(data.rows.length);
    expect(await listPage.titles()).toEqual(data.rows.map((row) => row.title));
  });

  test("loads every thumbnail at its display size (AP-779-TC-023)", async ({
    page,
  }) => {
    // Hits the real image CDN. Several sample URLs carry spaces and U+202F
    // (NARROW NO-BREAK SPACE, from macOS screenshot names), which is what
    // this case exists to catch.
    const { listPage } = await OnlineClassListService.open(page);
    await page.waitForLoadState("networkidle");

    const thumbnails = await listPage.thumbnails();

    expect(
      thumbnails.filter((image) => !image.loaded).map((image) => image.src),
    ).toEqual([]);
    for (const image of thumbnails) {
      expect([image.width, image.height]).toEqual([
        data.thumbnailSize.width,
        data.thumbnailSize.height,
      ]);
    }
  });

  test("shows modules and chapters as the API sends them (AP-779-TC-026)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);

    for (const expected of data.rows) {
      const row = listPage.row(expected.title, expected.occurrence);
      await expect(listPage.cell(row, "modules")).toHaveText(expected.modules);
      await expect(listPage.cell(row, "chapters")).toHaveText(
        expected.chapters,
      );
    }
  });

  test("shows DURATION(H) in hours, not seconds (AP-779-TC-027)", async ({
    page,
  }) => {
    // Expected to fail, finding D-01: `convertSecondToHour` is defined
    // (TeacherOnlineClassView.vue:255) but the template renders
    // `row[header.value]` raw (:117), so 36000 shows instead of 10:00.
    test.fail();

    const { listPage } = await OnlineClassListService.open(page);

    for (const expected of data.rows) {
      if (expected.expectedDuration === null) continue;
      const row = listPage.row(expected.title, expected.occurrence);
      await expect(listPage.cell(row, "duration")).toHaveText(
        expected.expectedDuration,
      );
    }
  });

  test("joins tags with a comma (AP-779-TC-028)", async ({ page }) => {
    const { listPage } = await OnlineClassListService.open(page);

    for (const expected of data.rows) {
      if (expected.expectedTags === null) continue;
      const row = listPage.row(expected.title, expected.occurrence);
      await expect(listPage.cell(row, "tags")).toHaveText(
        expected.expectedTags,
      );
    }
  });

  test(`${edge.emptyTags.scenario} (${edge.emptyTags.id})`, async ({
    page,
  }) => {
    // Expected to fail, finding D-11: an empty array passes `Array.isArray`
    // and joins to "" (TeacherOnlineClassView.vue:106), so the cell is blank.
    test.fail();

    const { listPage } = await OnlineClassListService.open(page);

    for (const title of edge.emptyTags.titles) {
      await expect(listPage.cell(listPage.row(title), "tags")).toHaveText(
        edge.emptyTags.expected,
      );
    }
  });

  test("marks featured classes with a check and others with a cross (AP-779-TC-029)", async ({
    page,
  }) => {
    const { listPage } = await OnlineClassListService.open(page);

    for (const expected of data.rows) {
      const cell = listPage.cell(
        listPage.row(expected.title, expected.occurrence),
        "featured",
      );
      await expect(
        cell.locator(expected.featured ? ".mdi-check" : ".mdi-close"),
      ).toBeVisible();
      await expect(
        cell.locator(expected.featured ? ".mdi-close" : ".mdi-check"),
      ).toHaveCount(0);
    }
  });

  test("acts on the right id when titles repeat (AP-779-TC-030)", async ({
    page,
  }) => {
    const target = data.duplicateTitleTarget;
    const { listPage, api } = await OnlineClassListService.open(page);

    await listPage
      .action(listPage.row(target.title, target.occurrence), "edit")
      .click();

    await expect(page).toHaveURL(/online-class-create\/class-information/);
    expect(api.detailRequests).toEqual([target.id]);
  });
});

test.describe("AP-779 online class list table edge data", () => {
  const nullThumbnail = caseById(edge.cases, "AP-779-TC-024");
  test(`${nullThumbnail.scenario} (${nullThumbnail.id})`, async ({ page }) => {
    // Expected to fail, finding D-22: `<img :src="row.thumbnail">` renders
    // with no src and there is no placeholder (TeacherOnlineClassView.vue:98).
    test.fail();

    const item = sampleItem(nullThumbnail.override);
    const { listPage } = await OnlineClassListService.open(page, {
      list: () => buildListResponse([item]),
    });

    const thumbnails = await listPage.thumbnails();
    expect(thumbnails.every((image) => image.src !== "" && image.loaded)).toBe(
      true,
    );
  });

  const longTitle = caseById(edge.cases, "AP-779-TC-025");
  test(`${longTitle.scenario} (${longTitle.id})`, async ({ page }) => {
    const item = sampleItem(longTitle.override);
    const { listPage } = await OnlineClassListService.open(page, {
      list: () => buildListResponse([item]),
    });

    const share = listPage.action(listPage.rows.first(), "share");
    await expect(share).toBeVisible();
    const box = await share.boundingBox();

    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );
  });

  const escaped = caseById(edge.cases, "AP-779-TC-032");
  test(`${escaped.scenario} (${escaped.id})`, async ({ page }) => {
    let dialogFired = false;
    page.on("dialog", async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    const item = sampleItem(escaped.override);
    const { listPage } = await OnlineClassListService.open(page, {
      list: () => buildListResponse([item]),
    });
    const row = listPage.rows.first();

    await expect(listPage.cell(row, "title")).toContainText(item.title);
    await expect(listPage.cell(row, "tags")).toHaveText(item.tags.join(", "));
    await expect(listPage.cell(row, "tags").locator("b")).toHaveCount(0);
    expect(dialogFired).toBe(false);
  });
});
