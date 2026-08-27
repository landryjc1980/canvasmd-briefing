"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BriefingArticle, BriefingData, BriefingEvidenceOverlayItem, BriefingSharer, HeroSupportLink, ReadoutWindowPayload } from "@/lib/types";
import {
  isReadoutEditionSnapshot,
  liveListenBriefs,
  resolveReadoutTodayEdition,
  sevenDayEditionDevelopments,
  sevenDayEditionListen,
} from "./editionSnapshot";
import {
  readoutEditionHistoryIncludingCurrent,
  readoutEditionPreferNonEmpty,
} from "./editionHistory";
import AudioQuote from "@/components/AudioQuote";
import {
  readoutWindowDays,
  type ReadoutWindow,
} from "./readoutRequest";
import {
  EDITION_AREAS,
  NEW_TO_LISTEN,
  cleanReadoutExcerpt,
  editorialScopeLabel,
  findArticle,
  findEpisode,
  listenForArea,
  relatedCoverageLinks,
  sameEditorialArticle,
  type EditorialArticle,
  type EditorialDevelopment,
  type EditorialEpisodeFeature,
  type EditionArea,
} from "./edition";

const AREA_LABELS: Record<EditionArea, string> = {
  All: "All oncology",
  GU: "Genitourinary",
  Breast: "Breast",
  Lung: "Lung",
  GI: "Gastrointestinal",
  Heme: "Hematologic",
  Skin: "Skin",
  Gyn: "Gynecologic",
};

const SHARER_PREVIEW_LIMIT = 3;
const EMPTY_BRIEFS: BriefingData[] = [];

function CanvasMdLogo() {
  return (
    <span className="er-logo" aria-label="CanvasMD">
      <svg className="er-logo-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M40,4 C16,4 4,14 4,24 C4,34 16,44 40,44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <rect x="28" y="12" width="16" height="2.5" rx="1.25" fill="currentColor" />
        <rect x="28" y="18" width="12" height="2.5" rx="1.25" fill="currentColor" opacity=".6" />
        <rect x="28" y="27" width="16" height="2.5" rx="1.25" fill="currentColor" />
        <rect x="28" y="33" width="10" height="2.5" rx="1.25" fill="currentColor" opacity=".6" />
        <rect x="14" y="21" width="8" height="2" rx="1" fill="currentColor" opacity=".5" />
        <rect x="17" y="18" width="2" height="8" rx="1" fill="currentColor" opacity=".5" />
      </svg>
      <span className="er-logo-word"><span>Canvas</span><b>MD</b></span>
    </span>
  );
}

function usefulPosts(article: BriefingArticle | null): BriefingSharer[] {
  if (!article) return [];
  const seen = new Set<string>();
  const sourceTitle = [article.title, article.journal].filter(Boolean).join(" ");
  return (article.posts ?? []).flatMap((post) => {
    const key = post.handle?.toLowerCase() || post.name.toLowerCase();
    if (seen.has(key)) return [];
    const receipt = [
      { text: post.text, tweetUrl: post.tweetUrl },
      ...(post.thread ?? []),
    ].find(({ text }) => isSubstantiveClinicianText(text, sourceTitle));
    if (!receipt?.text) return [];
    seen.add(key);
    return [{ ...post, text: receipt.text.trim(), tweetUrl: receipt.tweetUrl ?? post.tweetUrl }];
  });
}

function isSubstantiveClinicianText(text: string | null | undefined, sourceTitle: string): boolean {
  const value = text?.trim() ?? "";
  return Boolean(
    value
    && words(value).length >= 3
    && !/^rt\s+@/i.test(value)
    && !isTitleOnlyShare(value, sourceTitle),
  );
}

type NamedSharer = {
  name: string;
  handle: string | null;
  tweetUrl: string | null;
  score: number;
  order: number;
};

function sharerKey(sharer: { name: string; handle: string | null }) {
  return sharer.handle?.replace(/^@/, "").toLowerCase() || sharer.name.trim().toLowerCase();
}

function clinicianSharers(article: BriefingArticle | null): NamedSharer[] {
  if (!article) return [];
  if (article.sharerPeople?.length) {
    return article.sharerPeople.map((sharer, order) => ({
      name: sharer.name,
      handle: sharer.handle,
      tweetUrl: sharer.tweetUrl,
      score: 0,
      order,
    }));
  }
  const seen = new Set<string>();
  const names: NamedSharer[] = [];
  let order = 0;
  const add = (sharer: { name: string; handle: string | null; tweetUrl: string | null }, score: number) => {
    const key = sharerKey(sharer);
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push({ name: sharer.name, handle: sharer.handle, tweetUrl: sharer.tweetUrl, score, order: order++ });
  };

  for (const post of article.posts ?? []) {
    const engagementScore = (post.likes ?? 0) + (post.retweets ?? 0) * 2 + (post.quotes ?? 0) * 2 + Math.floor((post.views ?? 0) / 1000);
    if (!post.sourceLane || post.sourceLane === "clinician") add(post, engagementScore);
    for (const reposter of post.repostedBy ?? []) add(reposter, 0);
  }

  return names.sort((left, right) => right.score - left.score || left.order - right.order);
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][\p{L}\p{N}_-]+/gu, " ")
    .replace(/\b(?:new|paper|study|article|published|online)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function isTitleOnlyShare(text: string, title: string): boolean {
  const postWords = words(text);
  const titleWords = new Set(words(title));
  if (postWords.length < 5 || titleWords.size < 5) return false;
  const overlap = postWords.filter((word) => titleWords.has(word)).length;
  return overlap / postWords.length >= 0.6;
}

function clinicianSurname(name: string): string {
  const cleaned = name
    .replace(/,?\s+(?:MD|PhD|DO|MBBS|MBChB|MPH|MSc|MS|MBA|RN|FACP|FACS|FRCPC|FASTRO)\b.*$/i, "")
    .replace(/[.,;:]+$/, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || name;
}

function clinicianInitials(name: string): string {
  const cleaned = name.replace(/,?\s+(?:MD|PhD|DO)\b.*$/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function xAvatars(article: BriefingArticle | null): string[] {
  const seen = new Set<string>();
  const photos: string[] = [];
  const add = (src: string | null | undefined) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    photos.push(src);
  };
  for (const src of article?.faces ?? []) add(src);
  for (const person of article?.sharerPeople ?? []) add(person.avatar);
  for (const post of article?.posts ?? []) add(post.avatar);
  return photos;
}

function FacePile({ article, count }: { article: BriefingArticle | null; count: number }) {
  const photos = xAvatars(article);
  const visible = photos.slice(0, Math.min(3, photos.length));
  if (!visible.length) return null;
  const overflow = Math.max(0, count - visible.length);
  return (
    <span className="er-faces" aria-hidden="true">
      {visible.map((src) => <img src={src} alt="" loading="lazy" decoding="async" key={src} />)}
      {overflow > 0 && <span className="er-av-more">+{overflow}</span>}
    </span>
  );
}

function articleFromEditorial(item: EditorialArticle): BriefingArticle {
  return {
    title: item.title,
    url: item.url,
    journal: item.journal,
    domain: null,
    abstract: item.finding,
    description: null,
    sharers: item.sharedBy,
    kolSharers: item.sharedBy,
    publishers: [],
    faces: [],
    topLikes: 0,
    posts: [],
  };
}

function applyEvidenceOverlay(article: BriefingArticle | null, overlay: BriefingEvidenceOverlayItem | undefined): BriefingArticle | null {
  if (!article || !overlay) return article;
  return {
    ...article,
    kolSharers: overlay.kolSharers,
    faces: overlay.faces,
    posts: overlay.posts,
    sharerPeople: overlay.sharerPeople,
    authoredClinicianCount: overlay.authoredClinicianCount ?? article.authoredClinicianCount,
  };
}

function articleWithLiveEvidence(
  item: EditorialArticle,
  briefs: BriefingData[],
  overlay: BriefingEvidenceOverlayItem | undefined,
): BriefingArticle {
  const base = overlay ? findArticle(item, briefs) ?? articleFromEditorial(item) : articleFromEditorial(item);
  return applyEvidenceOverlay(base, overlay) ?? articleFromEditorial(item);
}

function PeerRow({ article, sharedBy }: { article: BriefingArticle | null; sharedBy: number }) {
  const sharers = clinicianSharers(article).slice(0, sharedBy);
  if (!sharers.length && sharedBy <= 0) return null;
  const named = sharers.slice(0, SHARER_PREVIEW_LIMIT);
  const others = Math.max(0, sharedBy - named.length);
  const surnames = named.map((sharer) => clinicianSurname(sharer.name));
  const availableComments = usefulPosts(article).length;
  const proof = shareCommentaryLabel(sharedBy, article?.authoredClinicianCount ?? availableComments, availableComments);
  return (
    <div className="er-peers">
      <FacePile article={article} count={sharedBy} />
      <div className="er-peer-copy">
        <p className="er-proof-count">{proof}</p>
        {named.length > 0 && (
          <p className="er-peers-who">
            <b>{surnames.join(", ")}</b>
            {others > 0 ? ` and ${others} other clinician${others === 1 ? "" : "s"}` : named.length === 1 ? "" : null}
          </p>
        )}
      </div>
    </div>
  );
}

function shareCommentaryLabel(sharedBy: number, authoredCount: number, availableCount: number): string {
  const shared = `Shared by ${sharedBy} clinician${sharedBy === 1 ? "" : "s"}`;
  if (authoredCount > availableCount) {
    if (availableCount <= 0) return `${shared} · ${authoredCount} commented · receipts unavailable`;
    return `${shared} · ${authoredCount} commented · ${availableCount} comment${availableCount === 1 ? "" : "s"} available`;
  }
  if (availableCount > 0) return `${shared} · ${availableCount} clinician comment${availableCount === 1 ? "" : "s"} available`;
  return shared;
}

function Voice({ post, extra = false }: { post: BriefingSharer; extra?: boolean }) {
  const handle = post.handle ? `@${post.handle.replace(/^@/, "")}` : null;
  return (
    <div className={`er-voice ${extra ? "er-voice-more" : ""}`}>
      <div className="er-who">
        {post.avatar
          ? <img src={post.avatar} alt="" loading="lazy" decoding="async" />
          : <span className="er-av" aria-hidden="true">{clinicianInitials(post.name)}</span>}
        <div>
          <b>{post.name}</b>
          {handle && <span className="er-handle">{handle}</span>}
        </div>
      </div>
      <p className="er-quote">{post.text}</p>
      {post.tweetUrl && <a className="er-xlink" href={post.tweetUrl} target="_blank" rel="noreferrer">View on X ↗</a>}
    </div>
  );
}

function PhysicianVoices({ article, sharedBy, expanded }: { article: BriefingArticle | null; sharedBy: number; expanded: boolean }) {
  const posts = usefulPosts(article);
  if (!posts.length) {
    if ((article?.authoredClinicianCount ?? 0) > 0) {
      return <p className="er-no-commentary">Clinicians commented, but no comment receipts are available.</p>;
    }
    return sharedBy > 0 ? <p className="er-no-commentary">Shared, no commentary yet.</p> : null;
  }
  const lead = posts[0];
  const rest = expanded ? posts.slice(1) : [];
  return (
    <div className={`er-convo ${posts.length === 1 ? "is-single" : ""}`}>
      <p className="er-voices-label">What clinicians are saying</p>
      <Voice post={lead} />
      {rest.map((post, index) => (
        <Voice post={post} extra key={`${post.handle ?? post.name}-${index}`} />
      ))}
    </div>
  );
}

function DevelopmentFinding({ text, label, expanded = false }: { text: string; label: string; expanded?: boolean }) {
  const [collapsible, setCollapsible] = useState(false);
  const findingRef = useRef<HTMLParagraphElement>(null);
  const findingId = useId();
  const finding = cleanReadoutExcerpt(text);

  useEffect(() => {
    const node = findingRef.current;
    if (!node || expanded) return;
    const measure = () => setCollapsible(node.scrollHeight > node.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, finding]);

  if (!finding) return null;
  return (
    <div className="er-excerpt">
      <span className="er-provenance">{label}</span>
      <p ref={findingRef} id={findingId} className={`er-finding ${!expanded ? "is-collapsed" : ""}`}>
        {finding}
      </p>
    </div>
  );
}

function articleContentType(item: EditorialArticle): string {
  const hay = `${item.evidence} ${item.sourceAction ?? ""} ${item.journal}`;
  if (/approval/i.test(hay)) return "FDA approval";
  if (/safety|warning/i.test(hay)) return "FDA safety";
  if (/label|regulatory|fast track|priority review|breakthrough/i.test(hay)) return "Regulatory";
  return "Paper";
}

function excerptLabel(item: EditorialArticle): string {
  if (item.findingLabel) return item.findingLabel;
  if (item.findingSource === "source") return "From the source";
  return "CanvasMD summary";
}

function SourceHeadline({ href, source, title, compact = false }: {
  href: string;
  source: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className={`er-source-headline ${compact ? "is-compact" : ""}`}>
      <span className="er-source">{source}</span>
      <h3 className="er-source-title">
        <a href={href} target="_blank" rel="noreferrer">{title} <span className="er-ext" aria-hidden="true">↗</span></a>
      </h3>
    </div>
  );
}

function validSupportLinks(links: HeroSupportLink[] | undefined, primaryUrl: string): HeroSupportLink[] {
  const seen = new Set<string>();
  return (links ?? []).filter((link) => {
    try {
      const url = new URL(link.url);
      const key = url.toString().toLowerCase();
      if (!/^https?:$/.test(url.protocol) || key === primaryUrl.toLowerCase() || seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}

function attachedSources(item: EditorialArticle, primaryUrl: string) {
  const primarySources = validSupportLinks(item.primarySources, primaryUrl);
  const supportingEvidence = validSupportLinks(item.supportingEvidence, primaryUrl);
  const relatedLinks = relatedCoverageLinks(item.relatedCoverage, primaryUrl, item.title);
  const relatedEpisodes = relatedLinks.filter((link) => link.kind === "episode").slice(0, 1);
  const related = relatedLinks.filter((link) => link.kind !== "episode").slice(0, 4);
  return { primarySources, supportingEvidence, related, relatedEpisodes };
}

function coverageSummary(item: EditorialArticle, primaryUrl: string): string {
  const { supportingEvidence, related } = attachedSources(item, primaryUrl);
  const parts: string[] = [];
  if (supportingEvidence.length) {
    parts.push(`Supporting study in ${supportingEvidence.map((link) => link.sourceLabel).join(", ")}.`);
  }
  if (related.length) {
    parts.push(`Coverage in ${related.map((link) => link.sourceLabel).join(", ")}.`);
  }
  return parts.join(" ");
}

function CoverageLinks({ item, primaryUrl, expanded }: { item: EditorialArticle; primaryUrl: string; expanded: boolean }) {
  const { primarySources, supportingEvidence, related } = attachedSources(item, primaryUrl);
  if (!primarySources.length && !supportingEvidence.length && !related.length) return null;
  if (!expanded) return null;
  const rows = [
    ...primarySources.map((link) => ({ role: "Anchor", link })),
    ...supportingEvidence.map((link) => ({ role: "Supporting study", link })),
    ...related.map((link) => ({ role: "Related coverage", link })),
  ];
  return (
    <div className="er-sources er-related-links is-open">
      {rows.map(({ role, link }) => (
        <div className="er-source-row" key={`${role}-${link.id}`}>
          <span className="er-role">{role}</span>
          <a href={link.url} target="_blank" rel="noreferrer">{link.sourceLabel} ↗</a>
        </div>
      ))}
    </div>
  );
}

function RelatedEpisode({ item, primaryUrl }: { item: EditorialArticle; primaryUrl: string }) {
  const link = attachedSources(item, primaryUrl).relatedEpisodes[0];
  if (!link) return null;
  return (
    <div className="er-related-episode">
      <div className="er-related-episode-heading">
        <span>Related episode</span>
        <a href={link.url} target="_blank" rel="noreferrer">{link.sourceLabel} ↗</a>
      </div>
      <p>{link.title}</p>
      {link.audioUrl && (
        <AudioQuote
          audioUrl={link.audioUrl}
          startMs={0}
          durationSeconds={link.durationSeconds}
          label="Listen here"
          eventId={link.id}
          eventLabel={link.title}
          accent="var(--area)"
        />
      )}
    </div>
  );
}

function discloseLabel(item: EditorialArticle, primaryUrl: string, extraComments: number): string {
  const { supportingEvidence, related } = attachedSources(item, primaryUrl);
  const parts: string[] = [];
  if (item.finding.trim()) parts.push(item.findingSource === "source" ? "Full source excerpt" : "Full summary");
  if (supportingEvidence.length) parts.push(supportingEvidence.map((link) => link.sourceLabel === "New England Journal of Medicine" ? "NEJM" : link.sourceLabel).join(", "));
  if (related.length) parts.push(`${related.length} related`);
  if (extraComments > 0) parts.push(`${extraComments} more available comment${extraComments === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Show more";
}

function Disclose({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="er-disclose" type="button" aria-expanded={open} onClick={onToggle}>
      <span>{open ? "Show less" : label}</span>
      <svg className="er-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function ArticleDevelopment({
  item,
  briefs,
  overlays,
  compact = false,
  numbered = false,
}: {
  item: EditorialArticle;
  briefs: BriefingData[];
  overlays: Map<string, BriefingEvidenceOverlayItem>;
  compact?: boolean;
  numbered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const overlay = overlays.get(item.id);
  const article = articleWithLiveEvidence(item, briefs, overlay);
  const href = article?.url || item.url;
  const sharedBy = article?.kolSharers ?? item.sharedBy;
  const contentType = articleContentType(item);
  const actionDate = contentType === "Paper" ? null : editionDateLabel(item.occurredOn);
  const authoredCount = usefulPosts(article).length;
  const extraComments = Math.max(0, authoredCount - 1);
  const canDisclose = Boolean(item.finding.trim()) || extraComments > 0 || Boolean(coverageSummary(item, href));
  return (
    <article className={`er-development ${compact ? "is-compact" : ""} ${open ? "is-open" : ""}`}>
      <div className="er-kicker">{editorialScopeLabel(item)}{numbered ? "" : ` · ${contentType}`}</div>
      <SourceHeadline href={href} source={item.journal} title={article?.title || item.title} compact={compact} />
      {contentType !== "Paper" && (
        <p className="er-action-date">Action date: {actionDate
          ? <time dateTime={item.occurredOn ?? undefined}>{actionDate}</time>
          : "Unavailable"}</p>
      )}
      <DevelopmentFinding text={item.finding} label={excerptLabel(item)} expanded={open} />
      <CoverageLinks item={item} primaryUrl={href} expanded={open} />
      <RelatedEpisode item={item} primaryUrl={href} />
      {overlay
        ? <PeerRow article={article} sharedBy={sharedBy} />
        : <p className="er-peers-pending">Updating clinician evidence...</p>}
      {overlay && <PhysicianVoices article={article} sharedBy={sharedBy} expanded={open} />}
      {canDisclose && <Disclose open={open} label={discloseLabel(item, href, extraComments)} onToggle={() => setOpen((value) => !value)} />}
    </article>
  );
}

function CompactClinicianComment({ article }: { article: BriefingArticle | null }) {
  const post = usefulPosts(article)[0];
  if (!post) return null;
  return <Voice post={post} />;
}

function EpisodeDevelopment({ item, briefs, numbered = false }: { item: EditorialEpisodeFeature; briefs: BriefingData[]; numbered?: boolean }) {
  const [open, setOpen] = useState(false);
  const episode = findEpisode(item, briefs);
  const sourceHref = episode?.sourceUrl || item.url;
  const audioUrl = episode?.audioUrl ?? null;
  const canDisclose = Boolean(item.finding.trim());
  return (
    <article className={`er-development er-development-episode ${open ? "is-open" : ""}`}>
      <div className="er-kicker">{editorialScopeLabel(item)}{!numbered && <> · <b>Podcast</b></>}</div>
      <SourceHeadline href={sourceHref} source={episode?.show || item.show} title={episode?.title || item.title} />
      <DevelopmentFinding text={item.finding} label="From the episode" expanded={open} />
      <EpisodeAudio
        audioUrl={audioUrl}
        sourceHref={sourceHref}
        title={episode?.title || item.title}
        durationSeconds={episode?.durationSeconds}
        episodeId={episode?.episodeId ?? item.id}
        evidence={item.evidence}
      />
      {canDisclose && <Disclose open={open} label="Full description" onToggle={() => setOpen((value) => !value)} />}
    </article>
  );
}

function EpisodeAudio({
  audioUrl,
  sourceHref,
  title,
  durationSeconds,
  episodeId,
  evidence,
}: {
  audioUrl: string | null;
  sourceHref: string;
  title: string;
  durationSeconds?: number | null;
  episodeId?: string | null;
  evidence?: string;
}) {
  if (!audioUrl) {
    return (
      <div className="er-episode-actions">
        <a className="er-source-link" href={sourceHref} target="_blank" rel="noreferrer">Open episode ↗</a>
        {evidence && <small>{evidence}</small>}
      </div>
    );
  }
  return (
    <div className="er-episode-audio">
      <AudioQuote
        audioUrl={audioUrl}
        startMs={0}
        durationSeconds={durationSeconds}
        label="Listen here"
        eventId={episodeId ?? null}
        eventLabel={title}
        accent="var(--area)"
      />
      <div className="er-episode-actions">
        <a className="er-source-link" href={sourceHref} target="_blank" rel="noreferrer">Episode page ↗</a>
        {evidence && <small>{evidence}</small>}
      </div>
    </div>
  );
}

function isEpisodeDevelopment(item: EditorialDevelopment): item is EditorialEpisodeFeature {
  return "kind" in item && item.kind === "episode";
}

function CompactDevelopment({
  item,
  overlays,
}: {
  item: EditorialArticle;
  overlays: Map<string, BriefingEvidenceOverlayItem>;
}) {
  return <ArticleDevelopment item={item} briefs={EMPTY_BRIEFS} overlays={overlays} compact />;
}

function Development({ item, briefs, overlays, numbered = false }: { item: EditorialDevelopment; briefs: BriefingData[]; overlays: Map<string, BriefingEvidenceOverlayItem>; numbered?: boolean }) {
  return isEpisodeDevelopment(item)
    ? <EpisodeDevelopment item={item} briefs={briefs} numbered={numbered} />
    : <ArticleDevelopment item={item} briefs={briefs} overlays={overlays} numbered={numbered} />;
}

function NumberedDevelopment({ item, briefs, overlays, position }: { item: EditorialDevelopment; briefs: BriefingData[]; overlays: Map<string, BriefingEvidenceOverlayItem>; position: number }) {
  const contentType = isEpisodeDevelopment(item) ? "Podcast" : articleContentType(item);
  return (
    <div className="er-numbered-development">
      <div className="er-story-order">{position} <span>·</span> {contentType}</div>
      <Development item={item} briefs={briefs} overlays={overlays} numbered />
    </div>
  );
}

function ReadoutLoading() {
  return (
    <div className="er-loading-stack" role="status" aria-label="Loading The Readout">
      {[0, 1].map((index) => (
        <div className="er-loading-card" aria-hidden="true" key={index}>
          <span className="er-loading-kicker" />
          <span className="er-loading-headline" />
          <span className="er-loading-line" />
          <span className="er-loading-line is-short" />
          <span className="er-loading-source" />
        </div>
      ))}
    </div>
  );
}

function payloadKey(area: EditionArea, window: ReadoutWindow) {
  return `${area}:${readoutWindowDays(window)}`;
}

function editionDateLabel(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00-04:00`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export default function EditorialReadout({ initialPayload }: { initialPayload: ReadoutWindowPayload }) {
  const [area, setArea] = useState<EditionArea>("All");
  const [readoutWindow, setReadoutWindow] = useState<ReadoutWindow>("today");
  const [windowPayload, setWindowPayload] = useState<ReadoutWindowPayload | null>(initialPayload);
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [alsoOpen, setAlsoOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const payloadCache = useRef(new Map<string, ReadoutWindowPayload>([[payloadKey("All", "today"), initialPayload]]));

  useEffect(() => {
    const key = payloadKey(area, readoutWindow);
    const cached = payloadCache.current.get(key);
    if (cached) {
      setWindowPayload(cached);
      setLoadingWindow(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setWindowPayload(null);
    setLoadingWindow(true);
    setLoadError(null);
    fetch("/api/briefing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "readout-window", area, days: readoutWindowDays(readoutWindow) }),
      cache: "no-store",
    }).then(async (response) => {
      if (response.ok) return response.json() as Promise<ReadoutWindowPayload>;
      const detail = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(detail?.error || `The Readout returned ${response.status}.`);
    }).then((payload) => {
      if (cancelled) return;
      payloadCache.current.set(key, payload);
      setWindowPayload(payload);
    })
      .catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "The Readout could not be loaded."); })
      .finally(() => { if (!cancelled) setLoadingWindow(false); });
    return () => { cancelled = true; };
  }, [area, readoutWindow, retryVersion]);

  const editionHistory = useMemo(() => {
    const history = (windowPayload?.editionHistory ?? []).filter(isReadoutEditionSnapshot);
    if (readoutWindow !== "7d") return history;
    const todayPayload = payloadCache.current.get(payloadKey(area, "today"));
    const current = readoutEditionPreferNonEmpty(
      todayPayload ? resolveReadoutTodayEdition(area, todayPayload) : null,
      windowPayload?.currentEdition,
    );
    return readoutEditionHistoryIncludingCurrent(current, history);
  }, [area, readoutWindow, windowPayload]);
  const historyDays = readoutWindow === "7d"
    ? new Set(editionHistory.map((snapshot) => snapshot.editionDate)).size
    : windowPayload?.historyDays ?? 0;
  const sevenDayEdition = useMemo(
    () => readoutWindow === "7d" ? sevenDayEditionDevelopments(editionHistory) : { developments: [], relevant: [] },
    [editionHistory, readoutWindow],
  );
  const todayEdition = useMemo(() => {
    if (!windowPayload || readoutWindow !== "today") return null;
    return resolveReadoutTodayEdition(area, windowPayload);
  }, [area, readoutWindow, windowPayload]);
  const currentWorth = useMemo(() => {
    if (readoutWindow === "7d") return sevenDayEdition.developments.slice(0, 5);
    return todayEdition?.developments.map((entry) => entry.development) ?? [];
  }, [readoutWindow, sevenDayEdition, todayEdition]);
  const moreFromSevenDays = useMemo(() => readoutWindow === "7d"
    ? [...sevenDayEdition.developments.slice(5).filter((item): item is EditorialArticle => !isEpisodeDevelopment(item)), ...sevenDayEdition.relevant]
      .filter((item, index, all) => all.findIndex((candidate) => sameEditorialArticle(candidate, item)) === index)
    : [], [readoutWindow, sevenDayEdition]);
  const relevant = useMemo(() => readoutWindow === "7d"
    ? []
    : todayEdition?.relevant.map((entry) => entry.article) ?? [], [readoutWindow, todayEdition]);
  const payloadEvidenceOverlays = useMemo(
    () => new Map((windowPayload?.overlays ?? []).map((overlay) => [overlay.id, overlay])),
    [windowPayload],
  );
  const activeEvidenceOverlays = payloadEvidenceOverlays;
  const worth = currentWorth;
  const usingFallback = readoutWindow === "today" && (todayEdition?.fallbackWindowHours ?? windowPayload?.fallbackWindowHours) === 72;
  const pageReady = !loadingWindow && !!windowPayload;
  const hasRegulatoryDevelopment = (windowPayload?.regulatoryCards.length ?? 0) > 0 || worth.some((item) =>
    !isEpisodeDevelopment(item) && /approval|label|safety|regulatory/i.test(item.evidence));

  const listenBriefs = useMemo(() => windowPayload ? liveListenBriefs(windowPayload) : [], [windowPayload]);
  const listen = useMemo(() => {
    return listenForArea(NEW_TO_LISTEN, listenBriefs, area, worth.filter(isEpisodeDevelopment));
  }, [area, listenBriefs, worth]);
  const listenEntries = useMemo(() => readoutWindow === "7d"
    ? sevenDayEditionListen(editionHistory, currentWorth)
    : listen.map((item) => {
      const matched = findEpisode(item, listenBriefs);
      return {
        item,
        episode: matched?.episodeId
          ? windowPayload?.episodes.find((episode) => episode.episodeId === matched.episodeId) ?? null
          : null,
      };
    }),
  [currentWorth, editionHistory, listen, listenBriefs, readoutWindow, windowPayload]);
  const briefs = listenBriefs;
  const displayedEditionDate = readoutWindow === "today"
    ? editionDateLabel(todayEdition?.editionDate)
    : null;

  const chooseArea = (candidate: EditionArea) => {
    if (candidate === area) return;
    const cached = payloadCache.current.get(payloadKey(candidate, readoutWindow)) ?? null;
    setArea(candidate);
    setWindowPayload(cached);
    setLoadingWindow(!cached);
    setLoadError(null);
    setAlsoOpen(false);
    setMoreOpen(false);
  };

  const chooseWindow = (candidate: ReadoutWindow) => {
    if (candidate === readoutWindow) return;
    const cached = payloadCache.current.get(payloadKey(area, candidate)) ?? null;
    setReadoutWindow(candidate);
    setWindowPayload(cached);
    setLoadingWindow(!cached);
    setLoadError(null);
    setMoreOpen(false);
  };

  const retryLoad = () => {
    payloadCache.current.delete(payloadKey(area, readoutWindow));
    setWindowPayload(null);
    setLoadingWindow(true);
    setLoadError(null);
    setRetryVersion((value) => value + 1);
  };

  return (
    <main className={`er-page er-area-${area.toLowerCase()}`}>
      <header className="er-header">
        <div className="er-brand">
          <CanvasMdLogo />
        </div>
        <nav className="er-filters" aria-label="Tumor area">
          {EDITION_AREAS.map((candidate) => (
            <button key={candidate} type="button" aria-pressed={candidate === area} className={candidate === area ? "active" : ""} onClick={() => chooseArea(candidate)}>
              {candidate}
            </button>
          ))}
        </nav>
      </header>

      <section className="er-section er-worth">
        <div className="er-section-title">
          <div>
            {area !== "All" && <p className="er-eyebrow">{AREA_LABELS[area].toUpperCase()}</p>}
            <h2>The Readout</h2>
            <p className="er-readout-dek">The papers, approvals, and episodes oncology clinicians are sharing.</p>
            {displayedEditionDate && <p className="er-edition-date">Edition: {displayedEditionDate}</p>}
          </div>
          <div className="er-window-tabs" role="tablist" aria-label="Readout window">
            <button type="button" role="tab" aria-selected={readoutWindow === "today"} className={readoutWindow === "today" ? "active" : ""} onClick={() => chooseWindow("today")}>Today</button>
            <button type="button" role="tab" aria-selected={readoutWindow === "7d"} className={readoutWindow === "7d" ? "active" : ""} onClick={() => chooseWindow("7d")}>7 days</button>
          </div>
        </div>
        {windowPayload?.stale && <p className="er-window-note" role="status">Showing the last saved edition while live evidence refreshes.</p>}
        {pageReady && readoutWindow === "7d" && historyDays < 7 && <p className="er-window-note">Showing {historyDays} archived morning edition{historyDays === 1 ? "" : "s"} so far. This view will fill as new editions publish.</p>}
        {pageReady && usingFallback && <p className="er-window-note">No new development cleared the bar in 24 hours. Showing the strongest qualifying development from the past 72 hours.</p>}
        {loadError ? <div className="er-load-error" role="alert"><p>The Readout could not load this view.</p><button type="button" onClick={retryLoad}>Try again</button></div> : !pageReady ? <ReadoutLoading /> : worth.length > 0 ? worth.map((item, index) => <NumberedDevelopment item={item} briefs={briefs} overlays={activeEvidenceOverlays} position={index + 1} key={item.id} />) : readoutWindow === "today" && area !== "All" ? (
          <div className="er-empty">
            <p>Nothing new cleared the bar in {AREA_LABELS[area]} today.</p>
            <button className="er-empty-history" type="button" onClick={() => chooseWindow("7d")}>See the last 7 days <span aria-hidden="true">&rarr;</span></button>
          </div>
        ) : (
          <p className="er-empty">No development cleared the bar in this area during the {readoutWindow === "7d" ? "past 7 days" : "past 24 hours"}.</p>
        )}
      </section>

      {pageReady && readoutWindow === "7d" && moreFromSevenDays.length > 0 && (
        <section className="er-section er-relevant er-seven-day-more">
          <button className="er-section-title er-section-button" type="button" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen}>
            <h2>More from the last 7 days</h2><span>{moreOpen ? "Show less \u2212" : `Show ${moreFromSevenDays.length} +`}</span>
          </button>
          {moreOpen && <div className="er-compact-list">{moreFromSevenDays.map((item) => (
            <CompactDevelopment key={item.id} item={item} overlays={activeEvidenceOverlays} />
          ))}</div>}
        </section>
      )}

      {pageReady && relevant.length > 0 && (
        <section className="er-section er-relevant">
          {relevant.length > 1 ? (
            <button className="er-section-title er-section-button" type="button" onClick={() => setAlsoOpen((value) => !value)} aria-expanded={alsoOpen}>
              <h2>Also Relevant</h2><span>{alsoOpen ? "Show less \u2212" : `Show ${relevant.length - 1} more +`}</span>
            </button>
          ) : (
            <div className="er-section-title"><h2>Also Relevant</h2></div>
          )}
          <div className="er-compact-list">{(alsoOpen || relevant.length === 1 ? relevant : relevant.slice(0, 1)).map((item) => (
            <CompactDevelopment key={item.id} item={item} overlays={activeEvidenceOverlays} />
          ))}</div>
        </section>
      )}

      {pageReady && listenEntries.length > 0 && (
        <section className="er-section er-listen">
          <div className="er-section-title"><h2>Listen</h2></div>
          <div className="er-listen-grid">
            {listenEntries.map(({ item, episode }) => {
              const sourceHref = episode?.sourceUrl || item.url;
              return (
                <article className="er-listen-card" key={item.id}>
                  {episode?.showArt && <img className="er-listen-art" src={episode.showArt} alt="" loading="lazy" decoding="async" />}
                  <div className="er-listen-copy">
                    <a className="er-listen-title" href={sourceHref} target="_blank" rel="noreferrer">
                      <b>{episode?.title || item.hook}</b>
                    </a>
                    <p>{episode?.show || item.show}</p>
                  </div>
                  {episode?.audioUrl && (
                    <div className="er-listen-audio">
                      <AudioQuote
                        audioUrl={episode.audioUrl}
                        startMs={0}
                        durationSeconds={episode.durationSeconds}
                        label="Listen here"
                        eventId={episode.episodeId ?? item.id}
                        eventLabel={episode.title}
                        accent="var(--area)"
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {pageReady && <section className="er-section er-regulatory">
        <div className="er-section-title">
          <h2>Regulatory Watch</h2>
          <span>{windowPayload?.designationCards.length
            ? `${windowPayload.designationCards.length} designation${windowPayload.designationCards.length === 1 ? "" : "s"}`
            : hasRegulatoryDevelopment ? "Covered above" : "Clear"}</span>
        </div>
        {(windowPayload?.designationCards ?? []).map((designation) => (
          <article key={designation.id}>
            <span>{designation.label.replace(/^FDA\s+/i, "").toUpperCase()}</span>
            <div>
              <b>{designation.headline}</b>
              <p className="er-regulatory-date">Action date: {editionDateLabel(designation.occurredOn)
                ? <time dateTime={designation.occurredOn ?? undefined}>{editionDateLabel(designation.occurredOn)}</time>
                : "Unavailable"}</p>
              <p>{designation.description ? `${designation.description} ` : ""}This is not an approval.</p>
              <a href={designation.url} target="_blank" rel="noreferrer">{designation.sourceLabel} ↗</a>
            </div>
          </article>
        ))}
        {!windowPayload?.designationCards.length && <p className="er-regulatory-empty">{hasRegulatoryDevelopment
          ? `No additional ${area === "All" ? "oncology" : AREA_LABELS[area].toLowerCase()} approval, safety warning, or designation in this window.`
          : `No new ${area === "All" ? "oncology" : AREA_LABELS[area].toLowerCase()} approval, safety warning, or designation in this window.`}</p>}
      </section>}

      <footer className="er-footer"><span>{pageReady ? "Evidence connected to the live Readout." : "Loading the live Readout..."}</span><span>CanvasMD</span></footer>
    </main>
  );
}
