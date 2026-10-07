import type { Locator, Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";

/** Where each portal mounts `SpeakingView.vue`. */
export const SPEAKING_LIST_PATHS = {
  master: "/master/question-management/question-creation/pte-question/speaking",
  teacher: "/teacher/question-creation/pte-question/speaking",
  coaching: "/coaching-owner/test/test-list/pte-question/speaking",
} as const;

/** The master section routes around the Speaking list. */
export const PTE_QUESTION_PATHS = {
  parent: "/master/question-management/question-creation/pte-question",
  questionManagement: "/master/question-management",
  create: "/master/question-management/question-creation/pte-question/create",
  edit: "/master/question-management/question-creation/pte-question/edit",
} as const;

/** Column order, from the `headers` data in `SpeakingView.vue:225-256`. */
const COLUMN = {
  sl: 0,
  qId: 1,
  index: 2,
  item: 3,
  frequency: 4,
  createdAt: 5,
  createdBy: 6,
  status: 7,
  actions: 8,
} as const;

export type SpeakingColumn = keyof typeof COLUMN;

/** Row actions by the mdi icon each renders (`SpeakingView.vue:106-141`). */
const ACTION_ICON = {
  details: "mdi-eye",
  evaluate: "mdi-clipboard-text-play",
  edit: "mdi-pencil",
  delete: "mdi-delete",
} as const;

export type SpeakingRowAction = keyof typeof ACTION_ICON;

/** `Paginate.vue` greys an arrow it will not act on with this class. */
const DISABLED_ARROW = "bg-periwinkle-gray";

/**
 * The Speaking question list — `SpeakingView.vue` inside the PTE-question tab
 * shell (`pte-question/IndexView.vue`), shared by the master, teacher and
 * coaching-center portals.
 *
 * The app ships no `data-testid`, so locators key off the view's own classes,
 * native `<select>`s and mdi icon classes. They all live here so a markup
 * change is a one-file fix.
 */
export class SpeakingListPage {
  readonly heading: Locator;
  readonly headerIcon: Locator;
  readonly tabs: Locator;
  readonly activeTab: Locator;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly search: Locator;
  readonly createButton: Locator;
  readonly skeleton: Locator;
  readonly headerCells: Locator;
  readonly rows: Locator;
  readonly emptyAlert: Locator;
  readonly paginator: Locator;
  readonly prevArrow: Locator;
  readonly nextArrow: Locator;
  readonly tooltip: Locator;
  private readonly table: Locator;

  constructor(private readonly page: Page) {
    // PageTopOuter renders the label in an <h3>; uppercase is CSS only.
    this.heading = page.locator("h3", { hasText: /^\s*speaking\s*$/i });
    this.headerIcon = page.locator(".mdi-microphone").first();
    this.tabs = page.locator(".tab-component a");
    this.activeTab = page.locator(".tab-component a.active");
    // The view's two native selects: question type, then status.
    this.typeFilter = page.locator("select.select-component").nth(0);
    this.statusFilter = page.locator("select.select-component").nth(1);
    this.search = page.getByPlaceholder("Search speaking questions");
    this.createButton = page.getByRole("button", { name: /create new/i });
    this.skeleton = page.locator(".v-skeleton-loader");
    this.table = page.locator("table").first();
    // Hidden columns keep their <th hidden> (`atom/table/Index.vue:11`).
    this.headerCells = this.table.locator("thead th:not([hidden])");
    this.rows = this.table.locator("tbody tr.table-row");
    // `atom/table/Index.vue:49` renders "Records not found" after the table.
    this.emptyAlert = page.locator(".v-alert", { hasText: "not found" });
    this.paginator = page.locator("div.center:has(.mdi-chevron-right)");
    this.prevArrow = this.paginator.locator("i.mdi-chevron-left");
    this.nextArrow = this.paginator.locator("i.mdi-chevron-right");
    this.tooltip = page.locator(".v-tooltip > .v-overlay__content");
  }

  /** Opens a list path and waits for its heading. */
  async goto(path: string, timeout = timeouts.uiRenderTimeout): Promise<void> {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    await this.heading.waitFor({ timeout });
  }

  async waitForRows(): Promise<void> {
    await this.rows.first().waitFor({ timeout: timeouts.uiRenderTimeout });
  }

  /** The row whose Q_ID cell reads exactly `qId`. */
  row(qId: string): Locator {
    return this.rows.filter({
      has: this.page
        .locator(`td:nth-child(${COLUMN.qId + 1})`)
        .getByText(qId, { exact: true }),
    });
  }

  cell(row: Locator, column: SpeakingColumn): Locator {
    return row.locator("td").nth(COLUMN[column]);
  }

  action(row: Locator, name: SpeakingRowAction): Locator {
    return this.cell(row, "actions").locator(`i.${ACTION_ICON[name]}`);
  }

  /** The row-action names a row renders, in order. */
  async actionsOf(row: Locator): Promise<SpeakingRowAction[]> {
    const icons = await this.cell(row, "actions")
      .locator("i")
      .evaluateAll((nodes) => nodes.map((node) => [...node.classList]));
    const names = Object.entries(ACTION_ICON);

    return icons.flatMap((classes) =>
      names
        .filter(([, icon]) => classes.includes(icon))
        .map(([name]) => name as SpeakingRowAction),
    );
  }

  /** The trimmed text of one column for every row on screen. */
  async columnTexts(column: SpeakingColumn): Promise<string[]> {
    const texts = await this.rows
      .locator(`td:nth-child(${COLUMN[column] + 1})`)
      .allInnerTexts();

    return texts.map((text) => text.trim());
  }

  /** The visible option labels of a filter select. */
  async optionLabels(select: Locator): Promise<string[]> {
    const labels = await select.locator("option").allInnerTexts();

    return labels.map((label) => label.trim());
  }

  /** Picks a filter option by its label. */
  async choose(select: Locator, label: string): Promise<void> {
    await select.selectOption({ label });
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

  async clearSearch(): Promise<void> {
    await this.search.fill("");
  }

  async submitSearch(): Promise<void> {
    await this.search.press("Enter");
  }

  async next(): Promise<void> {
    await this.nextArrow.click();
  }

  async previous(): Promise<void> {
    await this.prevArrow.click();
  }

  /** Whether `Paginate.vue` has greyed an arrow out. */
  async isArrowDisabled(arrow: Locator): Promise<boolean> {
    return (
      (await arrow.getAttribute("class"))?.includes(DISABLED_ARROW) ?? false
    );
  }

  /** A header cell by its label. */
  header(label: string): Locator {
    return this.headerCells.filter({
      hasText: new RegExp(`^\\s*${label}\\s*$`),
    });
  }

  /** Clicks the sort icon of the column headed `label`. */
  async sortBy(label: string): Promise<void> {
    await this.header(label).locator(".mdi-swap-vertical").click();
  }

  /** The mdi colour class `getIconColor` put on a row's FREQUENCY icon. */
  async frequencyIconClasses(row: Locator): Promise<string[]> {
    const icon = this.cell(row, "frequency").locator("i.v-icon");

    return ((await icon.getAttribute("class")) ?? "").split(/\s+/);
  }

  /** The clickable creator name in the CREATED BY cell. */
  creatorLink(row: Locator): Locator {
    return this.cell(row, "createdBy").locator(".table-cell-link");
  }

  /** The coloured label in the STATUS cell. */
  statusLabel(row: Locator): Locator {
    return this.cell(row, "status").locator("span");
  }
}
