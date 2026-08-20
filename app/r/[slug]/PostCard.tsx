"use client";

// The standalone post card — the SAME source-anchored hero card the reader shows on the home /
// area pages, rendered by itself and expanded, so a shared /r/<slug> link lands on the full card
// with all its social evidence (facepile, clinician + publisher posts, amplifiers, stance).
//
// It reuses the live reader components verbatim — HeroCards, StoryEvidence, EpisodeXReceipts,
// TweetCard, resolveHeroEvidence — inside a faithful copy of the reader's `.reader-editorial`
// context (the --rv-* paper palette + scoped <style> block) so the render matches home 1:1. The
// hero/story/tweet CSS lives in brief.css (imported here); the audio player CSS lives in the
// globally-loaded globals.css, re-tinted to paper by the .reader-editorial .aq-dark rules below.
//
// heroEvidenceFor is replicated from app/AllView.tsx (NOT imported) so this page never destabilizes
// the shared reader; resolveHeroEvidence (the pure data resolution) IS shared.

import { useEffect, useState } from "react";
import HeroCards, { type HeroEvidence } from "@/app/HeroCards";
import { resolveHeroEvidence } from "@/app/heroEvidence";
import { TweetCard, StoryEvidence, EpisodeXReceipts } from "@/app/ReaderView";
import { AREA_FULL } from "@/app/briefVM";
import type { BriefingData, HeroCard, BriefingStory, BriefingPaper } from "@/lib/types";
import "@/app/briefing.css";
import "@/app/brief.css";

// Only the four arrays resolveHeroEvidence reads — the page passes this trimmed slice (not the
// whole ~0.5MB brief) so a shared-link cold open stays lean. Matches resolveHeroEvidence's own
// param type exactly, so there is no risk of starving the evidence.
type CardBrief = Pick<BriefingData, "topStories" | "topArticles" | "movers" | "heroCandidates">;

// House palette (paper/ink), matching the reader (app/ReaderView.tsx constants).
const INK = "#17181a", INK_2 = "#4f5257", LIGHT_MUT = "#696c71", LIGHT_MUT2 = "#85878c";
const LINE = "#cfd0cb", SURFACE = "#ebeae5", PAPER = "#f4f4f1";
const MUT = "var(--rv-muted, #696c71)";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f", Skin: "#6d28d9",
};
const ALL_ACCENT = "#475569";

// Verbatim replica of app/AllView.tsx heroEvidenceFor (see file header). Maps the resolved
// evidence DATA to the reader's JSX; re-ranks/re-selects nothing.
function heroEvidenceFor(card: HeroCard, brief: CardBrief, accent: string): HeroEvidence {
  const resolved = resolveHeroEvidence(card, brief);
  if (!resolved) return null;
  if (resolved.kind === "paper") {
    const story = resolved.story as BriefingStory;
    const paper = story.papers?.[0];
    const firstPost = story.posts?.[0] ?? paper?.posts?.[0] ?? paper?.sharers?.[0] ?? resolved.publisherPosts[0] ?? resolved.otherPosts[0];
    return {
      faces: resolved.faces,
      abstract: paper?.abstract?.replace(/\s+/g, " ").trim() || null,
      preview: firstPost ? <TweetCard t={firstPost} compact /> : null,
      drawer: <StoryEvidence story={{ ...story, publisherPosts: resolved.publisherPosts, otherPosts: resolved.otherPosts, supportLinks: resolved.supportLinks }} accent={accent} paperLabel="The paper" />,
    };
  }
  if (resolved.kind === "article") {
    const paper = resolved.paper as unknown as BriefingPaper;
    const firstPost = resolved.posts[0] ?? paper.posts?.[0] ?? paper.sharers?.[0] ?? resolved.publisherPosts[0] ?? resolved.otherPosts[0];
    return {
      faces: resolved.faces,
      abstract: paper.abstract?.replace(/\s+/g, " ").trim() || null,
      preview: firstPost ? <TweetCard t={firstPost} compact /> : null,
      drawer: <StoryEvidence story={{ podcast: [], posts: resolved.posts, papers: [paper], kind: "paper", publisherPosts: resolved.publisherPosts, otherPosts: resolved.otherPosts, supportLinks: resolved.supportLinks }} accent={accent} paperLabel="The paper" />,
    };
  }
  if (resolved.kind === "episode") return { faces: resolved.faces, drawer: (
    <>
      <StoryEvidence story={{ podcast: resolved.pods, posts: [], papers: [], kind: "episode" }} accent={accent} paperLabel="Papers" />
      {((card.announcements ?? []).length > 0 || (card.amplifiers ?? []).length > 0) && <EpisodeXReceipts announcements={card.announcements ?? []} amplifiers={card.amplifiers ?? []} accent={accent} />}
    </>
  ) };
  if (resolved.kind === "event") return { faces: resolved.faces, drawer: <StoryEvidence story={{ podcast: [], posts: resolved.posts, papers: [], kind: "event", publisherPosts: resolved.publisherPosts, otherPosts: resolved.otherPosts, supportLinks: resolved.supportLinks }} accent={accent} paperLabel="Papers" /> };
  return { faces: resolved.faces, drawer: <StoryEvidence story={{ podcast: [], posts: [resolved.post], papers: [], kind: "thread" }} accent={accent} paperLabel="Papers" /> };
}

export default function PostCard({ card, brief, area, memberHome }: { card: HeroCard; brief: CardBrief; area: string; memberHome: string }) {
  const accent = AREA_ACCENTS[area] ?? ALL_ACCENT;
  const areaFull = AREA_FULL[area] ?? area;
  // Render the reader card CLIENT-ONLY (like the reader itself, which is a "use client" page):
  // its evidence components (TweetCard/StoryEvidence) emit relative timestamps that differ between
  // the server render and hydration. A mounted gate keeps the server + initial-client render
  // identical (a fixed-height placeholder), then swaps in the live card — no hydration mismatch.
  // The public teaser + OG (server-rendered elsewhere) already cover crawlers/unfurls.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="reader-editorial" style={{ minHeight: "100vh", overflowWrap: "break-word", background: PAPER, color: INK, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", ["--rv-accent" as string]: accent, ["--rv-ink" as string]: INK, ["--rv-ink-2" as string]: INK_2, ["--rv-copy" as string]: INK_2, ["--rv-muted" as string]: LIGHT_MUT, ["--rv-muted-2" as string]: LIGHT_MUT2, ["--rv-line" as string]: LINE, ["--rv-surface" as string]: SURFACE, ["--rv-card" as string]: "#fff", ["--rv-card-line" as string]: "#d8d7d1", ["--rv-card-radius" as string]: "8px", ["--rv-card-shadow" as string]: "0 8px 22px rgba(31,35,42,.07)" }}>
      {/* Reader's scoped styles (copied from app/ReaderView.tsx so the card + evidence + audio
          player render identically to home). Injected raw via dangerouslySetInnerHTML: unlike the
          reader (a client-only page), THIS card is server-rendered, and React would HTML-escape the
          `>` child-combinators in a JSX <style> text node on the server but not the client — a
          hydration mismatch. Raw injection emits byte-identical CSS on both sides. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .reader-editorial .rv-list-row{border-bottom:1px solid ${LINE}}
        .rv-row{transition:color .16s ease}
        @media(hover:hover){.rv-row:hover [data-disclosure],.rv-text-action:hover{text-decoration:underline;text-underline-offset:4px}}
        .reader-editorial .rv-row:focus-visible{outline:2px solid ${accent};outline-offset:-2px}
        .reader-editorial .rv-episode-row{padding:16px 2px 18px;border-bottom:1px solid ${LINE}}
        .reader-editorial .rv-text-action:focus-visible{outline:2px solid ${accent};outline-offset:2px;border-radius:4px}
        @media(max-width:600px){
          .reader-editorial .rv-paper-share{padding:16px 0!important}
          .reader-editorial .rv-paper-meta{align-items:flex-start!important}
          .reader-editorial .rv-paper-actions{justify-content:space-between}
          .reader-editorial .rv-paper-actions>span:last-child{margin-left:auto!important}
        }
        .reader-editorial .aq-dark{--aq-shell:#fff;--aq-border:#d8d7d1;--aq-track:#d9d8d3;background:var(--aq-shell);border-color:var(--aq-border);color:${INK};box-shadow:0 8px 22px -20px rgba(31,35,42,.6)}
        .reader-editorial .aq-dark .aq-times,.reader-editorial .aq-dark .aq-label,.reader-editorial .aq-dark .aq-cur{color:#74767a}
        .reader-editorial .aq-dark .aq-range::-webkit-slider-thumb{border-color:#fff}
        .reader-editorial .aq-dark .aq-range::-moz-range-thumb{border-color:#fff}
        .reader-editorial .readout-hero-card:not(.is-compact){border-top-color:${LINE}}
        .reader-editorial .readout-hero-abstract>p{color:${INK_2}}
        .reader-editorial .readout-hero-preview>div:first-child{color:${MUT}}
        .rv-drawer{animation:rvDrawerIn .26s cubic-bezier(.4,0,.2,1)}
        @keyframes rvDrawerIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @media(prefers-reduced-motion:reduce){.rv-drawer{animation:none}}
      ` }} />
      <div style={{ maxWidth: 690, margin: "0 auto", padding: "26px 22px 90px" }}>
        {/* masthead — wordmark + this card's edition */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <a href={memberHome} style={{ textDecoration: "none", display: "inline-flex", alignItems: "baseline", gap: 9 }}>
            <span style={{ color: accent, font: "750 10px/1 system-ui", letterSpacing: ".04em", textTransform: "uppercase" }}>CanvasMD</span>
            <span style={{ font: "400 22px/1 'Newsreader',Georgia,serif", color: INK, letterSpacing: "-.01em" }}>The Readout</span>
          </a>
          <a href={memberHome} style={{ marginLeft: "auto", font: "700 11px system-ui", letterSpacing: ".04em", textTransform: "uppercase", color: accent, textDecoration: "none" }}>{areaFull} edition</a>
        </div>
        <div aria-hidden style={{ height: 2, background: accent, opacity: .9, margin: "14px 0 4px", maxWidth: 44 }} />

        {/* the card — rendered as the lead (i===0), expanded via defaultOpenId. Client-only (see
            the mounted note above); a min-height placeholder holds the space to limit layout shift. */}
        {mounted ? (
          <HeroCards
            cards={[card]}
            accent={accent}
            defaultOpenId={card.id}
            ink={{ soft: INK_2, softer: LIGHT_MUT, line: LINE, ring: PAPER, surface: SURFACE }}
            evidenceOf={(c) => heroEvidenceFor(c, brief, accent)}
          />
        ) : (
          <div aria-hidden style={{ minHeight: 420 }} />
        )}

        {/* return to the full brief */}
        <div style={{ marginTop: 30, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
          <a href={memberHome} style={{ font: "600 13.5px system-ui", color: accent, textDecoration: "none" }}>Open the {areaFull} Readout ↗</a>
          <div style={{ font: "400 11.5px system-ui", color: LIGHT_MUT2, marginTop: 10 }}>Signal from tracked oncology clinicians and selected podcasts.</div>
        </div>
      </div>
    </div>
  );
}
