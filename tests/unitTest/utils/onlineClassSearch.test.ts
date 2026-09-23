import { describe, expect, it } from "vitest";
import { Fixtures } from "../../../utils/fixtures";
import {
  backendSearch,
  pageParamOf,
  searchTermsOf,
} from "../../../utils/onlineClassSearch";
import type { OnlineClassListResponse } from "../../../utils/types/onlineClass/onlineClass.types";

const items = Fixtures.api<OnlineClassListResponse>(
  "onlineClassList.response.json",
).items;
const titles = (term: string) => backendSearch(items, term).map((i) => i.title);

describe("backendSearch", () => {
  it("matches on title", () => {
    expect(titles("coaching")).toEqual(["coaching-test-1", "coaching-test"]);
  });

  it("matches on description text", () => {
    expect(titles("Maecenas")).toEqual([
      "New South Wales",
      "coaching-test-1",
      "coaching-test",
    ]);
  });

  it("is case-insensitive", () => {
    expect(titles("SDDS")).toEqual(titles("sdds"));
    expect(titles("SDDS")).toHaveLength(5);
  });

  it("matches raw HTML markup, as the backend does (finding D-10)", () => {
    expect(titles("strong")).toEqual(["How to Create an Online Class"]);
  });

  it("returns everything for an empty term", () => {
    expect(backendSearch(items, "")).toHaveLength(items.length);
  });
});

describe("searchTermsOf", () => {
  it("keeps only requests that carry a search, in order", () => {
    expect(
      searchTermsOf([
        "https://api.test/api/v1/online-class",
        "https://api.test/api/v1/online-class?page=1&search=coa",
        "https://api.test/api/v1/online-class?page=1&search=",
      ]),
    ).toEqual(["coa", ""]);
  });
});

describe("pageParamOf", () => {
  it("reads the page parameter", () => {
    expect(pageParamOf("https://api.test/api/v1/online-class?page=3")).toBe(3);
  });

  it("defaults to page 1 when absent", () => {
    expect(pageParamOf("https://api.test/api/v1/online-class")).toBe(1);
  });
});
