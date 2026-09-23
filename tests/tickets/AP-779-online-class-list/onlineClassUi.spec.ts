import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { OnlineClassListService } from "../../../services/onlineClass/onlineClassList.service";
import { DataLoader } from "../../../utils/dataLoader";
import type { OnlineClassUiTestData } from "../../../utils/types/onlineClass/onlineClassRowActions.types";

const data = DataLoader.load<OnlineClassUiTestData>(
  "data/regular/onlineClass/onlineClassUiRegularTestData.json",
);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "AP-779 layout checks run on one engine; cross-browser rendering is out of scope.",
);

test.describe("AP-779 online class list layout and accessibility", () => {
  for (const width of data.viewportWidths) {
    test(`no page-level horizontal scroll and no overlap at ${width}px (AP-779-TC-110)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: data.viewportHeight });
      const { listPage } = await OnlineClassListService.open(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      const create = await listPage.createButton.boundingBox();
      const paginator = await listPage.paginator.boundingBox();
      if (create && paginator) {
        const overlaps =
          create.x < paginator.x + paginator.width &&
          create.x + create.width > paginator.x &&
          create.y < paginator.y + paginator.height &&
          create.y + create.height > paginator.y;
        expect(overlaps, "+ button overlaps the paginator").toBe(false);
      }
    });
  }

  test("no serious or critical axe violations (AP-779-TC-111)", async ({
    page,
  }) => {
    // Expected to fail, finding A11Y-01: the row actions are icon-only
    // v-btns with no accessible name, and the create control is a <div> with
    // a click handler (TeacherOnlineClassView.vue:48-91, :142).
    test.fail();

    await OnlineClassListService.open(page);

    const results = await new AxeBuilder({ page })
      .include(data.axe.scope)
      .analyze();
    const blocking = results.violations.filter((violation) =>
      data.axe.blockingImpacts.includes(violation.impact ?? ""),
    );

    expect(
      blocking.map(
        (violation) => `${violation.id} (${violation.nodes.length})`,
      ),
    ).toEqual([]);
  });
});
