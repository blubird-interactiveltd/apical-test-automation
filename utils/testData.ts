/**
 * Picks one case out of a data file by id.
 *
 * For data files whose cases each drive a different assertion, so a spec
 * cannot simply loop over them. Throws rather than returning undefined: a
 * renamed id should fail the spec at load time, not skip its assertion.
 */
export function caseById<T extends { id: string }>(cases: T[], id: string): T {
  const found = cases.find((entry) => entry.id === id);

  if (!found) {
    throw new Error(`No test-data case with id "${id}".`);
  }

  return found;
}
