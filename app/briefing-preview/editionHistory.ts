import type { ReadoutEditionSnapshot } from "./editionSnapshot";

type SnapshotDevelopment = ReadoutEditionSnapshot["developments"][number]["development"];
type SnapshotArticle = ReadoutEditionSnapshot["relevant"][number]["article"];

const snapshotTextKey = (value: string | null | undefined): string =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function sameSnapshotArticle(left: SnapshotArticle, right: SnapshotArticle): boolean {
  return left.id === right.id || (!!left.url && left.url === right.url) ||
    (snapshotTextKey(left.title).length >= 12 && snapshotTextKey(left.title) === snapshotTextKey(right.title));
}

function sameSnapshotDevelopment(left: SnapshotDevelopment, right: SnapshotDevelopment): boolean {
  if (left.id === right.id) return true;
  if ("kind" in left || "kind" in right) {
    return "kind" in left && "kind" in right && snapshotTextKey(left.title) === snapshotTextKey(right.title);
  }
  return sameSnapshotArticle(left, right);
}

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
  if (!current || current.area === "All" || !all ||
      all.area !== "All" || all.editionDate !== current.editionDate) return current;

  const developments = [...current.developments];
  for (const entry of all.developments.filter((candidate) => candidate.development.area === current.area)) {
    if (!developments.some((existing) => sameSnapshotDevelopment(existing.development, entry.development))) {
      developments.push(entry);
    }
  }
  const relevant = [...current.relevant];
  for (const entry of all.relevant.filter((candidate) => candidate.article.area === current.area)) {
    if (!developments.some((existing) => !("kind" in existing.development) &&
        sameSnapshotArticle(existing.development, entry.article)) &&
        !relevant.some((existing) => sameSnapshotArticle(existing.article, entry.article))) {
      relevant.push(entry);
    }
  }
  if (developments.length === current.developments.length && relevant.length === current.relevant.length) return current;

  const positionedDevelopments = developments.map((entry, position) => ({ ...entry, position }));
  const positionedRelevant = relevant.map((entry, position) => ({ ...entry, position }));

  const developmentIds = new Set(positionedDevelopments.map((entry) => entry.development.id));
  const listen = [...current.listen];
  const listenKeys = new Set(listen.map((entry) => entry.episode?.episodeId || entry.item.url || entry.item.title.toLowerCase()));
  for (const entry of all.listen.filter((candidate) => candidate.item.area === current.area)) {
    const key = entry.episode?.episodeId || entry.item.url || entry.item.title.toLowerCase();
    if (!listenKeys.has(key)) {
      listenKeys.add(key);
      listen.push(entry);
    }
  }
  return {
    ...current,
    developments: positionedDevelopments,
    relevant: positionedRelevant,
    listen,
    middayInsertions: [...new Set([
      ...(current.middayInsertions ?? []),
      ...(all.middayInsertions ?? []).filter((id) => developmentIds.has(id)),
    ])],
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
