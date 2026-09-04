import "server-only";

import { unstable_cache } from "next/cache";
import type { ReadoutWindowPayload } from "@/lib/types";
import {
  readoutWindowDays,
  type ReadoutWindow,
} from "@/app/briefing-preview/readoutRequest";
import { EDITION_AREAS, type EditionArea } from "@/app/briefing-preview/edition";
import { resolveReadoutTodayEdition } from "@/app/briefing-preview/editionSnapshot";
import {
  readoutEditionForArea,
  readoutEditionHistoryIncludingCurrent,
  readoutEditionPreferNonEmpty,
} from "@/app/briefing-preview/editionHistory";

export const READOUT_WINDOW_CACHE_TAG = "readout-window-v17";
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
  return `readout-window:v4:${area}:${window}`;
}

function finishedWindowCacheToken(area: EditionArea, window: ReadoutWindow) {
  return `readout-window:finished:v3:${area}:${window}`;
}

function compactWindowPayload(payload: ReadoutWindowPayload): ReadoutWindowPayload {
  return {
    ...payload,
    overlays: (payload.overlays ?? []).map((overlay) => ({
      ...overlay,
      posts: overlay.posts.slice(0, 1),
    })),
  };
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
  return payload?.area === area && payload.windowDays === readoutWindowDays(window) ? payload : null;
}

const fetchReadoutWindow = unstable_cache(
  async (area: EditionArea, window: ReadoutWindow, cardsJson: string): Promise<ReadoutWindowPayload> => {
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
  },
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
): Promise<ReadoutWindowPayload> {
  const payload = await fetchReadoutWindow(area, window, "[]");
  const today = window === "today" ? payload : await fetchReadoutWindow(area, "today", "[]");
  const allToday = area === "All" ? today : await fetchReadoutWindow("All", "today", "[]");
  const canonicalCurrent = resolveReadoutTodayEdition("All", allToday);
  // The All edition remains the canonical source for papers, approvals, and guidelines.
  // An otherwise-empty specialty can additionally receive a transcript-supported podcast
  // lead from its own payload, so prefer that exact specialty edition when it is non-empty.
  const currentEdition = readoutEditionPreferNonEmpty(
    resolveReadoutTodayEdition(area, today),
    readoutEditionForArea(canonicalCurrent, area),
  );
  if (window === "today") return compactWindowPayload({
    ...payload,
    currentEdition,
    stale: payload.stale === true || allToday.stale === true,
  });

  const allHistory = area === "All" ? payload : await fetchReadoutWindow("All", "7d", "[]");
  const canonicalHistory = readoutEditionHistoryIncludingCurrent(
    canonicalCurrent,
    allHistory.editionHistory ?? [],
  );
  const editionHistory = canonicalHistory
    .map((snapshot) => readoutEditionForArea(snapshot, area))
    .filter((snapshot): snapshot is NonNullable<typeof snapshot> => !!snapshot);
  return compactWindowPayload({
    ...payload,
    currentEdition,
    editionHistory,
    historyDays: new Set(editionHistory.map((snapshot) => snapshot.editionDate)).size,
    overlays: mergeEvidenceOverlays(today, payload, allHistory),
    stale: payload.stale === true || today.stale === true || allToday.stale === true || allHistory.stale === true,
  });
}

const fetchFinishedReadoutWindow = unstable_cache(
  async (area: EditionArea, window: ReadoutWindow) => readFinishedWindow(area, window),
  ["readout-window-finished-v4"],
  { revalidate: READOUT_WINDOW_REVALIDATE_SECONDS, tags: [READOUT_WINDOW_CACHE_TAG] },
);

export async function getCachedReadoutWindow(
  area: EditionArea,
  window: ReadoutWindow,
): Promise<ReadoutWindowPayload> {
  const finished = await fetchFinishedReadoutWindow(area, window);
  if (finished) return finished;

  const rebuilt = await buildFinishedReadoutWindow(area, window);
  await persistFinishedWindow(area, window, rebuilt);
  return rebuilt;
}

export async function warmReadoutWindowCache() {
  const requests = EDITION_AREAS.flatMap((area) => (["today", "7d"] as const).map((window) => ({ area, window })));
  const warmed: Array<{ area: EditionArea; window: ReadoutWindow; generatedAt: string | null; stale: boolean; error?: string }> = [];

  for (let index = 0; index < requests.length; index += 4) {
    const batch = requests.slice(index, index + 4);
    const results = await Promise.all(batch.map(async ({ area, window }) => {
      try {
        const payload = await buildFinishedReadoutWindow(area, window);
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
