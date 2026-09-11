"use client";
import { activeReadoutEditionDate, READOUT_WINDOWS, readoutWindowKeyboardTarget } from "./readoutRequest";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BriefingArticle, BriefingData, BriefingEvidenceOverlay, BriefingEvidenceOverlayItem, BriefingSharer, HeroSupportLink, ReadoutWindowPayload } from "@/lib/types";
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
import DailyReadoutAudio from "@/components/DailyReadoutAudio";
import ReadoutArticleCard from "@/components/ReadoutArticleCard";
import ReadoutVoice from "@/components/ReadoutVoice";
import { articleExpansion, articleSourceText, articleTextPreview, readoutRegulatoryCoverage, regulatoryApprovalSourceText, sourceLinkKey, sourceLinkLabel } from "@/lib/readoutPresentation";
import {
  readoutWindowDays,
  type ReadoutWindow,
} from "./readoutRequest";
import {
  EDITION_AREAS,
  ARCHIVED_LISTEN_MEDIA,
  cleanClinicianText,
  cleanReadoutExcerpt,
  displayReadoutTitle,
  editorialScopeLabel,
  findArticle,
  findEpisode,
  listenCardTitle,
  relatedCoverageLinks,
  regulatoryWatchArticles,
  sameEditorialArticle,
  type EditorialArticle,
  type EditorialDevelopment,
  type EditorialEpisodeFeature,
  type EditionArea,
} from "./edition";
import ConferenceTeaser from "./ConferenceTeaser";
import type { ConferenceMeeting } from "@/lib/conference";
import { timeAgoLabel } from "@/lib/timeAgo";

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
const fullOverlayCache = new Map<string, Promise<BriefingEvidenceOverlayItem | null>>();

function loadFullEvidenceOverlay(item: EditorialDevelopment): Promise<BriefingEvidenceOverlayItem | null> {
  const cached = fullOverlayCache.get(item.id);
  if (cached) return cached;
  const card = isEpisodeDevelopment(item)
    ? {
        id: item.id,
        episodeId: item.episodeId,
        title: item.title,
        url: item.url,
      }
    : {
        id: item.id,
        title: item.title,
        url: item.url,
        doi: item.match.doi,
        pmid: item.match.pmid,
        titleIncludes: item.match.titleIncludes,
        articleIds: item.articleIds ?? [],
      };
  const request = fetch("/api/briefing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "evidence-overlay",
      windowHours: 168,
      cards: [card],
    }),
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Evidence details returned ${response.status}.`);
    const payload = await response.json() as BriefingEvidenceOverlay;
    return payload.overlays.find((overlay) => overlay.id === item.id) ?? null;
  }).then((overlay) => {
    if (!overlay) fullOverlayCache.delete(item.id);
    return overlay;
  }).catch(() => {
    fullOverlayCache.delete(item.id);
    return null;
  });
  fullOverlayCache.set(item.id, request);
  return request;
}

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
    ]
      .map((candidate) => ({ ...candidate, text: cleanClinicianText(candidate.text) }))
      .find(({ text }) => isSubstantiveClinicianText(text, sourceTitle));
    if (!receipt?.text) return [];
    seen.add(key);
    return [{ ...post, text: receipt.text, tweetUrl: receipt.tweetUrl ?? post.tweetUrl }];
  });
}

function isSubstantiveClinicianText(text: string | null | undefined, sourceTitle: string): boolean {
  const value = text?.trim() ?? "";
  return Boolean(
    value
    && words(value).length >= 3
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
  const loadedComments = usefulPosts(article).length;
  const availableComments = Math.max(loadedComments, article?.authoredClinicianCount ?? 0);
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
  const commented = Math.max(authoredCount, availableCount);
  return commented > 0 ? `${shared} · ${commented} commented` : shared;
}

function PhysicianVoices({
  article,
  sharedBy,
  expanded,
  loadingMore = false,
  loadFailed = false,
}: {
  article: BriefingArticle | null;
  sharedBy: number;
  expanded: boolean;
  loadingMore?: boolean;
  loadFailed?: boolean;
}) {
  const posts = usefulPosts(article);
  if (!posts.length) return null;
  const lead = posts[0];
  const rest = expanded ? posts.slice(1) : [];
  return (
    <div className={`er-convo ${posts.length === 1 ? "is-single" : ""}`}>
      <p className="er-voices-label">What clinicians are saying</p>
      <ReadoutVoice post={lead} expanded={expanded} cleanText={cleanClinicianText} />
      {rest.map((post, index) => (
        <ReadoutVoice post={post} extra expanded cleanText={cleanClinicianText} key={`${post.handle ?? post.name}-${index}`} />
      ))}
      {expanded && loadingMore && <p className="er-no-commentary" role="status">Loading remaining comments...</p>}
      {expanded && loadFailed && <p className="er-no-commentary">The remaining comments could not be loaded.</p>}
    </div>
  );
}

function DevelopmentFinding({
  text,
  expandedText,
  expanded = false,
  preservePreview = false,
}: {
  text: string;
  expandedText?: string | null;
  expanded?: boolean;
  preservePreview?: boolean;
}) {
  const finding = expanded
    ? cleanReadoutExcerpt(expandedText || text)
    : preservePreview ? cleanReadoutExcerpt(text) : articleTextPreview(cleanReadoutExcerpt(text));

  if (!finding) return null;
  return (
    <div className="er-excerpt">
      <p className="er-finding">
        {finding}
      </p>
    </div>
  );
}

function articleContentType(item: EditorialArticle): string {
  if (item.publicationClass && item.publicationClass !== "research") return { review: "Review", commentary: "Commentary", preprint: "Preprint", guideline: "Guideline", unknown: "Article" }[item.publicationClass];
  const hay = `${item.evidence} ${item.sourceAction ?? ""} ${item.journal}`;
  if (/approval/i.test(hay)) return "FDA approval";
  if (/safety|warning/i.test(hay)) return "FDA safety";
  if (/label|regulatory|fast track|priority review|breakthrough/i.test(hay)) return "Regulatory";
  if (/preprint|biorxiv|medrxiv|research\s*square|ssrn/i.test(hay)) return "Preprint";
  return "Paper";
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
        <div className="er-source-row" key={sourceLinkKey(role, link.url)}>
          <span className="er-role">{role}</span>
          <a href={link.url} target="_blank" rel="noreferrer">{sourceLinkLabel(link)}</a>
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
        <a href={link.url} target="_blank" rel="noreferrer">{sourceLinkLabel(link)}</a>
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

function Disclose({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="er-disclose" type="button" aria-expanded={open} onClick={onToggle}>
      <span>{open ? "Show less" : label}</span>
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
  const [detailOverlay, setDetailOverlay] = useState<BriefingEvidenceOverlayItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailLoadFailed, setDetailLoadFailed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const overlay = detailOverlay ?? overlays.get(item.id);
  const article = articleWithLiveEvidence(item, briefs, overlay);
  const href = article?.url || item.url;
  const sharedBy = article?.kolSharers ?? item.sharedBy;
  const contentType = articleContentType(item);
  const isResearch = !["FDA approval", "FDA safety", "Regulatory"].includes(contentType);
  // The footer stamps a compact age (13h, 3d) so it stays on one line beside the
  // disclosure; the full date is kept for assistive tech and the hover title.
  const dateWord = isResearch ? "Published" : "Action date";
  const fullDate = editionDateLabel(item.occurredOn);
  const dateStamp = timeAgoLabel(item.occurredOn);
  const authoredCount = usefulPosts(article).length;
  const availableComments = Math.max(authoredCount, article?.authoredClinicianCount ?? 0);
  // FDA paragraph boundaries select the source preview, so retain them until that
  // selection has happened. Cleaning first would collapse a later paragraph into
  // the first one and make the collapsed card misleading.
  const rawSourceText = item.sourceExcerpt || item.finding;
  const source = contentType === "FDA approval"
    ? (() => {
        const approvalSource = regulatoryApprovalSourceText(rawSourceText);
        return {
          preview: cleanReadoutExcerpt(approvalSource.preview),
          full: cleanReadoutExcerpt(approvalSource.full),
        };
      })()
    : articleSourceText(cleanReadoutExcerpt(item.finding), cleanReadoutExcerpt(rawSourceText));
  const expansion = articleExpansion(
    source,
    usefulPosts(article).map((post) => post.text ?? ""),
    availableComments,
    contentType === "FDA approval",
  );
  const links = attachedSources(item, href);
  const hasMoreLinks = links.primarySources.length + links.supportingEvidence.length + links.related.length > 0;
  const canDisclose = expansion.canExpand || hasMoreLinks;
  const sourceLabel = item.sourceExcerpt || item.findingSource === "source" ? "Full source excerpt" : "Full summary";
  const disclosureLabel = [expansion.canExpand ? expansion.label.replace("Full source excerpt", sourceLabel) : null, hasMoreLinks ? "Sources and related coverage" : null].filter(Boolean).join(" · ");
  const toggleDisclosure = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "start", behavior: "auto" }));
    if (!nextOpen || detailOverlay || loadingDetails || authoredCount >= availableComments) return;
    setLoadingDetails(true);
    setDetailLoadFailed(false);
    loadFullEvidenceOverlay(item).then((details) => {
      if (details) setDetailOverlay(details);
      else setDetailLoadFailed(true);
    }).finally(() => setLoadingDetails(false));
  };
  return (
    <ReadoutArticleCard
      articleRef={cardRef}
      className={`has-kicker-source is-collapsible ${compact ? "is-compact" : ""} ${open ? "is-open" : ""}`}
      href={href}
      source={item.journal}
      title={displayReadoutTitle(article?.title || item.title)}
      compact={compact}
      beforeSource={
        <div className="er-kicker-row">
          <div className="er-kicker">{editorialScopeLabel(item)}{item.studySetting === "preclinical" ? " · PRECLINICAL" : ""}{numbered ? "" : ` · ${contentType}`}</div>
          <span className="er-kicker-source">{item.journal}</span>
        </div>
      }
      footer={
        <div className="er-foot">
          {dateStamp ? (
            <p className="er-action-date"><span className="er-sr-only">{dateWord} </span><time dateTime={item.occurredOn ?? undefined} title={fullDate ? `${dateWord} ${fullDate}` : undefined}>{dateStamp}</time></p>
          ) : !isResearch ? (
            <p className="er-action-date">Date unavailable</p>
          ) : <span />}
          {canDisclose && <Disclose open={open} label={disclosureLabel} onToggle={toggleDisclosure} />}
        </div>
      }
    >
      <DevelopmentFinding text={source.preview} expandedText={source.full} expanded={open} preservePreview={contentType === "FDA approval"} />
      <CoverageLinks item={item} primaryUrl={href} expanded={open} />
      <RelatedEpisode item={item} primaryUrl={href} />
      {overlay
        ? <PeerRow article={article} sharedBy={sharedBy} />
        : <p className="er-peers-pending">Updating clinician evidence...</p>}
      {overlay && <PhysicianVoices article={article} sharedBy={sharedBy} expanded={open} loadingMore={loadingDetails} loadFailed={detailLoadFailed} />}
    </ReadoutArticleCard>
  );
}

function EpisodeDevelopment({
  item,
  briefs,
  overlays,
  numbered = false,
}: {
  item: EditorialEpisodeFeature;
  briefs: BriefingData[];
  overlays: Map<string, BriefingEvidenceOverlayItem>;
  numbered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [detailOverlay, setDetailOverlay] = useState<BriefingEvidenceOverlayItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailLoadFailed, setDetailLoadFailed] = useState(false);
  const episode = findEpisode(item, briefs);
  const overlay = detailOverlay ?? overlays.get(item.id);
  const sourceHref = episode?.sourceUrl || item.url;
  const audioUrl = episode?.audioUrl ?? item.audioUrl ?? null;
  const article = applyEvidenceOverlay({
    title: episode?.title || item.title,
    url: sourceHref,
    journal: episode?.show || item.show,
    domain: null,
    abstract: item.finding,
    description: null,
    sharers: overlay?.kolSharers ?? 0,
    kolSharers: overlay?.kolSharers ?? 0,
    publishers: [],
    faces: [],
    topLikes: 0,
    posts: [],
  }, overlay);
  const sharedBy = article?.kolSharers ?? 0;
  const authoredCount = usefulPosts(article).length;
  const availableComments = Math.max(authoredCount, article?.authoredClinicianCount ?? 0);
  const expansion = articleExpansion({ preview: cleanReadoutExcerpt(item.finding), full: cleanReadoutExcerpt(item.finding) }, usefulPosts(article).map((post) => post.text ?? ""), availableComments);
  const canDisclose = expansion.canExpand;
  const disclose = expansion.label.replace("Full source excerpt", "Full description");
  const toggleDisclosure = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen || detailOverlay || loadingDetails || authoredCount >= availableComments) return;
    setLoadingDetails(true);
    setDetailLoadFailed(false);
    loadFullEvidenceOverlay(item).then((details) => {
      if (details) setDetailOverlay(details);
      else setDetailLoadFailed(true);
    }).finally(() => setLoadingDetails(false));
  };
  return (
    <ReadoutArticleCard
      className={`er-development-episode ${open ? "is-open" : ""}`}
      href={sourceHref}
      source={episode?.show || item.show}
      title={episode?.title || item.title}
      beforeSource={<div className="er-kicker">{editorialScopeLabel(item)}{!numbered && <> · <b>Podcast</b></>}</div>}
    >
      <DevelopmentFinding text={item.finding} expanded={open} />
      {overlay
        ? <PeerRow article={article} sharedBy={sharedBy} />
        : <p className="er-peers-pending">Updating clinician evidence...</p>}
      {overlay && <PhysicianVoices article={article} sharedBy={sharedBy} expanded={open} loadingMore={loadingDetails} loadFailed={detailLoadFailed} />}
      <EpisodeAudio
        audioUrl={audioUrl}
        sourceHref={sourceHref}
        title={episode?.title || item.title}
        durationSeconds={episode?.durationSeconds ?? item.durationSeconds}
        episodeId={episode?.episodeId ?? item.episodeId ?? item.id}
        evidence={item.evidence}
      />
      {canDisclose && <Disclose open={open} label={disclose || "Show more"} onToggle={toggleDisclosure} />}
    </ReadoutArticleCard>
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
        <a className="er-source-link" href={sourceHref} target="_blank" rel="noreferrer">Open episode</a>
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
        <a className="er-source-link" href={sourceHref} target="_blank" rel="noreferrer">Episode page</a>
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
    ? <EpisodeDevelopment item={item} briefs={briefs} overlays={overlays} numbered={numbered} />
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

const readoutPayloadInflight = new Map<string, Promise<ReadoutWindowPayload>>();

function fetchReadoutPayload(area: EditionArea, window: ReadoutWindow): Promise<ReadoutWindowPayload> {
  const key = payloadKey(area, window);
  const existing = readoutPayloadInflight.get(key);
  if (existing) return existing;
  const request = fetch("/api/briefing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "readout-window", area, days: readoutWindowDays(window) }),
    cache: "no-store",
  }).then(async (response) => {
    if (response.ok) return response.json() as Promise<ReadoutWindowPayload>;
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error || `The Readout returned ${response.status}.`);
  }).finally(() => readoutPayloadInflight.delete(key));
  readoutPayloadInflight.set(key, request);
  return request;
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

export default function EditorialReadout({ initialPayload, conferenceMeetings = [] }: { initialPayload: ReadoutWindowPayload; conferenceMeetings?: ConferenceMeeting[] }) {
  const [area, setArea] = useState<EditionArea>("All");
  const [readoutWindow, setReadoutWindow] = useState<ReadoutWindow>("today");
  const [requestedArea, setRequestedArea] = useState<EditionArea>("All");
  const [requestedWindow, setRequestedWindow] = useState<ReadoutWindow>("today");
  const [windowPayload, setWindowPayload] = useState<ReadoutWindowPayload | null>(initialPayload);
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [alsoOpen, setAlsoOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const payloadCache = useRef(new Map<string, ReadoutWindowPayload>([[payloadKey("All", "today"), initialPayload]]));
  const windowTabRefs = useRef<Record<ReadoutWindow, HTMLButtonElement | null>>({ today: null, "7d": null });

  useEffect(() => {
    let refreshedAt = Date.now();
    let editionDate = activeReadoutEditionDate();
    const refreshIfNeeded = () => {
      if (document.visibilityState === "hidden") return;
      const date = activeReadoutEditionDate();
      if (Date.now() - refreshedAt < 5 * 60_000 && date === editionDate) return;
      refreshedAt = Date.now();
      editionDate = date;
      payloadCache.current.clear();
      setRetryVersion((version) => version + 1);
    };
    const timer = window.setInterval(refreshIfNeeded, 60_000);
    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener("visibilitychange", refreshIfNeeded);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshIfNeeded); document.removeEventListener("visibilitychange", refreshIfNeeded); };
  }, []);

  useEffect(() => {
    const key = payloadKey(requestedArea, requestedWindow);
    const cached = payloadCache.current.get(key);
    if (cached) {
      setArea(requestedArea);
      setReadoutWindow(requestedWindow);
      setWindowPayload(cached);
      setLoadingWindow(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadingWindow(true);
    setLoadError(null);
    fetchReadoutPayload(requestedArea, requestedWindow).then((payload) => {
      if (cancelled) return;
      payloadCache.current.set(key, payload);
      setArea(requestedArea);
      setReadoutWindow(requestedWindow);
      setWindowPayload(payload);
    })
      .catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "The Readout could not be loaded."); })
      .finally(() => { if (!cancelled) setLoadingWindow(false); });
    return () => { cancelled = true; };
  }, [requestedArea, requestedWindow, retryVersion]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const queue: Array<[EditionArea, ReadoutWindow]> = [
          ["All", "7d"],
          ...EDITION_AREAS.filter((candidate) => candidate !== "All")
            .map((candidate): [EditionArea, ReadoutWindow] => [candidate, "today"]),
        ];
        for (const [candidateArea, candidateWindow] of queue) {
          if (cancelled) return;
          const key = payloadKey(candidateArea, candidateWindow);
          if (payloadCache.current.has(key)) continue;
          try {
            const payload = await fetchReadoutPayload(candidateArea, candidateWindow);
            if (!cancelled) payloadCache.current.set(key, payload);
          } catch {
            // A speculative fetch never changes the visible page or its retry state.
          }
        }
      })();
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (area === "All") return;
    const otherWindow: ReadoutWindow = readoutWindow === "today" ? "7d" : "today";
    const key = payloadKey(area, otherWindow);
    if (payloadCache.current.has(key)) return;
    const timer = window.setTimeout(() => {
      void fetchReadoutPayload(area, otherWindow)
        .then((payload) => payloadCache.current.set(key, payload))
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [area, readoutWindow]);

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
  const addedSinceMorning = useMemo(() => {
    if (!todayEdition || readoutWindow !== "today") return [];
    const ids = new Set(todayEdition.middayInsertions ?? []);
    return todayEdition.relevant.map((entry) => entry.article)
      .filter((item): item is EditorialArticle => !isEpisodeDevelopment(item) && ids.has(item.id))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  }, [todayEdition, readoutWindow]);
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
    : todayEdition?.relevant.map((entry) => entry.article)
      .filter((item) => !todayEdition.middayInsertions?.includes(item.id)) ?? [], [readoutWindow, todayEdition]);
  const payloadEvidenceOverlays = useMemo(
    () => new Map((windowPayload?.overlays ?? []).map((overlay) => [overlay.id, overlay])),
    [windowPayload],
  );
  const activeEvidenceOverlays = payloadEvidenceOverlays;
  const worth = currentWorth;
  const pageReady = !!windowPayload;
  const publishedDevelopments = [...worth, ...addedSinceMorning, ...relevant, ...moreFromSevenDays];
  const renderedDevelopments = [...worth, ...addedSinceMorning, ...(alsoOpen ? relevant : relevant.slice(0, 1)), ...(moreOpen ? moreFromSevenDays : [])];
  const regulatoryCoverage = readoutRegulatoryCoverage(publishedDevelopments, renderedDevelopments);
  const regulatoryArticles = useMemo(() => regulatoryWatchArticles(
    windowPayload?.regulatoryCards ?? [],
    area,
    publishedDevelopments,
  ), [area, publishedDevelopments, windowPayload]);
  const regulatoryHeader = [
    regulatoryArticles.length ? `${regulatoryArticles.length} action${regulatoryArticles.length === 1 ? "" : "s"}` : null,
    windowPayload?.designationCards.length ? `${windowPayload.designationCards.length} designation${windowPayload.designationCards.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" · ") || regulatoryCoverage.status;

  const listenBriefs = useMemo(() => windowPayload ? liveListenBriefs(windowPayload) : [], [windowPayload]);
  const listenEntries = useMemo(() => readoutWindow === "7d"
    ? sevenDayEditionListen(editionHistory, currentWorth)
    : todayEdition ? sevenDayEditionListen([todayEdition], currentWorth) : [],
  [currentWorth, editionHistory, readoutWindow, todayEdition]);
  const audioDates = useMemo(() => readoutWindow === "7d"
    ? editionHistory.map((edition) => edition.editionDate)
    : todayEdition ? [todayEdition.editionDate] : [], [editionHistory, readoutWindow, todayEdition]);
  const audioVersions = useMemo(() => area === "All" ? Object.fromEntries(
    (readoutWindow === "7d" ? editionHistory : todayEdition ? [todayEdition] : [])
      .map((edition) => [edition.editionDate, edition.selectionVersion]),
  ) : {}, [area, editionHistory, readoutWindow, todayEdition]);
  const briefs = listenBriefs;
  const displayedEditionDate = readoutWindow === "today"
    ? editionDateLabel(todayEdition?.editionDate)
    : null;

  const chooseArea = (candidate: EditionArea) => {
    if (candidate === requestedArea) return;
    setRequestedArea(candidate);
    setLoadError(null);
    setAlsoOpen(false);
    setMoreOpen(false);
  };

  const chooseWindow = (candidate: ReadoutWindow) => {
    if (candidate === requestedWindow) return;
    setRequestedWindow(candidate);
    setLoadError(null);
    setMoreOpen(false);
  };

  const moveWindowTab = (event: React.KeyboardEvent<HTMLButtonElement>, candidate: ReadoutWindow) => {
    const next = readoutWindowKeyboardTarget(candidate, event.key);
    if (!next) return;
    event.preventDefault();
    chooseWindow(next);
    windowTabRefs.current[next]?.focus();
  };

  const retryLoad = () => {
    payloadCache.current.delete(payloadKey(requestedArea, requestedWindow));
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
      </header>

      <div className="er-section er-worth">
        <div className="er-section-title">
          <div>
            {area !== "All" && <p className="er-eyebrow">{AREA_LABELS[area].toUpperCase()}</p>}
            <div className="er-readout-heading">
              <h2>The Readout</h2>
              <span className="er-picker er-specialty-picker"><select className="er-specialty-select" aria-label="Specialty" value={requestedArea} onChange={(event) => chooseArea(event.target.value as EditionArea)}>
                {EDITION_AREAS.map((candidate) => <option key={candidate} value={candidate}>{candidate === "All" ? "All oncology" : AREA_LABELS[candidate]}</option>)}
              </select></span>
            </div>
            <p className="er-readout-dek">The papers, approvals, and episodes oncology clinicians are sharing.</p>
            {displayedEditionDate && <p className="er-edition-date">Edition: {displayedEditionDate}</p>}
          </div>
          <div className="er-window-tabs" role="tablist" aria-label="Readout window" aria-busy={loadingWindow}>
            {READOUT_WINDOWS.map((candidate) => <button
              key={candidate}
              ref={(element) => { windowTabRefs.current[candidate] = element; }}
              id={`readout-window-tab-${candidate}`}
              type="button"
              role="tab"
              aria-controls="readout-window-panel"
              aria-selected={requestedWindow === candidate}
              tabIndex={requestedWindow === candidate ? 0 : -1}
              className={requestedWindow === candidate ? "active" : ""}
              onClick={() => chooseWindow(candidate)}
              onKeyDown={(event) => moveWindowTab(event, candidate)}
            >{candidate === "today" ? "Today" : "7 days"}</button>)}
          </div>
        </div>
        <ConferenceTeaser meetings={conferenceMeetings} area={area} />
        <div id="readout-window-panel" role="tabpanel" aria-labelledby={`readout-window-tab-${requestedWindow}`} aria-busy={loadingWindow} tabIndex={-1}>
        {loadingWindow && pageReady && <p className="er-window-note er-window-progress" role="status">Loading the selected view...</p>}
        {windowPayload?.stale && <p className="er-window-note" role="status">Showing the last saved edition while live evidence refreshes.</p>}
        {pageReady && readoutWindow === "7d" && historyDays < 7 && <p className="er-window-note">Showing {historyDays} daily edition{historyDays === 1 ? "" : "s"} so far. This view will fill as new editions publish.</p>}
        {pageReady && readoutWindow === "today" && todayEdition?.fallbackWindowHours === 72 && <p className="er-window-note">Specialty lead selected from the 72-hour Listen window.</p>}
        {loadError && <div className="er-load-error" role="alert"><p>The selected view could not load.</p><button type="button" onClick={retryLoad}>Try again</button></div>}
        {pageReady && <DailyReadoutAudio dates={audioDates} expectedVersions={audioVersions} />}
        {!pageReady ? <ReadoutLoading /> : worth.length > 0 ? worth.map((item, index) => <NumberedDevelopment item={item} briefs={briefs} overlays={activeEvidenceOverlays} position={index + 1} key={item.id} />) : readoutWindow === "today" && area !== "All" ? (
          <div className="er-empty">
            <p>Nothing new cleared the bar in {AREA_LABELS[area]} today.</p>
            <button className="er-empty-history" type="button" onClick={() => chooseWindow("7d")}>See the last 7 days</button>
          </div>
        ) : (
          <p className="er-empty">No development cleared the bar in this area {readoutWindow === "7d" ? "in these saved editions" : "for this edition"}.</p>
        )}
      {pageReady && addedSinceMorning.length > 0 && (
        <section className="er-added-since-morning" aria-label="Added since this morning">
          <h2>Added since this morning</h2>
          <div className="er-compact-list">{addedSinceMorning.map((item) => (
            <CompactDevelopment key={item.id} item={item} overlays={activeEvidenceOverlays} />
          ))}</div>
        </section>
      )}
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
          <div className="er-section-title"><h2>More to read</h2></div>
          <div className="er-compact-list">{(alsoOpen || relevant.length === 1 ? relevant : relevant.slice(0, 1)).map((item) => (
            <CompactDevelopment key={item.id} item={item} overlays={activeEvidenceOverlays} />
          ))}</div>
          {relevant.length > 1 && <button className="er-more-toggle" type="button" onClick={() => setAlsoOpen((value) => !value)} aria-expanded={alsoOpen}>
            {alsoOpen ? "Show less" : `Show ${relevant.length - 1} more`}
          </button>}
        </section>
      )}

      {pageReady && listenEntries.length > 0 && (
        <section className="er-section er-listen">
          <div className="er-section-title"><h2>Listen</h2></div>
          <div className="er-listen-grid">
            {listenEntries.map(({ item, episode }) => {
              const sourceHref = episode?.sourceUrl || item.url;
              const archivedMedia = ARCHIVED_LISTEN_MEDIA.find((candidate) => candidate.id === item.id);
              const showArt = episode?.showArt ?? item.showArt ?? archivedMedia?.showArt;
              const audioUrl = episode?.audioUrl ?? item.audioUrl ?? archivedMedia?.audioUrl;
              const durationSeconds = episode?.durationSeconds ?? item.durationSeconds ?? archivedMedia?.durationSeconds;
              const episodeId = episode?.episodeId ?? item.episodeId ?? archivedMedia?.episodeId ?? item.id;
              const show = episode?.show || item.show;
              const title = listenCardTitle(episode?.title, item, archivedMedia);
              return (
                <article className={`er-listen-card${showArt ? "" : " no-art"}`} key={item.id}>
                  {showArt && (
                    <div className="er-listen-art-frame">
                      <img className="er-listen-art" src={showArt} alt="" loading="lazy" decoding="async" />
                    </div>
                  )}
                  <div className="er-listen-copy">
                    <p className="er-listen-show">{show}</p>
                    <a className="er-listen-title" href={sourceHref} target="_blank" rel="noreferrer">
                      <b>{title}</b>
                    </a>
                  </div>
                  {audioUrl && (
                    <div className="er-listen-audio">
                      <AudioQuote
                        audioUrl={audioUrl}
                        startMs={0}
                        durationSeconds={durationSeconds}
                        label="Listen here"
                        eventId={episodeId}
                        eventLabel={title}
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
          <span>{regulatoryHeader}</span>
        </div>
        {(windowPayload?.designationCards ?? []).map((designation) => (
          <article key={designation.id}>
            <span>{designation.label.replace(/^FDA\s+/i, "").toUpperCase()}</span>
            <div>
              <b>{designation.headline}</b>
              <p className="er-regulatory-date">{designation.dateLabel ?? "First shared"}: {editionDateLabel(designation.occurredOn)
                ? <time dateTime={designation.occurredOn ?? undefined}>{editionDateLabel(designation.occurredOn)}</time>
                : "Unavailable"}</p>
              <p>{designation.description ? `${designation.description} ` : ""}This is not an approval.</p>
              <a href={designation.url} target="_blank" rel="noreferrer">{designation.sourceLabel}</a>
            </div>
          </article>
        ))}
        {regulatoryArticles.map((item) => (
          <CompactDevelopment key={item.id} item={item} overlays={activeEvidenceOverlays} />
        ))}
        {!windowPayload?.designationCards.length && !regulatoryArticles.length && <p className="er-regulatory-empty">{regulatoryCoverage.hasPublished
          ? `No additional ${area === "All" ? "oncology" : AREA_LABELS[area].toLowerCase()} approval, safety warning, or designation in this window.`
          : `No new ${area === "All" ? "oncology" : AREA_LABELS[area].toLowerCase()} approval, safety warning, or designation in this window.`}</p>}
        </section>}
        </div>
      </div>
      </main>
  );
}
