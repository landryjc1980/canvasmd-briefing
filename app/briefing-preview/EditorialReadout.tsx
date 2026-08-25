"use client";

import { useEffect, useMemo, useState } from "react";
import type { BriefingArticle, BriefingData, BriefingSharer } from "@/lib/types";
import {
  ALSO_RELEVANT,
  EDITION_AREAS,
  FEATURED_EPISODES,
  NEW_TO_LISTEN,
  SPECIALTY_FALLBACKS,
  WORTH_YOUR_TIME,
  findArticle,
  findEpisode,
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

function usefulPosts(article: BriefingArticle | null): BriefingSharer[] {
  if (!article) return [];
  const seen = new Set<string>();
  return (article.posts ?? []).filter((post) => {
    const text = post.text?.trim() ?? "";
    const contentWords = words(text);
    const key = post.handle?.toLowerCase() || post.name.toLowerCase();
    if (!text || contentWords.length < 3 || /^rt\s+@/i.test(text) || isTitleOnlyShare(text, article.title)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  return overlap / postWords.length >= 0.82;
}

function FacePile({ article }: { article: BriefingArticle | null }) {
  const faces = article?.faces?.slice(0, 4) ?? [];
  if (!faces.length) return null;
  return (
    <span className="er-facepile" aria-hidden="true">
      {faces.map((src, index) => <img src={src} alt="" key={`${src}-${index}`} />)}
    </span>
  );
}

function PhysicianVoices({ article, accent, sharedBy }: { article: BriefingArticle | null; accent: string; sharedBy: number }) {
  const posts = usefulPosts(article);
  if (!posts.length) {
    return sharedBy > 0 ? <p className="er-no-commentary">Shared, no commentary yet.</p> : null;
  }
  return (
    <div className="er-voices" style={{ "--accent": accent } as React.CSSProperties}>
      <p className="er-voices-label">Physician perspective</p>
      {posts.slice(0, 2).map((post, index) => (
        <figure className="er-voice" key={`${post.handle ?? post.name}-${index}`}>
          <blockquote>{post.text}</blockquote>
          <figcaption>
            {post.avatar ? <img src={post.avatar} alt="" /> : <span className="er-avatar-fallback">{post.name.slice(0, 1)}</span>}
            <span><strong>{post.name}</strong>{post.handle && <> @{post.handle.replace(/^@/, "")}</>}</span>
            {post.tweetUrl && <a href={post.tweetUrl} target="_blank" rel="noreferrer">View on X ↗</a>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function ArticleDevelopment({ item, briefs }: { item: EditorialArticle; briefs: BriefingData[] }) {
  const article = findArticle(item, briefs);
  const href = article?.url || item.url;
  return (
    <article className="er-development">
      <div className="er-development-body">
        <div className="er-kicker"><span>{item.site}</span>{item.nickname && <><i aria-hidden="true">·</i><b>{item.nickname}</b></>}</div>
        <h3>{item.takeaway}</h3>
        <p className="er-finding">{item.finding}</p>
        <p className="er-remember"><strong>Remember:</strong> {item.remember}</p>
        <p className="er-citation">
          <span>{item.journal}</span>
          <a href={href} target="_blank" rel="noreferrer">{article?.title || item.title} ↗</a>
        </p>
        <div className="er-proof">
          <FacePile article={article} />
          <span>{item.evidence}</span>
          <i aria-hidden="true">·</i>
          <span>shared by {item.sharedBy} clinician{item.sharedBy === 1 ? "" : "s"}</span>
        </div>
        <PhysicianVoices article={article} accent="currentColor" sharedBy={item.sharedBy} />
      </div>
    </article>
  );
}

function EpisodeDevelopment({ item, briefs }: { item: EditorialEpisodeFeature; briefs: BriefingData[] }) {
  const episode = findEpisode(item, briefs);
  const href = episode?.sourceUrl || episode?.audioUrl || item.url;
  return (
    <article className="er-development er-development-episode">
      <div className="er-development-body">
        <div className="er-kicker"><span>{item.site}</span><i aria-hidden="true">·</i><b>{item.nickname}</b></div>
        <h3>{item.hook}</h3>
        <p className="er-finding">{item.finding}</p>
        <p className="er-remember"><strong>Remember:</strong> {item.remember}</p>
        <p className="er-citation"><span>{episode?.show || item.show}</span><a href={href} target="_blank" rel="noreferrer">{episode?.title || item.title} ↗</a></p>
        <div className="er-episode-actions"><a className="er-listen-button" href={href} target="_blank" rel="noreferrer"><span aria-hidden="true">▶</span> Listen to the episode</a><small>{item.evidence}</small></div>
      </div>
    </article>
  );
}

function isEpisodeDevelopment(item: EditorialDevelopment): item is EditorialEpisodeFeature {
  return "kind" in item && item.kind === "episode";
}

function Development({ item, briefs }: { item: EditorialDevelopment; briefs: BriefingData[] }) {
  return isEpisodeDevelopment(item)
    ? <EpisodeDevelopment item={item} briefs={briefs} />
    : <ArticleDevelopment item={item} briefs={briefs} />;
}

export default function EditorialReadout() {
  const [area, setArea] = useState<EditionArea>("All");
  const [briefs, setBriefs] = useState<BriefingData[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(true);
  const [alsoOpen, setAlsoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(EDITION_AREAS.filter((candidate) => candidate !== "All").map(async (candidate) => {
      const response = await fetch(`/api/briefing?area=${candidate}`, { cache: "no-store" });
      if (!response.ok) return null;
      const body = await response.json();
      return body.briefing as BriefingData;
    })).then((items) => {
      if (!cancelled) setBriefs(items.filter(Boolean) as BriefingData[]);
    }).finally(() => {
      if (!cancelled) setLoadingEvidence(false);
    });
    return () => { cancelled = true; };
  }, []);

  const currentWorth = useMemo(() => {
    const developments: EditorialDevelopment[] = [
      ...WORTH_YOUR_TIME.slice(0, 4),
      ...FEATURED_EPISODES,
      ...WORTH_YOUR_TIME.slice(4),
    ];
    const visible = visibleForArea(developments, area);
    return area === "All" ? visible.slice(0, 5) : visible;
  }, [area]);
  const fallbackWorth = useMemo(() => area === "All" || currentWorth.length > 0 ? [] : visibleForArea(SPECIALTY_FALLBACKS, area), [area, currentWorth.length]);
  const worth = currentWorth.length > 0 ? currentWorth : fallbackWorth;
  const usingFallback = fallbackWorth.length > 0;
  const relevant = useMemo(() => visibleForArea(ALSO_RELEVANT, area), [area]);
  const listen = useMemo(() => {
    const featuredIds = new Set(worth.filter(isEpisodeDevelopment).map((item) => item.id));
    return visibleForArea(NEW_TO_LISTEN, area).filter((item) => !featuredIds.has(item.id));
  }, [area, worth]);

  return (
    <main className={`er-page er-area-${area.toLowerCase()}`}>
      <header className="er-header">
        <div className="er-brand"><span>CANVASMD</span><h1>The Readout</h1></div>
        <nav className="er-filters" aria-label="Tumor area">
          {EDITION_AREAS.map((candidate) => (
            <button key={candidate} type="button" className={candidate === area ? "active" : ""} onClick={() => { setArea(candidate); setAlsoOpen(false); }}>
              {candidate}
            </button>
          ))}
        </nav>
        <div className="er-edition-meta"><strong>{AREA_LABELS[area]}</strong><span>{usingFallback ? "Best of 72h" : "Last 24h"}</span></div>
      </header>

      <section className="er-section er-worth">
        <div className="er-section-title">
          <div><p className="er-eyebrow">{area === "All" ? "ACROSS ONCOLOGY" : AREA_LABELS[area].toUpperCase()}</p><h2>Worth Your Time</h2></div>
          <span>{worth.length ? `${worth.length} selected` : "No selection"}</span>
        </div>
        {usingFallback && <p className="er-window-note">No new development cleared the bar in 24 hours. Showing the strongest qualifying development from the past 72 hours.</p>}
        {worth.length > 0 ? worth.map((item) => <Development item={item} briefs={briefs} key={item.id} />) : (
          <p className="er-empty">No development cleared the bar in this area during the past 72 hours.</p>
        )}
      </section>

      {relevant.length > 0 && (
        <section className="er-section er-relevant">
          <button className="er-section-title er-section-button" type="button" onClick={() => setAlsoOpen((value) => !value)} aria-expanded={alsoOpen}>
            <h2>Also Relevant</h2><span>{alsoOpen ? "Show less −" : relevant.length > 1 ? `Show all ${relevant.length} +` : "Details +"}</span>
          </button>
          <div className="er-compact-list">{(alsoOpen ? relevant : relevant.slice(0, 1)).map((item) => {
            const article = findArticle(item, briefs);
            return (
              <article key={item.id}>
                <div className="er-compact-topline">
                  <div className="er-compact-label"><b>{item.site}</b>{item.nickname && <><i aria-hidden="true">·</i><span>{item.nickname}</span></>}</div>
                  <small>{item.evidence} · shared by {item.sharedBy} clinician{item.sharedBy === 1 ? "" : "s"}</small>
                </div>
                <h3>{item.takeaway}</h3>
                <div className="er-compact-citation"><span>{item.journal}</span><a href={article?.url || item.url} target="_blank" rel="noreferrer">{article?.title || item.title} ↗</a></div>
              </article>
            );
          })}</div>
        </section>
      )}

      {listen.length > 0 && (
        <section className="er-section er-listen">
          <div className="er-section-title"><h2>New To Listen To</h2><span>{listen.length} selected</span></div>
          <div className="er-listen-grid">
            {listen.map((item) => {
              const episode = findEpisode(item, briefs);
              return (
                <article key={item.id}>
                  <span className="er-play" aria-hidden="true">▶</span>
                  <div><b>{item.hook}</b><p>{episode?.show || item.show}</p><a href={episode?.sourceUrl || item.url} target="_blank" rel="noreferrer">{episode?.title || item.title} ↗</a></div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {(area === "All" || area === "GI") && (
        <section className="er-section er-regulatory">
          <div className="er-section-title"><h2>Regulatory Watch</h2><span>1 designation</span></div>
          <article><span>FAST TRACK</span><div><b>ERAS-0015 · metastatic pancreatic adenocarcinoma</b><p>FDA Fast Track designation for the pan-RAS molecular glue. This is not an approval.</p><a href="https://www.onclive.com/view/fda-grants-fast-track-designation-to-pan-ras-molecular-glue-eras-0015-for-metastatic-pancreatic-adenocarcinoma" target="_blank" rel="noreferrer">OncLive ↗</a></div></article>
          <p className="er-regulatory-empty">No new oncology approval or safety warning in this window.</p>
        </section>
      )}

      {area !== "All" && area !== "GI" && (
        <section className="er-section er-regulatory">
          <div className="er-section-title"><h2>Regulatory Watch</h2><span>Clear</span></div>
          <p className="er-regulatory-empty">No new oncology approval or safety warning in this window.</p>
        </section>
      )}

      <footer className="er-footer"><span>{loadingEvidence ? "Connecting physician evidence..." : "Evidence connected to the live Readout."}</span><span>CanvasMD</span></footer>
    </main>
  );
}
