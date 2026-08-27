import type { ReadoutEditionSnapshot } from "./editionSnapshot";

function editionSnapshot(value: unknown): ReadoutEditionSnapshot | null {
  const snapshot = value as Partial<ReadoutEditionSnapshot> | null;
  return !!snapshot && snapshot.schemaVersion === 2 && typeof snapshot.editionDate === "string" &&
      typeof snapshot.area === "string" && Array.isArray(snapshot.developments) &&
      Array.isArray(snapshot.relevant) && Array.isArray(snapshot.listen)
    ? snapshot as ReadoutEditionSnapshot
    : null;
}

function hasEditorialCards(snapshot: ReadoutEditionSnapshot): boolean {
  return snapshot.developments.length > 0 || snapshot.relevant.length > 0;
}

export function readoutSpecialtyEditionFromAll(
  currentValue: unknown,
  allValue: unknown,
): ReadoutEditionSnapshot | null {
  const current = editionSnapshot(currentValue);
  const all = editionSnapshot(allValue);
  if (!current || current.area === "All" || hasEditorialCards(current) || !all ||
      all.area !== "All" || all.editionDate !== current.editionDate) return current;

  const developments = all.developments
    .filter((entry) => entry.development.area === current.area)
    .map((entry, position) => ({ ...entry, position }));
  const relevant = all.relevant
    .filter((entry) => entry.article.area === current.area)
    .map((entry, position) => ({ ...entry, position }));
  if (!developments.length && !relevant.length) return current;

  const developmentIds = new Set(developments.map((entry) => entry.development.id));
  return {
    ...current,
    developments,
    relevant,
    listen: current.listen.length
      ? current.listen
      : all.listen.filter((entry) => entry.item.area === current.area),
    middayInsertions: (all.middayInsertions ?? []).filter((id) => developmentIds.has(id)),
  };
}

export function readoutEditionPreferNonEmpty(
  preferredValue: unknown,
  fallbackValue: unknown,
): ReadoutEditionSnapshot | null {
  const preferred = editionSnapshot(preferredValue);
  const fallback = editionSnapshot(fallbackValue);
  if (!preferred) return fallback;
  if (!fallback || preferred.editionDate !== fallback.editionDate || hasEditorialCards(preferred)) return preferred;
  return hasEditorialCards(fallback) ? fallback : preferred;
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
