/**
 * Seconds to `HH:MM`, exactly as apical `src/utils/utils.js` `secondToHour`
 * does it. The list page defines a wrapper for this but never calls it (D-01),
 * so this is the expected value its DURATION(H) column should show.
 */
export function secondToHour(seconds: number): string {
  if (!seconds) {
    return "00:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
