import "server-only";

import { unstable_cache } from "next/cache";
import type { ReadoutWindowPayload } from "@/lib/types";
import {
  readoutWindowDays,
  activeReadoutEditionDate,
  type ReadoutWindow,
} from "@/app/briefing-preview/readoutRequest";
import { EDITION_AREAS, editorialBelongsToArea, editorialStoryAreas, type EditionArea } from "@/app/briefing-preview/edition";
import {
  isReadoutEditionSnapshot,
  type ReadoutEditionSnapshot,
} from "@/app/briefing-preview/editionSnapshot";
import {
  readoutEditionForArea,
  readoutEditionHistoryIncludingCurrent,
} from "@/app/briefing-preview/editionHistory";
import { readoutAttentionAnchor, validReadoutAttentionAnchor, type ReadoutAttentionAnchor } from "@/lib/readoutAttention";
import { sameReadoutRegulatoryIdentity } from "@/lib/readoutRegulatoryIdentity";

// Bump this whenever reader-side cache acceptance changes. It prevents an old
// finished selection from being served before the new durable-edition check runs.
export const READOUT_WINDOW_CACHE_TAG = "readout-window-v24";
export const READOUT_WINDOW_REVALIDATE_SECONDS = 60 * 60;

export function supabaseApiKeyHeaders(key: string): Record<string, string> {
  return key.startsWith("sb_")
    ? { apikey: key }
    : { apikey: key, authorization: `Bearer ${key}` };
}

function supabaseServiceEnvironment() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.");
  return { url, key };
}

function windowCacheToken(area: EditionArea, window: ReadoutWindow) {
  return `readout-window:v6:${area}:${window}`;
}

function finishedWindowCacheToken(area: EditionArea, window: ReadoutWindow) {
  return `readout-window:finished:v7:${area}:${window}`;
}

function compactWindowPayload(payload: ReadoutWindowPayload): ReadoutWindowPayload {
  // Selection-audit receipts are service-only and must never enter reader cache rows.
  const { selectionAudit: _selectionAudit, ...publicPayload } = payload as ReadoutWindowPayload & { selectionAudit?: unknown };
  return publicPayload;
}

function currentFinishedWindow(payload: ReadoutWindowPayload | null | undefined): boolean {
  const edition = payload?.currentEdition as { schemaVersion?: number; editionDate?: string } | null | undefined;
  return edition?.schemaVersion === 2 && edition.editionDate === activeReadoutEditionDate();
}

function editionSelectionMembership(snapshot: ReadoutEditionSnapshot): string[] {
  const membership = (item: { area?: string; areas?: unknown; subAreas?: string[] }) =>
    JSON.stringify([editorialStoryAreas(item), item.subAreas ?? []]);
  return [
    ...snapshot.developments.map((entry) => `development:${entry.development.id}:${membership(entry.development)}`),
    ...snapshot.relevant.map((entry) => `relevant:${entry.article.id}:${membership(entry.article)}`),
    ...snapshot.listen.map((entry) => `listen:${entry.episode?.episodeId ?? entry.item.episodeId ?? entry.item.id}:${membership(entry.item)}`),
    ...snapshot.regulatoryCards.map((card) => `regulatory:${card.id}:${membership(card)}`),
    ...snapshot.designationCards.map((card) => `designation:${card.id}:${membership(card)}`),
  ];
}

function sameSelectionMembership(left: ReadoutEditionSnapshot, right: ReadoutEditionSnapshot): boolean {
  const leftMembership = editionSelectionMembership(left);
  const rightMembership = editionSelectionMembership(right);
  return leftMembership.length === rightMembership.length &&
    leftMembership.every((item, index) => item === rightMembership[index]);
}

function sameEditionVersion(value: unknown, durable: ReadoutEditionSnapshot): boolean {
  return isReadoutEditionSnapshot(value) &&
    value.editionDate === durable.editionDate &&
    value.generatedAt === durable.generatedAt &&
    (value.updatedAt ?? null) === (durable.updatedAt ?? null) &&
    JSON.stringify(value.attentionAnchor ?? null) === JSON.stringify(durable.attentionAnchor ?? null) &&
    (!durable.selectionVersion || value.selectionVersion === durable.selectionVersion) &&
    sameSelectionMembership(value, durable);
}

export async function withReadoutSelectionVersion(snapshot: ReadoutEditionSnapshot): Promise<ReadoutEditionSnapshot> {
  if (snapshot.selectionVersion) return snapshot;
  // Keep this byte-for-byte aligned with Native's readoutSelectionVersion: public
  // content and selection are versioned, never live engagement overlays.
  const item = (value: Record<string, unknown> | null | undefined) => value ? {
    id: value.id, title: value.title, url: value.url, kind: value.kind,
    journal: value.journal, publicationClass: value.publicationClass,
    finding: value.finding, sourceExcerpt: value.sourceExcerpt,
    episodeId: value.episodeId, show: value.show, description: value.description,
  } : null;
  const source = JSON.stringify({
    editionDate: snapshot.editionDate, area: snapshot.area,
    developments: snapshot.developments.map((entry) => item(entry.development)),
    relevant: snapshot.relevant.map((entry) => item(entry.article)),
    listen: snapshot.listen.map((entry) => ({ item: item(entry.item), episode: item(entry.episode) })),
  });
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const selectionVersion = `readout-v1-${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return { ...snapshot, selectionVersion };
}

/** Service-only source read for the pre-6am canonical edition. It never writes a
 * finished reader-window token, so yesterday remains the public edition until rollover. */
export async function fetchFreshReadoutWindowForPrepublication(
  area: EditionArea,
  editionDate: string,
  attentionAnchor: ReadoutAttentionAnchor,
  options: { includeSelectionAudit?: boolean; signal?: AbortSignal } = {},
): Promise<ReadoutWindowPayload> {
  return fetchFreshReadoutWindow(area, "today", "[]", JSON.stringify({ editionDate, attentionAnchor, includeSelectionAudit: area === "All" && options.includeSelectionAudit === true }), options.signal);
}

/** The dated canonical edition is the authority for every paper-facing Today lens. */
async function readDurableCanonicalEdition(): Promise<ReadoutEditionSnapshot | null> {
  const { url, key } = supabaseServiceEnvironment();
  const editionDate = activeReadoutEditionDate();
  const tok = encodeURIComponent(`edition:v2:${editionDate}:All`);
  const response = await fetch(`${url}/rest/v1/readout_posts?select=card&tok=eq.${tok}&limit=1`, {
    headers: supabaseApiKeyHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ card?: unknown }>;
  const snapshot = rows[0]?.card;
  return isReadoutEditionSnapshot(snapshot) && snapshot.area === "All" && snapshot.editionDate === editionDate
    ? snapshot
    : null;
}

/** The published seven-day window is the persisted canonical All history, never
 * a current live response's per-area snapshots. */
async function readDurableCanonicalHistory(current: ReadoutEditionSnapshot): Promise<ReadoutEditionSnapshot[]> {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(
    `${url}/rest/v1/readout_posts?select=card&kind=eq.edition&area=eq.All&order=last_seen.desc`,
    { headers: supabaseApiKeyHeaders(key), cache: "no-store" },
  );
  if (!response.ok) return [];
  const rows = await response.json() as Array<{ card?: unknown }>;
  return readoutEditionHistoryIncludingCurrent(
    current,
    rows.map((row) => row.card).filter(isReadoutEditionSnapshot),
  );
}

function validFinishedEdition(
  area: EditionArea,
  edition: unknown,
  durableCanonical: ReadoutEditionSnapshot | null,
): boolean {
  // Old rows are deliberately rebuilt so published reads always prove their
  // canonical All-edition projection.
  if (!isReadoutEditionSnapshot(edition) || !edition.selectionVersion) return false;
  if (!durableCanonical) return false;
  const durableForArea = readoutEditionForArea(durableCanonical, area);
  if (!durableForArea) return false;
  return sameEditionVersion(edition, durableForArea);
}

async function persistLastGoodWindow(area: EditionArea, window: ReadoutWindow, payload: ReadoutWindowPayload, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Readout cache persistence aborted.");
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(`${url}/rest/v1/readout_posts?on_conflict=tok`, {
    method: "POST",
    headers: {
      ...supabaseApiKeyHeaders(key),
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{
      tok: windowCacheToken(area, window),
      area,
      kind: "window-cache",
      headline: `Readout window cache ${area} ${window}`,
      card: { ...payload, stale: false },
      evidence: {},
      last_seen: payload.generatedAt,
    }]),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Readout last-good write returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function readLastGoodWindow(area: EditionArea, window: ReadoutWindow): Promise<ReadoutWindowPayload | null> {
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(windowCacheToken(area, window));
  const response = await fetch(`${url}/rest/v1/readout_posts?select=card&tok=eq.${tok}&limit=1`, {
    headers: supabaseApiKeyHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ card?: ReadoutWindowPayload }>;
  const payload = rows[0]?.card;
  return payload?.area === area && payload.windowDays === readoutWindowDays(window) ? payload : null;
}

async function persistFinishedWindow(area: EditionArea, window: ReadoutWindow, payload: ReadoutWindowPayload, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Finished Readout persistence aborted.");
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(`${url}/rest/v1/readout_posts?on_conflict=tok`, {
    method: "POST",
    headers: {
      ...supabaseApiKeyHeaders(key),
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{
      tok: finishedWindowCacheToken(area, window),
      area,
      kind: "window-cache",
      headline: `Finished Readout window ${area} ${window}`,
      card: payload,
      evidence: {},
      last_seen: payload.generatedAt,
    }]),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Finished Readout cache write returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function readFinishedWindow(area: EditionArea, window: ReadoutWindow): Promise<ReadoutWindowPayload | null> {
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(finishedWindowCacheToken(area, window));
  const response = await fetch(`${url}/rest/v1/readout_posts?select=card&tok=eq.${tok}&limit=1`, {
    headers: supabaseApiKeyHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ card?: ReadoutWindowPayload }>;
  const payload = rows[0]?.card;
  if (payload?.area !== area || payload.windowDays !== readoutWindowDays(window) || !currentFinishedWindow(payload)) return null;
  const durableCanonical = await readDurableCanonicalEdition();
  return validFinishedEdition(area, payload.currentEdition, durableCanonical) ? payload : null;
}

async function fetchFreshReadoutWindow(
  area: EditionArea,
  window: ReadoutWindow,
  cardsJson: string,
  attentionContextJson: string,
  signal?: AbortSignal,
): Promise<ReadoutWindowPayload> {
    const { url, key } = supabaseServiceEnvironment();
    const briefingFunctionUrl = process.env.BRIEFING_FUNCTION_URL ?? `${url}/functions/v1/briefing`;
    try {
      const response = await fetch(briefingFunctionUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...supabaseApiKeyHeaders(key),
        },
        body: JSON.stringify({
          mode: "readout-window",
          area,
          days: readoutWindowDays(window),
          cards: JSON.parse(cardsJson),
          ...JSON.parse(attentionContextJson),
        }),
        cache: "no-store",
        signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Briefing readout-window returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
      }
      const payload = await response.json() as ReadoutWindowPayload;
      try {
        await persistLastGoodWindow(area, window, payload, signal);
      } catch (error) {
        console.error("Readout last-good cache write failed; serving fresh payload.", error);
      }
      return payload;
    } catch (error) {
      const fallback = await readLastGoodWindow(area, window);
      if (fallback) return { ...fallback, stale: true };
      throw error;
    }
}

const fetchReadoutWindow = unstable_cache(
  fetchFreshReadoutWindow,
  [READOUT_WINDOW_CACHE_TAG],
  { revalidate: READOUT_WINDOW_REVALIDATE_SECONDS, tags: [READOUT_WINDOW_CACHE_TAG] },
);

/** Raw candidate access is intentionally separate from published reader windows.
 * `mergeCurrentReadoutEditionInsertions` must call this for admission; it must
 * never call getCachedReadoutWindow, whose membership is already frozen. */
export async function fetchFreshReadoutWindowForInsertions(area: EditionArea): Promise<ReadoutWindowPayload> {
  const editionDate = activeReadoutEditionDate();
  const durableCanonical = await readDurableCanonicalEdition();
  const attentionAnchor = durableCanonical
    ? validReadoutAttentionAnchor(durableCanonical.attentionAnchor, editionDate)
    : readoutAttentionAnchor(editionDate);
  return fetchFreshReadoutWindow(area, "today", "[]", JSON.stringify({ editionDate, attentionAnchor }));
}

function mergeEvidenceOverlays(...payloads: ReadoutWindowPayload[]) {
  return [...new Map(payloads.flatMap((payload) =>
    (payload.overlays ?? []).map((overlay) => [overlay.id, overlay] as const))).values()];
}

// A fresh source response is allowed to repair source-facing copy, but it is
// never an alternate edition. In particular, it cannot change area routing,
// order, selection revision, or the set of published cards.
const PAPER_DISPLAY_FIELDS = [
  "title", "url", "sourceExcerpt", "finding", "publicationClass", "studySetting", "sourceAction",
] as const;
const REGULATORY_DISPLAY_FIELDS = [
  "headline", "url", "finding", "sourceExcerpt", "sourceAction", "sourceLabel", "eligibleLabel",
] as const;
const DESIGNATION_DISPLAY_FIELDS = ["headline", "url", "description", "sourceAction", "sourceLabel", "label"] as const;

function sourceDisplayRepair<T extends { id: string; evidence?: string; url?: string | null }>(
  frozen: T,
  source: unknown,
  fields: readonly string[],
): T {
  if (!source || typeof source !== "object" || ((source as { id?: unknown }).id !== frozen.id &&
    !sameReadoutRegulatoryIdentity(frozen, source as { evidence?: string; url?: string }))) return frozen;
  const repaired: Record<string, unknown> = {};
  for (const field of fields) {
    const value = (source as Record<string, unknown>)[field];
    if (value !== undefined) repaired[field] = value;
  }
  return Object.keys(repaired).length ? { ...frozen, ...repaired } : frozen;
}

function sourceSnapshotForEdition(
  snapshot: ReadoutEditionSnapshot,
  sourceSnapshots: ReadoutEditionSnapshot[],
): ReadoutEditionSnapshot | null {
  return sourceSnapshots.find((candidate) =>
    candidate.area === "All" && candidate.editionDate === snapshot.editionDate) ?? null;
}

function hydrateCanonicalDisplayFields(
  snapshot: ReadoutEditionSnapshot,
  sourceSnapshots: ReadoutEditionSnapshot[],
): ReadoutEditionSnapshot {
  const source = sourceSnapshotForEdition(snapshot, sourceSnapshots);
  if (!source) return snapshot;
  const sourceDevelopments = new Map(source.developments.map((entry) => [entry.development.id, entry.development]));
  const sourceRelevant = new Map(source.relevant.map((entry) => [entry.article.id, entry.article]));
  const sourceRegulatory = new Map(source.regulatoryCards.map((card) => [card.id, card]));
  const sourceDesignations = new Map(source.designationCards.map((card) => [card.id, card]));
  const sourceStories = [...sourceDevelopments.values(), ...sourceRelevant.values()];
  const repairedSourceFor = (item: { id: string; evidence?: string; url?: string }) =>
    sourceDevelopments.get(item.id) ?? sourceRelevant.get(item.id) ??
    sourceStories.find((candidate) => sameReadoutRegulatoryIdentity(item, candidate));
  return {
    ...snapshot,
    developments: snapshot.developments.map((entry) => ({
      ...entry,
      development: sourceDisplayRepair(entry.development, repairedSourceFor(entry.development), PAPER_DISPLAY_FIELDS),
    })),
    relevant: snapshot.relevant.map((entry) => ({
      ...entry,
      article: sourceDisplayRepair(entry.article, repairedSourceFor(entry.article), PAPER_DISPLAY_FIELDS),
    })),
    regulatoryCards: snapshot.regulatoryCards.map((card) =>
      sourceDisplayRepair(card, sourceRegulatory.get(card.id), REGULATORY_DISPLAY_FIELDS)),
    designationCards: snapshot.designationCards.map((card) =>
      sourceDisplayRepair(card, sourceDesignations.get(card.id), DESIGNATION_DISPLAY_FIELDS)),
  };
}

function canonicalSourceSnapshots(...payloads: ReadoutWindowPayload[]): ReadoutEditionSnapshot[] {
  return payloads.flatMap((payload) => [payload.currentEdition, ...(payload.editionHistory ?? [])])
    .filter(isReadoutEditionSnapshot)
    .filter((snapshot) => snapshot.area === "All");
}

function unavailableRawPayload(area: EditionArea, window: ReadoutWindow): ReadoutWindowPayload {
  return {
    generatedAt: new Date().toISOString(),
    windowDays: readoutWindowDays(window),
    area,
    cards: [],
    moreCards: [],
    episodes: [],
    regulatoryCards: [],
    breakingCards: [],
    designationCards: [],
    overlays: [],
    candidateGeneratedAt: null,
    stale: true,
  };
}

async function buildFinishedReadoutWindow(
  area: EditionArea,
  window: ReadoutWindow,
  options: { freshSource?: boolean; canonicalOnly?: boolean; signal?: AbortSignal; sourceCache?: Map<string, Promise<ReadoutWindowPayload>> } = {},
): Promise<ReadoutWindowPayload> {
  const source = options.freshSource ? fetchFreshReadoutWindow : fetchReadoutWindow;
  const durableCanonical = await readDurableCanonicalEdition();
  if (!durableCanonical) throw new Error("The canonical All Readout edition is not available yet.");
  const editionDate = activeReadoutEditionDate();
  // The persisted morning anchor governs every hourly read. An old saved edition
  // must not acquire a new window merely because a new reader was deployed.
  const attentionAnchor = durableCanonical
    ? validReadoutAttentionAnchor(durableCanonical.attentionAnchor, editionDate)
    : readoutAttentionAnchor(editionDate);
  const attentionContextJson = JSON.stringify({ editionDate, attentionAnchor });
  const raw = async (rawArea: EditionArea, rawWindow: ReadoutWindow) => {
    const key = JSON.stringify([rawArea, rawWindow, attentionContextJson]);
    try {
      let pending = options.sourceCache?.get(key);
      if (!pending) {
        pending = options.signal
          ? fetchFreshReadoutWindow(rawArea, rawWindow, "[]", attentionContextJson, options.signal)
          : source(rawArea, rawWindow, "[]", attentionContextJson);
        options.sourceCache?.set(key, pending);
      }
      return await pending;
    } catch (error) {
      console.error("Readout raw evidence unavailable; serving canonical publication.", error);
      return unavailableRawPayload(rawArea, rawWindow);
    }
  };
  // The critical 06:00 All/today projection is reconstructed from the durable
  // canonical selection even when the live evidence service is unavailable.
  // Full cache warming remains the independent path that refreshes receipts.
  const canonicalOnlyAllToday = options.canonicalOnly === true && area === "All" && window === "today";
  const payload = canonicalOnlyAllToday ? unavailableRawPayload(area, window) : { ...await raw("All", window), area };
  // Raw responses may refresh evidence receipts only. They never supply a
  // published edition, history, or Regulatory Watch membership.
  // The All raw window already includes every canonical story's evidence.
  // Specialty source rebuilds cannot add evidence for a different publication.
  const rawToday = window === "today" ? payload : await raw("All", "today");
  const rawAllToday = rawToday;
  const rawAllWeek = window === "7d" ? payload : null;
  const canonicalCurrent = await withReadoutSelectionVersion(durableCanonical);
  const sourceSnapshots = canonicalSourceSnapshots(rawAllToday, rawAllWeek ?? rawAllToday);
  const hydratedCanonicalCurrent = hydrateCanonicalDisplayFields(canonicalCurrent, sourceSnapshots);
  const currentEdition = readoutEditionForArea(hydratedCanonicalCurrent, area) ?? hydratedCanonicalCurrent;
  const canonicalHistory = window === "7d" ? await readDurableCanonicalHistory(canonicalCurrent) : [canonicalCurrent];
  const hydratedCanonicalHistory = canonicalHistory
    .map((snapshot) => hydrateCanonicalDisplayFields(snapshot, sourceSnapshots));
  const editionHistory = hydratedCanonicalHistory
    .map((snapshot) => readoutEditionForArea(snapshot, area))
    .filter((snapshot): snapshot is ReadoutEditionSnapshot => !!snapshot);
  const publicationSnapshots = window === "7d" ? hydratedCanonicalHistory : [hydratedCanonicalCurrent];
  const uniqueById = <T extends { id: string }>(items: T[]) =>
    items.filter((item, index) => items.findIndex((candidate) => candidate.id === item.id) === index);
  const publishedCardsForArea = <T extends { areas: string[] }>(items: T[]) =>
    items.filter((item) => editorialBelongsToArea({ area: "All", areas: item.areas }, area));
  const regulatoryCards = uniqueById(publicationSnapshots.flatMap((snapshot) =>
    publishedCardsForArea(snapshot.regulatoryCards)));
  const designationCards = uniqueById(publicationSnapshots.flatMap((snapshot) =>
    publishedCardsForArea(snapshot.designationCards)));
  if (window === "today") return compactWindowPayload({
    ...payload,
    currentEdition,
    editionHistory: [],
    regulatoryCards,
    designationCards,
    overlays: mergeEvidenceOverlays(payload, rawAllToday),
    stale: payload.stale === true || rawAllToday.stale === true,
  });
  return compactWindowPayload({
    ...payload,
    currentEdition,
    editionHistory,
    historyDays: new Set(editionHistory.map((snapshot) => snapshot.editionDate)).size,
    regulatoryCards,
    designationCards,
    overlays: mergeEvidenceOverlays(rawToday, payload, rawAllWeek ?? payload),
    stale: payload.stale === true || rawToday.stale === true || rawAllWeek?.stale === true,
  });
}

export async function getCachedReadoutWindow(
  area: EditionArea,
  window: ReadoutWindow,
): Promise<ReadoutWindowPayload> {
  // Do not framework-cache this read: durable-edition validation must run on every
  // request so an accepted pre-archive synthetic selection cannot outlive the archive.
  const finished = await readFinishedWindow(area, window);
  if (finished && currentFinishedWindow(finished)) return finished;

  const rebuilt = await buildFinishedReadoutWindow(area, window);
  await persistFinishedWindow(area, window, rebuilt);
  return rebuilt;
}

export async function warmReadoutWindow(
  area: EditionArea,
  window: ReadoutWindow,
  options: { freshSource?: boolean; canonicalOnly?: boolean; signal?: AbortSignal } = {},
) {
  if (options.signal?.aborted) throw new Error("Readout window warm aborted before source read.");
  const payload = await buildFinishedReadoutWindow(area, window, options);
  if (options.signal?.aborted) throw new Error("Readout window warm aborted before persistence.");
  await persistFinishedWindow(area, window, payload, options.signal);
  const edition = payload.currentEdition as { editionDate?: unknown; selectionVersion?: unknown } | null | undefined;
  return {
    area, window, generatedAt: payload.generatedAt, stale: payload.stale === true,
    editionDate: typeof edition?.editionDate === "string" ? edition.editionDate : null,
    selectionVersion: typeof edition?.selectionVersion === "string" ? edition.selectionVersion : null,
  };
}

export async function warmReadoutWindowCache(options: { freshSource?: boolean; signal?: AbortSignal } = {}) {
  // Share one observation per window across all eight specialty projections.
  const sourceCache = new Map<string, Promise<ReadoutWindowPayload>>();
  const requests = EDITION_AREAS.flatMap((area) => (["today", "7d"] as const).map((window) => ({ area, window })));
  const warmed: Array<{ area: EditionArea; window: ReadoutWindow; generatedAt: string | null; stale: boolean; error?: string }> = [];

  for (let index = 0; index < requests.length; index += 4) {
    const batch = requests.slice(index, index + 4);
    const results = await Promise.all(batch.map(async ({ area, window }) => {
      try {
        if (options.signal?.aborted) throw new Error("Readout cache warm aborted before source read.");
        const payload = await buildFinishedReadoutWindow(area, window, { ...options, sourceCache });
        if (options.signal?.aborted) throw new Error("Readout cache warm aborted before persistence.");
        await persistFinishedWindow(area, window, payload, options.signal);
        const edition = payload.currentEdition as { editionDate?: unknown; selectionVersion?: unknown } | null | undefined;
  return {
    area, window, generatedAt: payload.generatedAt, stale: payload.stale === true,
    editionDate: typeof edition?.editionDate === "string" ? edition.editionDate : null,
    selectionVersion: typeof edition?.selectionVersion === "string" ? edition.selectionVersion : null,
  };
      } catch (error) {
        return { area, window, generatedAt: null, stale: true, error: error instanceof Error ? error.message : "Unknown refresh error" };
      }
    }));
    warmed.push(...results);
  }
  return warmed;
}
