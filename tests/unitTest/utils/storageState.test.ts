import { describe, expect, it } from "vitest";
import { isStateFresh, statePath } from "../../../utils/storageState";

describe("isStateFresh", () => {
  it("treats a state saved just now as fresh", () => {
    expect(isStateFresh(Date.now(), 60_000)).toBe(true);
  });

  it("treats a state older than the maximum age as stale", () => {
    expect(isStateFresh(Date.now() - 120_000, 60_000)).toBe(false);
  });

  it("treats a state exactly at the maximum age as stale", () => {
    const now = Date.now();

    expect(isStateFresh(now - 60_000, 60_000)).toBe(false);
  });

  it("treats a missing state, reported as zero, as stale", () => {
    expect(isStateFresh(0, 60_000)).toBe(false);
  });
});

describe("statePath", () => {
  it("keeps each role's session in its own file under test-results", () => {
    expect(statePath("master")).toMatch(
      /test-results[\\/]\.auth[\\/]master\.json$/,
    );
    expect(statePath("coaching")).not.toBe(statePath("master"));
  });
});
