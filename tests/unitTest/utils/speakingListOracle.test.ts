import { describe, expect, it } from "vitest";
import {
  answerListRequest,
  backendFilter,
  backendSort,
  createdAtMs,
  parseListQuery,
} from "../../../utils/speakingListOracle";
import { recordedSpeakingQuestions } from "../../../utils/speakingFixtures";

const all = recordedSpeakingQuestions();
const ASQ = "d95558f1-5063-4a3e-8980-ab2a8f632063";

const url = (query: string) =>
  new URL(`https://api.test/api/v1/questions/list?${query}`);

describe("parseListQuery", () => {
  it("reads the filters and defaults page and per_page", () => {
    expect(
      parseListQuery(url("type=question&section=speaking&sort=-created_at")),
    ).toEqual({
      section: "speaking",
      questionTypeId: null,
      active: null,
      search: "",
      sort: "-created_at",
      page: 1,
      perPage: 20,
    });
  });
});

describe("createdAtMs", () => {
  it("orders the API's display dates by time, 12 pm before 1 pm", () => {
    expect(createdAtMs("02 Oct, 2026 12:30 pm")).toBeLessThan(
      createdAtMs("02 Oct, 2026 01:07 pm"),
    );
    expect(createdAtMs("02 Oct, 2026 12:30 am")).toBeLessThan(
      createdAtMs("02 Oct, 2026 01:07 am"),
    );
  });

  it("refuses a format it does not know", () => {
    expect(() => createdAtMs("2026-10-02")).toThrow();
  });
});

describe("backendFilter", () => {
  const base = parseListQuery(url("section=speaking"));

  it("returns every recorded question with no filter", () => {
    expect(backendFilter(all, base)).toHaveLength(118);
  });

  it("filters by type and by active, as the recorded counts say", () => {
    expect(backendFilter(all, { ...base, questionTypeId: ASQ })).toHaveLength(
      10,
    );
    expect(backendFilter(all, { ...base, active: "0" })).toHaveLength(8);
    expect(backendFilter(all, { ...base, active: "1" })).toHaveLength(110);
  });

  it("searches case-sensitively, like PostgreSQL LIKE", () => {
    expect(backendFilter(all, { ...base, search: "RS0001" }).length).toBe(5);
    expect(backendFilter(all, { ...base, search: "rs0001" })).toEqual([]);
  });

  it("returns nothing for another section", () => {
    expect(backendFilter(all, { ...base, section: "reading" })).toEqual([]);
  });
});

describe("backendSort", () => {
  it("defaults to newest first", () => {
    const sorted = backendSort(all, "");

    expect(Array.isArray(sorted) && sorted[0]?.q_id).toBe("RS00237");
  });

  it("sorts ascending and descending by a column", () => {
    const up = backendSort(all, "q_id");
    const down = backendSort(all, "-q_id");

    expect(Array.isArray(up) && up.map((item) => item.q_id)).toEqual(
      [...all.map((item) => item.q_id)].sort(),
    );
    expect(Array.isArray(down) && down[0]?.q_id).toBe(
      [...all.map((item) => item.q_id)].sort().at(-1),
    );
  });

  it("fails a column that does not exist, as the API does (F-03)", () => {
    expect(backendSort(all, "sl")).toMatchObject({ status: 404 });
    expect(backendSort(all, "-item")).toMatchObject({ status: 404 });
  });
});

describe("answerListRequest", () => {
  it("pages the filtered result", () => {
    const reply = answerListRequest(all, url("section=speaking&page=6"));

    expect("meta" in reply && reply.meta).toMatchObject({
      current_page: 6,
      from: 101,
      to: 118,
      total: 118,
    });
  });

  it("sends an empty page past the end, as the API does", () => {
    const reply = answerListRequest(
      all,
      url(`section=speaking&question_type_id=${ASQ}&page=5`),
    );

    expect("items" in reply && reply.items).toEqual([]);
    expect("meta" in reply && reply.meta.total).toBe(10);
  });
});
