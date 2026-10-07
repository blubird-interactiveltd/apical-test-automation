import type {
  QuestionPayload,
  TypeTiming,
} from "./types/speaking/speakingCreate.types";
import type { SpeakingCreateType } from "./types/speaking/speakingCreateData.types";
import type { SpeakingTypeCode } from "./types/speaking/speakingList.types";

/**
 * A create body for `type` as the front-end builds it (business doc §5.2):
 * the hidden defaults, the type's own times, plus `fields`.
 */
export function minimalPayload(
  type: Pick<SpeakingCreateType, "id" | "timing">,
  index: string,
  fields: QuestionPayload = {},
): QuestionPayload {
  return {
    index,
    question_type_id: type.id,
    prompt_type: "DEFAULT",
    prompt: "",
    preparation_time_type: "DEFAULT",
    preparation_time: type.timing.preparation_time,
    answer_time_type: "DEFAULT",
    answer_time: type.timing.answer_time,
    source: "EXAM_QUESTION",
    frequency: "MODERATE",
    active: true,
    type: "QUESTION",
    is_requested: false,
    ...fields,
  };
}

/** Every question the suite creates has an index starting with this. */
export const QA_INDEX_PREFIX = "QA-AUTO-SPK-";

/**
 * A unique index for one automation question: `QA-AUTO-SPK-<TYPE>-<timestamp>-<rand>`.
 *
 * The random tail keeps two workers that start in the same millisecond apart;
 * the API rejects a repeated index across every question type (§4.2).
 */
export function qaIndex(code: SpeakingTypeCode | string): string {
  return `${QA_INDEX_PREFIX}${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** A unique automation index padded with `x` to exactly `length` characters. */
export function qaIndexOfLength(
  code: SpeakingTypeCode | string,
  length: number,
): string {
  const base = qaIndex(code);

  if (base.length > length) {
    throw new Error(`An index of ${length} characters cannot hold "${base}".`);
  }

  return base.padEnd(length, "x");
}

/**
 * `total_answer_time` as apical-api `QuestionService::prepareAnswerTime`
 * computes it: the type's times, plus the media length for the
 * `pre_post_file_length_answer_time` types, plus one second when there is a beep.
 */
export function expectedTotalAnswerTime(
  timing: TypeTiming,
  mediaSeconds = 0,
): number {
  let total = timing.answer_time;

  if (timing.answer_time_calculation_type === "pre_post_answer_time") {
    total =
      timing.preparation_time_pre_audio +
      timing.preparation_time +
      timing.answer_time;
  } else if (
    timing.answer_time_calculation_type === "pre_post_file_length_answer_time"
  ) {
    total =
      timing.preparation_time_pre_audio +
      timing.preparation_time +
      timing.answer_time +
      mediaSeconds;
  }

  return total + (timing.is_beep ? 1 : 0);
}

/** The value of a plain text field in a multipart body, or null. */
export function multipartField(body: string, name: string): string | null {
  const match = new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r\\n]*)`).exec(
    body,
  );

  return match?.[1] ?? null;
}

/** The file name sent in a multipart file field, or null. */
export function multipartFileName(body: string, name: string): string | null {
  const match = new RegExp(`name="${name}"; filename="([^"]*)"`).exec(body);

  return match?.[1] ?? null;
}

/** A pattern matching any one of `texts` literally. */
export function anyOf(...texts: string[]): RegExp {
  return new RegExp(
    texts.map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  );
}

/** `text` without `[` and `]`, as the API's display reads return it. */
export function withoutBrackets(text: string): string {
  return text.replace(/[[\]]/g, "");
}
