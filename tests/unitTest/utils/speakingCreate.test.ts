import { describe, expect, it } from "vitest";
import {
  expectedTotalAnswerTime,
  minimalPayload,
  multipartField,
  multipartFileName,
  QA_INDEX_PREFIX,
  qaIndex,
  qaIndexOfLength,
  withoutBrackets,
} from "../../../utils/speakingCreate";
import { Fixtures } from "../../../utils/fixtures";
import { silentMp3 } from "../../../utils/speakingMedia";
import type { TypeTiming } from "../../../utils/types/speaking/speakingCreate.types";
import type { SpeakingQuestionTypesResponse } from "../../../utils/types/speaking/speakingList.types";

const types = Fixtures.api<SpeakingQuestionTypesResponse>(
  "speakingQuestionTypes.response.json",
).items;
const timing = (code: string) =>
  types.find((type) => type.short_title === code) as unknown as TypeTiming;

describe("qaIndex", () => {
  it("starts with the automation prefix and the type", () => {
    expect(qaIndex("RS")).toMatch(
      new RegExp(`^${QA_INDEX_PREFIX}RS-\\d{13}-[a-z0-9]{1,4}$`),
    );
  });

  it("does not repeat between calls in the same millisecond", () => {
    const indexes = new Set(Array.from({ length: 50 }, () => qaIndex("RA")));

    expect(indexes.size).toBe(50);
  });

  it("pads to an exact length, and refuses one too short to hold it", () => {
    expect(qaIndexOfLength("RA", 255)).toHaveLength(255);
    expect(qaIndexOfLength("RA", 256)).toHaveLength(256);
    expect(() => qaIndexOfLength("RA", 10)).toThrow(/10 characters/);
  });
});

describe("expectedTotalAnswerTime", () => {
  // Fixed totals measured on stage (business doc §3.1).
  it("gives RA 81 and DI 66 whatever the media", () => {
    expect(expectedTotalAnswerTime(timing("RA"), 99)).toBe(81);
    expect(expectedTotalAnswerTime(timing("DI"))).toBe(66);
  });

  it("adds the media length and the beep for the file-length types", () => {
    // RS: 3 pre-audio + 4 prep + 15 answer + 5 s file + 1 beep
    expect(expectedTotalAnswerTime(timing("RS"), 5)).toBe(28);
    // ASQ has no beep
    expect(expectedTotalAnswerTime(timing("ASQ"), 5)).toBe(26);
    expect(expectedTotalAnswerTime(timing("SGD"), 180)).toBe(314);
  });

  it("falls in the ranges stage holds for real media", () => {
    expect(expectedTotalAnswerTime(timing("RS"), 0)).toBeGreaterThanOrEqual(23);
    expect(expectedTotalAnswerTime(timing("RTAS"), 0)).toBe(54);
  });
});

describe("minimalPayload", () => {
  const type = { id: "type-id", timing: timing("RS") };

  it("carries the hidden defaults and the type's own times", () => {
    expect(minimalPayload(type, "QA-1")).toMatchObject({
      index: "QA-1",
      question_type_id: "type-id",
      prompt_type: "DEFAULT",
      answer_time_type: "DEFAULT",
      preparation_time_type: "DEFAULT",
      preparation_time: 4,
      answer_time: 15,
      type: "QUESTION",
      active: true,
      is_requested: false,
    });
  });

  it("lets fields replace a default", () => {
    expect(
      minimalPayload(type, "QA-1", { active: false, transcript: "t" }),
    ).toMatchObject({ active: false, transcript: "t" });
  });
});

describe("multipart helpers", () => {
  const body = [
    "------b",
    'Content-Disposition: form-data; name="file"; filename="speaking-short.mp3"',
    "Content-Type: audio/mpeg",
    "",
    "ID3...",
    "------b",
    'Content-Disposition: form-data; name="type"',
    "",
    "question_audio",
    "------b--",
  ].join("\r\n");

  it("reads a text field and a file name", () => {
    expect(multipartField(body, "type")).toBe("question_audio");
    expect(multipartFileName(body, "file")).toBe("speaking-short.mp3");
  });

  it("returns null for a field that is not there", () => {
    expect(multipartField(body, "missing")).toBeNull();
    expect(multipartFileName(body, "type")).toBeNull();
  });
});

describe("silentMp3", () => {
  it("is whole 144-byte frames, each starting with the MPEG-1 Layer III sync", () => {
    const clip = silentMp3(5);

    expect(clip.length % 144).toBe(0);
    expect([...clip.subarray(0, 4)]).toEqual([0xff, 0xfb, 0x18, 0xc0]);
    expect([...clip.subarray(144, 148)]).toEqual([0xff, 0xfb, 0x18, 0xc0]);
  });

  it("plays at least the asked length and less than one frame more", () => {
    // 32 kbps = 4000 bytes a second
    const seconds = silentMp3(60).length / 4000;

    expect(seconds).toBeGreaterThanOrEqual(60);
    expect(seconds).toBeLessThan(60.036);
  });
});

describe("withoutBrackets", () => {
  it("drops square brackets only", () => {
    expect(withoutBrackets("<p>The [government] is [[x]]</p>")).toBe(
      "<p>The government is x</p>",
    );
  });
});
