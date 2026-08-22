// Server-only resolver for the /r/<slug> hero-card post pages.
//
// A "post" IS a weekly hero card (app/HeroCards.tsx) — the same source-anchored card the reader
// shows on the home/area pages, and where ALL the social evidence lives (facepile of who's
// discussing it, clinician + publisher posts, amplifiers, and directional take classifications).
// That evidence is resolved from the activated WEEKLY brief (briefing_active.data: topStories /
// topArticles / movers / heroCandidates), NOT from the daily edition — which is why the old thin
// daily page had nothing to show. We resolve a URL token back to {area, card, brief} by scanning
// the current promoted build (one row per area) and rendering the card standalone.
//
// LINK LIFETIME: a card is in the brief only while its source sits inside the ~14-day window, so a
// shared /r link is live for ~2 weeks, then resolves to null (graceful "moved on" page, never a
// 500). A durable per-card index is the Phase-2 upgrade if links need to outlive the window.

import type { BriefingData, HeroCard } from "@/lib/types";
import { heroTok } from "@/lib/postId";
import { sliceBriefForCard, type CardBrief } from "@/app/heroEvidence";

const URL_ = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  isPublicSafeCard(kind) ? headline : `A clinician post in the current 14-day ${AREA_LABELS[area] ?? area} edition`;

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
      // `briefing_active` is the database's single activation contract: promoted frozen build,
      // or legacy snapshots only when no build has ever been activated. Missing active rows fail
      // closed instead of leaking mutable staging content into public links or the archive.
      let rows: SnapRow[] = [];
      try {
        const res = await fetch(
          `${URL_}/rest/v1/briefing_active?select=area,data,generated_at`,
          { headers: { apikey: SERVICE_KEY!, authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" },
        );
        if (res.ok) rows = (await res.json()) as SnapRow[];
      } catch {
        rows = [];
      }
      snapCache = { at: Date.now(), rows };
      return rows;
    })();
    inflight.finally(() => { inflight = null; });
  }
  return inflight;
}

// ---- durable archive (readout_posts) --------------------------------------------------------
// The active build keeps one row per area, so a card eventually rotates out when a later build is
// promoted. The archive keeps each card plus the slice of the brief its evidence
// resolves against, so a shared link keeps working for RETENTION_DAYS after it was last seen live.
export const RETENTION_DAYS = 30;

async function rest(path: string, init?: RequestInit): Promise<Response | null> {
  if (!URL_ || !SERVICE_KEY) return null;
  try {
    return await fetch(`${URL_}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

// Persist one card (idempotent). `first_seen` is preserved by the merge-duplicates upsert only for
// new rows; existing rows just get a fresh last_seen, which is what the retention sweep reads.
export async function archiveCard(area: string, card: HeroCard, brief: CardBrief): Promise<void> {
  const row = {
    tok: heroTok(card.id), area, kind: card.kind, headline: card.headline,
    card, evidence: sliceBriefForCard(card, brief), last_seen: new Date().toISOString(),
  };
  await rest("readout_posts?on_conflict=tok", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([row]),
  });
}

async function fromArchive(tok: string): Promise<HeroPost | null> {
  const res = await rest(`readout_posts?select=area,card,evidence&tok=eq.${encodeURIComponent(tok)}&limit=1`);
  if (!res?.ok) return null;
  const rows = (await res.json()) as { area: string; card: HeroCard; evidence: CardBrief }[];
  const r = rows?.[0];
  if (!r) return null;
  // The archived slice IS a BriefingData for every read path that matters here (the four arrays
  // resolveHeroEvidence touches); nothing downstream reads the rest.
  return { area: r.area, card: r.card, brief: r.evidence as BriefingData };
}

// Archive every card that is live right now (the cron's breadth pass).
export async function archiveAllLive(): Promise<number> {
  const rows = await latestSnapshots();
  let n = 0;
  for (const r of rows) {
    for (const card of r.data?.heroCandidates?.cards ?? []) {
      await archiveCard(r.area, card, r.data).catch(() => {});
      n++;
    }
  }
  return n;
}

// Drop anything not seen live for RETENTION_DAYS — that is the link lifetime we promise.
export async function pruneArchive(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
  const res = await rest(`readout_posts?last_seen=lt.${encodeURIComponent(cutoff)}`, {
    method: "DELETE",
    headers: { prefer: "return=representation" },
  });
  if (!res?.ok) return 0;
  const gone = (await res.json()) as unknown[];
  return Array.isArray(gone) ? gone.length : 0;
}

// Resolve a URL token → its hero card + the brief its evidence resolves against.
// LIVE snapshot first (freshest evidence, and it re-arms the archive), then the durable archive.
// null only when the token is unknown or the archived copy has aged past retention.
export async function resolveHeroPost(tok: string): Promise<HeroPost | null> {
  if (!tok) return null;
  const rows = await latestSnapshots();
  for (const r of rows) {
    for (const card of r.data?.heroCandidates?.cards ?? []) {
      if (heroTok(card.id) === tok) {
        // Someone is actually visiting this card — make sure it outlives the next rebuild. Awaited
        // (one small write, and /r traffic is rare) because a detached promise can be killed when
        // the serverless invocation ends. Never let archiving break the page.
        await archiveCard(r.area, card, r.data).catch(() => {});
        return { area: r.area, card, brief: r.data };
      }
    }
  }
  return fromArchive(tok);
}
