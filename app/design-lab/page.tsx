"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BriefingData, BriefingPaper, BriefingStory, HeroCard } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { AmplifierReceipts, StoryEvidence } from "../ReaderView";
import { articleSource, cleanArticleTitle, storiesOf } from "../briefVM";
import { heroDeckOf } from "../heroContract";
import { resolveHeroEvidence } from "../heroEvidence";
import "../brief.css";
import "./design-lab.css";

const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn"] as const;
const CONCEPTS = ["essential", "air", "studio", "signal"] as const;
type Concept = typeof CONCEPTS[number];
type Frame = "full" | "phone";
type ArticleMedia = { url: string; imageUrl: string | null; publisher: string | null; journal: string | null; domain: string | null };

const CONCEPT_LABEL: Record<Concept, string> = {
  essential: "Essential",
  air: "Air",
  studio: "Studio",
  signal: "Signal",
};

const KICKER: Record<HeroCard["kind"], string> = {
  paper: "Most shared paper",
  episode: "In-depth episode",
  event: "Regulatory event",
  thread: "Clinician post",
  trial_milestone: "Trial milestone",
};

const safeConcept = (value: string | null): Concept => CONCEPTS.includes(value as Concept) ? value as Concept : "essential";
const safeArea = (value: string | null): typeof AREAS[number] => AREAS.includes(value as typeof AREAS[number]) ? value as typeof AREAS[number] : "GU";

function legacyCards(data: BriefingData): HeroCard[] {
  return storiesOf(data).slice(0, 5).map((story: BriefingStory) => ({
    id: story.id,
    anchorId: story.id,
    kind: story.kind === "paper" ? "paper" : story.kind === "trial" ? "trial_milestone" : "thread",
    headline: story.headline,
    why: story.subtitle ?? "Selected from this week’s source activity",
    sourceLabel: story.subtitle ?? data.area,
    url: story.papers?.[0]?.url ?? story.posts?.[0]?.tweetUrl ?? null,
    excerpt: story.description,
    excerptVerbatim: false,
  }));
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "This week" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function minutes(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  return `${Math.round(seconds / 60)} min`;
}

function Artwork({ src, label, round = false }: { src?: string | null; label: string; round?: boolean }) {
  return src
    ? <img className={round ? "dl-avatar" : "dl-art"} src={src} alt="" />
    : <div className={round ? "dl-avatar dl-fallback" : "dl-art dl-fallback"}>{label.slice(0, 1)}</div>;
}

const sourceTone = (source: string | null | undefined): string => {
  const value = (source ?? "").toLowerCase();
  if (/nature|npj/.test(value)) return "nature";
  if (/nejm|massachusetts/.test(value)) return "nejm";
  if (/lancet/.test(value)) return "lancet";
  if (/asco|jco/.test(value)) return "asco";
  if (/uro|urology/.test(value)) return "uro";
  if (/blood|heme|hemat/.test(value)) return "blood";
  return "default";
};

function SourceMark({ name, domain }: { name: string; domain?: string | null }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return <span className={`dl-source-mark tone-${sourceTone(`${name} ${domain ?? ""}`)}`} title={name}>{letters || "P"}</span>;
}

function Faces({ urls }: { urls: string[] }) {
  const faces = urls.filter(Boolean).slice(0, 4);
  return faces.length ? <span className="dl-faces">{faces.map((src, index) => <img src={src} alt="" key={`${src}-${index}`} />)}</span> : null;
}

function ArticleVisual({ media, alt, fallback = null }: { media?: ArticleMedia; alt: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!media?.imageUrl || failed) return fallback;
  return (
    <img
      className="dl-article-image"
      src={media.imageUrl}
      alt={alt}
      onError={(event) => {
        event.currentTarget.closest(".has-image")?.classList.remove("has-image");
        setFailed(true);
      }}
    />
  );
}

function StoryAction({ card }: { card: HeroCard }) {
  if (card.kind === "episode" && card.url) {
    return (
      <AudioQuote
        audioUrl={card.url}
        startMs={card.startMs ?? 0}
        durationSeconds={card.durationSeconds}
        label={card.startMs ? "Play selected moment" : "Play episode"}
        eventId={card.id}
        eventLabel={card.headline}
        tone="dark"
      />
    );
  }
  return card.url ? <a className="dl-arrow-link" href={card.url} target="_blank" rel="noreferrer">Open source <span aria-hidden>↗</span></a> : null;
}

function StorySources({ card, data, accent }: { card: HeroCard; data: BriefingData; accent: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [card.id]);
  const resolved = resolveHeroEvidence(card, data);
  if (!resolved) return null;
  const regionId = `dl-sources-${card.id.replace(/[^a-z0-9]+/gi, "-")}`;
  const faces = resolved.faces;
  const drawer = resolved.kind === "paper"
    ? <StoryEvidence story={{ ...(resolved.story as BriefingStory), publisherPosts: resolved.publisherPosts }} accent={accent} paperLabel="The paper" />
    : resolved.kind === "article"
      ? <StoryEvidence story={{ podcast: [], posts: resolved.posts, papers: [resolved.paper as unknown as BriefingPaper], kind: "paper", publisherPosts: resolved.publisherPosts }} accent={accent} paperLabel="The paper" />
      : resolved.kind === "episode"
        ? <><StoryEvidence story={{ podcast: resolved.pods, posts: [], papers: [], kind: "episode" }} accent={accent} paperLabel="Papers" />{(card.amplifiers ?? []).length > 0 && <AmplifierReceipts amplifiers={card.amplifiers ?? []} accent={accent} />}</>
        : <StoryEvidence story={{ podcast: [], posts: [resolved.post], papers: [], kind: "thread" }} accent={accent} paperLabel="Papers" />;
  return (
    <div className="dl-sources">
      <button type="button" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((value) => !value)} style={{ color: accent }}>
        <Faces urls={faces} />
        <span>{open ? "Hide sources ↑" : "Sources ↓"}</span>
      </button>
      {open && <div className="dl-evidence" id={regionId}>{drawer}</div>}
    </div>
  );
}

function EpisodeRail({ data, limit = 4 }: { data: BriefingData; limit?: number }) {
  const episodes = (data.episodes ?? []).filter((episode) => episode.audioUrl).slice(0, limit);
  if (!episodes.length) return null;
  return (
    <section className="dl-section dl-episodes">
      <div className="dl-section-head"><h2>Listen</h2><span>{episodes.length} selected</span></div>
      <div className="dl-episode-list">
        {episodes.map((episode, index) => (
          <article className="dl-episode" key={episode.episodeId ?? `${episode.title}-${index}`}>
            <div className="dl-episode-head">
              <Artwork src={episode.showArt} label={episode.show ?? "Podcast"} />
              <div>
                <h3>{episode.title}</h3>
                <p>{episode.show ?? "Oncology podcast"}{minutes(episode.durationSeconds) ? ` · ${minutes(episode.durationSeconds)}` : ""}</p>
              </div>
            </div>
            <AudioQuote audioUrl={episode.audioUrl!} startMs={0} durationSeconds={episode.durationSeconds} label="Play episode" eventId={episode.episodeId ?? null} eventLabel={episode.title} tone="dark" />
          </article>
        ))}
      </div>
    </section>
  );
}

function PaperRail({ data, media, limit = 5 }: { data: BriefingData; media: Map<string, ArticleMedia>; limit?: number }) {
  const papers = data.topArticles.slice(0, limit);
  if (!papers.length) return null;
  return (
    <section className="dl-section dl-papers">
      <div className="dl-section-head"><h2>Papers being shared</h2><span>{papers.length} selected</span></div>
      <div className="dl-paper-list">
        {papers.map((paper, index) => (
          <a className={`dl-paper${media.get(paper.url)?.imageUrl ? " has-image" : ""}`} href={paper.url} target="_blank" rel="noreferrer" key={`${paper.url}-${index}`}>
            <ArticleVisual
              media={media.get(paper.url)}
              alt=""
              fallback={<SourceMark name={articleSource(paper.journal, paper.domain) ?? "Publication"} domain={paper.domain} />}
            />
            <span className="dl-paper-copy">
              <strong>{cleanArticleTitle(paper.title)}</strong>
              <small><Faces urls={paper.faces} />{articleSource(paper.journal, paper.domain) ?? "Publication"} · shared by {paper.kolSharers} clinician{paper.kolSharers === 1 ? "" : "s"}</small>
            </span>
            <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function PeopleRail({ data }: { data: BriefingData }) {
  const guests = (data.guests ?? []).slice(0, 3);
  const voices = [...data.topKols].filter((person) => (person.amp ?? 0) > 0).sort((a, b) => (b.amp ?? 0) - (a.amp ?? 0)).slice(0, 3);
  if (!guests.length && !voices.length) return null;
  return (
    <section className="dl-section dl-people">
      <div className="dl-section-head"><h2>People</h2><span>This week</span></div>
      <div className="dl-people-list">
        {guests.map((person) => (
          <div className="dl-person" key={`guest-${person.name}`}>
            <Artwork src={person.avatar} label={person.name} round />
            <div><strong>{person.name}</strong><small>{person.affiliation ?? person.shows[0] ?? "Podcast guest"}</small></div>
            <span>{person.thisWeek} ep</span>
          </div>
        ))}
        {voices.map((person) => (
          <div className="dl-person" key={`voice-${person.handle ?? person.name}`}>
            <Artwork src={person.avatar} label={person.name} round />
            <div><strong>{person.name}</strong><small>{person.institution ?? (person.handle ? `@${person.handle}` : "On X")}</small></div>
            <span>{person.amp} R/Q</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrialRail({ data }: { data: BriefingData }) {
  const trials = data.trials.slice(0, 4);
  if (!trials.length) return null;
  return (
    <section className="dl-section dl-trials">
      <div className="dl-section-head"><h2>Trials in discussion</h2><span>{trials.length} selected</span></div>
      <div className="dl-trial-list">
        {trials.map((trial) => (
          <div className="dl-trial" key={trial.nctId ?? trial.acronym}>
            <strong>{trial.acronym || trial.nctId}</strong>
            <p>{trial.title}</p>
            <span>{trial.phase ?? "Clinical trial"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Air({ data, cards, media }: { data: BriefingData; cards: HeroCard[]; media: Map<string, ArticleMedia> }) {
  const [lead, ...rest] = cards;
  return (
    <div className="dl-concept dl-air">
      <header className="dl-public-head">
        <div><span>CanvasMD</span><h1>The Readout</h1></div>
        <div className="dl-date">{fmtDate(data.generatedAt)} · {data.area}</div>
      </header>
      <nav className="dl-public-nav"><a href="#dl-stories">Stories</a><a href="#dl-listen">Listen</a><a href="#dl-papers">Papers</a><a href="#dl-people">People</a></nav>
      <main>
        <section id="dl-stories" className="dl-air-lead">
          {lead && <>
            <div className="dl-air-lead-copy">
              <div className="dl-kicker">{KICKER[lead.kind]}</div>
              <h2>{lead.headline}</h2>
              <p className="dl-deck">{lead.excerpt}</p>
              <div className="dl-source-line"><SourceMark name={lead.sourceLabel} /><strong>{lead.sourceLabel}</strong><span>{lead.why}</span></div>
              <StoryAction card={lead} />
              <StorySources card={lead} data={data} accent="#2365d8" />
            </div>
          </>}
        </section>
        <section className="dl-air-grid">
          {rest.map((card, index) => (
            <article key={card.id}>
              <span className="dl-index">0{index + 2}</span>
              <div className="dl-kicker">{KICKER[card.kind]}</div>
              <h3>{card.headline}</h3>
              <p>{card.excerpt}</p>
              <small>{card.why}</small>
              <StoryAction card={card} />
              <StorySources card={card} data={data} accent="#2365d8" />
            </article>
          ))}
        </section>
        <div className="dl-air-columns">
          <div id="dl-listen"><EpisodeRail data={data} limit={3} /></div>
          <div id="dl-papers"><PaperRail data={data} media={media} limit={5} /></div>
        </div>
        <div className="dl-air-columns dl-air-lower">
          <div id="dl-people"><PeopleRail data={data} /></div>
          <TrialRail data={data} />
        </div>
      </main>
    </div>
  );
}

function Studio({ data, cards, media }: { data: BriefingData; cards: HeroCard[]; media: Map<string, ArticleMedia> }) {
  const [active, setActive] = useState(0);
  const card = cards[Math.min(active, Math.max(0, cards.length - 1))];
  return (
    <div className="dl-concept dl-studio">
      <header className="dl-studio-head"><strong>The Readout</strong><span>{data.area} · {fmtDate(data.generatedAt)}</span></header>
      <main className="dl-studio-stage">
        <aside className="dl-story-index" aria-label="Top stories">
          <div className="dl-kicker">Worth your attention</div>
          {cards.map((item, index) => (
            <button className={index === active ? "active" : ""} onClick={() => setActive(index)} key={item.id}>
              <span>0{index + 1}</span><strong>{item.headline}</strong>
            </button>
          ))}
        </aside>
        {card && <section className="dl-studio-feature">
          <div className="dl-kicker">{KICKER[card.kind]}</div>
          <h1>{card.headline}</h1>
          <p>{card.excerpt}</p>
          <div className="dl-studio-meta"><strong>{card.sourceLabel}</strong><span>{card.why}</span></div>
          <StoryAction card={card} />
          <StorySources card={card} data={data} accent="#ff9b72" />
        </section>}
      </main>
      <div className="dl-studio-rails"><EpisodeRail data={data} limit={3} /><PaperRail data={data} media={media} limit={4} /></div>
      <div className="dl-studio-rails dl-studio-lower"><PeopleRail data={data} /><TrialRail data={data} /></div>
    </div>
  );
}

function Signal({ data, cards, media }: { data: BriefingData; cards: HeroCard[]; media: Map<string, ArticleMedia> }) {
  return (
    <div className="dl-concept dl-signal">
      <header className="dl-signal-head"><h1>The Readout</h1><div><strong>{data.area}</strong><span>{fmtDate(data.generatedAt)}</span></div></header>
      <main>
        <div className="dl-signal-title"><span>Worth your attention</span><strong>{cards.length}</strong></div>
        <section className="dl-signal-stories">
          {cards.map((card, index) => (
            <article className={`kind-${card.kind}`} key={card.id}>
              <div className="dl-signal-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <div className="dl-kicker">{KICKER[card.kind]}</div>
                <h2>{card.headline}</h2>
                {card.excerpt && <p>{card.excerpt}</p>}
                <div className="dl-signal-meta"><strong>{card.sourceLabel}</strong><span>{card.why}</span></div>
                <StoryAction card={card} />
                <StorySources card={card} data={data} accent="#b8322e" />
              </div>
            </article>
          ))}
        </section>
        <div className="dl-signal-rail"><EpisodeRail data={data} limit={4} /><PeopleRail data={data} /></div>
        <PaperRail data={data} media={media} limit={5} />
        <TrialRail data={data} />
      </main>
    </div>
  );
}

function Essential({ data, cards, media }: { data: BriefingData; cards: HeroCard[]; media: Map<string, ArticleMedia> }) {
  const [active, setActive] = useState(0);
  const card = cards[Math.min(active, Math.max(0, cards.length - 1))];
  return (
    <div className="dl-concept dl-essential">
      <header className="dl-essential-head">
        <strong>The Readout</strong>
        <div><span>{data.area}</span><span>{fmtDate(data.generatedAt)}</span></div>
      </header>
      <main>
        {card && (
          <section className="dl-essential-story">
            <nav className="dl-essential-pager" aria-label="Worth your attention">
              <span>Worth your attention</span>
              <div>
                {cards.map((item, index) => (
                  <button
                    type="button"
                    className={index === active ? "active" : ""}
                    aria-current={index === active ? "true" : undefined}
                    aria-label={`Story ${index + 1}: ${item.headline}`}
                    title={item.headline}
                    onClick={() => setActive(index)}
                    key={item.id}
                  >
                    <span className="dl-essential-pager-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="dl-essential-pager-title">{item.headline}</span>
                    <span className="dl-essential-pager-arrow" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            </nav>
            <div className="dl-essential-copy">
              <div className="dl-kicker">{KICKER[card.kind]}</div>
              <h1>{card.headline}</h1>
              {card.excerpt && <p>{card.excerpt}</p>}
              <div className="dl-essential-source">
                <SourceMark name={card.sourceLabel} />
                <div><strong>{card.sourceLabel}</strong><span>{card.why}</span></div>
              </div>
              <div className="dl-essential-actions"><StoryAction card={card} /><StorySources card={card} data={data} accent="#0066cc" /></div>
            </div>
          </section>
        )}
        <div className="dl-essential-stream">
          <EpisodeRail data={data} limit={3} />
          <PaperRail data={data} media={media} limit={5} />
          <PeopleRail data={data} />
          <TrialRail data={data} />
        </div>
      </main>
    </div>
  );
}

export default function DesignLabPage() {
  const [area, setArea] = useState<typeof AREAS[number]>("GU");
  const [concept, setConcept] = useState<Concept>("essential");
  const [frame, setFrame] = useState<Frame>("full");
  const [data, setData] = useState<BriefingData | null>(null);
  const [articleMedia, setArticleMedia] = useState<Map<string, ArticleMedia>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setArea(safeArea(query.get("area")));
    setConcept(safeConcept(query.get("concept")));
  }, []);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    fetch(`/api/briefing?area=${encodeURIComponent(area)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || body.error) throw new Error(body.error ?? `Briefing returned ${response.status}`);
        return body.briefing as BriefingData;
      })
      .then((briefing) => { if (active) setData(briefing); })
      .catch((reason) => { if (active) setError(String(reason?.message ?? reason)); });
    return () => { active = false; };
  }, [area]);

  const cards = useMemo(() => data ? (heroDeckOf(data) ?? legacyCards(data)).slice(0, 5) : [], [data]);

  useEffect(() => {
    if (!data) { setArticleMedia(new Map()); return; }
    const urls = [...new Set([
      ...data.topArticles.map((paper) => paper.url),
      ...cards.filter((card) => card.kind === "paper").map((card) => card.url).filter((url): url is string => !!url),
    ])];
    let active = true;
    fetch("/api/design-lab-media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls }) })
      .then((response) => response.json())
      .then((body) => {
        if (!active || !body?.ok) return;
        setArticleMedia(new Map((body.media as ArticleMedia[]).map((item) => [item.url, item])));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [data, cards]);

  const setLabState = (next: { area?: typeof AREAS[number]; concept?: Concept }) => {
    const url = new URL(window.location.href);
    if (next.area) { setArea(next.area); url.searchParams.set("area", next.area); }
    if (next.concept) { setConcept(next.concept); url.searchParams.set("concept", next.concept); }
    window.history.replaceState({}, "", url);
  };

  return (
    <div className="dl-lab">
      <header className="dl-toolbar">
        <a className="dl-lab-name" href="/admin"><strong>Design Lab</strong><span>The Readout</span></a>
        <div className="dl-toolbar-group" aria-label="Design direction">
          {CONCEPTS.map((value) => <button key={value} className={concept === value ? "active" : ""} onClick={() => setLabState({ concept: value })}>{CONCEPT_LABEL[value]}</button>)}
        </div>
        <div className="dl-toolbar-group dl-area-control" aria-label="Specialty">
          {AREAS.map((value) => <button key={value} className={area === value ? "active" : ""} onClick={() => setLabState({ area: value })}>{value}</button>)}
        </div>
        <div className="dl-toolbar-group" aria-label="Preview size">
          <button aria-label="Full width preview" title="Full width" className={frame === "full" ? "active" : ""} onClick={() => setFrame("full")}>Full</button>
          <button aria-label="Phone preview" title="Phone preview" className={frame === "phone" ? "active" : ""} onClick={() => setFrame("phone")}>Phone</button>
        </div>
        <a className="dl-live-link" href={`/?area=${area}`}>Live Readout <span aria-hidden>↗</span></a>
      </header>
      <div className={`dl-preview ${frame === "phone" ? "is-phone" : ""}`}>
        {!data && !error && <div className="dl-loading">Loading {area}…</div>}
        {error && <div className="dl-loading">Couldn’t load {area}: {error}</div>}
        {data && concept === "essential" && <Essential data={data} cards={cards} media={articleMedia} />}
        {data && concept === "air" && <Air data={data} cards={cards} media={articleMedia} />}
        {data && concept === "studio" && <Studio data={data} cards={cards} media={articleMedia} />}
        {data && concept === "signal" && <Signal data={data} cards={cards} media={articleMedia} />}
      </div>
    </div>
  );
}
