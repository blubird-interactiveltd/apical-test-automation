import { Fixtures } from "./fixtures";
import type {
  SpeakingListResponse,
  SpeakingQuestion,
} from "./types/speaking/speakingList.types";

/** Pages recorded from `GET /questions/list?type=question&section=speaking&sort=-created_at`. */
export const RECORDED_LIST_PAGES = 6;

export const listPageFixture = (page: number): string =>
  `speakingList.page${page}.response.json`;

/**
 * All 118 Speaking questions on stage (2026-10-05), in recorded order.
 *
 * Kept as the six pages the API returned rather than one merged file: each
 * page stays under the repo's 50 KB fixture limit (hook [2e]), and the files
 * are exactly what was recorded. Every call returns fresh clones.
 */
export function recordedSpeakingQuestions(): SpeakingQuestion[] {
  return Array.from({ length: RECORDED_LIST_PAGES }, (_, index) =>
    Fixtures.api<SpeakingListResponse>(listPageFixture(index + 1)),
  ).flatMap((page) => page.items);
}
