import type { ReadoutEditionSnapshot } from "./editionSnapshot";

type SnapshotDevelopment = ReadoutEditionSnapshot["developments"][number]["development"];
type SnapshotArticle = ReadoutEditionSnapshot["relevant"][number]["article"];

function isSnapshotArticle(value: SnapshotDevelopment): value is SnapshotArticle {
  return !("kind" in value);
}

const snapshotTextKey = (value: string | null | undefined): string =>
  String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function snapshotCanonicalUrl(value: string | null | undefined): string | null {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || ["fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "s", "source"].includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function snapshotEpisodeIdentityKeys(entry: ReadoutEditionSnapshot["listen"][number]): string[] {
  const title = snapshotTextKey(entry.episode?.title ?? entry.item.title);
  const show = snapshotTextKey(entry.episode?.show ?? entry.item.show);
  const audio = snapshotCanonicalUrl(entry.episode?.audioUrl ?? entry.item.audioUrl);
  const source = snapshotCanonicalUrl(entry.episode?.sourceUrl ?? entry.item.url);
  return [
    entry.item.id ? `episode:id:${entry.item.id}` : null,
    entry.item.episodeId ? `episode:id:${entry.item.episodeId}` : null,
    entry.episode?.episodeId ? `episode:id:${entry.episode.episodeId}` : null,
    audio ? `episode:audio:${audio}` : null,
    source ? `episode:url:${source}` : null,
    title.length >= 12 ? `episode:title:${show}:${title}` : null,
  ].filter((key): key is string => Boolean(key));
}

function sameSnapshotArticle(left: SnapshotArticle, right: SnapshotArticle): boolean {
  const leftUrl = snapshotCanonicalUrl(left.url);
  const rightUrl = snapshotCanonicalUrl(right.url);
  return left.id === right.id || (!!leftUrl && leftUrl === rightUrl) ||
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

function candidateAreas(value: unknown): string[] {
  const areas = (value as { areas?: unknown } | null)?.areas;
  return Array.isArray(areas) ? areas.filter((area): area is string => typeof area === "string") : [];
}

/**
 * A specialty is a lens over the one canonical All edition. It never owns a
 * second archive. Matching canonical cards are promoted into the specialty's
 * lead section first, with the remainder preserved as Also Relevant.
 */
export function readoutEditionForArea(
  allValue: unknown,
  area: ReadoutEditionSnapshot["area"],
): ReadoutEditionSnapshot | null {
  const all = editionSnapshot(allValue);
  if (!all || all.area !== "All") return null;
  if (area === "All") return all;

  const matchingDevelopments = all.developments
    .filter((entry) => entry.development.area === area);
  const matchingRelevant = all.relevant
    .filter((entry) => entry.article.area === area)
    .filter((entry) => !matchingDevelopments.some((existing) =>
      !("kind" in existing.development) && sameSnapshotArticle(existing.development, entry.article)));
  const allMatching = [
    ...matchingDevelopments,
    ...matchingRelevant.map((entry) => ({ development: entry.article, episode: null, position: entry.position })),
  ].filter((entry, index, entries) => !entries.slice(0, index).some((existing) =>
    sameSnapshotDevelopment(existing.development, entry.development)));
  const developments = allMatching.slice(0, 5)
    .map((entry, position) => ({ ...entry, position }));
  const relevant = allMatching.slice(5)
    .flatMap((entry) => "kind" in entry.development ? [] : [{ article: entry.development, position: 0 }])
    .map((entry, position) => ({ ...entry, position }));
  const includedIds = new Set(developments.map((entry) => entry.development.id));

  return {
    ...all,
    area,
    developments,
    relevant,
    listen: all.listen.filter((entry) => entry.item.area === area),
    regulatoryCards: all.regulatoryCards.filter((candidate) => candidateAreas(candidate).includes(area)),
    designationCards: all.designationCards.filter((candidate) => candidateAreas(candidate).includes(area)),
    middayInsertions: (all.middayInsertions ?? []).filter((id) => includedIds.has(id)),
  };
}

/** Merge the exact per-area copies created by the old implementation into one
 * canonical daily edition. The All ordering remains authoritative; specialty
 * cards that were absent from All are appended to its complete remainder. */
export function canonicalReadoutEditionSnapshot(
  values: unknown[],
): ReadoutEditionSnapshot | null {
  const snapshots = values.map(editionSnapshot).filter((value): value is ReadoutEditionSnapshot => !!value);
  const all = snapshots.find((snapshot) => snapshot.area === "All");
  if (!all) return null;

  const developments = [...all.developments];
  const relevant = [...all.relevant];
  for (const snapshot of snapshots.filter((candidate) => candidate.area !== "All")) {
    for (const entry of snapshot.developments) {
      const article = entry.development;
      if (!isSnapshotArticle(article)) continue;
      if (developments.some((existing) => sameSnapshotDevelopment(existing.development, article)) ||
          relevant.some((existing) => sameSnapshotArticle(existing.article, article))) continue;
      relevant.push({ article, position: relevant.length });
    }
    for (const entry of snapshot.relevant) {
      if (developments.some((existing) => !("kind" in existing.development) &&
          sameSnapshotArticle(existing.development, entry.article)) ||
          relevant.some((existing) => sameSnapshotArticle(existing.article, entry.article))) continue;
      relevant.push({ article: entry.article, position: relevant.length });
    }
  }

  const listen = [...all.listen];
  const listenKeys = new Set(listen.flatMap(snapshotEpisodeIdentityKeys));
  for (const entry of snapshots.filter((candidate) => candidate.area !== "All").flatMap((snapshot) => snapshot.listen)) {
    const keys = snapshotEpisodeIdentityKeys(entry);
    if (keys.some((key) => listenKeys.has(key))) continue;
    keys.forEach((key) => listenKeys.add(key));
    listen.push(entry);
  }
  const byId = <T extends { id: string }>(items: T[]): T[] =>
    items.filter((item, index) => items.findIndex((candidate) => candidate.id === item.id) === index);

  return {
    ...all,
    developments: developments.map((entry, position) => ({ ...entry, position })),
    relevant: relevant.map((entry, position) => ({ ...entry, position })),
    listen,
    regulatoryCards: byId(snapshots.flatMap((snapshot) => snapshot.regulatoryCards)),
    designationCards: byId(snapshots.flatMap((snapshot) => snapshot.designationCards)),
    middayInsertions: [...new Set(snapshots.flatMap((snapshot) => snapshot.middayInsertions ?? []))],
    // Old specialty snapshots can truthfully disclose the retired 72-hour rescue even when the
    // contemporaneous All snapshot did not use it. Preserve that fact through consolidation and
    // every specialty projection; new backend snapshots always carry null.
    fallbackWindowHours: snapshots.some((snapshot) => snapshot.fallbackWindowHours === 72) ? 72 : null,
    updatedAt: snapshots.map((snapshot) => snapshot.updatedAt ?? snapshot.generatedAt).sort().at(-1),
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
