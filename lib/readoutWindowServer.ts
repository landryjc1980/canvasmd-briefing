import "server-only";

import { unstable_cache } from "next/cache";
import type { ReadoutWindowPayload } from "@/lib/types";
import {
  readoutWindowDays,
  activeReadoutEditionDate,
  type ReadoutWindow,
} from "@/app/briefing-preview/readoutRequest";
import { EDITION_AREAS, type EditionArea } from "@/app/briefing-preview/edition";
import {
  isReadoutEditionSnapshot,
  resolveReadoutTodayEdition,
  type ReadoutEditionSnapshot,
} from "@/app/briefing-preview/editionSnapshot";
import {
  readoutEditionForArea,
  readoutEditionHistoryIncludingCurrent,
  readoutEditionPreferNonEmpty,
} from "@/app/briefing-preview/editionHistory";
import { readoutAttentionAnchor, validReadoutAttentionAnchor, type ReadoutAttentionAnchor } from "@/lib/readoutAttention";

// Bump this whenever reader-side cache acceptance changes. It prevents an old
// finished selection from being served before the new durable-edition check runs.
export const READOUT_WINDOW_CACHE_TAG = "readout-window-v23";
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
  return `readout-window:v5:${area}:${window}`;
}

function finishedWindowCacheToken(area: EditionArea, window: ReadoutWindow) {
  return `readout-window:finished:v6:${area}:${window}`;
}

function compactWindowPayload(payload: ReadoutWindowPayload): ReadoutWindowPayload {
  // These bounded comments are part of the publication. Keeping them allows
  // guests to expand evidence without accessing the private live share graph.
  return payload;
}

function currentFinishedWindow(payload: ReadoutWindowPayload | null | undefined): boolean {
  const edition = payload?.currentEdition as { schemaVersion?: number; editionDate?: string } | null | undefined;
  return edition?.schemaVersion === 2 && edition.editionDate === activeReadoutEditionDate();
}

function snapshotHasEditorialCards(snapshot: ReadoutEditionSnapshot | null): boolean {
  return !!snapshot && (snapshot.developments.length > 0 || snapshot.relevant.length > 0);
}

function editionSelectionMembership(snapshot: ReadoutEditionSnapshot): string[] {
  return [
    ...snapshot.developments.map((entry) => `development:${entry.development.id}`),
    ...snapshot.relevant.map((entry) => `relevant:${entry.article.id}`),
    ...snapshot.listen.map((entry) => `listen:${entry.episode?.episodeId ?? entry.item.episodeId ?? entry.item.id}`),
    ...snapshot.regulatoryCards.map((card) => `regulatory:${card.id}`),
    ...snapshot.designationCards.map((card) => `designation:${card.id}`),
  ].sort();
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
): Promise<ReadoutWindowPayload> {
  return fetchFreshReadoutWindow(area, "today", "[]", JSON.stringify({ editionDate, attentionAnchor }));
}

function isEpisodeOnlyFallback(edition: ReadoutEditionSnapshot, durableForArea: ReadoutEditionSnapshot): boolean {
  return edition.fallbackWindowHours === 72 &&
    !snapshotHasEditorialCards(durableForArea) &&
    edition.relevant.length === 0 &&
    edition.developments.length > 0 &&
    edition.developments.every((entry) => "kind" in entry.development && entry.development.kind === "episode");
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

function validFinishedEdition(
  area: EditionArea,
  edition: unknown,
  durableCanonical: ReadoutEditionSnapshot | null,
): boolean {
  // v5 rows written before selection revisions existed are deliberately rebuilt
  // once, so subsequent finished-cache reads always prove their public selection.
  if (!isReadoutEditionSnapshot(edition) || !edition.selectionVersion) return false;
  if (!durableCanonical) return true;
  const durableForArea = readoutEditionForArea(durableCanonical, area);
  if (!durableForArea) return false;
  if (sameEditionVersion(edition, durableForArea)) return true;
  // A specialty with no canonical cards may truthfully surface its transcript-supported
  // 72-hour podcast lead; it is not a paper selection and must remain available.
  return area !== "All" && isEpisodeOnlyFallback(edition, durableForArea);
}

async function persistLastGoodWindow(area: EditionArea, window: ReadoutWindow, payload: ReadoutWindowPayload) {
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

async function persistFinishedWindow(area: EditionArea, window: ReadoutWindow, payload: ReadoutWindowPayload) {
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
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Briefing readout-window returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
      }
      const payload = await response.json() as ReadoutWindowPayload;
      try {
        await persistLastGoodWindow(area, window, payload);
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

function mergeEvidenceOverlays(...payloads: ReadoutWindowPayload[]) {
  return [...new Map(payloads.flatMap((payload) =>
    (payload.overlays ?? []).map((overlay) => [overlay.id, overlay] as const))).values()];
}

async function buildFinishedReadoutWindow(
  area: EditionArea,
  window: ReadoutWindow,
  options: { freshSource?: boolean } = {},
): Promise<ReadoutWindowPayload> {
  const source = options.freshSource ? fetchFreshReadoutWindow : fetchReadoutWindow;
  const durableCanonical = await readDurableCanonicalEdition();
  const editionDate = activeReadoutEditionDate();
  // The persisted morning anchor governs every hourly read. An old saved edition
  // must not acquire a new window merely because a new reader was deployed.
  const attentionAnchor = durableCanonical
    ? validReadoutAttentionAnchor(durableCanonical.attentionAnchor, editionDate)
    : readoutAttentionAnchor(editionDate);
  const attentionContextJson = JSON.stringify({ editionDate, attentionAnchor });
  const payload = await source(area, window, "[]", attentionContextJson);
  const today = window === "today" ? payload : await source(area, "today", "[]", attentionContextJson);
  const allToday = area === "All" ? today : await source("All", "today", "[]", attentionContextJson);
  const sourceCurrentIsToday = isReadoutEditionSnapshot(allToday.currentEdition) &&
    allToday.currentEdition.editionDate === activeReadoutEditionDate();
  // During the rollover gap, carry the exact prior editions into the fallback build.
  // Otherwise a Sep. 8 source response can be relabeled Sep. 9 with no dedup history.
  const allHistory = window === "7d"
    ? (area === "All" ? payload : await source("All", "7d", "[]", attentionContextJson))
    : (!durableCanonical && !sourceCurrentIsToday ? await source("All", "7d", "[]", attentionContextJson) : null);
  const fallbackCanonicalHistory = (allHistory?.editionHistory ?? [])
    .filter(isReadoutEditionSnapshot)
    .filter((snapshot) => snapshot.area === "All" && snapshot.editionDate < activeReadoutEditionDate());
  const matchingSourceCanonical = durableCanonical
    ? [allToday.currentEdition, ...(allHistory?.editionHistory ?? [])]
      .filter(isReadoutEditionSnapshot)
      .find((snapshot) => sameEditionVersion(snapshot, durableCanonical)) ?? null
    : null;
  // The durable selection governs membership, while a matching live payload retains
  // source-hydrated titles and links. A mismatched/stale source cannot replace it.
  const resolvedCanonicalCurrent = matchingSourceCanonical ?? (durableCanonical
    ? await withReadoutSelectionVersion(durableCanonical)
    : resolveReadoutTodayEdition("All", allToday, fallbackCanonicalHistory));
  const canonicalCurrent = await withReadoutSelectionVersion(resolvedCanonicalCurrent);
  const durableForArea = durableCanonical ? readoutEditionForArea(durableCanonical, area) : null;
  const hydratedCanonicalForArea = readoutEditionForArea(canonicalCurrent, area);
  const fallbackAreaHistory = fallbackCanonicalHistory
    .map((snapshot) => readoutEditionForArea(snapshot, area))
    .filter((snapshot): snapshot is ReadoutEditionSnapshot => !!snapshot);
  const exactCurrent = resolveReadoutTodayEdition(area, today, fallbackAreaHistory);
  // The All edition remains the canonical source for papers, approvals, and guidelines.
  // An otherwise-empty specialty can additionally receive a transcript-supported podcast
  // lead from its own payload, but a same-date synthetic paper slate never outranks the
  // durable canonical edition.
  const selectedCurrentEdition = durableForArea
    ? validFinishedEdition(area, exactCurrent, durableCanonical)
      ? exactCurrent
      : hydratedCanonicalForArea ?? durableForArea
    : readoutEditionPreferNonEmpty(exactCurrent, hydratedCanonicalForArea);
  const currentEdition = selectedCurrentEdition ? await withReadoutSelectionVersion(selectedCurrentEdition) : null;
  if (window === "today") return compactWindowPayload({
    ...payload,
    currentEdition,
    // Specialty rows are projections of the canonical All edition. Keep its
    // receipts even when a selected paper no longer passes live admission.
    overlays: mergeEvidenceOverlays(payload, allToday),
    stale: payload.stale === true || allToday.stale === true,
  });

  const canonicalHistory = readoutEditionHistoryIncludingCurrent(
    canonicalCurrent,
    allHistory?.editionHistory ?? [],
  );
  const editionHistory = canonicalHistory
    .map((snapshot) => readoutEditionForArea(snapshot, area))
    .filter((snapshot): snapshot is NonNullable<typeof snapshot> => !!snapshot);
  return compactWindowPayload({
    ...payload,
    currentEdition,
    editionHistory,
    historyDays: new Set(editionHistory.map((snapshot) => snapshot.editionDate)).size,
    overlays: mergeEvidenceOverlays(today, payload, allHistory ?? payload),
    stale: payload.stale === true || today.stale === true || allToday.stale === true || allHistory?.stale === true,
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

export async function warmReadoutWindowCache(options: { freshSource?: boolean } = {}) {
  const requests = EDITION_AREAS.flatMap((area) => (["today", "7d"] as const).map((window) => ({ area, window })));
  const warmed: Array<{ area: EditionArea; window: ReadoutWindow; generatedAt: string | null; stale: boolean; error?: string }> = [];

  for (let index = 0; index < requests.length; index += 4) {
    const batch = requests.slice(index, index + 4);
    const results = await Promise.all(batch.map(async ({ area, window }) => {
      try {
        const payload = await buildFinishedReadoutWindow(area, window, options);
        await persistFinishedWindow(area, window, payload);
        return { area, window, generatedAt: payload.generatedAt, stale: payload.stale === true };
      } catch (error) {
        return { area, window, generatedAt: null, stale: true, error: error instanceof Error ? error.message : "Unknown refresh error" };
      }
    }));
    warmed.push(...results);
  }
  return warmed;
}
