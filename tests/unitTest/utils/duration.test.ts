import { describe, expect, it } from "vitest";
import { secondToHour } from "../../../utils/duration";

describe("secondToHour", () => {
  it("formats whole hours", () => {
    expect(secondToHour(36000)).toBe("10:00");
  });

  it("keeps minutes and drops leftover seconds", () => {
    expect(secondToHour(86662)).toBe("24:04");
  });

  it("pads single digits", () => {
    expect(secondToHour(360)).toBe("00:06");
    expect(secondToHour(25200)).toBe("07:00");
  });

  it("renders zero as 00:00, as the app does", () => {
    expect(secondToHour(0)).toBe("00:00");
  });
});
