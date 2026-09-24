import { describe, expect, it } from "vitest";
import { DataLoader } from "../../../utils/dataLoader";
import { caseById } from "../../../utils/testData";
import type { OnlineClassLoadingEdgeTestData } from "../../../utils/types/onlineClass/onlineClassLoading.types";
import type { OnlineClassSearchEdgeTestData } from "../../../utils/types/onlineClass/onlineClassSearch.types";
import type { OnlineClassTableTestData } from "../../../utils/types/onlineClass/onlineClassTable.types";

describe("caseById", () => {
  const cases = [
    { id: "AP-779-TC-001", value: 1 },
    { id: "AP-779-TC-002", value: 2 },
  ];

  it("returns the matching case", () => {
    expect(caseById(cases, "AP-779-TC-002").value).toBe(2);
  });

  it("throws on an unknown id instead of returning undefined", () => {
    expect(() => caseById(cases, "AP-779-TC-999")).toThrow(/AP-779-TC-999/);
  });
});

describe("AP-779 data files", () => {
  it("every case id is unique within its file", () => {
    const loading = DataLoader.load<OnlineClassLoadingEdgeTestData>(
      "data/edge/onlineClass/onlineClassLoadingEdgeTestData.json",
    );
    const search = DataLoader.load<OnlineClassSearchEdgeTestData>(
      "data/edge/onlineClass/onlineClassSearchEdgeTestData.json",
    );

    for (const ids of [
      loading.cases.map((entry) => entry.id),
      search.cases.map((entry) => entry.id),
      search.live.map((entry) => entry.id),
    ]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("the table data names the third 'sdds Copy' row's own id", () => {
    const table = DataLoader.load<OnlineClassTableTestData>(
      "data/regular/onlineClass/onlineClassTableRegularTestData.json",
    );
    const target = table.duplicateTitleTarget;
    const row = table.rows.find(
      (entry) =>
        entry.title === target.title && entry.occurrence === target.occurrence,
    );

    expect(row?.id).toBe(target.id);
  });
});
