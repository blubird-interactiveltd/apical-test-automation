import type { Locator, Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";

/** Where each portal mounts `TeacherOnlineClassView.vue`. */
export const ONLINE_CLASS_LIST_PATHS = {
  master: "/master/online-class/online-class-list",
  teacher: "/teacher/online-class/online-class-list",
  coaching: "/coaching-owner/online-class/online-class-list",
} as const;

/** The parent route that redirects to the master list. */
export const ONLINE_CLASS_PARENT_PATH = "/master/online-class";

/** Heading text, from `TeacherOnlineClassView.vue:8`. */
const HEADING = /online class list/i;

/** Column order, from the `headers` computed (`TeacherOnlineClassView.vue:214`). */
const COLUMN = {
  title: 0,
  modules: 1,
  chapters: 2,
  duration: 3,
  tags: 4,
  featured: 5,
  actions: 6,
} as const;

export type ListColumn = keyof typeof COLUMN;

/** Row buttons by the mdi icon each one renders (`TeacherOnlineClassView.vue:48-91`). */
const ACTION_ICON = {
  view: "mdi-eye",
  duplicate: "mdi-content-copy",
  link: "mdi-link",
  edit: "mdi-pencil",
  share: "mdi-navigation",
} as const;

export type RowAction = keyof typeof ACTION_ICON;

/**
 * The online class list — `TeacherOnlineClassView.vue`, shared by the master,
 * teacher and coaching-center portals.
 *
 * The app ships no `data-testid`, so every locator here keys off the view's own
 * class names and mdi icon classes. They are all in this file so a markup change
 * is a one-file fix.
 */
export class OnlineClassListPage {
  readonly heading: Locator;
  readonly search: Locator;
  readonly sortSelect: Locator;
  readonly headerCells: Locator;
  readonly rows: Locator;
  readonly emptyAlert: Locator;
  readonly paginator: Locator;
  readonly loader: Locator;
  readonly createButton: Locator;
  readonly sharePanel: Locator;
  private readonly listColumn: Locator;
  private readonly table: Locator;
  private readonly prevButton: Locator;
  private readonly nextButton: Locator;

  constructor(private readonly page: Page) {
    // Two `v-col`s share the row: the list, and the share panel that
    // `onShare` opens beside it. The panel has its own `tr.table-row`s, so
    // every list locator is scoped to the first column.
    this.listColumn = page.locator(".online_class_list > .v-col").first();
    this.sharePanel = page.locator(".online_class_list > .v-col").nth(1);
    this.heading = page.getByRole("heading", { name: HEADING });
    this.search = this.listColumn.locator("input.search-box");
    this.sortSelect = this.listColumn.locator("select.select-component");
    this.table = this.listColumn.locator("table").first();
    // Hidden columns keep their <th> with the `hidden` attribute
    // (`atom/table/Index.vue:11`), so they are excluded rather than counted.
    this.headerCells = this.table.locator("thead th:not([hidden])");
    this.rows = this.table.locator("tbody tr.table-row");
    // `atom/table/Index.vue:49` renders a VAlert after the table when empty.
    this.emptyAlert = this.listColumn.locator(".v-alert");
    this.paginator = this.listColumn.locator(
      "div.center:has(.mdi-chevron-right)",
    );
    this.prevButton = this.paginator.locator(".mdi-chevron-left");
    this.nextButton = this.paginator.locator(".mdi-chevron-right");
    this.loader = page.locator("#dataLoader");
    // A plain <div> with a click handler, not a button (`:142`), so it has
    // no role to query by.
    this.createButton = page.locator(
      ".online_class_list div.bg-algal.rounded-full:has(.mdi-plus)",
    );
  }

  /** Opens a portal's list and waits for the heading. */
  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    await this.heading.waitFor({ timeout: timeouts.uiRenderTimeout });
  }

  /** The `nth` row whose title cell reads exactly `title`. */
  row(title: string, nth = 0): Locator {
    return this.rows
      .filter({
        has: this.page.locator("td").first().getByText(title, { exact: true }),
      })
      .nth(nth);
  }

  cell(row: Locator, column: ListColumn): Locator {
    return row.locator("td").nth(COLUMN[column]);
  }

  action(row: Locator, name: RowAction): Locator {
    return row.locator(`button:has(.${ACTION_ICON[name]})`);
  }

  /** mdi icon class of every button in a row's actions cell, in order. */
  async actionIcons(row: Locator): Promise<string[]> {
    return this.cell(row, "actions")
      .locator("button i")
      .evaluateAll((icons) =>
        icons.map(
          (icon) =>
            [...icon.classList].find((name) => name.startsWith("mdi-")) ?? "",
        ),
      );
  }

  /** Row titles in on-screen order. */
  async titles(): Promise<string[]> {
    const texts = await this.rows
      .locator("td:first-child span")
      .allInnerTexts();

    return texts.map((text) => text.trim());
  }

  /** The row thumbnails as loaded: source, whether it decoded, rendered size. */
  async thumbnails(): Promise<
    { src: string; loaded: boolean; width: number; height: number }[]
  > {
    return this.rows.locator("td:first-child img").evaluateAll((images) =>
      (images as HTMLImageElement[]).map((image) => ({
        src: image.getAttribute("src") ?? "",
        loaded: image.complete && image.naturalWidth > 0,
        width: image.clientWidth,
        height: image.clientHeight,
      })),
    );
  }

  /**
   * Types one character at a time.
   *
   * Character by character on purpose: the view's `watch(keyword)` fires on
   * each change and only searches from the third character, which a single
   * `fill` would skip straight past.
   */
  async typeSearch(text: string): Promise<void> {
    await this.search.click();
    await this.search.pressSequentially(text, { delay: 60 });
  }

  async replaceSearch(text: string): Promise<void> {
    await this.search.fill(text);
  }

  async pressSearchKey(key: string): Promise<void> {
    await this.search.press(key);
  }

  async next(): Promise<void> {
    await this.nextButton.click();
  }

  async previous(): Promise<void> {
    await this.prevButton.click();
  }

  /** Clicks the sort toggle in the title column header. */
  async sortByTitle(): Promise<void> {
    await this.table
      .locator("thead th")
      .first()
      .locator(".mdi-swap-vertical")
      .click();
  }
}
