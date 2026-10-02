// Shared view-model helpers for the Readout web's evidence renderers (app/ReaderView.tsx
// named exports, /r and /design-lab).

import type { BriefingMover, BriefingData, BriefingStory, BriefingStance } from "@/lib/types";
export { clipSecond } from "./clientEvidence";

// Full tumor-area names for the header switcher (the compact "GU" codes are for chips).
export const AREA_FULL: Record<string, string> = {
  All: "All oncology",
  GU: "Genitourinary",
  Breast: "Breast",
  Lung: "Lung",
  GI: "Gastrointestinal",
  Heme: "Hematologic",
  Gyn: "Gynecologic",
  Skin: "Skin cancer",
};

// Momentum pill colors (constant across areas).
export const UP = { fg: "#74E6A8", bg: "rgba(116,230,168,.16)" };
export const DOWN = { fg: "#FF9B8F", bg: "rgba(255,155,143,.18)" };

// A face-pile coin: the image URL plus the person/show name, so the renderer can fall back to
// tinted initials when the avatar is missing or stale.
export type Face = { src: string | null; label?: string };

// A classic retweet carries the ORIGINAL author's words. Stripping the "RT @handle:" prefix
// (below) leaves those words sitting under the retweeter's name and face, which reads as their
// own take — the one thing a sourced mirror must never do. So: recover who actually wrote it,
// and let the card attribute the quote to them while still crediting the amplification.
// Returns the original author's handle, or null for an ordinary post.
export function rtOriginal(s: string | null | undefined): string | null {
  return (/^\s*RT @([A-Za-z0-9_]{1,15}):/.exec(s ?? "") ?? [])[1] ?? null;
}

// Display-side tweet cleanup: drop the "RT @handle:" prefix and bare t.co shortlinks —
// they read as debris on an editorial card. The card itself still links to the real tweet,
// so nothing is lost. Ingest/data stays untouched (display-only).
export function cleanTweetText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/^\s*RT @[A-Za-z0-9_]+:\s*/, "")
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/^[ \t]*(?:Article|Paper|Link):[ \t]*$/gim, "")
    // X delivers content HTML-escaped — decode the common entities so tweets don't
    // render a literal "&amp;" ("Vedotin &amp; pembrolizumab").
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Is this article/paper trade-media journalism (OncLive, UroToday…) rather than a peer-reviewed
// paper? The producer's flag decides (peerReviewed = the row has a journal name, a PMID, or a
// DOI). A row without the flag is not badged: there is no domain list to guess from.
export const isNewsItem = (x: { peerReviewed?: boolean } | null | undefined): boolean =>
  x?.peerReviewed === false;

// Drop a trailing " | Source" / " - Source" from a title. Same rule as the physician app's
// cleanPublisherTitle (lib/publisher.ts): whitespace collapsed, the suffix must follow a space
// and a "|", "-", "–" or "—", case-insensitive.
function cleanSourceSuffix(title: string, source: string | null | undefined): string {
  const clean = title.replace(/\s+/g, " ").trim();
  const suffix = source?.replace(/\s+/g, " ").trim();
  if (!suffix) return clean;
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean.replace(new RegExp(`\\s+(?:\\||[-–—])\\s*${escaped}$`, "i"), "").trim();
}

// The card title, cleaned of entities and of a trailing source suffix: by the stored journal,
// then also by the shown (registry) source name when that differs. Mirrors the physician app's
// publicationTitle (lib/publication-core.ts), with the stored journal as the legacy label.
export function cleanArticleTitle(title?: string | null, journal?: string | null, shown?: string | null): string {
  const t = (title || "")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s*[\u2605\u2606]\s*$/u, "")
    .replace(/\s+([,;:.])/g, "$1")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .trim();
  const clean = cleanSourceSuffix(t, journal);
  return shown && shown !== journal ? cleanSourceSuffix(clean, shown) : clean;
}

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

// "Directional takes detected" — the counts line for a drug's stance. Honest split, never a
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
