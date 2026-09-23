/** The Apical accounts the suites sign in as. */
export type ApicalRole = "master" | "coaching" | "teacher";

/**
 * What `POST /api/v1/login` returns, and exactly what `Login.vue` copies into
 * localStorage. The API sometimes nests it under `data`.
 */
export interface ApicalSession {
  token: string;
  token2?: string;
  user_id?: string | number;
  user_type?: string;
  organization_id?: string | number;
}

export interface ApicalLoginResponse extends Partial<ApicalSession> {
  data?: ApicalSession;
}

/** One `localStorage` entry as Playwright serialises it. */
export interface StorageEntry {
  name: string;
  value: string;
}

/** The storage-state shape this suite writes to disk. */
export interface SavedState {
  cookies: [];
  origins: { origin: string; localStorage: StorageEntry[] }[];
}
