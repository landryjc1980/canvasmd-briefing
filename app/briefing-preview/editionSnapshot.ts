import type { BriefingData, BriefingEpisode, ReadoutListenEpisode, ReadoutWindowPayload } from "@/lib/types";
import {
  archivedEditorialArticle,
  breakingEditorialArticle,
  editorialBelongsToArea,
  editorialEpisodeIdentityKeys,
  findEpisode,
  listenForArea,
  regulatoryEditorialArticle,
  sameEditorialArticle,
  sameEditorialDevelopment,
  type EditorialArticle,
  type EditorialDevelopment,
  type EditorialEpisode,
  type EditorialEpisodeFeature,
  type EditionArea,
} from "./edition";
import { activeReadoutEditionDate } from "./readoutRequest";
import type { ReadoutAttentionAnchor } from "@/lib/readoutAttention";
import {
  preferredReadoutRegulatoryItem,
  sameReadoutRegulatoryIdentity,
} from "@/lib/readoutRegulatoryIdentity";

export type ReadoutEditionDevelopment = {
  development: EditorialDevelopment;
  episode: ReadoutListenEpisode | null;
  position: number;
};
export type ReadoutEditionArticle = { article: EditorialArticle; position: number };
export type ReadoutEditionListen = { item: EditorialEpisode; episode: ReadoutListenEpisode | null };
export type ReadoutEditionSnapshot = {
  schemaVersion: 2;
  editionDate: string;
  generatedAt: string;
  selectionVersion?: string | null;
  candidateBuild?: { runId: string; requestId: number; generatedAt: string };
  attentionAnchor?: ReadoutAttentionAnchor;
  area: EditionArea;
  developments: ReadoutEditionDevelopment[];
  relevant: ReadoutEditionArticle[];
  listen: ReadoutEditionListen[];
  regulatoryCards: ReadoutWindowPayload["regulatoryCards"];
  designationCards: ReadoutWindowPayload["designationCards"];
  updatedAt?: string;
  middayInsertions?: string[];
  // retained on the TYPE only: frozen editions archived before 2026-08-29 carry it
  fallbackWindowHours?: number | null;
};

function isEpisodeDevelopment(item: EditorialDevelopment): item is EditorialEpisodeFeature {
  return "kind" in item && item.kind === "episode";
}

export function liveListenBriefs(payload: ReadoutWindowPayload): BriefingData[] {
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

function supportingSourceMatches(left: EditorialArticle, right: EditorialArticle): boolean {
  const rightUrl = right.url.toLowerCase();
  const rightTitle = right.title.toLowerCase();
  return (left.supportingEvidence ?? []).some((link) =>
    link.url.toLowerCase() === rightUrl || link.title.toLowerCase() === rightTitle);
}

function sameArticleDevelopment(left: EditorialArticle, right: EditorialArticle): boolean {
  return sameEditorialArticle(left, right) || supportingSourceMatches(left, right) || supportingSourceMatches(right, left);
}

function sameMorningStory(left: EditorialArticle, right: EditorialArticle): boolean {
  return left.id === right.id || sameEditorialArticle(left, right);
}

function uniqueDevelopments(items: EditorialDevelopment[]): EditorialDevelopment[] {
  return items.filter((item, index, all) => !all.slice(0, index).some((existing) => {
    if ("kind" in item || "kind" in existing) return sameEditorialDevelopment(item, existing);
    return sameArticleDevelopment(item, existing);
  }));
}

function renderableArticle(item: EditorialArticle): boolean {
  return /^https?:\/\//i.test(item.url) && item.title.trim().length > 0;
}

/** Preprints stay discoverable in Also Relevant, but cannot occupy a lead-paper slot. */
export function isPreprintEditorialArticle(item: EditorialArticle): boolean {
  if (item.publicationClass === "preprint") return true;
  const source = `${item.journal ?? ""} ${item.url ?? ""}`.toLowerCase();
  return /\b(?:biorxiv|medrxiv)\b/.test(source) ||
    /(?:researchsquare\.com|ssrn\.com)/.test(source) ||
    /doi\.org\/10\.(?:1101|64898)\//.test(source);
}

export function liveInsertionDevelopments(payload: ReadoutWindowPayload, area: EditionArea): EditorialArticle[] {
  return uniqueDevelopments([
    ...(payload.regulatoryCards ?? []).map(regulatoryEditorialArticle),
    ...(payload.breakingCards ?? []).map(breakingEditorialArticle),
  ]).filter((item): item is EditorialArticle =>
    !('kind' in item) && editorialBelongsToArea(item, area) && renderableArticle(item) && !isPreprintEditorialArticle(item));
}

function liveRankedDevelopments(payload: ReadoutWindowPayload, area: EditionArea): EditorialArticle[] {
  return uniqueDevelopments([
    ...liveInsertionDevelopments(payload, area),
    ...(payload.cards ?? []).map(archivedEditorialArticle),
  ]).filter((item): item is EditorialArticle =>
    !('kind' in item) && editorialBelongsToArea(item, area) && renderableArticle(item));
}

function uniqueRelevant(items: EditorialArticle[], developments: EditorialDevelopment[]): EditorialArticle[] {
  return items.filter((item, index, all) =>
    !developments.some((lead) => !("kind" in lead) && sameArticleDevelopment(item, lead)) &&
    !all.slice(0, index).some((existing) => sameArticleDevelopment(item, existing)));
}

function appearedInMorningEdition(item: EditorialArticle, history: ReadoutEditionSnapshot[]): boolean {
  const priorEditionDate = history.reduce(
    (latest, snapshot) => snapshot.editionDate > latest ? snapshot.editionDate : latest,
    "",
  );
  for (const snapshot of history) {
    const middayIds = new Set(snapshot.middayInsertions ?? []);
    const matches = [
      ...snapshot.developments.flatMap((entry) =>
        !isEpisodeDevelopment(entry.development) && sameMorningStory(item, entry.development)
          ? [{ id: entry.development.id }]
          : []),
      ...snapshot.relevant.flatMap((entry) =>
        sameMorningStory(item, entry.article) ? [{ id: entry.article.id }] : []),
    ];
    for (const match of matches) {
      if (snapshot.editionDate === priorEditionDate && middayIds.has(match.id)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

function appearedInAnyEarlierEdition(item: EditorialArticle, history: ReadoutEditionSnapshot[]): boolean {
  return history.some((snapshot) =>
    snapshot.developments.some((entry) =>
      !isEpisodeDevelopment(entry.development) && sameMorningStory(item, entry.development)) ||
    snapshot.relevant.some((entry) => sameMorningStory(item, entry.article)));
}

export function buildReadoutEditionSnapshot(
  area: EditionArea,
  payload: ReadoutWindowPayload,
  now = new Date(),
  previousEditions: ReadoutEditionSnapshot[] = [],
  editionDate = activeReadoutEditionDate(now),
): ReadoutEditionSnapshot {
  const ranked = liveRankedDevelopments(payload, area)
    .filter((item) => !appearedInMorningEdition(item, previousEditions));
  // Publication class labels the source; it does not veto an otherwise qualified article.
  // Preprints retain their existing non-lead safety rule.
  const leadRanked = ranked.filter((item) => !isPreprintEditorialArticle(item));
  const preprints = ranked.filter((item) => !leadRanked.includes(item));
  const developments: EditorialDevelopment[] = leadRanked.slice(0, 5);
  const relevant = uniqueRelevant([
    ...leadRanked.slice(5),
    ...preprints,
    ...(payload.moreCards ?? [])
      .map(archivedEditorialArticle)
      .filter(renderableArticle)
      .filter((item) => !appearedInMorningEdition(item, previousEditions)),
  ], developments);

  const briefs = liveListenBriefs(payload);
  const featured = developments.filter(isEpisodeDevelopment);
  const listenItems = listenForArea(briefs, area, featured, now);
  const listen = listenItems.map((item) => ({ item, episode: matchedEpisode(item, briefs, payload) }));

  return {
    schemaVersion: 2,
    editionDate,
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

export function resolveReadoutTodayEdition(
  area: EditionArea,
  payload: ReadoutWindowPayload,
  previousEditions: ReadoutEditionSnapshot[] = [],
): ReadoutEditionSnapshot {
  const generatedAt = new Date(payload.generatedAt);
  const now = Number.isFinite(generatedAt.getTime()) ? generatedAt : new Date();
  const editionDate = activeReadoutEditionDate(now);
  const saved = isReadoutEditionSnapshot(payload.currentEdition) &&
      payload.currentEdition.area === area && payload.currentEdition.editionDate === editionDate
    ? payload.currentEdition
    : null;
  return saved ?? buildReadoutEditionSnapshot(area, payload, now, previousEditions);
}

export function mergeReadoutEditionSnapshot(
  snapshot: ReadoutEditionSnapshot,
  payload: ReadoutWindowPayload,
  now = new Date(),
  previousEditions: ReadoutEditionSnapshot[] = [],
): ReadoutEditionSnapshot {
  const existingDevelopments = snapshot.developments.map((entry) => entry.development);
  const existingRelevant = snapshot.relevant.map((entry) => entry.article);
  const additions = liveInsertionDevelopments(payload, snapshot.area).filter((candidate) =>
    !appearedInAnyEarlierEdition(candidate, previousEditions) &&
    !existingDevelopments.some((existing) => !("kind" in existing) && sameArticleDevelopment(candidate, existing)) &&
    !existingRelevant.some((existing) => sameArticleDevelopment(candidate, existing)));
  const newDesignations = (payload.designationCards ?? []).filter((candidate) =>
    !snapshot.designationCards.some((existing) => existing.id === candidate.id));
  const briefs = liveListenBriefs(payload);
  const featured = existingDevelopments.filter(isEpisodeDevelopment);
  const currentListen = listenForArea(briefs, snapshot.area, featured, now)
    .map((item) => ({ item, episode: matchedEpisode(item, briefs, payload) }));
  const existingListenKeys = new Set(
    snapshot.listen.flatMap((entry) => editorialEpisodeIdentityKeys(entry.item, entry.episode)),
  );
  const newListen = currentListen.filter((entry) => {
    const keys = editorialEpisodeIdentityKeys(entry.item, entry.episode);
    if (keys.some((key) => existingListenKeys.has(key))) return false;
    keys.forEach((key) => existingListenKeys.add(key));
    return true;
  });
  if (!additions.length && !newDesignations.length && !newListen.length) return snapshot;

  // The morning slate is the narrated edition. Hourly admissions live in the
  // remainder with explicit insertion IDs; they cannot displace or renumber it.
  const relevant = uniqueRelevant([...existingRelevant, ...additions], existingDevelopments);
  const insertedIds = additions.map((item) => item.id);
  return {
    ...snapshot,
    updatedAt: now.toISOString(),
    middayInsertions: [...new Set([...(snapshot.middayInsertions ?? []), ...insertedIds])],
    developments: snapshot.developments,
    relevant: relevant.map((article, position) => ({ article, position })),
    regulatoryCards: [
      ...snapshot.regulatoryCards,
      ...(payload.regulatoryCards ?? []).filter((candidate) => !snapshot.regulatoryCards.some((existing) => existing.id === candidate.id)),
    ],
    designationCards: [...snapshot.designationCards, ...newDesignations],
    listen: [...newListen, ...snapshot.listen].slice(0, snapshot.area === "All" ? 3 : 2),
  };
}

export function isReadoutEditionSnapshot(value: unknown): value is ReadoutEditionSnapshot {
  const item = value as Partial<ReadoutEditionSnapshot> | null;
  return !!item && item.schemaVersion === 2 && typeof item.editionDate === "string" &&
    typeof item.area === "string" && Array.isArray(item.developments) &&
    Array.isArray(item.relevant) && Array.isArray(item.listen);
}

export function sevenDayEditionDevelopments(history: ReadoutEditionSnapshot[]) {
  const snapshots = [...history].sort((left, right) => right.editionDate.localeCompare(left.editionDate));
  const developments: Array<ReadoutEditionDevelopment & { editionDate: string }> = [];
  const relevant: Array<ReadoutEditionArticle & { editionDate: string }> = [];
  for (const snapshot of snapshots) {
    for (const entry of snapshot.developments) {
      const existingIndex = developments.findIndex((existing) =>
        sameEditorialDevelopment(existing.development, entry.development) ||
        (!isEpisodeDevelopment(existing.development) && !isEpisodeDevelopment(entry.development) &&
          sameReadoutRegulatoryIdentity(existing.development, entry.development)));
      if (existingIndex >= 0) {
        const existing = developments[existingIndex];
        if (!isEpisodeDevelopment(existing.development) && !isEpisodeDevelopment(entry.development) &&
          preferredReadoutRegulatoryItem(existing.development, entry.development) === entry.development) {
          // Keep the first saved position/date: replacing identity is not a
          // re-rank of the canonical morning edition.
          developments[existingIndex] = { ...existing, development: entry.development };
        }
        continue;
      }
      developments.push({ ...entry, editionDate: snapshot.editionDate });
    }
    for (const entry of snapshot.relevant) {
      const existingDevelopment = developments.find((existing) => !isEpisodeDevelopment(existing.development) &&
        (sameEditorialArticle(existing.development, entry.article) || sameReadoutRegulatoryIdentity(existing.development, entry.article)));
      const existingRelevantIndex = relevant.findIndex((existing) =>
        sameEditorialArticle(existing.article, entry.article) || sameReadoutRegulatoryIdentity(existing.article, entry.article));
      if (existingDevelopment) continue;
      if (existingRelevantIndex >= 0) {
        const existing = relevant[existingRelevantIndex];
        if (preferredReadoutRegulatoryItem(existing.article, entry.article) === entry.article) {
          relevant[existingRelevantIndex] = { ...existing, article: entry.article };
        }
        continue;
      }
      relevant.push({ ...entry, editionDate: snapshot.editionDate });
    }
  }
  developments.sort((left, right) => left.position - right.position || right.editionDate.localeCompare(left.editionDate));
  const uniqueRelevant = relevant.filter((entry) => !developments.some((development) =>
    !isEpisodeDevelopment(development.development) && sameEditorialArticle(development.development, entry.article)));

  if (snapshots[0]?.area !== "All" && developments.length === 0 && uniqueRelevant.length > 0) {
    const [lead] = uniqueRelevant.splice(0, 1);
    developments.push({
      development: lead.article,
      episode: null,
      position: 0,
      editionDate: lead.editionDate,
    });
  }
  return { developments: developments.map((entry) => entry.development), relevant: uniqueRelevant.map((entry) => entry.article) };
}

export function sevenDayEditionListen(
  history: ReadoutEditionSnapshot[],
  displayedDevelopments: EditorialDevelopment[] = [],
): ReadoutEditionListen[] {
  const displayedKeys = new Set(
    displayedDevelopments
      .filter(isEpisodeDevelopment)
      .flatMap((item) => editorialEpisodeIdentityKeys(item)),
  );
  const seen = new Set<string>();
  return [...history]
    .sort((left, right) => right.editionDate.localeCompare(left.editionDate))
    .flatMap((snapshot) => [
      ...snapshot.developments
        .filter((entry) => isEpisodeDevelopment(entry.development))
        .map((entry) => ({ item: entry.development as EditorialEpisodeFeature, episode: entry.episode })),
      ...snapshot.listen,
    ])
    .filter((entry) => {
      const keys = editorialEpisodeIdentityKeys(entry.item, entry.episode);
      if (keys.some((key) => displayedKeys.has(key) || seen.has(key))) return false;
      keys.forEach((key) => seen.add(key));
      return true;
    });
}
