"use client";

import { useEffect, useMemo, useState } from "react";
import type { BriefingArticle, BriefingData, BriefingSharer } from "@/lib/types";
import {
  ALSO_RELEVANT,
  EDITION_AREAS,
  NEW_TO_LISTEN,
  WORTH_YOUR_TIME,
  findArticle,
  findEpisode,
  visibleForArea,
  type EditorialArticle,
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
    const key = post.handle?.toLowerCase() || post.name.toLowerCase();
    if (!text || text.length < 24 || /^rt\s+@/i.test(text) || text === "*") return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function PhysicianConversation({ article, accent }: { article: BriefingArticle | null; accent: string }) {
  const posts = usefulPosts(article);
  const [open, setOpen] = useState(false);
  if (!posts.length) return null;
  return (
    <div className="er-conversation" style={{ "--accent": accent } as React.CSSProperties}>
      <button className="er-conversation-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        What physicians are saying <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="er-receipts">
          {posts.slice(0, 3).map((post, index) => (
            <article className="er-receipt" key={`${post.handle ?? post.name}-${index}`}>
              <header>
                {post.avatar ? <img src={post.avatar} alt="" /> : <span className="er-avatar-fallback">{post.name.slice(0, 1)}</span>}
                <div>
                  <strong>{post.name}</strong>
                  {post.handle && <span>@{post.handle.replace(/^@/, "")}</span>}
                </div>
                {post.likes > 0 && <small>{post.likes} likes</small>}
              </header>
              <p>{post.text}</p>
              {post.tweetUrl && <a href={post.tweetUrl} target="_blank" rel="noreferrer">View on X ↗</a>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Development({ item, briefs, index }: { item: EditorialArticle; briefs: BriefingData[]; index: number }) {
  const article = findArticle(item, briefs);
  const href = article?.url || item.url;
  return (
    <article className="er-development">
      <div className="er-number" aria-hidden="true">{index + 1}</div>
      <div className="er-development-body">
        <div className="er-kicker"><span>{item.site}</span><b>·</b>{item.nickname}</div>
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
        <PhysicianConversation article={article} accent="currentColor" />
      </div>
    </article>
  );
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

  const worth = useMemo(() => visibleForArea(WORTH_YOUR_TIME, area), [area]);
  const relevant = useMemo(() => visibleForArea(ALSO_RELEVANT, area), [area]);
  const listen = useMemo(() => visibleForArea(NEW_TO_LISTEN, area), [area]);

  return (
    <main className={`er-page er-area-${area.toLowerCase()}`}>
      <header className="er-header">
        <div className="er-brand"><span>CANVASMD</span><h1>The Readout</h1></div>
        <div className="er-edition-meta"><strong>{AREA_LABELS[area]}</strong><span>Aug 25, 2026</span><span>last 24h ET</span></div>
      </header>

      <nav className="er-filters" aria-label="Tumor area">
        {EDITION_AREAS.map((candidate) => (
          <button key={candidate} type="button" className={candidate === area ? "active" : ""} onClick={() => { setArea(candidate); setAlsoOpen(false); }}>
            {candidate}
          </button>
        ))}
      </nav>

      <section className="er-intro">
        <p className="er-eyebrow">ONCOLOGY BRIEFING · {area === "All" ? "ACROSS SPECIALTIES" : AREA_LABELS[area].toUpperCase()}</p>
        <h2>{area === "All" ? "The developments worth your time today." : `What matters in ${AREA_LABELS[area]} today.`}</h2>
        <p>Results first, caveats intact, with the physician conversation attached.</p>
      </section>

      <section className="er-section er-worth">
        <div className="er-section-title"><h2>Worth Your Time</h2><span>{worth.length || "No"} development{worth.length === 1 ? "" : "s"}</span></div>
        {worth.length > 0 ? worth.map((item, index) => <Development item={item} briefs={briefs} index={index} key={item.id} />) : (
          <p className="er-empty">No development cleared the bar in this area during the last 24 hours.</p>
        )}
      </section>

      {relevant.length > 0 && (
        <section className="er-section er-relevant">
          <button className="er-section-title er-section-button" type="button" onClick={() => setAlsoOpen((value) => !value)} aria-expanded={alsoOpen}>
            <h2>Also Relevant</h2><span>{alsoOpen ? "Hide −" : `${relevant.length} more +`}</span>
          </button>
          {alsoOpen && <div className="er-compact-list">{relevant.map((item) => {
            const article = findArticle(item, briefs);
            return (
              <article key={item.id}>
                <div><b>{item.site} · {item.nickname}</b><p>{item.takeaway}</p></div>
                <a href={article?.url || item.url} target="_blank" rel="noreferrer">{item.title} ↗</a>
                <small>{item.evidence} · shared by {item.sharedBy} clinician{item.sharedBy === 1 ? "" : "s"}</small>
              </article>
            );
          })}</div>}
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

      <footer className="er-footer"><span>{loadingEvidence ? "Connecting physician receipts…" : "Physician receipts connected to the live Readout payload."}</span><span>Preview edition · editorial contract v1</span></footer>
    </main>
  );
}
