import fs from "node:fs";
import path from "node:path";
import type { ApicalRole } from "./types/auth/auth.types";

/**
 * Where a signed-in role's local storage is cached.
 *
 * Kept under the Playwright output directory rather than the repo, so it is
 * never committed and never outlives a clean. It holds a live session token,
 * which is exactly the kind of thing hook [1] exists to keep out of git.
 */
export function statePath(role: ApicalRole): string {
  return path.resolve(process.cwd(), `test-results/.auth/${role}.json`);
}

/** How long a saved session is trusted before it is established again. */
export const STATE_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Whether a state saved at `savedAtMs` may still be reused.
 *
 * A missing file is reported by the caller as `0`, which is stale by this
 * comparison rather than through a separate branch. Exactly at the limit counts
 * as stale: a session about to expire mid-run is worse than one extra login.
 */
export function isStateFresh(savedAtMs: number, maxAgeMs: number): boolean {
  if (savedAtMs <= 0) {
    return false;
  }

  return Date.now() - savedAtMs < maxAgeMs;
}

/** When the cached state for `role` was written, or 0 when there is none. */
export function stateSavedAt(role: ApicalRole): number {
  const file = statePath(role);

  if (!fs.existsSync(file)) {
    return 0;
  }

  return fs.statSync(file).mtimeMs;
}

/** Creates the directory the state files live in, if it is not there yet. */
export function ensureStateDir(role: ApicalRole): void {
  fs.mkdirSync(path.dirname(statePath(role)), { recursive: true });
}
