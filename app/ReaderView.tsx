"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { emph, stripEmph } from "@/app/emphasis";
import { flushSync } from "react-dom";
import { BriefingData, BriefingSharer, BriefingPod, BriefingPaper, BriefingCongress, BriefingEpisode, BriefingArticle, HeroCard as HeroCardT, HeroSupportLink } from "@/lib/types";
import { heroSlugFor } from "@/lib/postId";
import AudioQuote from "@/components/AudioQuote";
import { palOf, inkOf, metricsLine, storyMetricLine, storyKicker, paperBlockLabel, storiesOf, partitionStories, heroDeckOf, articleSource, isNewsItem, cleanArticleTitle, cleanTweetText, rtOriginal, clipTs, pileFacesL, trialEvidenceLine, type Face, AREA_FULL, UP, DOWN } from "./briefVM";
import StanceBlock from "./StanceBlock";
import HeroCards, { type HeroEvidence } from "./HeroCards";
import { pickConversationPreview, resolveHeroEvidence } from "./heroEvidence";
import { scopedHeroCards } from "./heroContract";
import { logSignal, logStorySeen, type BriefSignalKind } from "./gateClient";
import DailyConversationEvidence from "./DailyConversationEvidence";

// "The Reader" — the Weekly Brief. 2026-07-21 depth pass (previous single-column design
// preserved at ?design=flat / git tag design-2026-07-21-flat-reader):
//   • surface elevation: soft top light on the page field, cards a clear step lighter with a
//     lit top edge + shadow, hover lift on every expandable row
//   • desktop ≥1180px: two tracks — the editorial column + a right rail (guests, X, trials)
//     so the width works and the rail modules stop stretching the scroll
//   • type scale: lead story gets front-page size; supporting stories stay quieter
//   • every expandable row is a real button (keyboard + screen readers), same click targets
// Evidence expands inline as an accordion under whatever you click — unchanged.

// Narrow every section by the two composable axes: the congress (Live-coverage scope) and the
// sub-indication (Focus). Filter, don't fragment — with neither active this returns the whole
// brief untouched. Top Stories are filtered separately in the component (off the full hero list),
// so an empty result shows a note rather than silently falling back to the drug movers.
function filterBrief(d: BriefingData, sa: string | null, congressOnly: boolean): BriefingData {
  if (!sa && !congressOnly) return d;
  const keep = (x: { subAreas?: string[]; congress?: boolean }) =>
    (!sa || (x.subAreas ?? []).includes(sa)) && (!congressOnly || x.congress === true);
  return {
    ...d,
    movers: d.movers.filter(keep),
    topKols: d.topKols.filter(keep),
    trials: d.trials.filter(keep),
    topArticles: d.topArticles.filter(keep),
    guests: d.guests ? d.guests.filter(keep) : d.guests,
    episodes: d.episodes ? d.episodes.filter(keep) : d.episodes,
  };
}

// Congress status is derived HERE (client), never trusted from the snapshot, so a cached brief
// can't show a stale "Day 2". Days count inclusive from start; whole-day granularity is honest
// for a snapshot that refreshes on a cron, not a live ticker.
type CongressState = { phase: "upcoming" | "live" | "wrapped"; label: string };
function congressState(c: BriefingCongress): CongressState {
  const day = 86400_000;
  const todayMs = Date.parse(new Date().toISOString().slice(0, 10));
  const start = Date.parse(c.startDate), end = Date.parse(c.endDate);
  const total = Math.round((end - start) / day) + 1;
  if (todayMs < start) {
    const d = Math.round((start - todayMs) / day);
    return { phase: "upcoming", label: d <= 1 ? "Starts tomorrow" : `Starts in ${d} days` };
  }
  if (todayMs > end) {
    const d = Math.round((todayMs - end) / day);
    return { phase: "wrapped", label: d <= 1 ? "Wrapped · the verdict" : "Wrapped" };
  }
  const dayN = Math.round((todayMs - start) / day) + 1;
  return { phase: "live", label: `Day ${dayN} of ${total}` };
}

const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};

const prettyPhase = (p: string | null): string => {
  if (!p) return "Trial";
  const nums = p.split("/").map((x) => x.replace(/[^0-9]/g, "")).filter(Boolean);
  return nums.length ? `Phase ${nums.join("/")}` : p.replace(/_/g, " ");
};
const ini = (s: string) =>
  (s || "?").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";

// Every avatar/show-art coin renders through Coin so a missing image NEVER reads as a broken
// gray disc: tinted initials sit underneath, the photo paints over them, and onError peels the
// photo away (X rotates pbs.twimg profile-image URLs on photo change, so a baked snapshot can
// hold a 404 for up to a rebuild cycle; ~22 panel accounts are deactivated and have no photo at
// all). Tint is deterministic per label — the same person gets the same color everywhere.
const COIN_TINTS = ["#0369a1", "#be185d", "#a45c0a", "#0d6b5f", "#9b0f18", "#334155"];
const coinTint = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COIN_TINTS[h % COIN_TINTS.length];
};
export function Coin({ src, label, size, radius = "50%", ring, style }: { src?: string | null; label?: string; size: number; radius?: number | string; ring?: string; style?: React.CSSProperties }) {
  const tint = coinTint(label || src || "?");
  return (
    <span aria-hidden style={{
      position: "relative", width: size, height: size, borderRadius: radius, overflow: "hidden", flex: "none",
      background: `${tint}24`, color: tint, font: `600 ${Math.max(7, Math.round(size * 0.33))}px system-ui`,
      display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: ring ? "content-box" : undefined,
      ...(ring ? { border: `2px solid ${ring}` } : {}), ...style,
    }}>
      {label ? ini(label) : null}
      {src && <img src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
    </span>
  );
}

const INK = "#17181a";
const INK_2 = "#4f5257";
const LIGHT_MUT = "#696c71";
const LIGHT_MUT2 = "#85878c";
// These components are also reused by the dark All Oncology view. CSS variables let the
// active Reader choose the light palette while the shared renderers retain dark fallbacks.
const MUT = "var(--rv-muted, #9aa2b6)";
const MUT2 = "var(--rv-muted-2, #7e8698)";
const LINE = "#cfd0cb";
const SURFACE = "#ebeae5";
const PAPER = "#f4f4f1";
const READER_ACCENTS: Record<string, string> = {
  GU: "#0369a1",
  Breast: "#be185d",
  Lung: "#334155",
  GI: "#a45c0a",
  Heme: "#9b0f18",
  Gyn: "#0d6b5f",
  Skin: "#6d28d9",
};
// Congress "marquee event" gold — the ONE accent that isn't a tumor-area jewel tone, so a congress
// reads as a distinct dimension (event, not disease). Used only by the Congress bar + badge.
const CG = "#E6B450";

// Podcast/trial excerpt cleanup. The transcript extractor (extract-mentions snippetAround)
// wraps a raw CHARACTER window in "…" markers, so snippets read "…r cancer … ineligible for…"
// — a half-word at each end. Strip the extractor's markers FIRST, then drop the dangling
// partial word at whichever end was truncated, then re-add one clean ellipsis. Clean AI glosses
// (no "…" markers, capitalized start, terminal punctuation) pass straight through untouched.
const cleanSnippet = (s: string | null | undefined): string => {
  const orig = (s ?? "").replace(/\s+/g, " ").trim();
  if (!orig) return orig;
  const truncStart = /^(?:…|\.{2,})/.test(orig);
  const truncEnd = /(?:…|\.{2,})$/.test(orig);
  let t = orig.replace(/^(?:…|\.{2,})\s*/, "").replace(/\s*(?:…|\.{2,})$/, "").trim();
  if (!t) return orig;
  // window opened mid-word (leading token is a lowercase fragment) → drop it
  if (truncStart && /^[a-z]/.test(t)) t = t.replace(/^\S+\s+/, "").trim();
  // window closed mid-word (no sentence-ending punctuation) → drop the dangling token
  if (truncEnd && !/[.!?"'’”)]$/.test(t)) t = t.replace(/\s+\S+$/, "").trim();
  if (!t) return orig;
  return (truncStart ? "…" : "") + t + (truncEnd ? "…" : "");
};

function Delta({ delta }: { delta: number }) {
  if (!delta) return <span title="No change vs. the prior two weeks" style={{ display: "inline-flex", alignItems: "center", background: "var(--rv-surface, rgba(255,255,255,.06))", color: "var(--rv-muted-2, rgba(255,255,255,.4))", font: "700 11px system-ui", padding: "3px 9px", borderRadius: 20 }}>— flat</span>;
  const up = delta > 0, c = up ? UP : DOWN;
  return <span title="Change in source activity (episodes + X sharers + papers) vs. the prior two weeks" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.fg, font: "700 11px system-ui", padding: "3px 9px", borderRadius: 20 }}>{(up ? "▲ " : "▼ ") + Math.abs(delta)}</span>;
}

// Raised surface: a step lighter than the page, lit top edge, soft drop — the depth system.
export const cardBox: React.CSSProperties = { background: "var(--rv-card, rgba(255,255,255,.065))", border: "1px solid var(--rv-card-line, rgba(255,255,255,.09))", borderRadius: "var(--rv-card-radius, 13px)", padding: 14, marginBottom: 9, boxShadow: "var(--rv-card-shadow, 0 8px 22px rgba(0,0,0,.2))" };
// Story container: everything belonging to one story (headline, stance, metrics, evidence
// peek, expanded drawer) sits inside ONE bounded panel — without it, the peek's "On the
// podcasts" read as a brand-new page section instead of story evidence. A quiet step above
// the page; the evidence cards inside step up again.
const storyCard: React.CSSProperties = { background: "transparent", border: 0, borderBottom: `1px solid ${LINE}`, borderRadius: 0, padding: "0 2px", marginBottom: 0 };
export const evLabel = (accent: string): React.CSSProperties => ({ font: "600 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 11 });
const EDITORIAL_MEASURE = 760;

// The clinician census is the useful paper signal. Peak likes belong to one
// post and are not evidence depth, so they never appear in paper metadata.
export const paperMeta = (shown: number, _likes: number, total?: number | null): string | undefined => {
  const n = Math.max(total ?? 0, shown);
  return n ? `shared by ${n} clinician${n === 1 ? "" : "s"}` : undefined;
};

export function PodCard({ p, accent }: { p: BriefingPod; accent: string }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
        <Coin src={p.showArt} label={p.show} size={34} radius={9} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13.5px/1.35 system-ui", color: "var(--rv-ink, #eef1f8)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.episodeTitle}</div>
          <div style={{ font: "400 11px system-ui", color: MUT, marginTop: 2 }}>{p.show}</div>
        </div>
      </div>
      <p style={{ margin: "11px 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #c8cad2)" }}>{cleanSnippet(p.gloss)}</p>
      {p.audioUrl
        ? <AudioQuote audioUrl={p.audioUrl} startMs={p.startMs} durationSeconds={p.durationSeconds} label="Listen to the clip" accent={accent} tone="dark" />
        : <div style={{ font: "600 11px system-ui", color: accent }}>clip {clipTs(p.startMs)}</div>}
    </div>
  );
}
export function TweetCard({ t, compact = false }: { t: BriefingSharer; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // Translation lane (X-convention disclosure, John 2026-08-18): non-English posts render
  // the stored English translation with "Translated from <Language>" + a toggle back to the
  // original. The ORIGINAL is the receipt of record; the translation is presentation only.
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = !!(t.textEn && t.textEn.trim() && t.textEn.trim() !== (t.text ?? "").trim());
  const langName = (() => {
    if (!hasTranslation) return null;
    try { return new Intl.DisplayNames(["en"], { type: "language" }).of((t.lang ?? "").split("-")[0]) ?? t.lang; }
    catch { return t.lang ?? "another language"; }
  })();
  const text = cleanTweetText(hasTranslation && !showOriginal ? t.textEn! : t.text);
  const thread = (t.thread ?? []).map((part) => ({ ...part, text: cleanTweetText(part.text) })).filter((part) => part.text);
  const canExpand = !compact && (thread.length > 0 || text.length > 320);
  const collapsedText: React.CSSProperties = canExpand && !expanded
    ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 6, overflow: "hidden" }
    : {};
  // Classic retweet: the words below belong to someone else. Credit the amplification on the
  // name line, then set the quote apart so it can never be read as this clinician's own take.
  const rtOf = rtOriginal(t.text);
  const original = rtOf ? t.original : undefined;
  const authorName = original?.name ?? (rtOf ? `@${rtOf}` : t.name);
  const authorHandle = original?.handle ?? (rtOf ? rtOf : t.handle);
  const authorAvatar = original?.avatar ?? (rtOf ? null : t.avatar);
  const body = (<>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Coin src={authorAvatar} label={authorName} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ font: "600 13px system-ui", color: "var(--rv-ink, #eef1f8)" }}>{authorName}</span> {authorHandle && <span style={{ font: "400 11.5px system-ui", color: MUT }}>@{authorHandle.replace(/^@/, "")}</span>}
          {rtOf && <div style={{ font: "400 11.5px system-ui", color: MUT, marginTop: 1 }}>Reposted by <span style={{ color: "var(--rv-muted, rgba(255,255,255,.62))" }}>{t.name}{t.handle ? ` @${t.handle.replace(/^@/, "")}` : ""}</span></div>}
        </div>
        {!rtOf && t.likes > 0 && <span style={{ font: "600 11px system-ui", color: "#e08aa0" }}>♥ {t.likes}</span>}
      </div>
      {text && <p style={{ margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)", overflowWrap: "anywhere", ...collapsedText }}>{text}</p>}
      {!text && thread.length === 0 && <div style={{ marginTop: 6, font: "500 11.5px system-ui", color: MUT }}>Shared this source</div>}
      {hasTranslation && (
        <button type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowOriginal((v) => !v); }}
          style={{ background: "none", border: 0, padding: "6px 0 0", cursor: "pointer", font: "500 11px system-ui", color: MUT, textAlign: "left" }}>
          {showOriginal ? `Show translation (from ${langName})` : `Translated from ${langName} · Show original`}
        </button>
      )}
    </>);
  const postUrl = original?.tweetUrl ?? t.tweetUrl;
  const root = postUrl
    ? <a href={postUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }}>{body}</a>
    : body;
  const reposters = t.repostedBy ?? [];
  const visibleReposters = compact ? reposters.slice(0, 3) : reposters;
  return (
    <div className={compact ? "readout-tweet-preview" : undefined} style={cardBox}>
      {root}
      {expanded && thread.map((part, i) => {
        const continuation = (
          <div style={{ marginTop: 13, paddingLeft: 11, borderLeft: "2px solid var(--rv-line, rgba(255,255,255,.14))" }}>
            <div style={{ marginBottom: 5, font: "600 10.5px system-ui", color: MUT }}>{i + 2} / {thread.length + 1}</div>
            <p style={{ margin: 0, font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)", overflowWrap: "anywhere" }}>{part.text}</p>
          </div>
        );
        return part.tweetUrl
          ? <a key={part.id} href={part.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }}>{continuation}</a>
          : <Fragment key={part.id}>{continuation}</Fragment>;
      })}
      {canExpand && <button type="button" className="rv-text-action" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}
        style={{ cursor: "pointer", minHeight: 44, marginTop: 5, padding: "0 2px", border: 0, background: "transparent", color: "var(--rv-accent)", font: "600 12px system-ui" }}>
        {expanded ? "Show less ↑" : thread.length ? `Show full thread · ${thread.length + 1} posts ↓` : "Show full post ↓"}
      </button>}
      {reposters.length > 0 && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div aria-hidden style={{ display: "flex", alignItems: "center", flex: "none", paddingTop: 1 }}>
            {visibleReposters.slice(0, 4).map((reposter, i) => (
              <Coin key={`${reposter.handle ?? reposter.name}:${i}`} src={reposter.avatar} label={reposter.name} size={16} ring="var(--rv-surface, #fff)" style={{ marginLeft: i ? -6 : 0 }} />
            ))}
          </div>
          <div style={{ minWidth: 0, font: "400 11.5px/1.45 system-ui", color: MUT }}>
            <span style={{ fontWeight: 600, color: "var(--rv-ink-2, #555)" }}>Reposted by </span>
            {visibleReposters.map((reposter, i) => (
              <Fragment key={`${reposter.handle ?? reposter.name}:label:${i}`}>
                {i > 0 ? " · " : ""}
                {reposter.tweetUrl ? <a href={reposter.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{reposter.name}</a> : reposter.name}
              </Fragment>
            ))}
            {compact && reposters.length > visibleReposters.length ? ` · +${reposters.length - visibleReposters.length}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

type BriefingAmplifier = NonNullable<BriefingEpisode["amplifiers"]>[number];

// A podcast's amplification is evidence, not decoration. Quote-posts keep the clinician's
// words; plain reposts render as named actions. Both live behind the same Sources disclosure
// used everywhere else, instead of appearing as an inert byline beside the audio player.
export function AmplifierReceipts({ amplifiers, accent, label = true }: { amplifiers: BriefingAmplifier[]; accent: string; label?: boolean }) {
  const quotes = amplifiers.filter((a) => a.isQuote && a.text);
  const reposts = amplifiers.filter((a) => !(a.isQuote && a.text));
  return (
    <div>
      {label && <div style={evLabel(accent)}>Amplified on X</div>}
      {quotes.map((a, j) => (
        <TweetCard key={`q${j}`} t={{ name: a.name, handle: a.handle, avatar: a.avatar, tweetUrl: a.tweetUrl ?? null, text: a.text, likes: a.likes, retweets: 0, quotes: 0, views: 0 }} />
      ))}
      {reposts.map((a, j) => (
        <div key={`r${j}`} style={{ ...cardBox, boxSizing: "border-box", width: "100%", minWidth: 0, display: "flex", alignItems: "center", gap: 10, font: "400 13px system-ui", color: "var(--rv-copy, #cfd4e0)" }}>
          <Coin src={a.avatar} label={a.name} size={26} />
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {a.tweetUrl ? <a href={a.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--rv-ink, #eef1f8)", fontWeight: 600, textDecoration: "none" }}>{a.name}</a> : <b style={{ color: "var(--rv-ink, #eef1f8)", fontWeight: 600 }}>{a.name}</b>}
            {a.handle ? <> <a href={`https://x.com/${a.handle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none" }}>@{a.handle.replace(/^@/, "")}</a></> : null}
            {" reposted the episode"}
          </span>
        </div>
      ))}
    </div>
  );
}

function AmplifiedAnnouncementReceipt({ amplifier, announcement, accent }: { amplifier: BriefingAmplifier; announcement: BriefingSharer; accent: string }) {
  const amplifierHandle = amplifier.handle?.replace(/^@/, "") ?? null;
  const announcementHandle = announcement.handle?.replace(/^@/, "") ?? null;
  const amplifierText = amplifier.isQuote ? cleanTweetText(amplifier.text) : "";
  const announcementText = cleanTweetText(announcement.text);
  const original = (
    <div style={{ marginTop: amplifierText ? 12 : 9, padding: "11px 0 0 12px", borderTop: "1px solid var(--rv-line, rgba(255,255,255,.12))", borderLeft: `2px solid ${accent}66` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Coin src={announcement.avatar} label={announcement.name} size={26} />
        <div style={{ minWidth: 0, font: "600 12.5px system-ui", color: "var(--rv-ink, #eef1f8)" }}>
          {announcement.name}{announcementHandle ? <span style={{ color: MUT, fontWeight: 400 }}> @{announcementHandle}</span> : null}
        </div>
      </div>
      {announcementText && <p style={{ margin: "8px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)", overflowWrap: "anywhere" }}>{announcementText}</p>}
    </div>
  );
  return (
    <div style={{ ...cardBox, boxSizing: "border-box", width: "100%", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Coin src={amplifier.avatar} label={amplifier.name} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {amplifier.tweetUrl ? <a href={amplifier.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ font: "600 13px system-ui", color: "var(--rv-ink, #eef1f8)", textDecoration: "none" }}>{amplifier.name}</a> : <span style={{ font: "600 13px system-ui", color: "var(--rv-ink, #eef1f8)" }}>{amplifier.name}</span>}
          {amplifierHandle ? <span style={{ font: "400 11.5px system-ui", color: MUT }}> @{amplifierHandle}</span> : null}
          <div style={{ marginTop: 1, font: "400 11.5px system-ui", color: MUT }}>{amplifier.isQuote ? "quoted this post" : "reposted this post"}</div>
        </div>
        {amplifier.isQuote && amplifier.likes > 0 ? <span style={{ font: "600 11px system-ui", color: "#e08aa0" }}>♥ {amplifier.likes}</span> : null}
      </div>
      {amplifierText && (amplifier.tweetUrl ? <a href={amplifier.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)", overflowWrap: "anywhere", textDecoration: "none" }}>{amplifierText}</a> : <p style={{ margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)", overflowWrap: "anywhere" }}>{amplifierText}</p>)}
      {announcement.tweetUrl ? <a href={announcement.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }}>{original}</a> : original}
    </div>
  );
}

export function EpisodeXReceipts({ announcements, amplifiers, accent }: { announcements: BriefingSharer[]; amplifiers: BriefingAmplifier[]; accent: string }) {
  const announcementIdOf = (post: BriefingSharer) => post.tweetUrl?.match(/\/status\/(\d+)/)?.[1] ?? null;
  const paired = amplifiers.map((amplifier) => ({
    amplifier,
    announcement: announcements.find((post) => announcementIdOf(post) === amplifier.announcementId),
  })).filter((pair): pair is { amplifier: BriefingAmplifier; announcement: BriefingSharer } => !!pair.announcement);
  const pairedAmplifiers = new Set(paired.map((pair) => pair.amplifier));
  const pairedAnnouncementIds = new Set(paired.map((pair) => pair.amplifier.announcementId));
  const unpairedAnnouncements = announcements.filter((post) => !pairedAnnouncementIds.has(announcementIdOf(post)));
  const unmatched = amplifiers.filter((amplifier) => !pairedAmplifiers.has(amplifier));
  const quotes = unmatched.filter((a) => a.isQuote && a.text);
  const reposts = unmatched.filter((a) => !(a.isQuote && a.text));
  return (
    <div>
      {paired.length > 0 && <><div style={evLabel(accent)}>Amplified on X</div>{paired.map(({ amplifier, announcement }, index) => (
        <AmplifiedAnnouncementReceipt key={`${amplifier.tweetUrl ?? amplifier.handle ?? amplifier.name}-${index}`} amplifier={amplifier} announcement={announcement} accent={accent} />
      ))}</>}
      {unpairedAnnouncements.length > 0 && <><div style={evLabel(accent)}>From the show on X</div>{unpairedAnnouncements.map((post, index) => (
        <TweetCard key={post.tweetUrl ?? index} t={post} />
      ))}</>}
      {quotes.length > 0 && <><div style={evLabel(accent)}>Clinician commentary</div>{quotes.map((a, j) => (
        <TweetCard key={`q${j}`} t={{ name: a.name, handle: a.handle, avatar: a.avatar, tweetUrl: a.tweetUrl ?? null, text: a.text, likes: a.likes, retweets: 0, quotes: 0, views: 0 }} />
      ))}</>}
      {reposts.length > 0 && <AmplifierReceipts amplifiers={reposts} accent={accent} />}
    </div>
  );
}
// Abstract and source receipts disclose independently, matching the main paper rail
// and native. The source link remains a separate direct action.
export function PaperCard({ title, journal, domain, meta, url, abstract, posts, accent, peerReviewed }: { title: string; journal: string | null; domain?: string | null; meta?: string; url?: string; abstract?: string | null; posts?: BriefingSharer[]; accent?: string; sharedTotal?: number | null; peerReviewed?: boolean }) {
  const [abstractOpen, setAbstractOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const hasAbs = !!(abstract && abstract.trim());
  const hasPosts = !!(posts && posts.length);
  const src = articleSource(journal, domain);
  const isNews = isNewsItem({ peerReviewed, journal, domain });
  return (
    <div style={cardBox}>
      {url
        ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "var(--rv-ink, #eef1f8)", textDecoration: "none" }}>{cleanArticleTitle(title)}</a>
        : <div style={{ font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "var(--rv-ink, #eef1f8)" }}>{cleanArticleTitle(title)}</div>}
      {(src || meta) && <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 7 }}>
        <span style={{ font: "400 12px system-ui", color: MUT }}>{[src, meta].filter(Boolean).join(" · ")}</span>
        {isNews && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "var(--rv-muted, rgba(255,255,255,.55))", background: "var(--rv-surface, rgba(255,255,255,.07))", border: "1px solid var(--rv-line, rgba(255,255,255,.13))", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
      </div>}
      {abstractOpen && hasAbs && <p style={{ margin: "11px 0 0", font: "400 13.5px/1.55 'Newsreader',Georgia,serif", color: "var(--rv-copy, #c3c6d0)" }}>{abstract}</p>}
      {sourcesOpen && hasPosts && <div style={{ marginTop: 12 }}>
        <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent ?? "var(--rv-muted, #9aa0ac)", marginBottom: 9 }}>
          On X · verified clinicians
        </div>
        {posts!.map((t, i) => <div key={i} style={{ marginTop: i ? 8 : 0 }}><TweetCard t={t} /></div>)}
      </div>}
      <div style={{ display: "flex", gap: 16, marginTop: 5, alignItems: "center" }}>
        {hasAbs && <button type="button" aria-expanded={abstractOpen} onClick={() => setAbstractOpen((o) => !o)} className="rv-text-action" style={{ minHeight: 44, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12px system-ui", color: accent ?? "var(--rv-muted, #9aa0ac)" }}>{abstractOpen ? "Hide abstract ↑" : "Abstract ↓"}</button>}
        {hasPosts && <button type="button" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((o) => !o)} className="rv-text-action" style={{ minHeight: 44, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12px system-ui", color: accent ?? "var(--rv-muted, #9aa0ac)" }}>{sourcesOpen ? "Hide sources ↑" : "Sources ↓"}</button>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", font: "600 12px system-ui", color: "var(--rv-muted, rgba(255,255,255,.55))", textDecoration: "none" }}>Open ↗</a>}
      </div>
    </div>
  );
}

// The expandable row. A real button now (keyboard + AT reach the evidence too), with the
// hover-lift surface from the .rv-row class; the click target is unchanged — the whole head.
// Evidence drawer: lazy (children mount only while open, keeping the content-heavy page light) and
// eased in with a pure-CSS fade + short slide on mount (see .rv-drawer). Deliberately NOT a
// height-unfurl — animating grid-template-rows/max-height is fragile and risks clipping the
// evidence to 0 if the animation is throttled; opacity/transform are universally safe and the
// content renders at its natural height immediately, so visibility never depends on JS.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="rv-drawer">{children}</div>;
}

export function Row({ open, onToggle, accent, head, children, landOffset = 70, variant = "surface" }: { open: boolean; onToggle: () => void; accent: string; head: React.ReactNode; children: React.ReactNode; landOffset?: number; variant?: "surface" | "list" }) {
  const headRef = useRef<HTMLDivElement>(null);
  // Single-open accordion: opening a row BELOW an already-open one collapses that one and yanks the
  // clicked row upward off the cursor. Capture the head's viewport position, commit the toggle
  // SYNCHRONOUSLY (flushSync — so the DOM/layout is updated before the browser paints; an rAF here
  // is unreliable when throttled), then scroll by the delta so the clicked row stays visually put.
  const activate = () => {
    const el = headRef.current;
    if (!el) { onToggle(); return; }
    const before = el.getBoundingClientRect().top;
    flushSync(() => onToggle());
    const d = el.getBoundingClientRect().top - before;
    if (Math.abs(d) > 1) window.scrollBy(0, d);
  };
  // Collapsing from the BOTTOM of a long drawer: after the content above the viewport vanishes,
  // a raw toggle would strand the reader far below the card. Commit the collapse synchronously,
  // then jump back to the card's head (just under the sticky pill bar) so you land on the story
  // you were reading.
  const hideFromBottom = () => {
    flushSync(() => onToggle());
    const el = headRef.current;
    if (!el) return;
    // landOffset defaults to this page's single-row sticky bar; the All page's compact
    // TWO-row bar (~90px) passes a taller value so the landed head isn't hidden under it
    const y = el.getBoundingClientRect().top + window.scrollY - landOffset;
    window.scrollTo(0, Math.max(0, y));
    // This button unmounts itself, which drops focus to <body> — a keyboard reader would restart
    // from the top of the document. Hand focus back to the row we just landed on.
    el.focus({ preventScroll: true });
  };
  return (
    <div className={variant === "list" ? "rv-list-row" : undefined}>
      <div
        ref={headRef}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        data-brief-event="source_open"
        data-brief-open={open}
        data-brief-target={variant}
        className="rv-row"
        onClick={activate}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
        style={variant === "list"
          ? { cursor: "pointer", margin: 0, padding: 0, borderRadius: 0 }
          : { cursor: "pointer", margin: "0 -12px", padding: "0 12px", borderRadius: 14 }}
      >{head}</div>
      <Collapse open={open}>
        <div style={{ margin: "6px 0 24px 0", display: "flex", flexDirection: "column", gap: 18 }}>
          {children}
          {/* every drawer collapses from the bottom, and lands you back on the card */}
          <button type="button" onClick={hideFromBottom} className="rv-text-action" style={{ alignSelf: "flex-start", background: "none", border: 0, color: accent, font: "600 12.5px system-ui", padding: "10px 2px", minHeight: 44, cursor: "pointer", marginTop: 2 }}>Hide sources ↑</button>
        </div>
      </Collapse>
    </div>
  );
}

// Long list sections (Most active on X, What's being read, …) show the top `cap` and tuck the
// rest behind a "Show N more" toggle so the desktop column doesn't scroll forever. Short lists
// (≤ cap) render in full with no button. Slicing from 0 keeps item indices stable when expanded.
function Capped<T>({ items, cap, accent, render }: { items: T[]; cap: number; accent: string; render: (item: T, i: number) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, cap);
  const extra = items.length - cap;
  return (
    <>
      {shown.map(render)}
      {extra > 0 && (
        <div style={{ marginTop: 8, marginBottom: 12 }}>
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-brief-event="show_more" data-brief-open={open} className="rv-text-action" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, background: "none", border: 0, color: accent, font: "600 12.5px system-ui", padding: "0 2px", cursor: "pointer" }}>
            {open ? "Show less ↑" : `Show ${extra} more ↓`}
          </button>
        </div>
      )}
    </>
  );
}

// ── Progressive evidence disclosure ─────────────────────────────────────────────────────────
// ONE shared block for the story drawer, the All-oncology page, and the Drugs board drawer, so
// they never drift. A deep-dive week used to render every clip/post/paper at full height — a
// 2,500px receipt wall past the collapse control, with the same episode repeated many times.
// Now: podcast clips GROUP by episode (lead clip of the first two episodes; "more moments" reveals
// repeat clips of ONE episode; "more episodes" reveals the rest), and X posts / papers cap at 3 / 2
// behind "show more". Order is the producer's array order (podcast[0] is the lead) — NO re-scoring.
// Every receipt is preserved: PodCard/TweetCard/PaperCard are reused verbatim. Every show-more
// control carries aria-expanded + an accurate label + aria-controls (the a11y gap on the old flat
// list was that there were no controls at all).
const moreBtn = (accent: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", minHeight: 44, background: "none", border: 0, color: accent, font: "600 12.5px system-ui", padding: "0 2px", cursor: "pointer" });

// Group clips by episode, preserving first-seen (= strength) order. A missing episodeId falls back
// to a stable audio/title key; a clip with none of those gets a UNIQUE key so unattributed clips
// are never silently merged into one "episode".
function groupPods(pods: BriefingPod[]): BriefingPod[][] {
  const order: string[] = [];
  const byKey = new Map<string, BriefingPod[]>();
  pods.forEach((p, i) => {
    const key = p.episodeId || p.audioUrl || p.episodeTitle || `__clip${i}`;
    let g = byKey.get(key);
    if (!g) { g = []; byKey.set(key, g); order.push(key); }
    g.push(p);
  });
  return order.map((k) => byKey.get(k)!);
}

// One episode: its lead clip always shows; repeat "moments" from the same episode tuck behind a
// per-episode toggle. The revealed region carries the aria-controls id (empty when collapsed).
function EpisodeClips({ clips, accent }: { clips: BriefingPod[]; accent: string }) {
  const [open, setOpen] = useState(false);
  const rid = useId();
  const extra = clips.length - 1;
  return (
    <>
      <PodCard p={clips[0]} accent={accent} />
      {extra > 0 && <>
        <div id={rid}>{open && clips.slice(1).map((p, j) => <PodCard key={j} p={p} accent={accent} />)}</div>
        <button type="button" aria-expanded={open} aria-controls={rid} onClick={() => setOpen((o) => !o)} className="rv-text-action"
          style={{ ...moreBtn(accent), padding: "5px 14px", font: "600 11.5px system-ui", margin: "0 0 12px" }}>
          {open ? "Fewer moments ↑" : `${extra} more moment${extra === 1 ? "" : "s"} from this episode ↓`}
        </button>
      </>}
    </>
  );
}

// Podcast evidence: the first two episodes' lead clips show; "more episodes" reveals the rest.
function PodcastEvidence({ pods, accent }: { pods: BriefingPod[]; accent: string }) {
  const [open, setOpen] = useState(false);
  const rid = useId();
  const groups = groupPods(pods);
  const EP_CAP = 2;
  const extra = groups.length - EP_CAP;
  return (
    <>
      {groups.slice(0, EP_CAP).map((clips, gi) => <EpisodeClips key={gi} clips={clips} accent={accent} />)}
      {extra > 0 && <>
        <div id={rid}>{open && groups.slice(EP_CAP).map((clips, gi) => <EpisodeClips key={gi} clips={clips} accent={accent} />)}</div>
        <div style={{ marginTop: 4 }}>
          <button type="button" aria-expanded={open} aria-controls={rid} onClick={() => setOpen((o) => !o)} className="rv-text-action" style={moreBtn(accent)}>
            {open ? "Show fewer episodes ↑" : `Show ${extra} more episode${extra === 1 ? "" : "s"} ↓`}
          </button>
        </div>
      </>}
    </>
  );
}

// The three evidence blocks with progressive disclosure — used by every drawer that shows story /
// mover evidence. `story` is a BriefingStory or a drug mover; both carry podcast/posts/papers, and
// the paper-total formula falls back to sharerCount for movers (no kind:"paper"). `paperLabel` is
// passed by the caller so each surface keeps its exact heading ("The paper" vs "Papers shared").
type EvSource = EvidenceSource;
type EvidenceSource = { podcast: BriefingPod[]; posts: BriefingSharer[]; papers: BriefingPaper[]; kind?: string; clinicianCount?: number | null; publisherPosts?: BriefingSharer[]; otherPosts?: BriefingSharer[]; supportLinks?: HeroSupportLink[] };

const supportRelationship = (relationship: string) => ({
  interviews_author: "Author interview",
  interviews_investigator: "Investigator interview",
  covers_approval: "Approval coverage",
  discusses_publication: "Publication discussion",
  discusses_trial: "Trial discussion",
  reports_results: "Results coverage",
  clinician_shared: "Shared source",
}[relationship] ?? "Related coverage");

function SupportLinkRow({ link, accent }: { link: HeroSupportLink; accent: string }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "10px 2px", borderBottom: `1px solid ${LINE}`, color: "inherit", textDecoration: "none" }}>
      <div style={{ font: "600 11px/1.35 system-ui", color: accent }}>{link.sourceLabel} · {supportRelationship(link.relationshipType)}</div>
      <div style={{ marginTop: 3, font: "500 14px/1.4 system-ui", color: "var(--rv-ink, #f4f7ff)" }}>{link.title} <span aria-hidden>↗</span></div>
    </a>
  );
}

export function StoryEvidence({ story, accent, paperLabel }: { story: EvidenceSource; accent: string; paperLabel: string }) {
  const publisherPosts = story.publisherPosts ?? story.papers.flatMap((x) => x.publisherPosts ?? []);
  const otherPosts = story.otherPosts ?? story.papers.flatMap((x) => x.otherPosts ?? []);
  const supportLinks = story.supportLinks ?? [];
  const sourceGroupEnd: React.CSSProperties = { borderBottom: `1px solid ${LINE}`, paddingBottom: 16, marginBottom: 16 };
  return (
    <>
      {story.podcast.length > 0 && <div><div style={evLabel(accent)}>On the podcasts</div><PodcastEvidence pods={story.podcast} accent={accent} /></div>}
      {story.posts.length > 0 && <div style={(publisherPosts.length === 0 && otherPosts.length === 0 && (supportLinks.length > 0 || story.papers.length > 0)) ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>On X · verified clinicians</div><Capped items={story.posts} cap={3} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>}
      {publisherPosts.length > 0 && (
        <div style={(otherPosts.length === 0 && (supportLinks.length > 0 || story.papers.length > 0)) ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>From publishers &amp; journals</div><Capped items={publisherPosts} cap={2} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>
      )}
      {otherPosts.length > 0 && <div style={(supportLinks.length > 0 || story.papers.length > 0) ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>Additional posts on X</div><Capped items={otherPosts} cap={2} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>}
      {supportLinks.length > 0 && <div style={story.papers.length > 0 ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>Related coverage</div><Capped items={supportLinks} cap={4} accent={accent} render={(link, j) => <SupportLinkRow key={`${link.kind}:${link.id}:${j}`} link={link} accent={accent} />} /></div>}
      {story.papers.length > 0 && <div><div style={evLabel(accent)}>{paperLabel}</div>{(() => { const pubs = [...new Set(story.papers.flatMap((pp) => pp.publishers ?? []))]; const havePosts = publisherPosts.length > 0; return pubs.length && !havePosts ? <div style={{ font: "400 12px system-ui", color: "var(--rv-muted, rgba(233,237,246,.55))", margin: "2px 0 8px" }}>Also shared by: {pubs.join(" · ")}</div> : null; })()}<Capped items={story.papers} cap={2} accent={accent} render={(p, j) => {
        const total = (story.kind === "paper" && j === 0 ? story.clinicianCount : undefined) ?? p.sharerCount;
        return <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} peerReviewed={p.peerReviewed} meta={paperMeta(p.sharers.length || p.posts?.length || 0, p.topLikes || 0, total)} url={p.url} abstract={p.abstract} posts={p.posts?.length ? p.posts : p.sharers} accent={accent} sharedTotal={total} />;
      }} /></div>}
    </>
  );
}

// Overlapping avatars of the clinicians who shared an article (the "who's reading this" face-pile,
// mirrors the pharma dashboard). `ring` = page bg so the overlap reads as clean separated coins.
// Accepts labeled faces (initials fallback) or plain URL strings from older payload fields.
export function FacePile({ faces, extra, ring }: { faces: (Face | string)[]; extra: number; ring: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flex: "none" }}>
      {faces.slice(0, 4).map((raw, i) => {
        const f: Face = typeof raw === "string" ? { src: raw } : raw;
        return <Coin key={i} src={f.src} label={f.label} size={22} ring={ring} style={{ marginLeft: i ? -8 : 0 }} />;
      })}
      {extra > 0 && (
        <div style={{ height: 26, minWidth: 26, padding: "0 6px", boxSizing: "border-box", borderRadius: 13, border: `2px solid ${ring}`, background: "var(--rv-surface, rgba(255,255,255,.1))", marginLeft: -8, display: "flex", alignItems: "center", justifyContent: "center", font: "600 10px system-ui", color: "var(--rv-ink-2, rgba(255,255,255,.72))", flex: "none" }}>+{extra}</div>
      )}
    </div>
  );
}

export function PaperShareRow({ paper, id, open, onToggle, accent, ring, featured, contextLabel }: { paper: BriefingArticle; id: string; open: boolean; onToggle: () => void; accent: string; ring: string; featured: boolean; contextLabel?: string }) {
  const [abstractOpen, setAbstractOpen] = useState(false);
  const abstract = paper.abstract?.replace(/\s+/g, " ").trim() || null;
  const sourceId = `paper-source-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const abstractId = `paper-abstract-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const hasPublisherPosts = !!paper.publisherPosts?.length;
  const hasOtherPosts = !!paper.otherPosts?.length;
  const hasPublisherNames = paper.publishers.length > 0;
  const hasSources = paper.posts.length > 0 || hasPublisherPosts || hasOtherPosts || hasPublisherNames || !!paper.url;
  const source = articleSource(paper.journal, paper.domain);

  return (
    <div className="rv-list-row">
      <div className="rv-paper-share" style={{ padding: "16px 2px" }}>
        {(contextLabel || source || isNewsItem(paper)) && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 7 }}>
            {contextLabel && <span style={{ font: "700 8px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: accent, background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 4, padding: "3px 6px", flex: "none" }}>{contextLabel}</span>}
            {source && <span style={{ font: "600 14px system-ui", color: MUT }}>{source}</span>}
            {isNewsItem(paper) && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "var(--rv-muted, rgba(255,255,255,.55))", background: "var(--rv-surface, rgba(255,255,255,.07))", border: "1px solid var(--rv-line, rgba(255,255,255,.13))", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
          </div>
        )}
        <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", font: "500 17px/1.4 'Newsreader',Georgia,serif", color: "var(--rv-ink, #f4f7ff)", textDecoration: "none" }}>{cleanArticleTitle(paper.title)}</a>
        <div className="rv-paper-meta" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 10px", marginTop: 9 }}>
          {paper.faces.length > 0 && <FacePile faces={paper.faces} extra={paper.kolSharers - paper.faces.length} ring={ring} />}
          {paper.kolSharers > 0 && <span style={{ font: "400 12px system-ui", color: MUT }}>shared by {paper.kolSharers} clinician{paper.kolSharers === 1 ? "" : "s"}</span>}
        </div>
        <div className="rv-paper-actions" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0 14px", marginTop: 5 }}>
          {featured && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".07em", textTransform: "uppercase", color: accent, background: `${accent}17`, border: `1px solid ${accent}59`, borderRadius: 5, padding: "1.5px 6px" }}>Also in Top Stories</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 14, minHeight: 44, marginLeft: "auto" }}>
            {abstract && (
              <button type="button" aria-expanded={abstractOpen} aria-controls={abstractId} onClick={() => setAbstractOpen((o) => !o)} className="rv-text-action"
                style={{ background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12.5px system-ui", color: accent, whiteSpace: "nowrap" }}>
                {abstractOpen ? "Hide abstract ↑" : "Abstract ↓"}
              </button>
            )}
            {hasSources && (
              <button type="button" aria-expanded={open} aria-controls={sourceId} onClick={onToggle} data-brief-event="source_open" data-brief-open={open} data-brief-target="list" className="rv-text-action"
                style={{ background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12.5px system-ui", color: accent, whiteSpace: "nowrap" }}>
                {open ? "Hide sources ↑" : "See all sources ↓"}
              </button>
            )}
          </span>
        </div>
        {abstractOpen && abstract && <p id={abstractId} style={{ margin: "3px 0 0", maxWidth: 740, font: "400 15px/1.6 'Newsreader',Georgia,serif", color: "var(--rv-copy, #b7bac3)" }}>{abstract}</p>}
      </div>
      {open && (
        <div id={sourceId} className="rv-drawer">
          <div style={{ margin: "6px 0 24px 0", display: "flex", flexDirection: "column", gap: 18 }}>
            {paper.posts.length > 0 && <div><div style={evLabel(accent)}>On X · verified clinicians</div>{paper.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
            {hasPublisherPosts && <div><div style={evLabel(accent)}>From publishers &amp; journals</div><Capped items={paper.publisherPosts!} cap={2} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>}
            {hasOtherPosts && <div><div style={evLabel(accent)}>Additional posts on X</div><Capped items={paper.otherPosts!} cap={2} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>}
            {hasPublisherNames && !hasPublisherPosts && <div><div style={evLabel(accent)}>From publishers &amp; journals</div><div style={{ font: "400 12px system-ui", color: "var(--rv-muted, rgba(233,237,246,.55))" }}>Shared by: {paper.publishers.join(" · ")}</div></div>}
            {paper.url && <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", font: "600 13px system-ui", color: accent, textDecoration: "none" }}>Open article ↗</a>}
            <button type="button" onClick={onToggle} className="rv-text-action" style={{ alignSelf: "flex-start", background: "none", border: 0, color: accent, font: "600 12.5px system-ui", padding: "10px 2px", minHeight: 44, cursor: "pointer", marginTop: 2 }}>Hide sources ↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReaderView({ data: rawData, area, areas, onArea, seen, compact = false, primary, onSetPrimary, daily }: { data: BriefingData; area: string; areas: string[]; onArea: (a: string) => void; seen?: Record<string, string>; compact?: boolean; primary?: string | null; onSetPrimary?: (a: string) => void; daily?: import("@/lib/types").DailyReadout | null }) {
  // One publication canvas across every edition; area color is an interaction accent.
  const darkPal = inkOf(area);
  const pal = { bg: PAPER, accent: READER_ACCENTS[area] ?? darkPal.accent };
  const [openId, setOpenId] = useState<string | null>(null);
  // Sub-tumor (indication) filter — GU → Prostate/Bladder/Kidney. `data` is the sub-filtered view
  // every section reads from; the switcher options come from the UNfiltered catalog (rawData.subAreas).
  // Reset the pick whenever the tumor area changes (a stale "Prostate" makes no sense in Breast).
  const [subArea, setSubArea] = useState<string | null>(null);
  // Congress Mode: "Live coverage" scopes the whole brief to congress-tagged items. Default ON only
  // while the congress is actually live AND there's tagged content to show — otherwise the weekly
  // brief leads and the bar is an invitation.
  const cong = rawData.congress;
  const cState = cong ? congressState(cong) : null;
  const defaultCongressOn = (c?: BriefingData["congress"]) => {
    if (!c) return false; const st = congressState(c); return st.phase === "live" && c.taggedStories > 0;
  };
  const [congressOn, setCongressOn] = useState<boolean>(() => defaultCongressOn(rawData.congress));
  // Reset the Focus pick, the congress scope, AND any open drawer on an area switch. openId matters
  // because rail rows (KOLs/papers/trials/guests) are index-keyed, so on a cached switch (ReaderView
  // stays mounted) a stale openId would render a DIFFERENT item's drawer open in the new area.
  useEffect(() => { setSubArea(null); setOpenId(null); setCongressOn(defaultCongressOn(rawData.congress)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [area]);
  const subAreaOpts = rawData.subAreas ?? [];
  // Guard against a stale pick: the useEffect reset runs AFTER render, so on an area switch there's
  // one render where `subArea` (e.g. "prostate") no longer belongs to the new area's catalog. Deriving
  // `activeSub` — the pick ONLY if the current catalog still has it — makes filtering correct on that
  // very render (an area like Breast with no taxonomy filters by null = shows everything, no blank flash).
  const activeSub = subArea && subAreaOpts.some((s) => s.key === subArea) ? subArea : null;
  // If the congress is gone for this area (area switch), never leave the scope stuck on.
  const congressScope = congressOn && !!cong;
  const data = useMemo(() => filterBrief(rawData, activeSub, congressScope), [rawData, activeSub, congressScope]);
  const subLabel = activeSub ? (subAreaOpts.find((s) => s.key === activeSub)?.label ?? activeSub) : null;
  const [shareMsg, setShareMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false); // masthead area/tumor switcher (mobile parity)
  // On a phone, seven full Top Stories put "This week on the podcasts" ~3,000px down — the podcast
  // archive is the most differentiated asset and nobody scrolled to it. Show the first few and tuck
  // the rest (which, in split mode, are the already-read ones) behind an explicit control.
  const [showAllStories, setShowAllStories] = useState(false);
  // Two-track layout kicks in on real desktop width (never on the compact/mobile pass).
  const [wide, setWide] = useState<boolean>(() => typeof window !== "undefined" && !compact && window.matchMedia("(min-width: 1180px)").matches);
  useEffect(() => {
    if (compact) { setWide(false); return; }
    const mq = window.matchMedia("(min-width: 1180px)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, [compact]);
  // Keep the document canvas the same color as the page so load-in and overscroll bounce
  // never flash the classic design's cream (globals.css paints --paper for ?design=classic).
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.backgroundColor;
    const previousBody = body.style.backgroundColor;
    root.style.backgroundColor = pal.bg;
    body.style.backgroundColor = pal.bg;
    return () => {
      root.style.backgroundColor = previousRoot;
      body.style.backgroundColor = previousBody;
    };
  }, [pal.bg]);
  const doShare = async () => {
    try {
      const r = await fetch("/api/brief-share", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok || !j.url) { setShareMsg("Couldn't create a link"); setTimeout(() => setShareMsg(""), 3000); return; }
      const nav = navigator as any;
      // Carry the CURRENT area on the invite link so a colleague opens the SAME edition the sharer
      // was reading (a breast-onc sharing the breast brief shouldn't land them on GU). /i/[code]
      // reads ?area and redirects into it.
      const url = area ? `${j.url}?area=${encodeURIComponent(area)}` : j.url;
      // URL only — iMessage/Mail build a rich card from OG tags; adding text/title posts a second
      // plain bubble on top (ugly). URL alone = just the card.
      if (nav.share) { try { await nav.share({ url }); return; } catch (e: any) { if (e?.name === "AbortError") return; } }
      let copied = false;
      try { await navigator.clipboard.writeText(url); copied = true; } catch { /* activation lost */ }
      setShareMsg(copied ? "Link copied — send it to a colleague" : url);
      setTimeout(() => setShareMsg(""), copied ? 2800 : 6000);
    } catch { setShareMsg("Couldn't create a link"); setTimeout(() => setShareMsg(""), 3000); }
  };
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  // Tumor-area / "edition" switcher — one menu, two homes. The trigger is an
  // editorial text tab rather than a capsule; its invisible pseudo-element keeps
  // the platform-sized tap target without adding visual bulk.
  const areaSwitcher = (variant: "chip" | "plain", menuSide: "left" | "right" = "left") => {
    const chip = variant === "chip";
    return (
      <div style={{ position: "relative", flex: "none" }}>
        <div role="button" tabIndex={0} aria-expanded={menuOpen} aria-label="Switch tumor area"
          onClick={() => setMenuOpen((o) => !o)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMenuOpen((o) => !o); } }}
          className={chip ? "rv-edition" : undefined}
          // .rv-edition::after carries the 44px hit area; color and the larger
          // chevron communicate interactivity without a capsule or hanging rule.
          style={chip
            ? { display: "inline-flex", alignItems: "center", gap: 9, padding: "4px 0", cursor: "pointer", background: "transparent", border: 0, borderRadius: 0, boxSizing: "border-box" }
            : { display: "flex", alignItems: "center", gap: 9, padding: "4px 0", cursor: "pointer" }}>
          <span style={{ font: chip ? "700 13px system-ui" : "600 14px system-ui", color: pal.accent, whiteSpace: "nowrap" }}>{AREA_FULL[area] ?? area}</span>
          <span aria-hidden style={{ width: 10, height: 10, borderRight: `2px solid ${chip ? pal.accent : "var(--rv-ink-2, rgba(255,255,255,.72))"}`, borderBottom: `2px solid ${chip ? pal.accent : "var(--rv-ink-2, rgba(255,255,255,.72))"}`, transform: menuOpen ? "translateY(3px) rotate(225deg)" : "translateY(-2px) rotate(45deg)", transition: "transform .18s ease", flex: "none", boxSizing: "border-box" }} />
        </div>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
            <div style={{ position: "absolute", top: "calc(100% + 7px)", ...(menuSide === "right" ? { right: 0 } : { left: 0 }), width: 210, background: "rgba(255,255,255,.98)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${LINE}`, borderRadius: 6, boxShadow: "0 16px 36px rgba(31,35,42,.14)", padding: 8, zIndex: 31 }}>
              <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--rv-muted-2, rgba(255,255,255,.4))", padding: "6px 11px 8px" }}>Tumor area</div>
              {areas.map((a) => {
                const on = a === area;
                const isHome = a === primary;
                return (
                  <button key={a} type="button" role="menuitem" aria-current={on} onClick={() => { setMenuOpen(false); if (a !== area) onArea(a); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: on ? "var(--rv-surface, rgba(255,255,255,.1))" : "transparent", border: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: palOf(a).accent, flex: "none" }} />
                    <span style={{ flex: 1, font: "600 13.5px system-ui", color: on ? pal.accent : INK_2 }}>{AREA_FULL[a] ?? a}</span>
                    {/* a filled home glyph marks the saved default, so switching to browse another
                        area is visibly distinct from your home — and you can see what you'll land on next visit */}
                    {isHome && <span title="Your default" aria-label="Your default" style={{ color: "var(--rv-muted-2, rgba(255,255,255,.5))", font: "700 12px system-ui" }}>⌂</span>}
                    {on && <span style={{ color: pal.accent, font: "700 13px system-ui" }}>✓</span>}
                  </button>
                );
              })}
              {/* Setting a default is a DELIBERATE act — browsing to another specialty never changes
                  it. Only shown when you're viewing an area that isn't already your home. */}
              {onSetPrimary && area !== primary && (
                <>
                  <div style={{ height: 1, background: "var(--rv-line, rgba(255,255,255,.08))", margin: "6px 4px" }} />
                  <button type="button" onClick={() => { onSetPrimary(area); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: "transparent", border: 0, color: pal.accent, font: "600 12.5px system-ui" }}>
                    <span aria-hidden style={{ font: "700 13px system-ui" }}>⌂</span>
                    Make {AREA_FULL[area] ?? area} my default
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };
  const focusSwitcher = (mobile: boolean) => {
    if (subAreaOpts.length < 2) return null;
    return (
      <div className={`rv-pills${mobile ? " rv-fade" : ""}`} style={{ display: "flex", alignItems: "center", gap: mobile ? 18 : 16, flexWrap: mobile ? "nowrap" : "wrap", overflowX: mobile ? "auto" : "visible", margin: mobile ? "10px -20px 0" : 0, padding: mobile ? "0 20px" : 0, minWidth: 0 }}>
        <span style={{ font: "600 9.5px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: MUT2, alignSelf: "center", marginRight: mobile ? -4 : -2, flex: "none" }}>Focus</span>
        {[{ key: null as string | null, label: "All" }, ...subAreaOpts.map((s) => ({ key: s.key as string | null, label: s.label }))].map((c) => {
          const on = subArea === c.key;
          return (
            <button key={c.label} type="button" className="rv-focus-chip" aria-pressed={on} onClick={() => { setSubArea(c.key); setOpenId(null); }}
              style={{ cursor: "pointer", font: `${on ? "700" : "600"} 12px system-ui`, padding: "8px 1px 9px", borderRadius: 0, border: 0, borderBottom: `2px solid ${on ? pal.accent : "transparent"}`, background: "transparent", color: on ? INK : MUT, whiteSpace: "nowrap", flex: "none", transition: "border-color .15s, color .15s", display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
              {c.label}
            </button>
          );
        })}
      </div>
    );
  };
  // sticky section nav — jump-links + scroll-spy. On the wide layout the rail sections
  // (guests/KOLs, trials) live beside the column, so their pills drop out of the nav.
  const carriedKols = [...data.topKols]
    .filter((k) => (k.amp ?? 0) > 0)
    .sort((a, b) => (b.amp ?? 0) - (a.amp ?? 0) || b.tweets - a.tweets || b.peakLikes - a.peakLikes);
  const sections = [
    { id: "sec-top", label: "Top Stories", on: true },
    { id: "sec-episodes", label: "Episodes", on: !!data.episodes?.some((e) => e.audioUrl) },
    { id: "sec-papers", label: "Papers", on: data.topArticles.length > 0 },
    { id: "sec-trials", label: "Trials", on: data.trials.length > 0 },
    { id: "sec-kols", label: "People", on: !!(data.guests?.length || carriedKols.length) },
    { id: "sec-drugs", label: "Drugs", on: data.movers.length > 0 },
  ].filter((s) => s.on);
  const [activeSec, setActiveSec] = useState<string>("sec-top");
  // A jump-click PINS its section active, even when two targets share a vertical position: on wide,
  // sec-top and sec-kols both sit at their column tops, so a pure position spy ties to Top Stories
  // and the clicked KOLs pill never lights. The pin is released on the reader's next genuine scroll.
  const pinnedSecRef = useRef<string | null>(null);
  // The jump-link bar stays transparent at rest and gains ink-glass chrome only once it sticks.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    // On the wide layout the KOL/Trials sections live in the right rail; their pills now stay in
    // the nav (jump + active-state), so the scroll-spy tracks every section on both layouts.
    const ids = ["sec-top", "sec-kols", "sec-episodes", "sec-papers", "sec-trials", "sec-drugs"];
    let raf = 0;
    const check = () => {
      setStuck(window.scrollY > 120);
      // A pinned section (just clicked) wins until the reader scrolls — resolves the shared-position
      // tie the position spy alone cannot (sec-top vs sec-kols on wide).
      if (pinnedSecRef.current) { setActiveSec(pinnedSecRef.current); return; }
      // Pick the header most-recently scrolled PAST (greatest top still ≤ threshold), not the last
      // in array order — so the two-column wide layout (long editorial column + short right rail)
      // can't mark a rail section active while the reader is mid-column.
      let cur = "", curTop = -Infinity;
      for (const id of ids) { const el = document.getElementById(id); if (!el) continue; const top = el.getBoundingClientRect().top; if (top <= 90 && top > curTop) { curTop = top; cur = id; } }
      setActiveSec(cur || ids.find((id) => document.getElementById(id)) || "sec-top");
    };
    // Genuine reader scroll (wheel / touch-drag) releases the jump pin. The programmatic glide uses
    // window.scrollTo — which fires "scroll" but never wheel/touchmove — so the pin survives it.
    const releasePin = () => { pinnedSecRef.current = null; };
    check();
    // `stuck` gates the bar's opaque backing — set it synchronously so a throttled rAF can never
    // leave a transparent bar with page text scrolling through it. The spy stays deferred.
    const onScroll = () => {
      setStuck(window.scrollY > 120);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", releasePin, { passive: true });
    window.addEventListener("touchmove", releasePin, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("wheel", releasePin); window.removeEventListener("touchmove", releasePin); if (raf) cancelAnimationFrame(raf); };
  }, [area, wide, subArea]);
  // Jump-link scroll: rAF glide instead of native scrollIntoView({smooth}) — iOS janks on
  // long smooth scrolls, and lazy-loading avatars/show-art ABOVE the target shift the layout
  // mid-flight so the native scroll re-targets with a visible lurch. Fixed duration (long
  // jumps glide, short ones feel instant), ease-in-out, target re-measured EVERY frame so
  // layout shifts are absorbed smoothly, and any reader wheel/touch cancels the glide.
  const goSec = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    pinnedSecRef.current = id; // pin the clicked section active (survives the glide; released on scroll)
    setActiveSec(id);          // instant feedback — the pill lights the moment it's tapped
    logSignal("section_jump", area, null, { section: id.replace(/^sec-/, "") });
    const offset = compact ? 74 : 62; // clear the sticky pill bar (taller on mobile — 44px pills)
    const targetNow = () => el.getBoundingClientRect().top + window.scrollY - offset;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, targetNow()); return; }
    const start = window.scrollY;
    const t0 = performance.now();
    const D = 520;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf = 0;
    const cancel = () => { cancelAnimationFrame(raf); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); };
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      window.scrollTo(0, start + (targetNow() - start) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else cancel();
    };
    raf = requestAnimationFrame(step);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
  };
  const sectionControls = (mobile: boolean) => sections.map((s) => {
    const on = activeSec === s.id;
    return <button key={s.id} aria-current={on ? "page" : undefined} onClick={() => goSec(s.id)} style={{ cursor: "pointer", font: "650 13px system-ui", letterSpacing: 0, padding: mobile ? "8px 3px 10px" : "8px 2px 10px", borderRadius: 0, border: 0, borderBottom: `2px solid ${on ? pal.accent : "transparent"}`, background: "transparent", color: on ? INK : MUT, whiteSpace: "nowrap", flex: "none", transition: "border-color .15s, color .15s", display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", minHeight: mobile ? 44 : undefined }}>{s.label === "Top Stories" ? "Stories" : s.label === "Episodes" ? "Listen" : s.label}</button>;
  });
  // "Since your last read": returning readers get NEW/UPDATED stories first, then a caught-up
  // divider, then the ones they've already read (editorial order inside each half). Sub-tumor
  // filtering happens HERE (off the full hero list) — not via storiesOf(data), whose empty-array
  // fallback would silently swap in the drug movers when a sub-area has no curated story.
  const heroStories = storiesOf(rawData);
  const visibleStories = heroStories.filter((s) =>
    (!activeSub || (s.subAreas ?? []).includes(activeSub)) && (!congressScope || s.congress === true));
  // SOURCE-ANCHORED HERO (cutover): in hero mode the server-authored deck is AUTHORITATIVE —
  // branch on mode ALONE (Codex cutover review). Focus and live coverage narrow that deck using
  // the anchor's producer-authored scope tags; an empty result never resurrects legacy stories.
  const heroDeck = heroDeckOf(rawData);
  const heroMode = heroDeck !== null;
  const heroCards = heroMode ? scopedHeroCards(heroDeck, activeSub, congressScope) : null;
  // RECEIPTS for hero cards (John 2026-08-09: "shared by 13 clinicians" must open into WHO
  // and WHAT THEY SAID). The payload dual-publishes the full legacy evidence — join each
  // card to it by anchor and reuse the SAME StoryEvidence drawer as legacy stories.
  const heroEvidenceOf = (c: HeroCardT): HeroEvidence => {
    const r = resolveHeroEvidence(c, rawData);
    if (!r) return null;
    if (r.kind === "paper") {
      const story = r.story as EvSource;
      const paper = story.papers?.[0];
      const firstPost = pickConversationPreview(story.posts, paper?.posts, paper?.sharers);
      return { faces: r.faces, abstract: paper?.abstract?.replace(/\s+/g, " ").trim() || null, preview: firstPost ? <TweetCard t={firstPost} compact /> : null, drawer: <StoryEvidence story={{ ...story, publisherPosts: r.publisherPosts, otherPosts: r.otherPosts, supportLinks: r.supportLinks }} accent={pal.accent} paperLabel="The paper" /> };
    }
    if (r.kind === "article") {
      const paper = r.paper as unknown as BriefingPaper;
      const firstPost = pickConversationPreview(r.posts, paper.posts, paper.sharers);
      return { faces: r.faces, abstract: paper.abstract?.replace(/\s+/g, " ").trim() || null, preview: firstPost ? <TweetCard t={firstPost} compact /> : null, drawer: <StoryEvidence story={{ podcast: [], posts: r.posts, papers: [paper], kind: "paper", publisherPosts: r.publisherPosts, otherPosts: r.otherPosts, supportLinks: r.supportLinks }} accent={pal.accent} paperLabel="The paper" /> };
    }
    if (r.kind === "episode") return { faces: r.faces, drawer: (
      <>
        <StoryEvidence story={{ podcast: r.pods, posts: [], papers: [], kind: "episode" }} accent={pal.accent} paperLabel="Papers" />
        {((c.announcements ?? []).length > 0 || (c.amplifiers ?? []).length > 0) && (
          <EpisodeXReceipts announcements={c.announcements ?? []} amplifiers={c.amplifiers ?? []} accent={pal.accent} />
        )}
      </>
    ) };
    if (r.kind === "event") {
      const firstPost = pickConversationPreview(r.posts);
      return {
        faces: r.faces,
        preview: firstPost ? <TweetCard t={firstPost} compact /> : null,
        drawer: <StoryEvidence story={{ podcast: [], posts: r.posts, papers: [], kind: "event", publisherPosts: r.publisherPosts, otherPosts: r.otherPosts, supportLinks: r.supportLinks }} accent={pal.accent} paperLabel="Papers" />,
      };
    }
    return {
      faces: r.faces,
      preview: <TweetCard t={r.post} compact />,
      drawer: <StoryEvidence story={{ podcast: [], posts: [r.post], papers: [], kind: "thread" }} accent={pal.accent} paperLabel="Papers" />,
    };
  };
  const part = partitionStories(heroMode ? [] : visibleStories, seen);
  const stories = part.ordered;
  // "Also in Top Stories" — a paper promoted to a Top Story is ALSO kept in the full reading list
  // (measured 2026-08-03: every paper-story, ~2.8/edition, duplicates below). Rather than delete it
  // from the complete list, tag it. Keys come from the CURRENTLY-RENDERED story set so the tag is
  // never false after a Focus filter. Snapshot carries no DOI client-side; match on url, normalized
  // title as fallback (both lists derive from the same source, so urls align).
  const normKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const featuredPaperKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of heroCards ?? []) if (c.kind === "paper") {
      if (c.anchorId) keys.add(`u:${c.anchorId}`);
      if (c.url) keys.add(`u:${c.url}`);
      if (c.headline) keys.add(`t:${normKey(c.headline)}`);
    }
    for (const s of stories) if (s.kind === "paper") {
      const p = s.papers?.[0];
      if (p?.url) keys.add(`u:${p.url}`);
      const t = p?.title ?? s.headline; if (t) keys.add(`t:${normKey(t)}`);
    }
    return keys;
  }, [heroCards, stories]);
  const isFeaturedPaper = (a: { url?: string | null; title: string }) =>
    (!!a.url && featuredPaperKeys.has(`u:${a.url}`)) || featuredPaperKeys.has(`t:${normKey(a.title)}`);
  // One quiet disclosure treatment across the reader: text carries the action while the
  // surrounding row supplies the 44px+ target. No nested pill inside an already-clickable row.
  const SignalTag = ({ id, style }: { id: string; style?: React.CSSProperties }) => (
    <span data-disclosure style={{ display: "inline-flex", alignItems: "center", minHeight: 44, font: "600 12.5px system-ui", color: pal.accent, padding: "0 2px", whiteSpace: "nowrap", ...style }}>
      {openId === id ? "Hide sources ↑" : "Sources ↓"}
    </span>
  );

  // Story impression — a story counts as SEEN when its card actually scrolls into view (≥45%
  // visible). Logged once per story per page load (logStorySeen dedupes); feeds
  // Since-your-last-read next visit. Plain rect-check on scroll instead of
  // IntersectionObserver: IO callbacks are suppressed in embedded/backgrounded webviews
  // (verified in the in-app preview), and a rAF-throttled check over ≤7 cards is free.
  useEffect(() => {
    const check = () => {
      // Zero-rect guard: a hidden/display:none/transitioning layout reports all-zero rects,
      // and `0 >= 0*0.45` would mass-log EVERY story as seen without the reader seeing any.
      const vh = window.innerHeight;
      if (vh <= 0 || document.hidden) return;
      document.querySelectorAll<HTMLElement>("[data-sid]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height <= 0) return;
        const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (visible >= r.height * 0.45 && el.dataset.sid) {
          logStorySeen(area, el.dataset.sid, el.dataset.sfp || undefined, {
            label: el.dataset.stitle,
            kind: el.dataset.skind,
          });
        }
      });
    };
    check(); // whatever is visible on load counts as seen
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [area, subArea]);

  // Whether the desktop rail has ANY content — drives collapsing the two-column grid to one when a
  // Focus pick empties guests + KOLs + trials + drugs (else the fixed 320px track leaves a blank gap).
  const railHasContent = !!(data.guests?.length || carriedKols.length || data.trials.length || data.movers.length);

  // ---- section builders (placement differs by layout; content is identical) --------------

  // Mobile only: cap the deck so the sections below stay reachable. Stories are ordered
  // fresh-first in split mode, so the cap also keeps already-read ones collapsed by default.
  const MOBILE_STORY_CAP = 4;
  const storiesCapped = compact && !showAllStories && stories.length > MOBILE_STORY_CAP;
  const deckStories = storiesCapped ? stories.slice(0, MOBILE_STORY_CAP) : stories;

  // THE DAILY, area slice (John 2026-08-18): narrative paragraphs tagged for THIS area,
  // rendered above Top stories; hidden entirely when today's edition has nothing here.
  const [dailyOpen, setDailyOpen] = useState(false);
  // THE DAILY, v4 per-area editions (John): this area's own mini-brief (lead + paragraphs),
  // with the shared Frontier section under it — or AS the top on a quiet day. Legacy
  // narrative-slicing remains the fallback for pre-editions payloads.
  const dailyEd = daily?.payload?.editions?.[area] ?? null;
  const dailyGen = daily?.payload?.editions?.general ?? null;
  const legacyParas = daily?.payload?.narrative ?? [];
  const areaDailyParas = dailyEd ? dailyEd.paragraphs : legacyParas.filter((p) => (p.areas ?? []).includes(area));
  const genDailyParas = (dailyGen ? dailyGen.paragraphs : legacyParas.filter((p) => (p.areas ?? []).length === 0)).filter((p) => !((p as { dupFor?: string[] }).dupFor ?? []).includes(area));
  const dailyQuiet = !areaDailyParas.length && genDailyParas.length > 0;
  const dailyLead = dailyEd?.lead ?? null;
  const dailyAll = [...areaDailyParas, ...genDailyParas];
  const dailyLong = dailyAll.length > 1 || (dailyAll[0]?.text.length ?? 0) > 200 || !!dailyLead;
  const dailyPara = (p: { head?: string | null; text: string; refs?: { label: string; url: string }[] | null; storyIds?: string[] }, i: number | string, n?: number) => (
    <div key={i}>
      <p style={{ margin: "12px 0 0", font: "400 14.5px/1.65 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)" }}>
        {n !== undefined && <strong style={{ fontWeight: 700, color: pal.accent }}>{n}. </strong>}
        {p.head && <strong style={{ fontWeight: 700, color: "var(--rv-ink, #eef1f8)" }}>{stripEmph(p.head)}. </strong>}
        {emph(p.text)}
        {(p.refs ?? []).length > 0 && (
          <span style={{ font: "500 11.5px system-ui", color: MUT }}>
            {" "}{(p.refs ?? []).map((r, ri) => (
              <a key={ri} href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: pal.accent, textDecoration: "none" }}>{ri > 0 ? " · " : ""}{r.label} ↗</a>
            ))}
          </span>
        )}
      </p>
      <DailyConversationEvidence stories={daily?.payload?.conversationStories} storyIds={p.storyIds} area={area} accent={pal.accent} ink="var(--rv-ink, #eef1f8)" muted={MUT} line={LINE} />
    </div>
  );
  const dailySection = dailyAll.length > 0 && (
    <section style={{ margin: "18px 0 8px", padding: "16px 18px", background: "var(--rv-surface, rgba(255,255,255,.03))", border: `1px solid ${LINE}`, borderRadius: 10 }}>
      <div className="daily-meta" style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="daily-meta-primary" style={{ font: "700 10.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: pal.accent }}>The Daily · {area}</span>
        <span style={{ font: "500 11px system-ui", color: MUT }}>{daily?.date}</span>
        {/* The promise, stated once: this is a 24-hour brief (John 2026-08-19). */}
        <span style={{ font: "500 11px system-ui", color: MUT2 }}>· updated today</span>
      </div>
      {dailyQuiet && <div style={{ margin: "9px 0 -2px", font: "italic 500 12.5px/1.5 'Newsreader',Georgia,serif", color: MUT }}>Quiet in {area} today — from the frontier:</div>}
      {dailyOpen || !dailyLong ? (
        <>
          {dailyLead && <p style={{ margin: "10px 0 0", font: "500 15.5px/1.55 'Newsreader',Georgia,serif", color: "var(--rv-ink, #eef1f8)" }}>{stripEmph(dailyLead)}</p>}
          {areaDailyParas.map((p, i) => dailyPara(p, i, i + 1))}
          {genDailyParas.length > 0 && (
            <>
              {!dailyQuiet && <div style={{ margin: "16px 0 -4px", font: "700 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: MUT }}>Frontiers</div>}
              {genDailyParas.map((p, i) => dailyPara(p, "g" + i, areaDailyParas.length + i + 1))}
            </>
          )}
        </>
      ) : (
        <>
          {dailyLead && <p style={{ margin: "10px 0 0", font: "400 14.5px/1.65 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{stripEmph(dailyLead)}</p>}
          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
            {areaDailyParas.slice(0, 3).map((p, i) => (
              <div key={i} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "600 12.5px/1.45 'Newsreader',Georgia,serif", color: "var(--rv-ink, #eef1f8)" }}>
                <span style={{ color: pal.accent }}>{i + 1}. </span>{stripEmph(p.head ?? p.text)}
              </div>
            ))}
          </div>
        </>
      )}
      {dailyLong && (
        <button onClick={() => setDailyOpen((o) => !o)} style={{ margin: "9px 0 0", padding: 0, border: "none", background: "none", cursor: "pointer", font: "600 11.5px system-ui", color: pal.accent }}>
          {dailyOpen ? "Show less ↑" : "Read more ↓"}
        </button>
      )}
    </section>
  );

  const storiesSection = (
    <>
      <SectionHead id="sec-top" accent={pal.accent} left>{heroMode ? "Top stories" : part.mode === "split" ? "Since your last read" : "Top stories"}</SectionHead>
      {heroMode && heroCards && heroCards.length > 0 && <HeroCards cards={heroCards} accent={pal.accent} ink={{ soft: INK_2, softer: LIGHT_MUT, line: LINE, ring: PAPER, surface: SURFACE }} evidenceOf={heroEvidenceOf} shareUrlOf={(c) => `/r/${heroSlugFor(c.kind, c.headline, c.id)}`} />}
      {heroMode && heroCards && heroCards.length === 0 && !activeSub && !congressScope && (
        <div style={{ font: "400 14px/1.5 system-ui", color: MUT, padding: "2px 2px 22px" }}>
          A quiet week — no source-anchored stories qualified. The sections below still carry the corpus.
        </div>
      )}
      {heroMode && heroCards && heroCards.length === 0 && (activeSub || congressScope) && (
        <div style={{ font: "400 14px/1.5 system-ui", color: MUT, padding: "2px 2px 22px" }}>
          {congressScope
            ? <>No source-anchored top stories match this live-coverage view. The sections below may still have signal.</>
            : <>No {subLabel} top stories this week. The sections below may still have {subLabel} signal — or tap <b style={{ color: "var(--rv-ink, #e9edf6)", fontWeight: 600 }}>All</b> for the full brief.</>}
        </div>
      )}
      {!heroMode && stories.length === 0 && (congressScope || subArea) && (
        <div style={{ font: "400 14px/1.5 system-ui", color: MUT, padding: "2px 2px 22px" }}>
          {congressScope
            ? <>{cState?.phase === "upcoming" ? `Nothing from ${cong?.shortName} yet — it hasn’t started.` : `Quiet so far on ${cong?.shortName}${subLabel ? ` for ${subLabel}` : ""}.`} Tap <b style={{ color: "var(--rv-ink, #e9edf6)", fontWeight: 600 }}>Weekly brief</b> for the full read.</>
            : <>No {subLabel} top stories this week. The other sections below may still have {subLabel} signal — or tap <b style={{ color: "var(--rv-ink, #e9edf6)", fontWeight: 600 }}>All</b> for the full brief.</>}
        </div>
      )}
      {part.mode === "caughtup" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "0 0 22px", font: "500 13px system-ui", color: MUT }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
          You&rsquo;re all caught up — nothing new since your last read.
        </div>
      )}
      {deckStories.map((s, i) => {
        const id = "s:" + s.id;
        const isDrug = s.kind === "drug";
        const lead = i === 0;
        const faces = pileFacesL(s);
        const chip = part.mode === "split" ? part.status.get(s.id) : undefined;
        // Denser, scannable scale (2026-07-22 redesign): the lead is a step up, not a poster —
        // the old 34px front-page headline ate most of a phone screen before story #2.
        const headlineFont = lead ? (compact ? "500 23px/1.2" : "500 25px/1.16") : (compact ? "500 19px/1.25" : "500 20.5px/1.2");
        const open = openId === id;
        return (
          <Fragment key={id}>
            {part.mode === "split" && i === part.freshCount && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "26px 0 10px" }}>
                <div style={{ flex: 1, height: 1, background: "var(--rv-line, rgba(255,255,255,.12))" }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 12px system-ui", color: MUT, minWidth: 0, flexShrink: 1, textAlign: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
                  You&rsquo;re caught up — {stories.length - part.freshCount} stor{stories.length - part.freshCount === 1 ? "y" : "ies"} you&rsquo;ve already read
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--rv-line, rgba(255,255,255,.12))" }} />
              </div>
            )}
          <div className="readout-story-card" data-sid={s.id} data-sfp={s.fp ?? ""} data-stitle={s.headline} data-skind={s.kind} style={lead ? { ...storyCard, borderLeft: `3px solid ${pal.accent}` } : storyCard}>
          <Row open={open} onToggle={() => toggle(id)} accent={pal.accent}
            head={
              <div style={{ display: "flex", alignItems: "flex-start", padding: "22px 2px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {s.congress && cong && (
                      <span style={{ font: "800 8.5px system-ui", letterSpacing: ".05em", color: "#12130f", background: CG, borderRadius: 4, padding: "2.5px 6px", textTransform: "uppercase" }}>{cong.shortName}</span>
                    )}
                    {(chip === "new" || chip === "updated") && (
                      <span style={{ font: "800 8.5px system-ui", letterSpacing: ".08em", color: chip === "new" ? "#fff" : pal.accent, background: chip === "new" ? pal.accent : `${pal.accent}12`, border: `1px solid ${pal.accent}55`, borderRadius: 4, padding: "2.5px 6px" }}>{chip === "new" ? "NEW" : "UPDATED"}</span>
                    )}
                    <span style={{ font: compact ? "700 11px system-ui" : "600 9px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: pal.accent }}>{storyKicker(s)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ font: `${headlineFont} 'Newsreader',Georgia,serif`, color: "var(--rv-ink, #f8f9fc)", letterSpacing: lead ? "-.01em" : "0" }}>{s.headline}</span>
                    {s.subtitle && <span style={{ font: "500 12px system-ui", letterSpacing: ".02em", color: MUT }}>{s.subtitle}</span>}
                    {isDrug && s.delta !== 0 && <Delta delta={s.delta} />}
                  </div>
                  {/* Description is a 2-line teaser when closed (sans = the "gloss", not the field's
                      own words), and unclamps to the full text on expand. */}
                  {s.description && <p style={{ margin: "11px 0 0", font: "400 14px/1.55 system-ui", color: "var(--rv-muted, #aab0bf)", ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{s.description}</p>}
                  {/* Facts-forward: who + how many + where. The stance ("favorable") does NOT live
                      here — it only appears in the drawer, next to its receipts. */}
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    {faces.length > 0 && <FacePile faces={faces} extra={0} ring={pal.bg} />}
                    <span style={{ font: "400 12px system-ui", color: MUT }}>{storyMetricLine(s)}</span>
                    {!open && <SignalTag id={id} style={{ marginLeft: "auto" }} />}
                  </div>
                </div>
              </div>
            }>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* the field's read at the TOP of the evidence — receipts, only on expand */}
              <StanceBlock stance={s.stance} accent={pal.accent} />
              <StoryEvidence story={s} accent={pal.accent} paperLabel={paperBlockLabel(s)} />
            </div>
          </Row>
          </div>
          </Fragment>
        );
      })}
      {storiesCapped && (
        <button onClick={() => setShowAllStories(true)}
          data-brief-event="show_more" data-brief-target="stories"
          className="rv-text-action"
          style={{ display: "inline-flex", alignItems: "center", minHeight: 44, margin: "2px 0 24px", padding: "0 2px", cursor: "pointer", background: "none", border: 0, color: pal.accent, font: "600 13px system-ui" }}>
          Show {stories.length - MOBILE_STORY_CAP} more {stories.length - MOBILE_STORY_CAP === 1 ? "story" : "stories"} ↓
        </button>
      )}
    </>
  );

  // This week's guests — box score (recent form + lifetime career)
  const guestsSection = !!data.guests?.length && (
    <>
      <SectionHead accent={pal.accent} rail={wide} left>This week&rsquo;s guests</SectionHead>
      <Capped items={data.guests} cap={6} accent={pal.accent} render={(g, i) => {
        const eps = g.episodes.filter((e) => e.audioUrl);
        return (
        <Row key={"g:" + i} open={openId === "g:" + i} onToggle={() => { if (eps.length) toggle("g:" + i); }} accent={pal.accent} variant="list"
          head={
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 2px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "500 17px 'Newsreader',Georgia,serif", color: "var(--rv-ink, #f4f7ff)" }}>{g.name}</div>
                {(g.verified || g.affiliation) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {g.verified && <span style={{ font: "700 8px system-ui", letterSpacing: ".06em", color: pal.bg, background: pal.accent, borderRadius: 4, padding: "2px 5px", textTransform: "uppercase", flex: "none" }}>Verified</span>}
                    {g.affiliation && <span style={{ font: "400 12.5px system-ui", color: MUT }}>{g.affiliation}</span>}
                  </div>
                )}
                {eps.length > 0 && <div style={{ font: "600 11.5px system-ui", color: pal.accent, marginTop: 7 }}>{openId === "g:" + i ? "Hide ↑" : `▸ Listen · ${eps.length} episode${eps.length === 1 ? "" : "s"}`}</div>}
              </div>
              <div style={{ flex: "none", display: "flex", gap: 8, textAlign: "center" }}>
                <div style={{ ...statTile }}><div style={{ font: "600 21px 'Newsreader',Georgia,serif", color: pal.accent }}>{g.thisWeek}</div><div style={statTileLabel}>This wk</div></div>
                <div style={{ ...statTile }}><div style={{ font: "600 21px 'Newsreader',Georgia,serif", color: "var(--rv-ink, #f4f7ff)" }}>{g.career}</div><div style={statTileLabel}>Career</div></div>
              </div>
            </div>
          }>
          {eps.map((ep, j) => (
            <div key={j} style={cardBox}>
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 11 }}>
                <Coin src={ep.showArt} label={ep.show || g.name} size={34} radius={9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 13.5px/1.35 system-ui", color: "var(--rv-ink, #eef1f8)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.title}</div>
                  <div style={{ font: "400 11px system-ui", color: MUT, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.show || "Podcast"}</div>
                </div>
              </div>
              {ep.description && <p style={{ margin: "0 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #c8cad2)", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.description}</p>}
              <AudioQuote audioUrl={ep.audioUrl!} startMs={0} durationSeconds={ep.durationSeconds} label="Listen to the episode" accent={pal.accent} tone="dark" />
            </div>
          ))}
        </Row>
      );}} />
    </>
  );

  // X voices — the server pool is canonically ordered by earned amplification. Re-sort here as
  // a compatibility guard for older frozen snapshots that still carried activity-first order.
  const kolsSection = carriedKols.length > 0 && (
    <>
      <SectionHead accent={pal.accent} rail={wide} left>Carried on X</SectionHead>
      <Capped items={carriedKols} cap={6} accent={pal.accent} render={(k, i) => {
        const id = "k:" + i;
        const open = openId === id;
        // KOL expander is NOT "the signal" — expanding shows their raw posts/papers, not
        // synthesized evidence. Label it with the honest COUNT, and keep it small: this is
        // the rail, secondary to stories/drugs. Lighter tint than SignalTag on purpose.
        const nPost = k.tweets ?? k.posts.length, nArt = k.paperShares ?? k.articles.length;
        const countLabel = open
          ? "Hide ↑"
          : ([k.posts.length ? `${k.posts.length} post${k.posts.length === 1 ? "" : "s"}` : "", k.articles.length ? `${k.articles.length} paper${k.articles.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "View activity") + " ↓";
        const drugLine = k.drugs.slice(0, 4).join(" · ") || (k.handle ? "@" + k.handle : "");
        return (
          <Row key={id} open={open} onToggle={() => toggle(id)} accent={pal.accent} variant="list"
            head={
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 2px" }}>
                <Coin src={k.avatar} label={k.name} size={38} style={{ marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* name clamped to 2 lines so credential-laden names ("…, MD PhD") don't run away */}
                    <span style={{ flex: 1, minWidth: 0, font: "500 15.5px/1.25 'Newsreader',Georgia,serif", color: "var(--rv-ink, #f4f7ff)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{k.name}</span>
                    <span data-disclosure style={{ display: "inline-flex", alignItems: "center", minHeight: 44, flex: "none", margin: "-10px 0 -10px", font: "600 11.5px system-ui", color: pal.accent, padding: "0 2px", whiteSpace: "nowrap" }}>{countLabel}</span>
                  </div>
                  {/* institution + drugs each clamped to ONE line — the ballooning multi-line
                      affiliation was the source of the ragged look */}
                  {k.institution && <div style={{ font: "400 12px system-ui", color: MUT, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.institution}</div>}
                  {drugLine && <div style={{ font: "400 11.5px system-ui", color: MUT2, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{drugLine}</div>}
                </div>
              </div>
            }>
            <div>
              {k.posts.length > 0 && <div><div style={evLabel(pal.accent)}>Top posts on X · {k.posts.length}{nPost > k.posts.length ? ` of ${nPost}` : ""}</div>{k.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              {k.articles.length > 0 && <div><div style={evLabel(pal.accent)}>Top papers shared · {k.articles.length}{nArt > k.articles.length ? ` of ${nArt}` : ""}</div>{k.articles.map((a, j) => <PaperCard key={j} title={a.title} journal={a.journal} domain={a.domain} peerReviewed={a.peerReviewed} url={a.url} accent={pal.accent} />)}</div>}
            </div>
          </Row>
        );
      }} />
    </>
  );

  // Guests and X voices are one People destination. Keeping the anchor on the wrapper means the
  // nav lands on whichever subsection is actually first (and still works when either is empty).
  const peopleSection = (data.guests?.length || carriedKols.length) ? (
    <div id="sec-kols" style={{ scrollMarginTop: 66 }}>
      {wide ? guestsSection : kolsSection}
      {wide ? kolsSection : guestsSection}
    </div>
  ) : null;

  // This week on the podcasts — area episodes the drug movers don't cover (untracked-topic blind
  // spot). Flat list of episode cards, same shape as a guest's episode.
  const episodesSection = !!data.episodes?.some((e) => e.audioUrl) && (
    <div className="rv-editorial-measure" style={{ width: "100%", maxWidth: wide ? EDITORIAL_MEASURE : undefined }}>
      <SectionHead id="sec-episodes" accent={pal.accent} left>This week on the podcasts</SectionHead>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
        {/* Show 4, then tuck the deeper server-ranked pool behind "Show N more". */}
        <Capped items={data.episodes.filter((e) => e.audioUrl)} cap={4} accent={pal.accent} render={(ep, i) => {
          const amplifiers = ep.amplifiers ?? [];
          const announcements = ep.announcements ?? [];
          const hasXReceipts = amplifiers.length > 0 || announcements.length > 0;
          const ampId = `epamp:${ep.episodeId ?? i}`;
          const ampOpen = openId === ampId;
          const drawerId = `epamp-drawer-${String(ep.episodeId ?? i).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
          return (
          <div key={i} className="rv-episode-row">
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 11 }}>
              <Coin src={ep.showArt} label={ep.show || "Podcast"} size={34} radius={9} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                {/* the EPISODE is the content — it takes the headline slot (John); the show is the byline */}
                <span style={{ font: "600 15px/1.35 system-ui", color: "var(--rv-ink, #eef1f8)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.title}</span>
                {(heroMode ? heroDeck!.some((hc) => hc.kind === "episode" && hc.anchorId === ep.episodeId) : ep.featured) && <span style={{ flex: "none", font: "700 8.5px system-ui", letterSpacing: ".07em", textTransform: "uppercase", color: pal.accent, background: `${pal.accent}17`, border: `1px solid ${pal.accent}59`, borderRadius: 5, padding: "1.5px 6px" }}>Also in Top Stories</span>}</div><div style={{ font: "400 11.5px system-ui", color: MUT, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.show || "Podcast"}</div></div>
            </div>
            {ep.description && <p style={{ margin: "0 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #c8cad2)", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.description}</p>}
            <AudioQuote audioUrl={ep.audioUrl!} startMs={0} durationSeconds={ep.durationSeconds} label="Listen to the episode" eventId={ep.episodeId ?? null} eventLabel={ep.title} accent={pal.accent} tone="dark" />
            {hasXReceipts && (
              <div style={{ margin: "8px 0 0" }}>
                <button type="button" onClick={() => toggle(ampId)} aria-expanded={ampOpen} aria-controls={drawerId} aria-label={`${ampOpen ? "Hide" : "Show"} amplification sources for ${ep.title}`} className="rv-text-action"
                  style={{ width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 8, background: "none", border: 0, padding: "4px 0", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ display: "flex", alignItems: "center", flex: "none" }}>
                  {amplifiers.slice(0, 4).map((a, j) => (
                    <Coin key={j} src={a.avatar} label={a.name} size={18} ring={pal.bg} style={{ marginLeft: j ? -7 : 0 }} />
                  ))}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, font: "500 12.5px system-ui", color: "var(--rv-muted, rgba(233,237,246,.7))" }}>
                    {amplifiers.length === 1 ? `Amplified by ${amplifiers[0].name}` : amplifiers.length > 1 ? `Amplified by ${amplifiers.length} clinicians` : `From ${announcements[0]?.name ?? "the show"} on X`}
                  </span>
                  <span data-disclosure style={{ color: pal.accent, font: "600 12.5px system-ui", whiteSpace: "nowrap" }}>{ampOpen ? "Hide sources ↑" : "Sources ↓"}</span>
                </button>
                {ampOpen && <div id={drawerId} className="rv-drawer" style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--rv-line, rgba(255,255,255,.08))" }}><EpisodeXReceipts announcements={announcements} amplifiers={amplifiers} accent={pal.accent} /></div>}
              </div>
            )}
          </div>
        );}} />
      </div>
    </div>
  );

  // papers
  const papersSection = data.topArticles.length > 0 && (
    <div className="rv-editorial-measure" style={{ width: "100%", maxWidth: wide ? EDITORIAL_MEASURE : undefined }}>
      <SectionHead id="sec-papers" accent={pal.accent} left>Papers being shared</SectionHead>
      <Capped items={data.topArticles} cap={8} accent={pal.accent} render={(a, i) => {
        const id = "p:" + i;
        return <PaperShareRow key={id} paper={a} id={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent} ring={pal.bg} featured={isFeaturedPaper(a)} />;
      }} />
    </div>
  );

  // trials
  const trialsSection = data.trials.length > 0 && (
    <>
      <SectionHead id="sec-trials" accent={pal.accent} rail={wide} left>Trials being discussed</SectionHead>
      <Capped items={data.trials} cap={6} accent={pal.accent} render={(t, i) => {
        const id = "t:" + i;
        const open = openId === id;
        const evidenceLine = trialEvidenceLine(t);
        const tFaces = pileFacesL({ posts: [...t.posts, ...(t.publisherPosts ?? []), ...(t.otherPosts ?? []), ...t.articles.flatMap((a) => a.sharers)], podcast: t.pods });
        return (
          /* One flat row owns the trial header and its expanded evidence. Title clamps to two
             lines when closed and shows in full when open. */
          <Row key={id} open={open} onToggle={() => toggle(id)} accent={pal.accent} variant="list"
            head={
              <div style={{ padding: "13px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, font: "500 16px 'Newsreader',Georgia,serif", color: "var(--rv-ink, #f4f7ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.acronym || prettyPhase(t.phase)}</span>
                  {t.resultsFresh && <span style={{ flex: "none", font: "700 8px system-ui", letterSpacing: ".06em", textTransform: "uppercase", color: pal.accent, border: `1px solid ${pal.accent}55`, borderRadius: 4, padding: "2px 5px" }}>New results</span>}
                  <SignalTag id={id} style={{ flex: "none" }} />
                </div>
                {t.title && <div style={{ font: "400 12.5px/1.5 system-ui", color: MUT, marginTop: 6, ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{t.title}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
                  {tFaces.length > 0 && <FacePile faces={tFaces} extra={0} ring={pal.bg} />}
                  <span style={{ font: "400 11.5px system-ui", color: MUT }}>{evidenceLine}</span>
                </div>
                {/* Registry context ANNOTATES the conversation-driven row (never a separate list —
                    2026-08-18: the standalone watch rail was retracted as clutter). Server strings
                    verbatim; appears only when a DISCUSSED trial nears registered completion. */}
                {(() => { const w = (data.readoutWatch ?? []).find((x) => x.nctId === t.nctId); return w ? (
                  <div style={{ font: "500 11px/1.5 system-ui", color: pal.accent, marginTop: 5, opacity: .9 }}>{w.line}{w.move ? ` · ${w.move.line}` : ""}</div>
                ) : null; })()}
              </div>
            }>
            {t.pods.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{t.pods.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
            {t.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div><Capped items={t.posts} cap={3} accent={pal.accent} render={(tw, j) => <TweetCard key={j} t={tw} />} /></div>}
            {(t.publisherPosts?.length ?? 0) > 0 && <div><div style={evLabel(pal.accent)}>From publishers &amp; journals</div><Capped items={t.publisherPosts!} cap={2} accent={pal.accent} render={(tw, j) => <TweetCard key={j} t={tw} />} /></div>}
            {(t.otherPosts?.length ?? 0) > 0 && <div><div style={evLabel(pal.accent)}>Additional posts on X</div><Capped items={t.otherPosts!} cap={2} accent={pal.accent} render={(tw, j) => <TweetCard key={j} t={tw} />} /></div>}
            {t.articles.length > 0 && <div><div style={evLabel(pal.accent)}>Related papers</div>{t.articles.map((p: BriefingPaper, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} peerReviewed={p.peerReviewed} meta={paperMeta(p.sharers.length, 0, p.sharerCount)} url={p.url} abstract={p.abstract} posts={p.posts?.length ? p.posts : p.sharers} accent={pal.accent} sharedTotal={p.sharerCount} />)}</div>}
            <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ font: "600 12px system-ui", color: pal.accent }}>View on ClinicalTrials.gov ↗</a>
          </Row>
        );
      }} />
    </>
  );

  // Drugs — the full drug board, relocated so the drug overview isn't lost.
  const drugsSection = data.movers.length > 0 && (
    <>
      <SectionHead id="sec-drugs" accent={pal.accent} left>Drug activity</SectionHead>
      {data.movers.map((m) => {
        const id = "m:" + m.drugId;
        const open = openId === id;
        const drugMeta = [m.brand, m.company].filter(Boolean).join(" · ");
        return (
          <div key={id} style={storyCard}>
          <Row open={open} onToggle={() => toggle(id)} accent={pal.accent}
            head={
              <div style={{ padding: compact ? "18px 2px" : "22px 2px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", columnGap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "500 22px/1.18 'Newsreader',Georgia,serif", color: "var(--rv-ink, #f8f9fc)" }}>{m.drug}</div>
                    {drugMeta && <div style={{ marginTop: 5, font: "500 12px/1.4 system-ui", color: MUT }}>{drugMeta}</div>}
                  </div>
                  {m.delta !== 0 && <Delta delta={m.delta} />}
                </div>
                  {/* The Drugs board is a compact INDEX into sources, not a synthesized drug profile.
                      It deliberately does NOT render `why` (the highest-mention gloss, verbatim): a
                      gloss is written from a dense, often multi-drug passage, so presenting it as this
                      drug's profile is exactly how a neighbour's approval date / biomarker / trial
                      result ends up read as this drug's fact. What survives here is only what is
                      deterministic — a dated regulatory event, the source counts, who's talking — and
                      the claims themselves stay in the linked source material below. */}
                {m.eventChip && <p style={{ margin: "10px 0 0", font: "400 13px/1.5 system-ui", color: "var(--rv-muted, #aab0bf)" }}>{m.eventChip}</p>}
                <div style={{ marginTop: 15, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", columnGap: 12 }}>
                  <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    {pileFacesL(m).length > 0 && <span style={{ flex: "none" }}><FacePile faces={pileFacesL(m)} extra={0} ring={pal.bg} /></span>}
                    <span style={{ minWidth: 0, font: "400 12px/1.45 system-ui", color: MUT }}>{metricsLine(m)}</span>
                  </div>
                  {!open && <SignalTag id={id} />}
                </div>
              </div>
            }>
            {/* Evidence cards are ONE width everywhere (John 2026-08-17: the drug drawer's
                cards read "skinnier" than the trials/papers rails, which never indent). The
                old 54px gutter aligned the drawer under the head's text column at the cost of
                making identical card components render narrower in this one rail. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* the field's read at the TOP of the drug's evidence drawer (self-suppresses if thin) */}
              <StanceBlock stance={m.stance} accent={pal.accent} />
              <StoryEvidence story={m} accent={pal.accent} paperLabel="Papers shared" />
            </div>
          </Row>
          </div>
        );
      })}
    </>
  );

  const captureInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-brief-event]");
    if (!el || el.dataset.briefOpen === "true") return;
    const kind = el.dataset.briefEvent as BriefSignalKind | undefined;
    if (!kind) return;
    const meta = {
      ...(el.dataset.briefTarget ? { target: el.dataset.briefTarget } : {}),
      ...(el.dataset.briefLabel ? { label: el.dataset.briefLabel } : {}),
    };
    logSignal(kind, area, el.dataset.briefStory ?? null, Object.keys(meta).length ? meta : undefined);
  };

  return (
    <div className="reader-editorial" onClickCapture={captureInteraction} style={{ minHeight: "100vh", overflowWrap: "break-word", background: pal.bg, color: INK, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", ["--rv-accent" as string]: pal.accent, ["--rv-ink" as string]: INK, ["--rv-ink-2" as string]: INK_2, ["--rv-copy" as string]: INK_2, ["--rv-muted" as string]: LIGHT_MUT, ["--rv-muted-2" as string]: LIGHT_MUT2, ["--rv-line" as string]: LINE, ["--rv-surface" as string]: SURFACE, ["--rv-card" as string]: "#fff", ["--rv-card-line" as string]: "#d8d7d1", ["--rv-card-radius" as string]: "8px", ["--rv-card-shadow" as string]: "0 8px 22px rgba(31,35,42,.07)" }}>
      {/* rv-pills: hide the scrollbar; on mobile a right-edge fade signals there's more to scroll.
          Expandable lists use dividers and quiet text actions instead of nested pills/cards. */}
      <style>{`
        .rv-pills::-webkit-scrollbar{display:none}.rv-pills{scrollbar-width:none}
        .rv-edition{position:relative}
        .rv-edition::after{content:"";position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:44px}
        .rv-focus-chip{position:relative}
        .rv-focus-chip::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:max(100%,44px);height:44px}
        .rv-fade{-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 36px),transparent);mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 36px),transparent)}
        .reader-editorial .rv-list-row{border-bottom:1px solid ${LINE}}
        .rv-row{transition:color .16s ease}
        @media(hover:hover){.rv-row:hover [data-disclosure],.rv-text-action:hover{text-decoration:underline;text-underline-offset:4px}}
        .reader-editorial .rv-row:focus-visible{outline:2px solid ${pal.accent};outline-offset:-2px}
        .reader-editorial .rv-episode-row{padding:16px 2px 18px;border-bottom:1px solid ${LINE}}
        .reader-editorial .rv-text-action:focus-visible{outline:2px solid ${pal.accent};outline-offset:2px;border-radius:4px}
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
        .cg-pip{animation:cgPulse 2.2s ease-out infinite}
        @keyframes cgPulse{0%{box-shadow:0 0 0 0 rgba(255,92,92,.55)}70%{box-shadow:0 0 0 7px rgba(255,92,92,0)}100%{box-shadow:0 0 0 0 rgba(255,92,92,0)}}
        @media(prefers-reduced-motion:reduce){.rv-drawer{animation:none}.cg-pip{animation:none}}
      `}</style>
      <div style={{ maxWidth: wide ? 1280 : 690, margin: "0 auto", padding: compact ? "18px 20px 100px" : "0 32px 120px" }}>
        {/* CONGRESS MODE bar — the ONE new element. A gold "marquee event" strip above the
            masthead: status on the left (derived client-side from the dates), a Weekly/Live toggle
            on the right. Everything below is the normal reader, scoped to congress-tagged stories
            when Live coverage is on. Wrapped-with-nothing-tagged self-suppresses. */}
        {cong && cState && !(cState.phase === "wrapped" && cong.taggedStories === 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: compact ? "0 -20px 16px" : "-6px -30px 20px", padding: compact ? "11px 20px" : "12px 30px", background: `linear-gradient(90deg, ${CG}29, ${CG}0d)`, borderTop: `1px solid ${CG}55`, borderBottom: `1px solid ${CG}55` }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, font: "700 11px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: INK_2, minWidth: 0 }}>
              <span aria-hidden className={cState.phase === "live" ? "cg-pip" : ""} style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: cState.phase === "live" ? "#FF5C5C" : cState.phase === "upcoming" ? CG : "#8a8f9c" }} />
              {cState.phase === "live" && <span style={{ color: "#a43b35" }}>Live</span>}
              <b style={{ color: INK, fontWeight: 700 }}>{cong.shortName}</b>
              <span style={{ color: "#70530a", whiteSpace: "nowrap" }}>· {cState.label}</span>
            </span>
            <div role="group" aria-label="Congress coverage" style={{ marginLeft: "auto", display: "inline-flex", background: "rgba(255,255,255,.62)", border: `1px solid ${CG}66`, borderRadius: 20, padding: 3, flex: "none" }}>
              {([["Weekly brief", false], ["Live coverage", true]] as [string, boolean][]).map(([lbl, on]) => (
                <button key={lbl} type="button" aria-pressed={congressScope === on} onClick={() => { setCongressOn(on); setOpenId(null); }}
                  style={{ cursor: "pointer", font: "700 11px system-ui", padding: "6px 12px", borderRadius: 16, border: 0, whiteSpace: "nowrap", background: congressScope === on ? CG : "transparent", color: congressScope === on ? "#12130f" : "var(--rv-muted, rgba(255,255,255,.62))" }}>{lbl}</button>
              ))}
            </div>
          </div>
        )}
        {/* The production masthead now follows the Editorial concept: one calm publication row
            for brand, section navigation, and edition context; Focus remains a separate scope
            strip because it filters the whole page rather than navigating within it. */}
        {wide && !compact && <>
          <div style={{ position: "sticky", top: 0, zIndex: 15, minHeight: 86, margin: "0 -32px", padding: "0 32px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center", columnGap: 42, background: stuck ? "rgba(244,244,241,.94)" : PAPER, backdropFilter: "blur(16px) saturate(1.1)", WebkitBackdropFilter: "blur(16px) saturate(1.1)", borderBottom: `1px solid ${LINE}`, boxShadow: stuck ? "0 12px 28px -22px rgba(31,35,42,.35)" : "none", transition: "box-shadow .2s ease" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: pal.accent, font: "750 10px/1 system-ui", textTransform: "uppercase" }}>CanvasMD</span>
              <h1 style={{ font: "500 28px/1 Georgia,'Newsreader',serif", color: INK, margin: "5px 0 0", whiteSpace: "nowrap" }}>The Readout</h1>
            </div>
            <nav aria-label="Readout sections" className="rv-pills" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, minWidth: 0, overflow: "hidden" }}>
              {sectionControls(false)}
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
              {areaSwitcher("chip")}
              <span style={{ font: "600 12px system-ui", color: MUT, whiteSpace: "nowrap" }}>{ago(data.generatedAt)}</span>
              {shareMsg && <span role="status" style={{ font: "600 12px system-ui", color: "#fff", background: INK, borderRadius: 6, padding: "6px 10px", whiteSpace: "nowrap" }}>{shareMsg}</span>}
              <button onClick={doShare} aria-label="Share this edition" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: 0, color: MUT, width: 44, height: 44, padding: 0, cursor: "pointer" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              </button>
            </div>
          </div>
          <div style={{ minHeight: 58, margin: "0 -32px 18px", padding: "0 32px", display: "flex", alignItems: "center", gap: 20, borderBottom: `1px solid ${LINE}` }}>
            {focusSwitcher(false)}
          </div>
        </>}

        {/* Mobile and medium-width layouts use the same Editorial hierarchy in a compact stack. */}
        {(!wide || compact) && <>
        {/* The desktop masthead spans the same frame as the editorial column + rail. Its controls
            stay on the reading spine, while Share anchors the far edge; the rule beneath belongs
            to the whole edition rather than ending where the Focus labels happen to end. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: compact ? 8 : 18, paddingBottom: 0 }}>
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <span style={{ display: "block", color: pal.accent, font: "750 9px/1 system-ui", textTransform: "uppercase" }}>CanvasMD</span>
            <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: compact ? 8 : 18, marginTop: 1 }}>
              <h1 style={{ font: `500 ${compact ? 22 : 26}px/1 Georgia,'Newsreader',serif`, color: INK, margin: 0, display: "inline" }}>The Readout</h1>
              {!compact && areaSwitcher("chip")}
            </div>
            {!compact && <div style={{ font: "600 10px system-ui", color: MUT2, marginTop: 9 }}>Updated {ago(data.generatedAt)}</div>}
            {/* On medium-width single-column desktop, Focus still needs its own row. The wide
                two-column layout moves it into the shared navigation band below. */}
            {!compact && !wide && <div style={{ marginTop: 13 }}>{focusSwitcher(false)}</div>}
          </div>
          <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: compact ? 8 : 14, flex: "none", marginTop: compact ? 10 : 2 }}>
          {!compact && <>
            {shareMsg && <span role="status" style={{ font: "600 12.5px system-ui", color: "#fff", background: INK, borderRadius: 6, padding: "6px 11px" }}>{shareMsg}</span>}
            <button onClick={doShare} aria-label="Share this edition" style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: `1px solid ${LINE}`, color: INK, font: "600 13px system-ui", borderRadius: 6, padding: "8px 15px", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
              Share
            </button>
          </>}
          {compact && areaSwitcher("chip", "right")}
          {/* mobile share — a bare muted icon (no box) so the header stays quiet */}
          {/* 44px box around a 17px glyph: the icon measured 21x21 as a tap target, under the
              24px WCAG 2.2 floor and well under the platform 44px norm. Negative margin keeps the
              larger hit area from disturbing the header's optical alignment. */}
          {compact && <button onClick={doShare} aria-label="Share" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, width: 44, height: 44, margin: "-11px -13px -11px 0", padding: 0, cursor: "pointer", flex: "none", order: 1 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={MUT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          </button>}
          {compact && shareMsg && <span style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 40, font: "600 12.5px system-ui", color: "#fff", background: INK, borderRadius: 6, padding: "8px 13px", boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>{shareMsg}</span>}
          </div>
        </div>
        {/* Full-width edition rule unifies the desktop editorial column and supporting rail. */}
        {!compact && <div aria-hidden style={{ height: 1, margin: "14px 0 12px", background: LINE }} />}
        {/* mobile: byline + freshness on a quiet second line, so the wordmark sits inline with the
            share + area controls (not floating against a 3-line stack) */}
        {compact && <>
          <div style={{ font: "600 10px system-ui", color: MUT2, margin: "7px 0 0" }}>Updated {ago(data.generatedAt)}</div>
          <div aria-hidden style={{ height: 1, margin: "13px 0 10px", background: LINE }} />
        </>}
        {/* Section jumps stay sticky on compact and medium-width layouts. */}
        <div className={`rv-pills rv-section-tabs${compact ? " rv-fade" : ""}`} style={{ position: "sticky", top: 0, zIndex: 15, margin: compact ? "0 -20px" : "0 -32px", padding: compact ? "4px 20px 2px" : "5px 32px 2px", background: stuck ? "rgba(244,244,241,.96)" : PAPER, backdropFilter: "blur(16px) saturate(1.1)", WebkitBackdropFilter: "blur(16px) saturate(1.1)", borderBottom: `1px solid ${LINE}`, boxShadow: stuck ? "0 10px 24px -22px rgba(31,35,42,.4)" : "none", transition: "box-shadow .2s ease", display: "flex", justifyContent: "flex-start", flexWrap: compact ? "nowrap" : "wrap", gap: compact ? 24 : 28, overflowX: compact ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
          {sectionControls(compact)}
        </div>

        {/* On desktop Focus shares the masthead line with the specialty picker. Phones retain
            the horizontally scrollable strip here, where every option keeps a 44px target. */}
        {compact && focusSwitcher(true)}
        </>}

        {/* No AI cover hero on either platform: lead with the #1 story — a real headline the
            field wrote, not a whole-week thesis the AI could get wrong (John: drop it on desktop
            like mobile). The recap/headline still exist on the payload for OG/social. The lead
            story instead gets front-page TYPE SCALE (see headlineFont above). */}

        {wide ? (
          /* two tracks: the editorial column + the rail. Rail modules (guests, trials, X voices,
             and drug activity)
             use their narrow/stacked arrangements; evidence still expands inline. When a
             Focus pick empties the whole rail, collapse to a single column so the fixed 320px
             track doesn't leave a blank gap. */
          <div style={{ display: "grid", gridTemplateColumns: railHasContent ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)", columnGap: 46, alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              {dailySection}
              {storiesSection}
              {episodesSection}
              {papersSection}
            </div>
            {railHasContent && (
              <aside style={{ minWidth: 0 }}>
                {peopleSection}
                {trialsSection}
                {drugsSection}
              </aside>
            )}
          </div>
        ) : (
          <>
            {/* Narrow column order mirrors what the product actually promises: the stories, then the
                podcast archive (the most differentiated asset — on the wide layout it already sits
                directly under the stories), then the papers trusted accounts are circulating (a
                first-class editorial signal, not a footnote), and only then trials, the unified
                People block, and drug context. */}
            {dailySection}
            {storiesSection}
            {episodesSection}
            {papersSection}
            {trialsSection}
            {peopleSection}
            {drugsSection}
          </>
        )}

        {/* footer — the positioning line lives here (end of the read), not stacked on the masthead */}
        <div style={{ textAlign: "center", marginTop: 40, paddingTop: 22, borderTop: `1px solid ${LINE}` }}>
          <div style={{ font: "500 15px/1 'Newsreader',Georgia,serif", color: "var(--rv-muted, rgba(255,255,255,.6))", letterSpacing: "-.01em" }}>The Readout</div>
          <div style={{ font: "400 12px/1.55 system-ui", color: MUT, marginTop: 12, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>Signal from tracked oncology clinicians and selected oncology podcasts. No anonymous social accounts.</div>
        </div>
      </div>
    </div>
  );
}

const statTile: React.CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 11px", minWidth: 56 };
const statTileLabel: React.CSSProperties = { font: "600 8px system-ui", letterSpacing: ".09em", textTransform: "uppercase", color: MUT2, marginTop: 5 };

// Section header as a real h2. ReaderView left-aligns every section on desktop and mobile;
// `rail` only tightens the spacing for the supporting column. The optional centered form remains
// available for other callers.
function SectionHead({ children, id, accent, rail = false, left = false }: { children: React.ReactNode; id?: string; accent: string; rail?: boolean; left?: boolean }) {
  const leftAlign = rail || left;
  return (
    <h2 id={id} style={{ display: "flex", alignItems: "center", gap: 14, margin: rail ? "54px 0 10px" : "54px 0 18px", scrollMarginTop: 66 }}>
      {!leftAlign && <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${accent}42)` }} />}
      <span style={{ font: "700 12.5px system-ui", letterSpacing: ".13em", textTransform: "uppercase", color: INK }}>{children}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}42, transparent)` }} />
    </h2>
  );
}
