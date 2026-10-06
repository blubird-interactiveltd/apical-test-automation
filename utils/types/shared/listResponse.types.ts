/** Laravel's paginator `meta`, as the Apical list resources send it. */
export interface ListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

/** Laravel resource-collection envelope the list pages read. */
export interface ListResponse<T> {
  items: T[];
  links: { prev: string | null; next: string | null };
  meta: ListMeta;
}

/** A stubbed error reply for a list endpoint. */
export interface StubbedError {
  status: number;
  body?: Record<string, unknown>;
}
