import { pageOf } from "./listResponse";
import type { StubbedError } from "./types/shared/listResponse.types";
import type {
  SpeakingListQuery,
  SpeakingListResponse,
  SpeakingQuestion,
} from "./types/speaking/speakingList.types";

/** `config/settings.php` `pagination.per_page`. */
export const DEFAULT_PER_PAGE = 20;

/**
 * Columns of `questions` that `ORDER BY` accepts, mapped to the list field that
 * carries the same value. `created_by` holds the creator's uuid, which the list
 * resource sends as `creator` and replaces `created_by` with a display name.
 */
const SORTABLE: Record<string, keyof SpeakingQuestion> = {
  q_id: "q_id",
  index: "index",
  title: "title",
  frequency: "frequency",
  active: "active",
  approve_status: "approve_status",
  created_at: "created_at",
  created_by: "creator",
  question_type_id: "question_type_id",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Reads the filters a list request carries, defaulting as the API does. */
export function parseListQuery(url: URL): SpeakingListQuery {
  const params = url.searchParams;

  return {
    section: (params.get("section") ?? "").toLowerCase(),
    questionTypeId: params.get("question_type_id"),
    active: params.get("active"),
    search: params.get("search") ?? "",
    sort: params.get("sort") ?? "",
    page: Number(params.get("page") ?? 1) || 1,
    perPage: Number(params.get("per_page") ?? DEFAULT_PER_PAGE),
  };
}

/** "02 Oct, 2026 01:07 pm" → epoch ms, so `created_at` sorts by time. */
export function createdAtMs(value: string): number {
  const match = /^(\d{2}) (\w{3}), (\d{4}) (\d{2}):(\d{2}) (am|pm)$/.exec(
    value,
  );

  if (!match) {
    throw new Error(`Unrecognised created_at "${value}".`);
  }

  const [, day, month, year, hour, minute, half] = match;
  const hour24 = (Number(hour) % 12) + (half === "pm" ? 12 : 0);

  return Date.UTC(
    Number(year),
    MONTHS.indexOf(month ?? ""),
    Number(day),
    hour24,
    Number(minute),
  );
}

/**
 * `active` as `Question::scopeOfSearch` applies it: present means filter, and
 * PostgreSQL reads "1"/"true" as true and "0"/"false" as false.
 */
function activeFilter(value: string | null): boolean | null {
  if (value === null) return null;

  return value === "1" || value === "true";
}

/**
 * The backend's filters, reproduced so a stub answers as the server would.
 *
 * Mirrors apical-api `Question::scopeOfSearch`: section, question_type_id,
 * active, and a **case-sensitive** `LIKE %term%` (PostgreSQL). Of the seven
 * columns the API searches, the list fixture carries three — q_id, index and
 * title — so a term that only appears in prompt, transcript, keywords or
 * file_path matches nothing here. The live spec covers those.
 */
export function backendFilter(
  items: SpeakingQuestion[],
  query: SpeakingListQuery,
): SpeakingQuestion[] {
  // The recorded fixture holds only Speaking questions.
  if (query.section && query.section !== "speaking") {
    return [];
  }

  const active = activeFilter(query.active);
  const term = query.search;

  return items.filter(
    (item) =>
      (query.questionTypeId === null ||
        item.question_type_id === query.questionTypeId) &&
      (active === null || item.active === active) &&
      (term === "" ||
        item.q_id.includes(term) ||
        item.index.includes(term) ||
        (item.title ?? "").includes(term)),
  );
}

function compareValues(
  a: unknown,
  b: unknown,
  column: keyof SpeakingQuestion,
): number {
  if (column === "created_at") {
    return createdAtMs(String(a)) - createdAtMs(String(b));
  }
  if (typeof a === "boolean" || typeof a === "number") {
    return Number(a) - Number(b);
  }

  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/**
 * `BaseTrait::scopeOfOrderBy`: a comma list of columns, `-` for descending,
 * default `created_at desc`. Any name is passed to `ORDER BY` unchecked, so a
 * name that is not a column fails the query (finding F-03) — reproduced here
 * as the error the API returns. Nulls sort last ascending and first
 * descending, as in PostgreSQL.
 */
export function backendSort(
  items: SpeakingQuestion[],
  sort: string,
): SpeakingQuestion[] | StubbedError {
  const keys = (sort || "-created_at")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  for (const key of keys) {
    const name = key.replace(/^-/, "");
    if (!(name in SORTABLE)) {
      return {
        status: 404,
        body: {
          message: `SQLSTATE[42703]: Undefined column: 7 ERROR:  column "${name}" does not exist`,
        },
      };
    }
  }

  return [...items].sort((left, right) => {
    for (const key of keys) {
      const descending = key.startsWith("-");
      const column = SORTABLE[key.replace(/^-/, "")] as keyof SpeakingQuestion;
      const a = left[column];
      const b = right[column];

      if (a === b) continue;
      if (a === null) return descending ? -1 : 1;
      if (b === null) return descending ? 1 : -1;

      const order = compareValues(a, b, column);
      if (order !== 0) return descending ? -order : order;
    }

    return 0;
  });
}

/** One list response for `url`, answered from `items` as the API would. */
export function answerListRequest(
  items: SpeakingQuestion[],
  url: URL,
): SpeakingListResponse | StubbedError {
  const query = parseListQuery(url);
  const sorted = backendSort(backendFilter(items, query), query.sort);

  if (!Array.isArray(sorted)) {
    return sorted;
  }

  return pageOf(sorted, query.page, query.perPage);
}
