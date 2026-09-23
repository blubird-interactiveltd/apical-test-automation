import type { OnlineClass } from "./types/onlineClass/onlineClass.types";

/**
 * The backend's search, reproduced so a stub answers the way the server would.
 *
 * Mirrors apical-api `OnlineClass::scopeOfSearch`: `title LIKE %term%` OR
 * `description LIKE %term%`, case-insensitive under MySQL's default collation.
 * The description is the raw editor HTML, which is why a term such as
 * `strong` matches (finding D-10). An empty term means no filter, as there.
 */
export function backendSearch(
  items: OnlineClass[],
  term: string,
): OnlineClass[] {
  if (term === "") {
    return items;
  }

  const needle = term.toLowerCase();

  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) ||
      item.description.toLowerCase().includes(needle),
  );
}

/** Search terms, in order, from a list of recorded list-request URLs. */
export function searchTermsOf(urls: string[]): string[] {
  return urls
    .map((url) => new URL(url).searchParams.get("search"))
    .filter((term): term is string => term !== null);
}

/** The `page` query parameter of a list-request URL, defaulting to 1. */
export function pageParamOf(url: string): number {
  return Number(new URL(url).searchParams.get("page") ?? 1);
}
