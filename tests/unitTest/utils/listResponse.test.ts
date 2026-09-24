import { describe, expect, it } from "vitest";
import {
  buildListResponse,
  makeClasses,
  pageOf,
} from "../../../utils/listResponse";
import { Fixtures } from "../../../utils/fixtures";
import type { OnlineClassListResponse } from "../../../utils/types/onlineClass/onlineClass.types";

const base = Fixtures.api<OnlineClassListResponse>(
  "onlineClassList.response.json",
).items[0];

if (!base) {
  throw new Error("onlineClassList.response.json has no items.");
}

describe("buildListResponse", () => {
  it("describes a full first page the way Laravel does", () => {
    const response = buildListResponse(makeClasses(base, 20, "C"), 1, 20, 45);

    expect(response.meta).toEqual({
      current_page: 1,
      last_page: 3,
      per_page: 20,
      total: 45,
      from: 1,
      to: 20,
    });
    expect(response.links).toEqual({ prev: null, next: "?page=2" });
  });

  it("sends null from/to on an empty result, never 0", () => {
    const response = buildListResponse([], 1, 20, 0);

    expect(response.meta.from).toBeNull();
    expect(response.meta.to).toBeNull();
    expect(response.meta.last_page).toBe(1);
  });

  it("matches the recorded sample's meta for 20 items on one page", () => {
    const sample = Fixtures.api<OnlineClassListResponse>(
      "onlineClassList.response.json",
    );
    const rebuilt = buildListResponse(sample.items);

    expect(rebuilt.meta).toEqual({
      current_page: sample.meta.current_page,
      last_page: sample.meta.last_page,
      per_page: sample.meta.per_page,
      total: sample.meta.total,
      from: sample.meta.from,
      to: sample.meta.to,
    });
  });
});

describe("makeClasses", () => {
  it("numbers titles with zero padding so they sort as numbered", () => {
    const titles = makeClasses(base, 12, "Class").map((item) => item.title);

    expect(titles.slice(0, 2)).toEqual(["Class 001", "Class 002"]);
    expect([...titles].sort()).toEqual(titles);
  });

  it("gives every class a distinct UUID-shaped id", () => {
    const ids = makeClasses(base, 45, "Class").map((item) => item.id);

    expect(new Set(ids).size).toBe(45);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("pageOf", () => {
  it("returns the short last page", () => {
    const page = pageOf(makeClasses(base, 45, "Class"), 3, 20);

    expect(page.items.map((item) => item.title)).toEqual([
      "Class 041",
      "Class 042",
      "Class 043",
      "Class 044",
      "Class 045",
    ]);
    expect(page.meta.to).toBe(45);
    expect(page.links.next).toBeNull();
  });
});
