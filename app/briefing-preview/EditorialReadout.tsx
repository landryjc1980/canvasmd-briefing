"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BriefingArticle, BriefingData, BriefingEpisode, BriefingEvidenceOverlayItem, BriefingSharer, HeroSupportLink, ReadoutWindowPayload } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import {
  evidenceTarget,
  readoutWindowDays,
  type ReadoutWindow,
} from "./readoutRequest";
import {
  ALSO_RELEVANT,
  ARCHIVED_TAKEAWAY_FALLBACK,
  EDITION_AREAS,
  FEATURED_EPISODES,
  NEW_TO_LISTEN,
  SPECIALTY_FALLBACKS,
  WORTH_YOUR_TIME,
  archivedEditorialArticle,
  findArticle,
  findArchivedEditorialSource,
  findEpisode,
  listenForArea,
  regulatoryEditorialArticle,
  relatedCoverageLinks,
  sameEditorialArticle,
  visibleForArea,
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
const SHARER_EXPANDED_LIMIT = 12;
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
  return (article.posts ?? []).filter((post) => {
    const text = post.text?.trim() ?? "";
    const contentWords = words(text);
    const key = post.handle?.toLowerCase() || post.name.toLowerCase();
    if (!text || contentWords.length < 3 || /^rt\s+@/i.test(text) || isTitleOnlyShare(text, [article.title, article.journal].filter(Boolean).join(" "))) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function FacePile({ article, count }: { article: BriefingArticle | null; count: number }) {
  const faces = article?.faces?.slice(0, Math.min(4, count)) ?? [];
  if (!faces.length) return null;
  return (
    <span className="er-facepile" aria-hidden="true">
      {faces.map((src, index) => <img src={src} alt="" key={`${src}-${index}`} />)}
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

function SharerNames({ article, sharedBy }: { article: BriefingArticle | null; sharedBy: number }) {
  const [expanded, setExpanded] = useState(false);
  const sharers = clinicianSharers(article).slice(0, sharedBy);
  if (!sharers.length) return null;

  const visibleCount = expanded ? Math.min(SHARER_EXPANDED_LIMIT, sharers.length) : Math.min(SHARER_PREVIEW_LIMIT, sharers.length);
  const visibleSharers = sharers.slice(0, visibleCount);
  const hiddenCount = Math.max(0, sharedBy - visibleCount);
  const expandableCount = Math.min(SHARER_EXPANDED_LIMIT, sharers.length) - visibleCount;
  const canExpand = !expanded && expandableCount > 0;

  return (
    <div className="er-sharer-names">
      <span className="er-sharer-label">Including</span>
      <span className="er-sharer-list">
        {visibleSharers.map((sharer, index) => (
          <span className="er-sharer-name" key={sharerKey(sharer)}>
            {sharer.tweetUrl ? <a href={sharer.tweetUrl} target="_blank" rel="noreferrer">{sharer.name}</a> : sharer.name}
            {index < visibleSharers.length - 1 ? <span className="er-sharer-comma">,</span> : null}
          </span>
        ))}
      </span>
      {canExpand ? (
        <button className="er-sharer-more" type="button" onClick={() => setExpanded((value) => !value)}>
          +{expandableCount} more
        </button>
      ) : expanded ? (
        <>
          {hiddenCount > 0 && <span className="er-sharer-more-text">+{hiddenCount} others counted</span>}
          <button className="er-sharer-more" type="button" onClick={() => setExpanded(false)}>Show fewer</button>
        </>
      ) : hiddenCount > 0 ? (
        <span className="er-sharer-more-text">+{hiddenCount} others counted</span>
      ) : null}
    </div>
  );
}

function PhysicianVoices({ article, accent, sharedBy }: { article: BriefingArticle | null; accent: string; sharedBy: number }) {
  const [showAllMobile, setShowAllMobile] = useState(false);
  const posts = usefulPosts(article);
  if (!posts.length) {
    return sharedBy > 0 ? <p className="er-no-commentary">Shared, no commentary yet.</p> : null;
  }
  const visiblePosts = posts.slice(0, 2);
  return (
    <div className={`er-voices ${visiblePosts.length === 1 ? "is-single" : ""}`} style={{ "--accent": accent } as React.CSSProperties}>
      <p className="er-voices-label">What clinicians are saying</p>
      {visiblePosts.map((post, index) => (
        <figure className={`er-voice ${index > 0 ? "er-voice-secondary" : ""} ${showAllMobile ? "is-mobile-open" : ""}`} key={`${post.handle ?? post.name}-${index}`}>
          <blockquote>{post.text}</blockquote>
          <figcaption>
            {post.avatar ? <img src={post.avatar} alt="" /> : <span className="er-avatar-fallback">{post.name.slice(0, 1)}</span>}
            <span><strong>{post.name}</strong>{post.handle && <> @{post.handle.replace(/^@/, "")}</>}</span>
            {post.tweetUrl && <a href={post.tweetUrl} target="_blank" rel="noreferrer">View on X ↗</a>}
          </figcaption>
        </figure>
      ))}
      {visiblePosts.length > 1 && (
        <button className="er-voices-more" type="button" aria-expanded={showAllMobile} onClick={() => setShowAllMobile((value) => !value)}>
          {showAllMobile ? "Show fewer comments" : `Show ${visiblePosts.length - 1} more comment`}
        </button>
      )}
    </div>
  );
}

function DevelopmentFinding({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  const findingRef = useRef<HTMLParagraphElement>(null);
  const findingId = useId();
  const finding = text.trim();

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
    <>
      <p ref={findingRef} id={findingId} className={`er-finding ${!expanded ? "is-collapsed" : ""}`}>{finding}</p>
      {collapsible && (
        <button className="er-finding-toggle" type="button" aria-controls={findingId} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : "Show full result"}
        </button>
      )}
    </>
  );
}

function SourceArticle({ href, journal, title, action = "Read article", compact = false }: {
  href: string;
  journal: string;
  title: string;
  action?: string;
  compact?: boolean;
}) {
  return (
    <a className={`er-citation ${compact ? "er-compact-citation" : ""}`} href={href} target="_blank" rel="noreferrer">
      <span className="er-citation-topline"><b>{journal}</b><em>{action} ↗</em></span>
      <strong>{title}</strong>
    </a>
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

function CoverageLinks({ item, primaryUrl }: { item: EditorialArticle; primaryUrl: string }) {
  const [coverageOpen, setCoverageOpen] = useState(false);
  const primarySources = validSupportLinks(item.primarySources, primaryUrl);
  const supportingEvidence = validSupportLinks(item.supportingEvidence, primaryUrl);
  const related = relatedCoverageLinks(item.relatedCoverage, primaryUrl, item.title).slice(0, 4);
  if (!primarySources.length && !supportingEvidence.length && !related.length) return null;
  return (
    <div className="er-support-links">
      <div className="er-primary-links">
        {primarySources.map((link) => (
          <p key={`primary-${link.id}`}><span>Primary source</span><i aria-hidden="true">·</i><a href={link.url} target="_blank" rel="noreferrer">{link.sourceLabel} ↗</a></p>
        ))}
      </div>
      <div className="er-supporting-links">
        {supportingEvidence.map((link) => (
          <p key={`supporting-${link.id}`}><span>Supporting study</span><i aria-hidden="true">·</i><a href={link.url} target="_blank" rel="noreferrer">{link.sourceLabel} ↗</a></p>
        ))}
      </div>
      {related.length > 0 && (
        <>
          <button className="er-related-toggle" type="button" aria-expanded={coverageOpen} onClick={() => setCoverageOpen((value) => !value)}>
            Related coverage ({related.length}) <span aria-hidden="true">{coverageOpen ? "−" : "+"}</span>
          </button>
          <div className={`er-related-links ${coverageOpen ? "is-open" : ""}`}>
            {related.map((link) => (
              <p key={`related-${link.id}`}><span>Related coverage</span><i aria-hidden="true">·</i><a href={link.url} target="_blank" rel="noreferrer">{link.sourceLabel} ↗</a></p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ArticleDevelopment({ item, briefs, overlays }: { item: EditorialArticle; briefs: BriefingData[]; overlays: Map<string, BriefingEvidenceOverlayItem> }) {
  const overlay = overlays.get(item.id);
  const article = articleWithLiveEvidence(item, briefs, overlay);
  const href = article?.url || item.url;
  const sharedBy = article?.kolSharers ?? item.sharedBy;
  const authoredCount = usefulPosts(article).length;
  return (
    <article className="er-development">
      <div className="er-development-body">
        <div className="er-kicker"><span>{item.site}</span>{item.nickname && <><i aria-hidden="true">·</i><b>{item.nickname}</b></>}</div>
        <h3>{item.takeaway}</h3>
        <DevelopmentFinding text={item.finding} />
        {item.remember !== ARCHIVED_TAKEAWAY_FALLBACK && <p className="er-remember"><strong>Key takeaway:</strong> {item.remember}</p>}
        <SourceArticle href={href} journal={item.journal} title={article?.title || item.title} action={item.sourceAction} />
        <CoverageLinks item={item} primaryUrl={href} />
        <div className="er-proof">
          {overlay && <FacePile article={article} count={sharedBy} />}
          <span className="er-evidence-kind">{item.evidence}</span>
          <span className="er-proof-count">{overlay ? shareCommentaryLabel(sharedBy, authoredCount, 2) : "Updating clinician evidence..."}</span>
        </div>
        {overlay && <SharerNames article={article} sharedBy={sharedBy} />}
        {overlay && <PhysicianVoices article={article} accent="currentColor" sharedBy={sharedBy} />}
      </div>
    </article>
  );
}

function CompactClinicianComment({ article }: { article: BriefingArticle | null }) {
  const post = usefulPosts(article)[0];
  if (!post) return null;
  return (
    <figure className="er-compact-comment">
      <blockquote>{post.text}</blockquote>
      <figcaption>
        {post.avatar ? <img src={post.avatar} alt="" /> : <span className="er-avatar-fallback">{post.name.slice(0, 1)}</span>}
        <span><strong>{post.name}</strong>{post.handle && <> @{post.handle.replace(/^@/, "")}</>}</span>
      </figcaption>
    </figure>
  );
}

function EpisodeDevelopment({ item, briefs }: { item: EditorialEpisodeFeature; briefs: BriefingData[] }) {
  const episode = findEpisode(item, briefs);
  const sourceHref = episode?.sourceUrl || item.url;
  const audioUrl = episode?.audioUrl ?? null;
  return (
    <article className="er-development er-development-episode">
      <div className="er-development-body">
        <div className="er-kicker"><span>{item.site}</span><i aria-hidden="true">·</i><b>{item.nickname}</b></div>
        <h3>{item.hook}</h3>
        <DevelopmentFinding text={item.finding} />
        <p className="er-remember"><strong>Key takeaway:</strong> {item.remember}</p>
        <SourceArticle href={sourceHref} journal={episode?.show || item.show} title={episode?.title || item.title} action="Open episode" />
        <EpisodeAudio
          audioUrl={audioUrl}
          sourceHref={sourceHref}
          title={episode?.title || item.title}
          durationSeconds={episode?.durationSeconds}
          episodeId={episode?.episodeId ?? item.id}
          evidence={item.evidence}
        />
      </div>
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

function shareCommentaryLabel(sharedBy: number, authoredCount: number, visibleLimit: number): string {
  const shared = `Shared by ${sharedBy} clinician${sharedBy === 1 ? "" : "s"}`;
  if (authoredCount === 1) return `${shared} · 1 commentary`;
  if (authoredCount > 1) {
    const visible = Math.min(authoredCount, visibleLimit);
    return `${shared} · ${visible < authoredCount ? `${visible} of ${authoredCount}` : authoredCount} clinician comments`;
  }
  return shared;
}

function liveListenBriefs(payload: ReadoutWindowPayload | null): BriefingData[] {
  const byArea = new Map<string, BriefingEpisode[]>();
  for (const episode of payload?.episodes ?? []) {
    const briefingEpisode: BriefingEpisode = {
      episodeId: episode.episodeId,
      title: episode.title,
      show: episode.show,
      showArt: episode.showArt,
      audioUrl: episode.audioUrl,
      sourceUrl: episode.sourceUrl,
      durationSeconds: episode.durationSeconds,
      description: episode.description,
      publishedAt: episode.publishedAt,
      subAreas: episode.areas,
    };
    for (const episodeArea of episode.areas) byArea.set(episodeArea, [...(byArea.get(episodeArea) ?? []), briefingEpisode]);
  }
  return [...byArea].map(([briefArea, episodes]) => ({ area: briefArea, episodes } as BriefingData));
}

function Development({ item, briefs, overlays }: { item: EditorialDevelopment; briefs: BriefingData[]; overlays: Map<string, BriefingEvidenceOverlayItem> }) {
  return isEpisodeDevelopment(item)
    ? <EpisodeDevelopment item={item} briefs={briefs} />
    : <ArticleDevelopment item={item} briefs={briefs} overlays={overlays} />;
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

export default function EditorialReadout({ initialPayload }: { initialPayload: ReadoutWindowPayload }) {
  const [area, setArea] = useState<EditionArea>("All");
  const [readoutWindow, setReadoutWindow] = useState<ReadoutWindow>("today");
  const [windowPayload, setWindowPayload] = useState<ReadoutWindowPayload | null>(initialPayload);
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [alsoOpen, setAlsoOpen] = useState(false);
  const briefs = EMPTY_BRIEFS;

  useEffect(() => {
    if (windowPayload?.area === area && windowPayload.windowDays === readoutWindowDays(readoutWindow)) {
      setLoadingWindow(false);
      return;
    }
    let cancelled = false;
    setWindowPayload(null);
    setLoadingWindow(true);
    fetch("/api/briefing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "readout-window", area, days: readoutWindowDays(readoutWindow) }),
      cache: "no-store",
    }).then(async (response) => response.ok ? response.json() as Promise<ReadoutWindowPayload> : null)
      .then((payload) => { if (!cancelled && payload) setWindowPayload(payload); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingWindow(false); });
    return () => { cancelled = true; };
  }, [area, readoutWindow, windowPayload]);

  const currentWorth = useMemo(() => {
    const todayDevelopments: EditorialDevelopment[] = area === "All"
      ? WORTH_YOUR_TIME
      : [...WORTH_YOUR_TIME, ...FEATURED_EPISODES];
    const regulatory = (windowPayload?.regulatoryCards ?? []).map((candidate) => regulatoryEditorialArticle(candidate, area));
    if (readoutWindow === "7d") {
      const archived = (windowPayload?.cards ?? []).map(archivedEditorialArticle);
      return [...regulatory, ...archived]
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
        .slice(0, 5);
    }
    const visible = visibleForArea(todayDevelopments, area);
    const supported = visible.map((item) => {
      if (isEpisodeDevelopment(item)) return item;
      const archived = findArchivedEditorialSource(item, windowPayload?.cards ?? []);
      if (!archived?.card.support?.links?.length) return item;
      const supportLinks = archived.card.support.links;
      return {
        ...item,
        articleIds: supportLinks.map((link) => link.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
        primarySources: supportLinks.filter((link) => link.relationshipType === "primary_source"),
        relatedCoverage: supportLinks,
      };
    });
    const developments = [...regulatory, ...supported];
    return area === "All" ? developments.slice(0, 5) : developments;
  }, [area, readoutWindow, windowPayload]);
  const fallbackCandidates = useMemo(() => area === "All" || readoutWindow === "7d" || currentWorth.length > 0 ? [] : visibleForArea(SPECIALTY_FALLBACKS, area), [area, currentWorth.length, readoutWindow]);
  const hasFallbackWindow = fallbackCandidates.length > 0;
  const evidenceWorth = useMemo(() => currentWorth.length > 0 ? currentWorth : fallbackCandidates, [currentWorth, fallbackCandidates]);
  const relevant = useMemo(() => visibleForArea(ALSO_RELEVANT, area).map((item) => {
    const archived = findArchivedEditorialSource(item, windowPayload?.cards ?? []);
    if (!archived?.card.support?.links?.length) return item;
    const supportLinks = archived.card.support.links;
    return {
      ...item,
      articleIds: supportLinks.map((link) => link.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
      primarySources: supportLinks.filter((link) => link.relationshipType === "primary_source"),
      relatedCoverage: supportLinks,
    };
  }).filter((item) => !evidenceWorth.some((lead) => !isEpisodeDevelopment(lead) && sameEditorialArticle(item, lead))), [area, evidenceWorth, windowPayload]);
  const evidenceTargets = useMemo(() => {
    const articleItems = [...evidenceWorth, ...relevant].filter((item): item is EditorialArticle => !isEpisodeDevelopment(item));
    return articleItems.map(evidenceTarget);
  }, [evidenceWorth, relevant]);
  const payloadEvidenceOverlays = useMemo(
    () => new Map((windowPayload?.overlays ?? []).map((overlay) => [overlay.id, overlay])),
    [windowPayload],
  );
  const activeEvidenceOverlays = payloadEvidenceOverlays;
  const fallbackReady = !hasFallbackWindow || fallbackCandidates.every((item) => activeEvidenceOverlays.has(item.id));
  const fallbackWorth = fallbackReady
    ? fallbackCandidates.filter((item) => (activeEvidenceOverlays.get(item.id)?.windowClinicianCount ?? 0) > 0)
    : [];
  const worth = currentWorth.length > 0 ? currentWorth : fallbackWorth;
  const usingFallback = fallbackWorth.length > 0;
  const pageReady = !loadingWindow && !!windowPayload && evidenceTargets.every((target) => activeEvidenceOverlays.has(target.id));
  const hasRegulatoryDevelopment = (windowPayload?.regulatoryCards.length ?? 0) > 0 || worth.some((item) =>
    !isEpisodeDevelopment(item) && /approval|label|safety|regulatory/i.test(item.evidence));

  const listenBriefs = useMemo(() => liveListenBriefs(windowPayload), [windowPayload]);
  const listen = useMemo(() => {
    return listenForArea(NEW_TO_LISTEN, listenBriefs, area, worth.filter(isEpisodeDevelopment));
  }, [area, listenBriefs, worth]);

  return (
    <main className={`er-page er-area-${area.toLowerCase()}`}>
      <header className="er-header">
        <div className="er-brand">
          <CanvasMdLogo />
        </div>
        <nav className="er-filters" aria-label="Tumor area">
          {EDITION_AREAS.map((candidate) => (
            <button key={candidate} type="button" className={candidate === area ? "active" : ""} onClick={() => {
              if (candidate === area) return;
              setLoadingWindow(true);
              setWindowPayload(null);
              setArea(candidate);
              setAlsoOpen(false);
            }}>
              {candidate}
            </button>
          ))}
        </nav>
        {area !== "All" && <div className="er-edition-meta"><strong>{AREA_LABELS[area]}</strong><span>{readoutWindow === "7d" ? "Past 7 days" : usingFallback ? "Best of 72h" : "Last 24h"}</span></div>}
      </header>

      <section className="er-section er-worth">
        <div className="er-section-title">
          <div>{area !== "All" && <p className="er-eyebrow">{AREA_LABELS[area].toUpperCase()}</p>}<h2>The Readout</h2></div>
          <div className="er-window-tabs" role="tablist" aria-label="Readout window">
            <button type="button" role="tab" aria-selected={readoutWindow === "today"} className={readoutWindow === "today" ? "active" : ""} onClick={() => {
              if (readoutWindow === "today") return;
              setLoadingWindow(true);
              setWindowPayload(null);
              setReadoutWindow("today");
            }}>Today</button>
            <button type="button" role="tab" aria-selected={readoutWindow === "7d"} className={readoutWindow === "7d" ? "active" : ""} onClick={() => {
              if (readoutWindow === "7d") return;
              setLoadingWindow(true);
              setWindowPayload(null);
              setReadoutWindow("7d");
            }}>7 days</button>
          </div>
        </div>
        {pageReady && usingFallback && <p className="er-window-note">No new development cleared the bar in 24 hours. Showing the strongest qualifying development from the past 72 hours.</p>}
        {!pageReady ? <ReadoutLoading /> : worth.length > 0 ? worth.map((item) => <Development item={item} briefs={briefs} overlays={activeEvidenceOverlays} key={item.id} />) : (
          <p className="er-empty">No development cleared the bar in this area during the {readoutWindow === "7d" ? "past 7 days" : "past 24 hours"}.</p>
        )}
      </section>

      {pageReady && relevant.length > 0 && (
        <section className="er-section er-relevant">
          {relevant.length > 1 ? (
            <button className="er-section-title er-section-button" type="button" onClick={() => setAlsoOpen((value) => !value)} aria-expanded={alsoOpen}>
              <h2>Also Relevant</h2><span>{alsoOpen ? "Show less −" : `Show ${relevant.length - 1} more +`}</span>
            </button>
          ) : (
            <div className="er-section-title"><h2>Also Relevant</h2></div>
          )}
          <div className="er-compact-list">{(alsoOpen || relevant.length === 1 ? relevant : relevant.slice(0, 1)).map((item) => {
            const overlay = activeEvidenceOverlays.get(item.id);
            const article = articleWithLiveEvidence(item, briefs, overlay);
            const sharedBy = article?.kolSharers ?? item.sharedBy;
            const authoredCount = usefulPosts(article).length;
            return (
              <article key={item.id}>
                <div className="er-compact-topline">
                  <div className="er-compact-label"><b>{item.site}</b>{item.nickname && <><i aria-hidden="true">·</i><span>{item.nickname}</span></>}</div>
                  <small>{item.evidence}</small>
                </div>
                <h3>{item.takeaway}</h3>
                <SourceArticle href={article?.url || item.url} journal={item.journal} title={article?.title || item.title} compact />
                <CoverageLinks item={item} primaryUrl={article?.url || item.url} />
                <div className="er-compact-proof">
                  {overlay && <FacePile article={article} count={sharedBy} />}
                  <span>{overlay ? shareCommentaryLabel(sharedBy, authoredCount, 1) : "Updating clinician evidence..."}</span>
                </div>
                {overlay && <SharerNames article={article} sharedBy={sharedBy} />}
                {overlay && <CompactClinicianComment article={article} />}
              </article>
            );
          })}</div>
        </section>
      )}

      {pageReady && listen.length > 0 && (
        <section className="er-section er-listen">
          <div className="er-section-title"><h2>Listen</h2></div>
          <div className="er-listen-grid">
            {listen.map((item) => {
              const episode = findEpisode(item, listenBriefs);
              const sourceHref = episode?.sourceUrl || item.url;
              return (
                <article key={item.id}>
                  <div>
                    <b>{item.hook}</b>
                    <p>{episode?.show || item.show}</p>
                    <a href={sourceHref} target="_blank" rel="noreferrer">{episode?.title || item.title} ↗</a>
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
                  </div>
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
              <p>{designation.description ? `${designation.description} ` : ""}This is not an approval.</p>
              <a href={designation.url} target="_blank" rel="noreferrer">{designation.sourceLabel} ↗</a>
            </div>
          </article>
        ))}
        {!windowPayload?.designationCards.length && <p className="er-regulatory-empty">{hasRegulatoryDevelopment
          ? "No additional oncology approval, safety warning, or designation in this window."
          : "No new oncology approval, safety warning, or designation in this window."}</p>}
      </section>}

      <footer className="er-footer"><span>{pageReady ? "Evidence connected to the live Readout." : "Loading the live Readout..."}</span><span>CanvasMD</span></footer>
    </main>
  );
}
