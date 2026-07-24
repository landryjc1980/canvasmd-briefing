// Shared view-model helpers for the new "story / reader" Weekly Brief designs
// (StoryView.tsx + ReaderView.tsx). Maps our real BriefingData onto the shapes the
// design mocks expect, and holds the dark jewel-tone per-area palette.

import { BriefingMover, BriefingData, BriefingStory, BriefingPod, BriefingStance } from "@/lib/types";

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

// ---- Ink editorial treatment (2026-07-21) ----------------------------------------
// The default reader no longer paints the page in the jewel tone — a saturated
// full-viewport field read as cheap. The page is one shared near-black ink (a whisper
// of blue so it isn't dead), and the area's jewel tone survives as a "cover wash":
// a gradient band at the very top of the page that fades into the ink, plus the
// accent system (kickers, numerals, hairlines, bars). palOf/PALETTE stay untouched —
// the frozen ?design=flat fallback and StoryView still key off them.
export const INK_BG = "#0D1017";
export type InkPal = { bg: string; accent: string; wash: string };
export const inkOf = (area: string): InkPal => {
  const p = palOf(area);
  return { bg: INK_BG, accent: p.accent, wash: p.bg };
};

// Full tumor-area names for the header switcher (the compact "GU" codes are for chips).
export const AREA_FULL: Record<string, string> = {
  All: "All oncology",
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

// The "who's discussing this" face-pile for a story/drug card: X-sharer avatars first (human
// faces), then podcast show art (fills in when X is sparse). Movers carry precomputed `avatars`/
// `showArt`; stories derive them from their podcast/posts evidence. Deduped, capped at 4.
export function pileFaces(x: {
  avatars?: string[]; showArt?: string[];
  posts?: { avatar: string | null }[]; podcast?: { showArt: string | null }[];
}): string[] {
  const xs = x.avatars ?? (x.posts ?? []).map((p) => p.avatar).filter((a): a is string => !!a);
  const pods = x.showArt ?? (x.podcast ?? []).map((p) => p.showArt).filter((a): a is string => !!a);
  return [...new Set([...xs, ...pods])].slice(0, 4);
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

// Display-side tweet cleanup: drop the "RT @handle:" prefix and bare t.co shortlinks —
// they read as debris on an editorial card. The card itself still links to the real tweet,
// so nothing is lost. Ingest/data stays untouched (display-only).
export function cleanTweetText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/^RT @[A-Za-z0-9_]+:\s*/, "")
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    // X delivers content HTML-escaped — decode the common entities so tweets don't
    // render a literal "&amp;" ("Vedotin &amp; pembrolizumab").
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .trim();
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
  if (s.kind === "trial") {
    // The corroboration behind the trial event: podcasts that discussed it + X + papers.
    const parts: string[] = [];
    const conv = podConvLabel(podEpisodeCount(s), s.podcast?.length ?? s.podConvs);
    if (conv) parts.push(conv);
    if (s.xSharers) parts.push(`${s.xSharers} on X`);
    if (s.articleCount) parts.push(`${s.articleCount} paper${s.articleCount === 1 ? "" : "s"}`);
    return parts.join(" · ") || "discussed this week";
  }
  // topic (legacy snapshots only) — "clinicians" (engaged = sharers ∪ commenters)
  return `${s.articleCount} paper${s.articleCount === 1 ? "" : "s"} · ${s.clinicianCount} clinician${s.clinicianCount === 1 ? "" : "s"} engaged`;
}

// Small uppercase kicker naming the atom kind on the story card.
export const storyKicker = (s: BriefingStory): string =>
  s.kind === "drug" ? "Trending drug" : s.kind === "paper" ? "Most-shared paper" : s.kind === "trial" ? "Trial in discussion" : "In focus";

// Map a drug mover onto the story shape — the fallback so the hero always renders even when
// an old snapshot (or the native/pharma callers) hasn't got topStories yet.
export function moverToStory(m: BriefingMover): BriefingStory {
  return {
    kind: "drug", id: m.drugId, headline: m.drug,
    subtitle: [m.brand, m.company].filter(Boolean).join(" · ") || null,
    description: m.why, score: m.score, delta: m.delta, bar: [m.podPct, m.xPct, m.articlePct],
    podConvs: m.podConvs, podEpisodes: m.podEpisodes, podShows: m.podShows, xSharers: m.xSharers, articleCount: m.articleCount, clinicianCount: 0, topLikes: m.topLikes,
    podcast: m.podcast, posts: m.posts, papers: m.papers, drugId: m.drugId, stance: m.stance ?? null,
    subAreas: m.subAreas, // carry sub-tumor tags so the Focus filter works even on the movers-as-stories fallback
  };
}

// ---- article source labeling -------------------------------------------------------------
// Trade-media articles (OncLive, Healio, …) have no journal, so the card showed a raw domain
// (or nothing). Map the domain to a clean publication name, flag it as News (vs a peer-reviewed
// journal), and strip the redundant "… | OncLive" suffix these outlets put in their titles.
const MEDIA_SOURCE: Record<string, string> = {
  "onclive.com": "OncLive", "targetedonc.com": "Targeted Oncology", "cancernetwork.com": "Cancer Network",
  "healio.com": "Healio", "oncodaily.com": "OncoDaily", "urotoday.com": "UroToday", "ascopost.com": "The ASCO Post",
  "cancertherapyadvisor.com": "Cancer Therapy Advisor", "medscape.com": "Medscape", "medpagetoday.com": "MedPage Today",
  "vjoncology.com": "VJOncology", "guoncologynow.com": "GU Oncology Now", "oncologynexus.com": "Oncology Nexus",
  "bloodcancerstoday.com": "Blood Cancers Today", "lungcancerstoday.com": "Lung Cancers Today", "cancerletter.com": "The Cancer Letter",
};
const baseDomain = (d?: string | null) => (d || "").toLowerCase().replace(/^www\./, "");
const mediaName = (domain?: string | null): string | null => {
  const d = baseDomain(domain); if (!d) return null;
  const k = Object.keys(MEDIA_SOURCE).find((m) => d === m || d.endsWith("." + m));
  return k ? MEDIA_SOURCE[k] : null;
};
export const isNewsDomain = (domain?: string | null): boolean => !!mediaName(domain);
// Peer-reviewed journal / publisher domains — used ONLY to prettify the source label when we
// couldn't attach a journal name (so "euoncology.europeanurology.com" reads "European Urology",
// not a raw host). These are NOT news, so they never get a "News" badge (isNewsDomain stays
// media-only). Suffix-matched, so subdomains resolve.
const JOURNAL_DOMAIN: Record<string, string> = {
  "europeanurology.com": "European Urology", "ascopubs.org": "ASCO Journals", "nejm.org": "NEJM",
  "thelancet.com": "The Lancet", "jamanetwork.com": "JAMA", "nature.com": "Nature", "annalsofoncology.org": "Annals of Oncology",
  "aacrjournals.org": "AACR Journals", "cell.com": "Cell Press", "bmj.com": "BMJ", "sciencedirect.com": "ScienceDirect",
  "academic.oup.com": "Oxford Academic", "oup.com": "Oxford Academic", "wiley.com": "Wiley", "onlinelibrary.wiley.com": "Wiley",
  "springer.com": "Springer", "link.springer.com": "Springer", "tandfonline.com": "Taylor & Francis", "nature.nature.com": "Nature",
};
const journalDomainName = (domain?: string | null): string | null => {
  const d = baseDomain(domain); if (!d) return null;
  const k = Object.keys(JOURNAL_DOMAIN).find((m) => d === m || d.endsWith("." + m));
  return k ? JOURNAL_DOMAIN[k] : null;
};
// Last-resort prettifier: strip a leading subdomain and the TLD so an unknown host at least reads
// as its registrable name ("euoncology.europeanurology.com" → "europeanurology") rather than a URL.
const prettyDomain = (domain?: string | null): string | null => {
  const d = baseDomain(domain); if (!d) return null;
  const parts = d.split(".").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : d;
};
// The source shown on an article card: the journal if we have one, else a clean media name, else a
// known journal-publisher name, else the registrable host. News outlets never masquerade as a journal.
export function articleSource(journal?: string | null, domain?: string | null): string | null {
  if (journal) return journal;
  return mediaName(domain) ?? journalDomainName(domain) ?? prettyDomain(domain);
}
// Strip a trailing "… | OncLive" / "… - Healio" ONLY when the suffix is a known media name — safe
// against clipping a real subtitle ("… - A Review"), which we never touch.
const MEDIA_SUFFIX_RE = new RegExp(`\\s*[|\\u2013\\u2014-]\\s*(${Object.values(MEDIA_SOURCE).map((n) => n.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})\\s*$`, "i");
export function cleanArticleTitle(title?: string | null): string {
  const t = (title || "").trim();
  return t.replace(MEDIA_SUFFIX_RE, "").trim() || t;
}

// "How the field is reacting" — the counts line for a drug's stance. Honest split, never a
// hollow %. Returns null when there's no stance (thin signal / non-drug), so the card stays clean.
export function stanceParts(s: BriefingStance | null | undefined):
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
