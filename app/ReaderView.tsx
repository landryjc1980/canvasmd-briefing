"use client";

import { Fragment, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BriefingSharer, BriefingPod, BriefingPaper, BriefingEpisode, HeroSupportLink } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { isNewsItem, cleanArticleTitle, cleanTweetText, rtOriginal, storedJournal, type Face } from "./briefVM";
import { paperClinicianMeta, representedClinicianCountAcrossLanes, supportLinkGroups } from "./heroEvidence";
import { unrepresentedPublishers } from "./clientEvidence";
import { articleKey } from "@/lib/publicationDisplay";

// Shared evidence renderers from the retired Reader view (TweetCard, StoryEvidence, PaperCard,
// receipts), still used by /r and /design-lab.

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
// These components are also reused by the dark All Oncology view. CSS variables let the
// active Reader choose the light palette while the shared renderers retain dark fallbacks.
const MUT = "var(--rv-muted, #9aa2b6)";
const MUT2 = "var(--rv-muted-2, #7e8698)";
const LINE = "#cfd0cb";

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

// Raised surface: a step lighter than the page, lit top edge, soft drop — the depth system.
export const cardBox: React.CSSProperties = { background: "var(--rv-card, rgba(255,255,255,.065))", border: "1px solid var(--rv-card-line, rgba(255,255,255,.09))", borderRadius: "var(--rv-card-radius, 13px)", padding: 14, marginBottom: 9, boxShadow: "var(--rv-card-shadow, 0 8px 22px rgba(0,0,0,.2))" };
export const evLabel = (accent: string): React.CSSProperties => ({ font: "600 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 11 });
export const EDITORIAL_MEASURE = 850; // the editorial column measure every edition shares

// Embedded papers suppress their own source drawer to avoid a drawer inside a drawer. Hoist every
// paper-specific clinician receipt into the containing evidence lane instead, deduped by the exact
// source URL when available and by author+text for legacy receipts without one.
export function mergeReceiptPosts(...groups: (BriefingSharer[] | null | undefined)[]): BriefingSharer[] {
  const seen = new Set<string>();
  const merged: BriefingSharer[] = [];
  for (const post of groups.flatMap((group) => group ?? [])) {
    const url = post.tweetUrl?.trim().toLowerCase();
    const handle = post.handle?.replace(/^@/, "").trim().toLowerCase();
    const name = post.name?.replace(/\s+/g, " ").trim().toLowerCase();
    const text = post.text?.replace(/\s+/g, " ").trim().toLowerCase();
    const key = url ? `url:${url}` : `receipt:${handle || name || "unknown"}:${text || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(post);
  }
  return merged;
}

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
        ? <AudioQuote audioUrl={p.audioUrl} startMs={p.startMs} durationSeconds={p.durationSeconds} label="Listen to the clip" eventId={p.episodeId} eventLabel={p.episodeTitle} accent={accent} tone="dark" />
        : <div style={{ font: "500 11px system-ui", color: MUT }}>Audio unavailable</div>}
      {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", marginTop: 2, font: "600 12px system-ui", color: accent, textDecoration: "none" }}>Open episode ↗</a>}
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
        {!rtOf && t.likes > 0 && <span style={{ font: "600 11px system-ui", color: "#a93658" }}>♥ {t.likes}</span>}
      </div>
      {text && <p style={{ margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "var(--rv-copy, #cbcdd5)", overflowWrap: "anywhere", ...collapsedText }}>{text}</p>}
      {t.quotedContext && (t.quotedContext.title || t.quotedContext.description || t.quotedContext.text) && (
        <a href={t.quotedContext.url ?? undefined} target={t.quotedContext.url ? "_blank" : undefined} rel={t.quotedContext.url ? "noopener noreferrer" : undefined}
          style={{ display: "block", marginTop: 10, padding: 10, border: `1px solid ${LINE}`, borderRadius: 7, background: "var(--rv-surface, rgba(255,255,255,.05))", color: "inherit", textDecoration: "none", pointerEvents: t.quotedContext.url ? "auto" : "none" }}>
          {t.quotedContext.title && <div style={{ font: "600 12.5px/1.4 system-ui", color: "var(--rv-ink, #eef1f8)" }}>{t.quotedContext.title}</div>}
          {(t.quotedContext.description || t.quotedContext.text) && <p style={{ margin: t.quotedContext.title ? "5px 0 0" : 0, font: "400 12.5px/1.45 'Newsreader',Georgia,serif", color: MUT, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{cleanTweetText(t.quotedContext.description || t.quotedContext.text || "")}</p>}
        </a>
      )}
      {t.receiptNote && <div style={{ marginTop: 6, font: "500 11px system-ui", color: MUT }}>{t.receiptNote}</div>}
      {!text && thread.length === 0 && <div style={{ marginTop: 6, font: "500 11.5px system-ui", color: MUT }}>Shared this source</div>}
    </>);
  const postUrl = original?.tweetUrl ?? t.tweetUrl;
  const reposters = t.repostedBy ?? [];
  const visibleReposters = compact ? reposters.slice(0, 3) : reposters;
  return (
    <div className={compact ? "readout-tweet-preview" : undefined} style={cardBox}>
      {body}
      {(hasTranslation || postUrl) && (
        <div style={{ display: "flex", alignItems: "center", columnGap: 16, flexWrap: "wrap", marginTop: 3 }}>
          {hasTranslation && (
            <button type="button" onClick={() => setShowOriginal((v) => !v)}
              style={{ minHeight: 44, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "500 11px system-ui", color: MUT, textAlign: "left" }}>
              {showOriginal ? `Show translation (from ${langName})` : `Translated from ${langName} · Show original`}
            </button>
          )}
          {postUrl && (
            <a href={postUrl} target="_blank" rel="noopener noreferrer" className="rv-text-action"
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "var(--rv-accent)", font: "600 12px system-ui", textDecoration: "none" }}>
              View on X ↗
            </a>
          )}
        </div>
      )}
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
        {expanded ? "Show less ↑" : thread.length ? `Show available thread · ${thread.length + 1} posts ↓` : "Show longer excerpt ↓"}
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
                {reposter.tweetUrl ? <a href={reposter.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 24, margin: "-3px 0", color: "inherit", textDecoration: "none" }}>{reposter.name}</a> : reposter.name}
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
        {amplifier.isQuote && amplifier.likes > 0 ? <span style={{ font: "600 11px system-ui", color: "#a93658" }}>♥ {amplifier.likes}</span> : null}
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
export function PaperCard({ title, journal, meta, url, abstract, description, posts, publishers, accent, peerReviewed, showSources = true, sourceName }: { title: string; journal: string | null; meta?: string; url?: string; abstract?: string | null; description?: string | null; posts?: BriefingSharer[]; publishers?: string[]; accent?: string; sharedTotal?: number | null; peerReviewed?: boolean; showSources?: boolean; /** Registry name; null = no source; undefined = the stored journal. */ sourceName?: string | null }) {
  const [abstractOpen, setAbstractOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const hasAbs = !!(abstract && abstract.trim());
  const sourceContext = !hasAbs ? description?.trim() || null : null;
  const context = hasAbs ? abstract : sourceContext;
  const hasPosts = showSources && !!(posts && posts.length);
  const hasPublishers = showSources && !!publishers?.length;
  const hasSources = hasPosts || hasPublishers;
  const src = sourceName !== undefined ? sourceName : storedJournal(journal);
  const isNews = isNewsItem({ peerReviewed });
  const shownTitle = cleanArticleTitle(title, journal, src);
  return (
    <div style={cardBox}>
      {url
        ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", minHeight: 44, font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "var(--rv-ink, #eef1f8)", textDecoration: "none" }}>{shownTitle}</a>
        : <div style={{ font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "var(--rv-ink, #eef1f8)" }}>{shownTitle}</div>}
      {(src || meta || isNews) && <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 7 }}>
        <span style={{ font: "400 12px system-ui", color: MUT }}>{[src, meta].filter(Boolean).join(" · ")}</span>
        {isNews && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "var(--rv-muted, rgba(255,255,255,.55))", background: "var(--rv-surface, rgba(255,255,255,.07))", border: "1px solid var(--rv-line, rgba(255,255,255,.13))", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
      </div>}
      {abstractOpen && context && <p style={{ margin: "11px 0 0", font: "400 13.5px/1.55 'Newsreader',Georgia,serif", color: "var(--rv-copy, #c3c6d0)" }}>{context}</p>}
      {sourcesOpen && hasPosts && <div style={{ marginTop: 12 }}>
        <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent ?? "var(--rv-muted, #9aa0ac)", marginBottom: 9 }}>
          On X · physician posts
        </div>
        {posts!.map((t, i) => <div key={i} style={{ marginTop: i ? 8 : 0 }}><TweetCard t={t} /></div>)}
      </div>}
      {sourcesOpen && hasPublishers && <div style={{ marginTop: 12 }}>
        <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent ?? "var(--rv-muted, #9aa0ac)", marginBottom: 6 }}>Publisher provenance</div>
        <div style={{ font: "400 12px/1.5 system-ui", color: MUT }}>{publishers!.join(" · ")}</div>
      </div>}
      <div style={{ display: "flex", gap: 16, marginTop: 5, alignItems: "center" }}>
        {context && <button type="button" aria-expanded={abstractOpen} onClick={() => setAbstractOpen((o) => !o)} className="rv-text-action" style={{ minHeight: 44, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12px system-ui", color: accent ?? "var(--rv-muted, #9aa0ac)" }}>{abstractOpen ? `Hide ${hasAbs ? "abstract" : "context"} ↑` : `${hasAbs ? "Abstract" : "Source context"} ↓`}</button>}
        {hasSources && <button type="button" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((o) => !o)} className="rv-text-action" style={{ minHeight: 44, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12px system-ui", color: accent ?? "var(--rv-muted, #9aa0ac)" }}>{sourcesOpen ? "Hide sources ↑" : "Sources ↓"}</button>}
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

export function Row({ open, onToggle, accent, head, children, landOffset = 70, variant = "surface", disabled = false }: { open: boolean; onToggle: () => void; accent: string; head: React.ReactNode; children: React.ReactNode; landOffset?: number; variant?: "surface" | "list"; disabled?: boolean }) {
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
  if (disabled) return <div className={variant === "list" ? "rv-list-row" : undefined}>{head}</div>;
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
type EvidenceSource = { podcast: BriefingPod[]; posts: BriefingSharer[]; papers: BriefingPaper[]; kind?: string; clinicianCount?: number | null; publisherPosts?: BriefingSharer[]; otherPosts?: BriefingSharer[]; supportLinks?: HeroSupportLink[] };

const supportRelationship = (relationship: string) => ({
  primary_source: "Primary source",
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
      {link.description && <div style={{ marginTop: 6, font: "400 13.5px/1.5 system-ui", color: "var(--rv-muted, #aab0bf)" }}>{link.description}</div>}
    </a>
  );
}

export function StoryEvidence({ story, accent, paperLabel, sourceNames }: { story: EvidenceSource; accent: string; paperLabel: string; sourceNames?: Record<string, string | null> }) {
  const clinicianPosts = mergeReceiptPosts(
    story.posts,
    ...story.papers.map((paper) => paper.posts?.length ? paper.posts : paper.sharers),
  );
  const publisherPosts = mergeReceiptPosts(story.publisherPosts, ...story.papers.map((paper) => paper.publisherPosts));
  const otherPosts = mergeReceiptPosts(story.otherPosts, ...story.papers.map((paper) => paper.otherPosts));
  const { primarySources, relatedCoverage } = supportLinkGroups(story.supportLinks);
  const hasSupportLinks = primarySources.length > 0 || relatedCoverage.length > 0;
  const sourceGroupEnd: React.CSSProperties = { borderBottom: `1px solid ${LINE}`, paddingBottom: 16, marginBottom: 16 };
  return (
    <>
      {story.podcast.length > 0 && <div><div style={evLabel(accent)}>On the podcasts</div><PodcastEvidence pods={story.podcast} accent={accent} /></div>}
      {clinicianPosts.length > 0 && <div style={(publisherPosts.length === 0 && otherPosts.length === 0 && (hasSupportLinks || story.papers.length > 0)) ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>On X · physician posts</div><Capped items={clinicianPosts} cap={3} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>}
      {publisherPosts.length > 0 && (
        <div style={(otherPosts.length === 0 && (hasSupportLinks || story.papers.length > 0)) ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>From publishers &amp; journals</div><Capped items={publisherPosts} cap={2} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>
      )}
      {otherPosts.length > 0 && <div style={(hasSupportLinks || story.papers.length > 0) ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>Additional posts on X</div><Capped items={otherPosts} cap={2} accent={accent} render={(t, j) => <TweetCard key={j} t={t} />} /></div>}
      {primarySources.length > 0 && <div style={(relatedCoverage.length > 0 || story.papers.length > 0) ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>Primary sources</div><Capped items={primarySources} cap={4} accent={accent} render={(link, j) => <SupportLinkRow key={`${link.kind}:${link.id}:${j}`} link={link} accent={accent} />} /></div>}
      {relatedCoverage.length > 0 && <div style={story.papers.length > 0 ? sourceGroupEnd : undefined}><div style={evLabel(accent)}>Related coverage</div><Capped items={relatedCoverage} cap={4} accent={accent} render={(link, j) => <SupportLinkRow key={`${link.kind}:${link.id}:${j}`} link={link} accent={accent} />} /></div>}
      {story.papers.length > 0 && <div><div style={evLabel(accent)}>{paperLabel}</div>{(() => { const pubs = unrepresentedPublishers(story.papers.flatMap((pp) => pp.publishers ?? []), publisherPosts); return pubs.length ? <div style={{ font: "400 12px system-ui", color: "var(--rv-muted, rgba(233,237,246,.55))", margin: "2px 0 8px" }}>Also shared by: {pubs.join(" · ")}</div> : null; })()}<Capped items={story.papers} cap={2} accent={accent} render={(p, j) => {
        const total = (story.kind === "paper" && j === 0 ? story.clinicianCount : undefined) ?? p.sharerCount;
        const posts = p.posts?.length ? p.posts : p.sharers;
        const registryId = articleKey((p as { article_id?: unknown }).article_id);
        const sourceName = registryId && sourceNames && Object.prototype.hasOwnProperty.call(sourceNames, registryId) ? sourceNames[registryId] : undefined;
        return <PaperCard key={j} title={p.title} journal={p.journal} peerReviewed={p.peerReviewed} publishers={p.publishers} meta={paperClinicianMeta(representedClinicianCountAcrossLanes(posts, publisherPosts, otherPosts), total)} url={p.url} abstract={p.abstract} description={p.description} posts={posts} accent={accent} sharedTotal={total} showSources={false} sourceName={sourceName} />;
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

export const statTile: React.CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 11px", minWidth: 56 };
export const statTileLabel: React.CSSProperties = { font: "600 8px system-ui", letterSpacing: ".09em", textTransform: "uppercase", color: MUT2, marginTop: 5 };

// Section header as a real h2. ReaderView left-aligns every section on desktop and mobile;
// `rail` only tightens the spacing for the supporting column. The optional centered form remains
// available for other callers.
export function SectionHead({ children, id, accent, rail = false, left = false }: { children: React.ReactNode; id?: string; accent: string; rail?: boolean; left?: boolean }) {
  const leftAlign = rail || left;
  return (
    <h2 id={id} style={{ display: "flex", alignItems: "center", gap: 14, margin: rail ? "54px 0 10px" : "54px 0 18px", scrollMarginTop: 66 }}>
      {!leftAlign && <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${accent}42)` }} />}
      <span style={{ font: "700 12.5px system-ui", letterSpacing: ".13em", textTransform: "uppercase", color: INK }}>{children}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}42, transparent)` }} />
    </h2>
  );
}
