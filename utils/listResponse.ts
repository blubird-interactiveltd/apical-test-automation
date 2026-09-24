import type {
  OnlineClass,
  OnlineClassListResponse,
} from "./types/onlineClass/onlineClass.types";

/**
 * Builds one page of `GET /api/v1/online-class` the way Laravel paginates it.
 *
 * `from`/`to` are null on an empty result, as Laravel sends them, because the
 * list page's paginator reads them and an invented `0` would hide that case.
 */
export function buildListResponse(
  items: OnlineClass[],
  page = 1,
  perPage = 20,
  total = items.length,
): OnlineClassListResponse {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : null;

  return {
    items,
    links: {
      prev: page > 1 ? `?page=${page - 1}` : null,
      next: page < lastPage ? `?page=${page + 1}` : null,
    },
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total,
      from,
      to: from ? from + items.length - 1 : null,
    },
  };
}

/**
 * `count` synthetic classes cloned from `base`, titled `<prefix> 001`…
 *
 * Zero-padded so the titles sort the same way they are numbered, and given
 * v4-shaped ids so the detail route's UUID matcher still accepts them.
 */
export function makeClasses(
  base: OnlineClass,
  count: number,
  prefix: string,
): OnlineClass[] {
  return Array.from({ length: count }, (_, index) => ({
    ...base,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `${prefix} ${String(index + 1).padStart(3, "0")}`,
  }));
}

/** Slices `all` into the page a `?page=` request asks for. */
export function pageOf(
  all: OnlineClass[],
  page: number,
  perPage: number,
): OnlineClassListResponse {
  const start = (page - 1) * perPage;

  return buildListResponse(
    all.slice(start, start + perPage),
    page,
    perPage,
    all.length,
  );
}
