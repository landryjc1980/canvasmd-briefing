import type { BriefingData, BriefingEpisode, ReadoutListenEpisode, ReadoutWindowPayload } from "@/lib/types";
import {
  ALSO_RELEVANT,
  FEATURED_EPISODES,
  NEW_TO_LISTEN,
  SPECIALTY_FALLBACKS,
  WORTH_YOUR_TIME,
  findArchivedEditorialSource,
  findEpisode,
  listenForArea,
  regulatoryEditorialArticle,
  sameEditorialArticle,
  visibleForArea,
  type EditorialArticle,
  type EditorialDevelopment,
  type EditorialEpisode,
  type EditorialEpisodeFeature,
  type EditionArea,
} from "./edition";

export type ReadoutEditionDevelopment = {
  development: EditorialDevelopment;
  episode: ReadoutListenEpisode | null;
  position: number;
};
export type ReadoutEditionArticle = { article: EditorialArticle; position: number };
export type ReadoutEditionListen = { item: EditorialEpisode; episode: ReadoutListenEpisode | null };
export type ReadoutEditionSnapshot = {
  schemaVersion: 1;
  editionDate: string;
  generatedAt: string;
  area: EditionArea;
  developments: ReadoutEditionDevelopment[];
  relevant: ReadoutEditionArticle[];
  listen: ReadoutEditionListen[];
  regulatoryCards: ReadoutWindowPayload["regulatoryCards"];
  designationCards: ReadoutWindowPayload["designationCards"];
};

export function etEditionDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function etEditionHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));
}

function isEpisodeDevelopment(item: EditorialDevelopment): item is EditorialEpisodeFeature {
  return "kind" in item && item.kind === "episode";
}

function liveListenBriefs(payload: ReadoutWindowPayload): BriefingData[] {
  const byArea = new Map<string, BriefingEpisode[]>();
  for (const episode of payload.episodes ?? []) {
    const item: BriefingEpisode = {
      episodeId: episode.episodeId,
      title: episode.title,
      show: episode.show,
      showArt: episode.showArt,
      audioUrl: episode.audioUrl,
      sourceUrl: episode.sourceUrl,
      durationSeconds: episode.durationSeconds,
      description: episode.description,
      publishedAt: episode.publishedAt,
      subAreas: episode.areas,
    };
    for (const episodeArea of episode.areas) byArea.set(episodeArea, [...(byArea.get(episodeArea) ?? []), item]);
  }
  return [...byArea].map(([area, episodes]) => ({ area, episodes } as BriefingData));
}

function withSupport(item: EditorialArticle, payload: ReadoutWindowPayload): EditorialArticle {
  const archived = findArchivedEditorialSource(item, payload.cards ?? []);
  if (!archived?.card.support?.links?.length) return item;
  const links = archived.card.support.links;
  return {
    ...item,
    articleIds: links.map((link) => link.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
    primarySources: links.filter((link) => link.relationshipType === "primary_source"),
    relatedCoverage: links,
  };
}

function matchedEpisode(
  item: EditorialEpisode,
  briefs: BriefingData[],
  payload: ReadoutWindowPayload,
): ReadoutListenEpisode | null {
  const matched = findEpisode(item, briefs);
  return matched?.episodeId
    ? payload.episodes.find((episode) => episode.episodeId === matched.episodeId) ?? null
    : null;
}

export function buildReadoutEditionSnapshot(
  area: EditionArea,
  payload: ReadoutWindowPayload,
  now = new Date(),
): ReadoutEditionSnapshot {
  const regulatory = payload.regulatoryCards.map((candidate) => regulatoryEditorialArticle(candidate, area));
  const staticDevelopments: EditorialDevelopment[] = area === "All"
    ? WORTH_YOUR_TIME
    : [...WORTH_YOUR_TIME, ...FEATURED_EPISODES];
  const supported = visibleForArea(staticDevelopments, area).map((item) =>
    isEpisodeDevelopment(item) ? item : withSupport(item, payload));
  let developments = [...regulatory, ...supported];
  if (area === "All") developments = developments.slice(0, 5);
  if (area !== "All" && developments.length === 0) {
    developments = visibleForArea(SPECIALTY_FALLBACKS, area)
      .filter((item) => (payload.overlays.find((overlay) => overlay.id === item.id)?.windowClinicianCount ?? 0) > 0)
      .map((item) => withSupport(item, payload));
  }

  const relevant = visibleForArea(ALSO_RELEVANT, area)
    .map((item) => withSupport(item, payload))
    .filter((item) => !developments.some((lead) => !isEpisodeDevelopment(lead) && sameEditorialArticle(item, lead)));

  const briefs = liveListenBriefs(payload);
  const featured = developments.filter(isEpisodeDevelopment);
  const listenItems = listenForArea(NEW_TO_LISTEN, briefs, area, featured, now);
  const listen = listenItems.map((item) => ({ item, episode: matchedEpisode(item, briefs, payload) }));

  return {
    schemaVersion: 1,
    editionDate: etEditionDate(now),
    generatedAt: now.toISOString(),
    area,
    developments: developments.map((development, position) => ({
      development,
      episode: isEpisodeDevelopment(development) ? matchedEpisode(development, briefs, payload) : null,
      position,
    })),
    relevant: relevant.map((article, position) => ({ article, position })),
    listen,
    regulatoryCards: payload.regulatoryCards,
    designationCards: payload.designationCards,
  };
}

export function isReadoutEditionSnapshot(value: unknown): value is ReadoutEditionSnapshot {
  const item = value as Partial<ReadoutEditionSnapshot> | null;
  return !!item && item.schemaVersion === 1 && typeof item.editionDate === "string" &&
    typeof item.area === "string" && Array.isArray(item.developments) &&
    Array.isArray(item.relevant) && Array.isArray(item.listen);
}

function sameDevelopment(left: EditorialDevelopment, right: EditorialDevelopment): boolean {
  const leftEpisode = isEpisodeDevelopment(left);
  const rightEpisode = isEpisodeDevelopment(right);
  if (leftEpisode || rightEpisode) {
    return leftEpisode && rightEpisode &&
      (left.id === right.id || left.title.toLowerCase() === right.title.toLowerCase());
  }
  return sameEditorialArticle(left, right);
}

export function sevenDayEditionDevelopments(history: ReadoutEditionSnapshot[]) {
  const snapshots = [...history].sort((left, right) => right.editionDate.localeCompare(left.editionDate));
  const developments: Array<ReadoutEditionDevelopment & { editionDate: string }> = [];
  const relevant: Array<ReadoutEditionArticle & { editionDate: string }> = [];
  for (const snapshot of snapshots) {
    for (const entry of snapshot.developments) {
      if (developments.some((existing) => sameDevelopment(existing.development, entry.development))) continue;
      developments.push({ ...entry, editionDate: snapshot.editionDate });
    }
    for (const entry of snapshot.relevant) {
      if (developments.some((existing) => !isEpisodeDevelopment(existing.development) && sameEditorialArticle(existing.development, entry.article)) ||
        relevant.some((existing) => sameEditorialArticle(existing.article, entry.article))) continue;
      relevant.push({ ...entry, editionDate: snapshot.editionDate });
    }
  }
  developments.sort((left, right) => left.position - right.position || right.editionDate.localeCompare(left.editionDate));
  return { developments: developments.map((entry) => entry.development), relevant: relevant.map((entry) => entry.article) };
}

export function sevenDayEditionListen(
  history: ReadoutEditionSnapshot[],
  displayedDevelopments: EditorialDevelopment[] = [],
): ReadoutEditionListen[] {
  const displayedIds = new Set(displayedDevelopments.filter(isEpisodeDevelopment).map((item) => item.id));
  const seen = new Set<string>();
  return [...history]
    .sort((left, right) => right.editionDate.localeCompare(left.editionDate))
    .flatMap((snapshot) => [
      ...snapshot.developments
        .filter((entry) => isEpisodeDevelopment(entry.development) && !displayedIds.has(entry.development.id))
        .map((entry) => ({ item: entry.development as EditorialEpisodeFeature, episode: entry.episode })),
      ...snapshot.listen,
    ])
    .filter((entry) => {
      const key = entry.episode?.episodeId || entry.item.url || entry.item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
