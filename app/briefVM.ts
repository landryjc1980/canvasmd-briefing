// Shared view-model helpers for the new "story / reader" Weekly Brief designs
// (StoryView.tsx + ReaderView.tsx). Maps our real BriefingData onto the shapes the
// design mocks expect, and holds the dark jewel-tone per-area palette.

import { BriefingMover, BriefingData, BriefingStory, BriefingPod } from "@/lib/types";

// Dark jewel-tone palette, one color per tumor area (from the design handoff).
export type Pal = { bg: string; accent: string; soft: string };
export const PALETTE: Record<string, Pal> = {
  GU: { bg: "#14336B", accent: "#9FC0FF", soft: "#5A7FC4" },
  Breast: { bg: "#4A1836", accent: "#FFB0D4", soft: "#B46A8F" },
  Lung: { bg: "#22384F", accent: "#A9C4E6", soft: "#5F7D9E" },
  GI: { bg: "#463107", accent: "#F3CD8A", soft: "#B08B45" },
  Heme: { bg: "#4A1414", accent: "#FF9F95", soft: "#B05A52" },
  Gyn: { bg: "#0F3F39", accent: "#8FE8D8", soft: "#4F9A8F" },
};
export const palOf = (area: string): Pal => PALETTE[area] ?? PALETTE.GU;

// Full tumor-area names for the header switcher (the compact "GU" codes are for chips).
export const AREA_FULL: Record<string, string> = {
  GU: "Genitourinary",
  Breast: "Breast",
  Lung: "Lung",
  GI: "Gastrointestinal",
  Heme: "Hematologic",
  Gyn: "Gynecologic",
};

// Momentum pill colors (constant across areas).
export const UP = { fg: "#74E6A8", bg: "rgba(116,230,168,.16)" };
export const DOWN = { fg: "#FF9B8F", bg: "rgba(255,155,143,.18)" };

// The 3-segment monochrome signal bar: accent at opacities [1, .5, .24] sized by
// the podcast / X / paper split. Returns segment descriptors (flex + opacity).
export function barSegments(m: BriefingMover): { flex: number; opacity: number }[] {
  const raw = [m.podPct, m.xPct, m.articlePct];
  const ops = [1, 0.5, 0.24];
  return raw.map((f, i) => ({ flex: Math.max(f, 0), opacity: ops[i] })).filter((s) => s.flex > 0);
}

// A "conversation" = one episode's discussion of the drug. Five clips of one Oncology
// Brothers episode are ONE conversation (a deep dive), not five — so the caption counts
// distinct EPISODES, and flags a single richly-clipped episode as "in-depth" rather than
// inflating the number. Falls back to deriving episodes from the pod evidence when an older
// snapshot predates the podEpisodes field.
export function podEpisodeCount(x: { podEpisodes?: number; podcast?: BriefingPod[] }): number {
  if (typeof x.podEpisodes === "number") return x.podEpisodes;
  return new Set((x.podcast ?? []).map((p) => p.episodeId).filter(Boolean)).size;
}
export function podConvLabel(episodes: number, segments: number): string | null {
  if (!episodes) return null;
  if (episodes === 1) return segments >= 3 ? "1 in-depth conversation" : "1 conversation";
  return `${episodes} conversations`;
}

// "4 conversations · 2 on X · 3 papers · ♥ 214" — zeros omitted.
export function metricsLine(m: BriefingMover): string {
  const parts: string[] = [];
  const conv = podConvLabel(podEpisodeCount(m), m.podcast?.length ?? m.podConvs);
  if (conv) parts.push(conv);
  if (m.xSharers) parts.push(`${m.xSharers} on X`);
  if (m.articleCount) parts.push(`${m.articleCount} paper${m.articleCount === 1 ? "" : "s"}`);
  if (m.topLikes) parts.push(`♥ ${m.topLikes}`);
  return parts.join(" · ");
}

// "5:30" clip timestamp from a start offset in ms.
export function clipTs(ms: number | null): string {
  if (ms == null) return "0:00";
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Split the recap into a serif "lead" line + the remainder paragraph for the hero.
export function heroSplit(recap: string | null): { lead: string; rest: string } {
  const t = (recap ?? "").trim();
  if (!t) return { lead: "", rest: "" };
  const m = t.match(/^(.+?[.?!])\s+(.*)$/s);
  return m ? { lead: m[1], rest: m[2] } : { lead: t, rest: "" };
}

// Aggregate stats for the hero row.
export function heroStats(data: BriefingData) {
  const talkCount = data.movers.reduce((n, m) => n + podEpisodeCount(m), 0);
  const postCount = data.topKols.reduce((n, k) => n + k.tweets, 0);
  return { moverCount: data.movers.length, postCount, talkCount };
}

// ---- Top Stories (atom-agnostic) view-model --------------------------------
// The same 3-segment monochrome bar, but from a story's explicit [pod%, x%, article%].
export function barSegmentsRaw(bar: [number, number, number] | null): { flex: number; opacity: number }[] {
  if (!bar) return [];
  const ops = [1, 0.5, 0.24];
  return bar.map((f, i) => ({ flex: Math.max(f, 0), opacity: ops[i] })).filter((s) => s.flex > 0);
}

// The metric line adapts by atom: drug = the 3-way count line; paper = "N clinicians shared ·
// ♥"; topic = "N papers · M doctors".
export function storyMetricLine(s: BriefingStory): string {
  if (s.kind === "drug") {
    const parts: string[] = [];
    const conv = podConvLabel(podEpisodeCount(s), s.podcast?.length ?? s.podConvs);
    if (conv) parts.push(conv);
    if (s.xSharers) parts.push(`${s.xSharers} on X`);
    if (s.articleCount) parts.push(`${s.articleCount} paper${s.articleCount === 1 ? "" : "s"}`);
    if (s.topLikes) parts.push(`♥ ${s.topLikes}`);
    return parts.join(" · ");
  }
  if (s.kind === "paper") {
    const base = `${s.clinicianCount} clinician${s.clinicianCount === 1 ? "" : "s"} shared`;
    return s.topLikes ? `${base} · ♥ ${s.topLikes}` : base;
  }
  // topic — "clinicians" (engaged = sharers ∪ commenters), not "doctors" which read as "only N people"
  return `${s.articleCount} paper${s.articleCount === 1 ? "" : "s"} · ${s.clinicianCount} clinician${s.clinicianCount === 1 ? "" : "s"} engaged`;
}

// Small uppercase kicker naming the atom kind on the story card.
export const storyKicker = (s: BriefingStory): string =>
  s.kind === "drug" ? "Trending drug" : s.kind === "paper" ? "Most-shared paper" : "In focus";

// Map a drug mover onto the story shape — the fallback so the hero always renders even when
// an old snapshot (or the native/pharma callers) hasn't got topStories yet.
export function moverToStory(m: BriefingMover): BriefingStory {
  return {
    kind: "drug", id: m.drugId, headline: m.drug,
    subtitle: [m.brand, m.company].filter(Boolean).join(" · ") || null,
    description: m.why, score: m.score, delta: m.delta, bar: [m.podPct, m.xPct, m.articlePct],
    podConvs: m.podConvs, podEpisodes: m.podEpisodes, podShows: m.podShows, xSharers: m.xSharers, articleCount: m.articleCount, clinicianCount: 0, topLikes: m.topLikes,
    podcast: m.podcast, posts: m.posts, papers: m.papers, drugId: m.drugId, stance: m.stance ?? null,
  };
}

// "How the field is reacting" — the counts line for a drug's stance. Honest split, never a
// hollow %. Returns null when there's no stance (thin signal / non-drug), so the card stays clean.
export function stanceParts(s: import("@/lib/types").BriefingStance | null | undefined):
  { favorable: number; skeptical: number; mixed: number; total: number; axis: string | null; quote: string } | null {
  if (!s || s.total < 4) return null;
  return { favorable: s.favorable, skeptical: s.skeptical, mixed: s.mixed, total: s.total, axis: s.axis, quote: s.quote };
}

// The Top Stories to render: the real topStories if present, else drug movers as stories.
export function storiesOf(data: BriefingData): BriefingStory[] {
  return data.topStories && data.topStories.length ? data.topStories : data.movers.map(moverToStory);
}

// ---- "Since your last read" partition ------------------------------------------------------
// Honest-repeat handling for the 14-day window: a returning reader sees NEW/UPDATED stories
// first, then a "you're caught up" divider, then the ones they've already read. Rules:
//  • NEW      = story id the reader has never viewed
//  • UPDATED  = viewed before, but the evidence fingerprint changed since (facts developed)
//  • seen     = viewed AND fingerprint unchanged — cosmetic drift (likes/counts) is NOT news
//  • order INSIDE each partition stays editorial (importance), never chronological
//  • the frame is SUPPRESSED (mode "plain") when it wouldn't partition anything: signed-out /
//    first visit / everything-new (long absence) — no header over a full deck of NEW chips.
//  • everything seen+unchanged → mode "caughtup": normal order + a slim caught-up note only.
export type StoryStatus = "new" | "updated" | "seen";
export type StoryPartition = {
  mode: "plain" | "split" | "caughtup";
  ordered: BriefingStory[];               // the deck order to render
  status: Map<string, StoryStatus>;       // story.id -> chip
  freshCount: number;                     // NEW + UPDATED (0 in plain/caughtup)
};
export function partitionStories(stories: BriefingStory[], seen: Record<string, string> | null | undefined): StoryPartition {
  const status = new Map<string, StoryStatus>();
  const plain: StoryPartition = { mode: "plain", ordered: stories, status, freshCount: 0 };
  if (!seen || Object.keys(seen).length === 0) return plain;           // signed-out / first visit
  if (stories.some((s) => !s.fp)) return plain;                        // old snapshot without fps — can't be honest, so don't pretend
  for (const s of stories) {
    const prior = seen[s.id];
    status.set(s.id, prior === undefined ? "new" : prior === s.fp ? "seen" : "updated");
  }
  const fresh = stories.filter((s) => status.get(s.id) !== "seen");
  const old = stories.filter((s) => status.get(s.id) === "seen");
  if (old.length === 0) return plain;                                  // everything new (long absence) — no frame
  if (fresh.length === 0) return { mode: "caughtup", ordered: stories, status, freshCount: 0 };
  return { mode: "split", ordered: [...fresh, ...old], status, freshCount: fresh.length };
}
