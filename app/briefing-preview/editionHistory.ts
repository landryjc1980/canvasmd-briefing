import type { ReadoutEditionSnapshot } from "./editionSnapshot";

function editionSnapshot(value: unknown): ReadoutEditionSnapshot | null {
  const snapshot = value as Partial<ReadoutEditionSnapshot> | null;
  return !!snapshot && snapshot.schemaVersion === 2 && typeof snapshot.editionDate === "string" &&
      typeof snapshot.area === "string" && Array.isArray(snapshot.developments) &&
      Array.isArray(snapshot.relevant) && Array.isArray(snapshot.listen)
    ? snapshot as ReadoutEditionSnapshot
    : null;
}

export function readoutEditionHistoryIncludingCurrent(
  currentValue: unknown,
  historyValues: unknown[] = [],
): ReadoutEditionSnapshot[] {
  const current = editionSnapshot(currentValue);
  const currentDay = current ? Date.parse(`${current.editionDate}T12:00:00Z`) : Number.NaN;
  const oldestIncludedDate = Number.isFinite(currentDay)
    ? new Date(currentDay - 6 * 86400_000).toISOString().slice(0, 10)
    : null;
  const history = historyValues
    .map(editionSnapshot)
    .filter((snapshot): snapshot is ReadoutEditionSnapshot => !!snapshot)
    .filter((snapshot) => !current || (
      snapshot.area === current.area && snapshot.editionDate < current.editionDate &&
      (!oldestIncludedDate || snapshot.editionDate >= oldestIncludedDate)
    ))
    .sort((left, right) => right.editionDate.localeCompare(left.editionDate));

  const seenDates = new Set<string>();
  const previous = history.filter((snapshot) => {
    if (seenDates.has(snapshot.editionDate)) return false;
    seenDates.add(snapshot.editionDate);
    return true;
  }).slice(0, current ? 6 : 7);

  return current ? [current, ...previous] : previous;
}
