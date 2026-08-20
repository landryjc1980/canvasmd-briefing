// Server-only resolver for the /r/<slug> hero-card post pages.
//
// A "post" IS a weekly hero card (app/HeroCards.tsx) — the same source-anchored card the reader
// shows on the home/area pages, and where ALL the social evidence lives (facepile of who's
// discussing it, clinician + publisher posts, amplifiers, "how the field is reacting" stance).
// That evidence is resolved from the WEEKLY brief (briefing_snapshots.data: topStories /
// topArticles / movers / heroCandidates), NOT from the daily edition — which is why the old thin
// daily page had nothing to show. We resolve a URL token back to {area, card, brief} by scanning
// the current snapshots (one row per area) and rendering the card standalone.
//
// LINK LIFETIME: a card is in the brief only while its source sits inside the ~14-day window, so a
// shared /r link is live for ~2 weeks, then resolves to null (graceful "moved on" page, never a
// 500). A durable per-card index is the Phase-2 upgrade if links need to outlive the window.

import type { BriefingData, HeroCard } from "@/lib/types";
import { heroTok } from "@/lib/postId";

const URL_ = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"] as const;

export type HeroPost = { area: string; card: HeroCard; brief: BriefingData };

export const AREA_LABELS: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Hematology", Gyn: "Gynecologic", Skin: "Skin cancer",
};

// ⚠️ PUBLIC-SAFETY POLICY for /r pages. A `thread` card IS a clinician's post: its headline is
// their VERBATIM words, its sourceLabel is their NAME, and its url carries their handle. None of
// that may appear on a public page, in metadata, in an OG card, or in a slug — the same doctrine
// that already denies the daily `conversation` section a public page. Members see it in full;
// everyone else gets a neutral edition line. Anything that publishes a card must ask this first.
export const isPublicSafeCard = (kind: string) => kind !== "thread";
export const publicTitleOf = (kind: string, headline: string, area: string) =>
  isPublicSafeCard(kind) ? headline : `A clinician post in this week's ${AREA_LABELS[area] ?? area} edition`;

type SnapRow = { area: string; data: BriefingData; generated_at: string };

// Per-lambda memo (5 min), same posture as app/api/briefing/route.ts: deliberately NOT a
// shared/CDN cache (the brief sits behind the gate), and single-flighted so the page + its OG
// image (which resolve back-to-back) share one read instead of each pulling every area's ~0.5MB.
const TTL_MS = 5 * 60_000;
let snapCache: { at: number; rows: SnapRow[] } | null = null;
let inflight: Promise<SnapRow[]> | null = null;

async function latestSnapshots(): Promise<SnapRow[]> {
  if (!URL_ || !SERVICE_KEY) return [];
  const hit = snapCache;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;
  if (!inflight) {
    inflight = (async () => {
      // Latest snapshot per area — one clean read each, in parallel. PostgREST can't project into
      // the JSON `data` column, so we take the whole row (memoized above to keep this rare).
      const reads = AREAS.map(async (area): Promise<SnapRow | null> => {
        try {
          const res = await fetch(
            `${URL_}/rest/v1/briefing_snapshots?select=area,data,generated_at&area=eq.${area}&order=generated_at.desc&limit=1`,
            { headers: { apikey: SERVICE_KEY!, authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" },
          );
          if (!res.ok) return null;
          const rows = (await res.json()) as SnapRow[];
          return rows?.[0] ?? null;
        } catch {
          return null; // one area down must not sink the rest
        }
      });
      const rows = (await Promise.all(reads)).filter((r): r is SnapRow => !!r);
      snapCache = { at: Date.now(), rows };
      return rows;
    })();
    inflight.finally(() => { inflight = null; });
  }
  return inflight;
}

// Resolve a URL token → its hero card + that area's brief. null when the card has rotated out of
// the current snapshots (link older than the window) or the token is unknown.
export async function resolveHeroPost(tok: string): Promise<HeroPost | null> {
  if (!tok) return null;
  const rows = await latestSnapshots();
  for (const r of rows) {
    for (const card of r.data?.heroCandidates?.cards ?? []) {
      if (heroTok(card.id) === tok) return { area: r.area, card, brief: r.data };
    }
  }
  return null;
}
