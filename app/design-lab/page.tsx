"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { BriefingArticle, BriefingData, BriefingPaper, BriefingSharer, BriefingStory, BriefingTrial, HeroCard } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { AmplifierReceipts, StoryEvidence, TweetCard } from "../ReaderView";
import { AREA_FULL, articleSource, cleanArticleTitle, cleanTweetText, storiesOf } from "../briefVM";
import { heroDeckOf } from "../heroContract";
import { resolveHeroEvidence } from "../heroEvidence";
import "../brief.css";
import "./design-lab.css";

const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn"] as const;
const CONCEPTS = ["essential", "air", "studio", "editorial", "signal"] as const;
type Concept = typeof CONCEPTS[number];
type Frame = "full" | "phone";
type ArticleMedia = { url: string; imageUrl: string | null; publisher: string | null; journal: string | null; domain: string | null };

const CONCEPT_LABEL: Record<Concept, string> = {
  essential: "Essential",
  air: "Air",
  studio: "Studio",
  editorial: "Editorial",
  signal: "Signal",
};

const KICKER: Record<HeroCard["kind"], string> = {
  paper: "Paper",
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
        const row = event.currentTarget.closest(".dl-paper");
        const item = event.currentTarget.closest(".dl-paper-item");
        row?.classList.remove("has-image");
        row?.classList.add("no-visual");
        item?.classList.remove("has-image");
        item?.classList.add("no-visual");
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

function StorySources({ card, data, accent, collapsedLabel = "Sources", editorial = false }: { card: HeroCard; data: BriefingData; accent: string; collapsedLabel?: string; editorial?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [card.id]);
  const resolved = resolveHeroEvidence(card, data);
  if (!resolved) return null;
  const regionId = `dl-sources-${card.id.replace(/[^a-z0-9]+/gi, "-")}`;
  const faces = resolved.faces;
  const drawer = editorial
    ? resolved.kind === "paper"
      ? <EditorialEvidence
          posts={(resolved.story as BriefingStory).posts ?? []}
          pods={(resolved.story as BriefingStory).podcast ?? []}
          papers={(resolved.story as BriefingStory).papers ?? []}
          publisherPosts={resolved.publisherPosts}
          amplifiers={card.amplifiers ?? []}
        />
      : resolved.kind === "article"
        ? <EditorialEvidence posts={resolved.posts} papers={[resolved.paper as unknown as BriefingPaper]} publisherPosts={resolved.publisherPosts} amplifiers={card.amplifiers ?? []} />
        : resolved.kind === "episode"
          ? <EditorialEvidence pods={resolved.pods} amplifiers={card.amplifiers ?? []} />
          : <EditorialEvidence posts={[resolved.post]} />
    : resolved.kind === "paper"
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
        <span>{open ? "Hide sources ↑" : `${collapsedLabel} ↓`}</span>
      </button>
      {open && <div className="dl-evidence" id={regionId}>{drawer}</div>}
    </div>
  );
}

function SourceDisclosure({ faces, label = "See sources", children }: { faces: string[]; label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return (
    <div className="dl-sources">
      <button type="button" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((value) => !value)}>
        <Faces urls={faces} />
        <span>{open ? "Hide sources ↑" : `${label} ↓`}</span>
      </button>
      {open && <div className="dl-evidence" id={regionId}>{children}</div>}
    </div>
  );
}

function PaperSources({ paper }: { paper: BriefingArticle }) {
  const clinicianPosts = paper.posts ?? [];
  const publisherPosts = paper.publisherPosts ?? [];
  if (!clinicianPosts.length && !publisherPosts.length && !paper.publishers.length) return null;
  const evidencePaper: BriefingPaper = {
    title: paper.title,
    url: paper.url,
    journal: paper.journal,
    domain: paper.domain,
    abstract: paper.abstract,
    sharers: clinicianPosts,
    sharerCount: paper.kolSharers,
    topLikes: paper.topLikes,
    posts: clinicianPosts,
    publishers: paper.publishers,
    publisherPosts,
    peerReviewed: paper.peerReviewed,
  };
  return (
    <SourceDisclosure faces={paper.faces}>
      <EditorialEvidence posts={clinicianPosts} papers={[evidencePaper]} publisherPosts={publisherPosts} />
    </SourceDisclosure>
  );
}

function EpisodeSources({ episode }: { episode: NonNullable<BriefingData["episodes"]>[number] }) {
  const amplifiers = episode.amplifiers ?? [];
  if (!amplifiers.length) return null;
  return (
    <SourceDisclosure faces={amplifiers.map((item) => item.avatar).filter((avatar): avatar is string => !!avatar)} label="See amplification">
      <EditorialEvidence amplifiers={amplifiers} />
    </SourceDisclosure>
  );
}

function TrialSources({ trial }: { trial: BriefingTrial }) {
  const faces = [
    ...trial.posts.map((post) => post.avatar),
    ...trial.pods.map((pod) => pod.showArt),
  ].filter((avatar): avatar is string => !!avatar);
  if (!trial.posts.length && !trial.pods.length && !trial.articles.length) return null;
  return (
    <SourceDisclosure faces={faces}>
      <EditorialEvidence posts={trial.posts} pods={trial.pods} papers={trial.articles} />
    </SourceDisclosure>
  );
}

function firstSourceTweet(card: HeroCard, data: BriefingData): BriefingSharer | null {
  const resolved = resolveHeroEvidence(card, data);
  if (!resolved) return null;
  if (resolved.kind === "paper") {
    const story = resolved.story as BriefingStory;
    return story.posts?.[0] ?? story.papers?.[0]?.posts?.[0] ?? resolved.publisherPosts[0] ?? null;
  }
  if (resolved.kind === "article") return resolved.posts[0] ?? resolved.publisherPosts[0] ?? null;
  if (resolved.kind === "thread") return resolved.post;
  const quote = (card.amplifiers ?? []).find((item) => item.isQuote && item.text);
  return quote ? {
    name: quote.name,
    handle: quote.handle,
    avatar: quote.avatar,
    tweetUrl: null,
    text: quote.text,
    likes: quote.likes,
    retweets: 0,
    quotes: 0,
    views: 0,
  } : null;
}

function EditorialTweet({ tweet }: { tweet: BriefingSharer }) {
  const content = <>
    <div className="dl-editorial-tweet-head">
      {tweet.avatar && <img src={tweet.avatar} alt="" />}
      <div><strong>{tweet.name}</strong>{tweet.handle && <span>@{tweet.handle.replace(/^@/, "")}</span>}</div>
      {(tweet.likes ?? 0) > 0 && <small>♥ {tweet.likes}</small>}
    </div>
    <p>{cleanTweetText(tweet.text)}</p>
  </>;
  return tweet.tweetUrl
    ? <a className="dl-editorial-tweet" href={tweet.tweetUrl} target="_blank" rel="noreferrer">{content}</a>
    : <div className="dl-editorial-tweet">{content}</div>;
}

function EditorialEvidence({ posts = [], pods = [], papers = [], publisherPosts = [], amplifiers = [] }: {
  posts?: BriefingSharer[];
  pods?: BriefingStory["podcast"];
  papers?: BriefingPaper[];
  publisherPosts?: BriefingSharer[];
  amplifiers?: NonNullable<HeroCard["amplifiers"]>;
}) {
  const [showAllPosts, setShowAllPosts] = useState(false);
  const postsRegionId = useId();
  const seenPosts = new Set<string>();
  const uniquePosts = [...posts, ...publisherPosts].filter((post) => {
    const key = post.tweetUrl ?? `${post.handle ?? post.name}:${post.text ?? ""}`;
    if (seenPosts.has(key)) return false;
    seenPosts.add(key);
    return true;
  });
  const postIdentity = uniquePosts.map((post) => post.tweetUrl ?? `${post.handle ?? post.name}:${post.text ?? ""}`).join("|");
  useEffect(() => setShowAllPosts(false), [postIdentity]);
  const visiblePosts = showAllPosts ? uniquePosts : uniquePosts.slice(0, 5);
  const publisherNames = [...new Set(papers.flatMap((paper) => paper.publishers ?? []))];
  return (
    <div className="dl-editorial-evidence">
      {pods.length > 0 && <section>
        <div className="dl-editorial-evidence-label">Podcast moments</div>
        {pods.map((pod, index) => <article className="dl-editorial-pod" key={`${pod.episodeId}-${pod.startMs ?? index}`}>
          <div className="dl-editorial-pod-head">
            <Artwork src={pod.showArt} label={pod.show ?? "Podcast"} />
            <div><strong>{pod.episodeTitle}</strong><small>{pod.show}</small></div>
          </div>
          <p>{pod.gloss}</p>
          {pod.audioUrl && <AudioQuote audioUrl={pod.audioUrl} startMs={pod.startMs} durationSeconds={pod.durationSeconds} label="Play this moment" eventId={pod.episodeId} eventLabel={pod.episodeTitle} tone="dark" />}
        </article>)}
      </section>}
      {uniquePosts.length > 0 && <section>
        <div className="dl-editorial-evidence-label-row">
          <div className="dl-editorial-evidence-label">Shared on X</div>
          {uniquePosts.length > 5 && <span>{visiblePosts.length} of {uniquePosts.length}</span>}
        </div>
        <div id={postsRegionId}>
          {visiblePosts.map((post, index) => <EditorialTweet tweet={post} key={post.tweetUrl ?? `${post.handle}-${index}`} />)}
        </div>
        {uniquePosts.length > 5 && <button
          className="dl-evidence-list-action"
          type="button"
          aria-expanded={showAllPosts}
          aria-controls={postsRegionId}
          onClick={() => setShowAllPosts((value) => !value)}
        >
          {showAllPosts ? "Show fewer source posts ↑" : `Show ${uniquePosts.length - visiblePosts.length} more source posts ↓`}
        </button>}
      </section>}
      {amplifiers.length > 0 && <section>
        <div className="dl-editorial-evidence-label">Amplified on X</div>
        <div className="dl-editorial-amplifiers">
          {amplifiers.map((item, index) => <div key={`${item.handle ?? item.name}-${index}`}>
            <Artwork src={item.avatar} label={item.name} round />
            <span>
              <strong>{item.name}</strong>
              {item.handle && <small>@{item.handle.replace(/^@/, "")}</small>}
              {item.text && <p>{cleanTweetText(item.text)}</p>}
            </span>
          </div>)}
        </div>
      </section>}
      {papers.length > 0 && <section>
        <div className="dl-editorial-evidence-label">Original papers</div>
        {publisherNames.length > 0 && <div className="dl-editorial-publishers">Also shared by {publisherNames.join(" · ")}</div>}
        {papers.slice(0, 3).map((paper, index) => <a className="dl-editorial-evidence-paper" href={paper.url} target="_blank" rel="noreferrer" key={`${paper.url}-${index}`}>
          <span>{paper.journal ?? paper.domain ?? "Publication"}</span>
          <strong>{cleanArticleTitle(paper.title)}</strong>
          <i aria-hidden="true">↗</i>
        </a>)}
      </section>}
    </div>
  );
}

function paperAbstract(card: HeroCard, data: BriefingData): string | null {
  if (card.kind !== "paper") return null;
  const reading = data.topArticles.find((paper) => paper.url === card.url);
  const story = data.topStories?.find((item) => item.kind === "paper" && (item.papers?.[0]?.url === card.url || item.headline === card.headline));
  const value = reading?.abstract ?? story?.papers?.[0]?.abstract ?? null;
  return value?.replace(/\s+/g, " ").trim() || null;
}

function AbstractDisclosure({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <details className={`dl-abstract${compact ? " is-compact" : ""}`}>
      <summary>{compact ? "Abstract" : "Read abstract"}<span aria-hidden="true">↓</span></summary>
      <p>{text}</p>
    </details>
  );
}

function studioVisual(card: HeroCard, data: BriefingData, media: Map<string, ArticleMedia>): { src: string; round: boolean } | null {
  if (card.kind === "paper" && card.url) {
    const src = media.get(card.url)?.imageUrl;
    const looksLikeUnvettedPreview = !src || /pbs\.twimg\.com\/news_img|(?:^|[._/-])(fig(?:ure)?|graph|chart|table)(?:[._/-]|$)/i.test(src);
    return looksLikeUnvettedPreview ? null : { src, round: false };
  }
  if (card.kind === "episode") {
    const resolved = resolveHeroEvidence(card, data);
    const receiptArt = resolved?.kind === "episode" ? resolved.pods.find((pod) => pod.showArt)?.showArt : null;
    const episodeArt = data.episodes?.find((episode) => episode.episodeId === card.anchorId)?.showArt;
    const src = receiptArt ?? episodeArt;
    return src ? { src, round: false } : null;
  }
  if (card.kind === "thread") {
    const src = firstSourceTweet(card, data)?.avatar;
    return src ? { src, round: true } : null;
  }
  return null;
}

function StudioVisual({ visual, headline }: { visual: { src: string; round: boolean }; headline: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className={`dl-studio-story-visual${visual.round ? " is-round" : ""}`}
      src={visual.src}
      alt=""
      aria-hidden="true"
      title={headline}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (!visual.round && (naturalWidth < 180 || naturalHeight < 120 || naturalWidth / naturalHeight > 3 || naturalHeight / naturalWidth > 2.2)) {
          setFailed(true);
        }
      }}
      onError={() => setFailed(true)}
    />
  );
}

function StudioLeadStory({ card, data, accent }: { card: HeroCard; data: BriefingData; accent: string }) {
  const firstTweet = firstSourceTweet(card, data);
  const abstract = paperAbstract(card, data);
  return (
    <article className="dl-studio-lead">
      <div className="dl-kicker">{KICKER[card.kind]}</div>
      <div className="dl-studio-source">{card.sourceLabel}</div>
      <h1>{card.url && card.kind !== "episode"
        ? <a href={card.url} target="_blank" rel="noreferrer">{card.headline}</a>
        : card.headline}</h1>
      {card.excerpt && <p>{card.excerpt}</p>}
      {abstract && <AbstractDisclosure text={abstract} />}
      {card.kind === "episode" && <StoryAction card={card} />}
      {firstTweet && <div className="dl-studio-tweet"><span>From X</span><TweetCard t={firstTweet} /></div>}
      <StorySources card={card} data={data} accent={accent} collapsedLabel="See all sources" />
    </article>
  );
}

function StudioStoryRow({ card, data, media, accent, index }: { card: HeroCard; data: BriefingData; media: Map<string, ArticleMedia>; accent: string; index: number }) {
  const visual = studioVisual(card, data, media);
  const abstract = paperAbstract(card, data);
  return (
    <article className="dl-studio-story">
      <div className="dl-studio-story-source">
        <span>{KICKER[card.kind]}</span>
        <strong>{card.sourceLabel}</strong>
      </div>
      <div className={`dl-studio-story-main${visual ? " has-visual" : ""}`}>
        {visual && <StudioVisual visual={visual} headline={card.headline} />}
        <div className="dl-studio-story-copy">
          <span className="dl-studio-story-number">{String(index + 1).padStart(2, "0")}</span>
          <h2>{card.url && card.kind !== "episode"
            ? <a href={card.url} target="_blank" rel="noreferrer" title={card.headline}>{card.headline}</a>
            : card.headline}</h2>
          {card.excerpt && <p>{card.excerpt}</p>}
        </div>
      </div>
      {abstract && <AbstractDisclosure text={abstract} compact />}
      {card.kind === "episode" && <StoryAction card={card} />}
      <StorySources card={card} data={data} accent={accent} collapsedLabel="See all sources" />
    </article>
  );
}

function EpisodeRail({ data, limit = 4, accent }: { data: BriefingData; limit?: number; accent?: string }) {
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
            {accent && <EpisodeSources episode={episode} />}
          </article>
        ))}
      </div>
    </section>
  );
}

function PaperRail({ data, media, limit = 5, accent }: { data: BriefingData; media: Map<string, ArticleMedia>; limit?: number; accent?: string }) {
  const papers = data.topArticles.slice(0, limit);
  if (!papers.length) return null;
  return (
    <section className="dl-section dl-papers">
      <div className="dl-section-head"><h2>Papers being shared</h2><span>{papers.length} selected</span></div>
      <div className="dl-paper-list">
        {papers.map((paper, index) => {
          const hasImage = !!media.get(paper.url)?.imageUrl;
          const showFallbackMark = !accent;
          const hasVisual = hasImage || showFallbackMark;
          const visualClass = hasImage ? " has-image" : hasVisual ? "" : " no-visual";
          return (
            <article className={`dl-paper-item${visualClass}`} key={`${paper.url}-${index}`}>
              <a className={`dl-paper${visualClass}`} href={paper.url} target="_blank" rel="noreferrer">
                {hasVisual && <ArticleVisual
                  media={media.get(paper.url)}
                  alt=""
                  fallback={showFallbackMark ? <SourceMark name={articleSource(paper.journal, paper.domain) ?? "Publication"} domain={paper.domain} /> : null}
                />}
                <span className="dl-paper-copy">
                  <strong>{cleanArticleTitle(paper.title)}</strong>
                  <small>{!accent && <Faces urls={paper.faces} />}{articleSource(paper.journal, paper.domain) ?? "Publication"} · shared by {paper.kolSharers} clinician{paper.kolSharers === 1 ? "" : "s"}</small>
                </span>
                <span aria-hidden>↗</span>
              </a>
              <div className="dl-paper-controls">
                {accent && <PaperSources paper={paper} />}
                {paper.abstract?.trim() && <AbstractDisclosure text={paper.abstract.replace(/\s+/g, " ").trim()} compact />}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PersonPostDisclosure({ posts }: { posts: BriefingSharer[] }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const postCount = posts.length;
  if (!postCount) return null;
  return (
    <div className="dl-person-posts">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide posts ↑" : `View ${postCount} post${postCount === 1 ? "" : "s"} ↓`}
      </button>
      {open && <div className="dl-editorial-evidence dl-person-post-drawer" id={regionId}>
        <section>
          <div className="dl-editorial-evidence-label">Posts on X</div>
          {posts.map((post, index) => <EditorialTweet tweet={post} key={post.tweetUrl ?? `${post.handle}-${index}`} />)}
        </section>
      </div>}
    </div>
  );
}

function PeopleRail({ data, accent }: { data: BriefingData; accent?: string }) {
  const [showAllGuests, setShowAllGuests] = useState(false);
  const [showAllVoices, setShowAllVoices] = useState(false);
  useEffect(() => {
    setShowAllGuests(false);
    setShowAllVoices(false);
  }, [data.area]);
  const allGuests = data.guests ?? [];
  const allVoices = [...data.topKols]
    .filter((person) => (person.amp ?? 0) > 0)
    .sort((a, b) => (b.amp ?? 0) - (a.amp ?? 0) || b.tweets - a.tweets || b.peakLikes - a.peakLikes);
  const guests = showAllGuests ? allGuests : allGuests.slice(0, 4);
  const voices = showAllVoices ? allVoices : allVoices.slice(0, 4);
  if (!guests.length && !voices.length) return null;
  return (
    <section className="dl-section dl-people">
      <div className="dl-section-head"><h2>People</h2><span>This week</span></div>
      <div className="dl-people-groups">
        {allGuests.length > 0 && <div className="dl-people-group">
          <div className="dl-people-group-head"><h3>Podcast guests</h3><span>On the mics</span></div>
          <div className="dl-people-list">
            {guests.map((person) => (
              <div className={`dl-person${person.avatar ? "" : " no-avatar"}`} key={`guest-${person.name}`}>
                {person.avatar && <Artwork src={person.avatar} label={person.name} round />}
                <div><strong>{person.name}</strong><small>{person.affiliation ?? person.shows[0] ?? "Podcast guest"}</small></div>
                <span>{person.thisWeek} ep</span>
              </div>
            ))}
          </div>
          {allGuests.length > 4 && <button className="dl-list-action" type="button" onClick={() => setShowAllGuests((value) => !value)}>
            {showAllGuests ? "Show fewer guests ↑" : `Show ${allGuests.length - guests.length} more guests ↓`}
          </button>}
        </div>}
        {allVoices.length > 0 && <div className="dl-people-group">
          <div className="dl-people-group-head"><h3>Amplified on X</h3><span>Verified clinicians</span></div>
          <div className="dl-people-list">
            {voices.map((person) => (
              <div className={`dl-person${person.avatar ? "" : " no-avatar"}`} key={`voice-${person.handle ?? person.name}`}>
                {person.avatar && <Artwork src={person.avatar} label={person.name} round />}
                <div><strong>{person.name}</strong><small>{person.institution ?? (person.handle ? `@${person.handle}` : "On X")}</small></div>
                <span>{person.amp} R/Q</span>
                {accent && <PersonPostDisclosure posts={person.posts} />}
              </div>
            ))}
          </div>
          {allVoices.length > 4 && <button className="dl-list-action" type="button" onClick={() => setShowAllVoices((value) => !value)}>
            {showAllVoices ? "Show fewer clinicians ↑" : `Show ${allVoices.length - voices.length} more clinicians ↓`}
          </button>}
        </div>}
      </div>
    </section>
  );
}

function TrialRail({ data, accent }: { data: BriefingData; accent?: string }) {
  const trials = data.trials.slice(0, 4);
  if (!trials.length) return null;
  return (
    <section className="dl-section dl-trials">
      <div className="dl-section-head"><h2>Trials in discussion</h2><span>{trials.length} selected</span></div>
      <div className="dl-trial-list">
        {trials.map((trial) => (
          <article className="dl-trial" key={trial.nctId ?? trial.acronym}>
            <a className="dl-trial-name" href={trial.url} target="_blank" rel="noreferrer"><strong>{trial.acronym || trial.nctId}</strong></a>
            <p>{trial.title}</p>
            <span>{trial.phase ?? "Clinical trial"}</span>
            {accent && <div className="dl-trial-sources"><TrialSources trial={trial} /></div>}
          </article>
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

function Studio({ data, cards, media, onAreaChange, lightMode, onLightModeChange }: { data: BriefingData; cards: HeroCard[]; media: Map<string, ArticleMedia>; onAreaChange: (area: typeof AREAS[number]) => void; lightMode: boolean; onLightModeChange: (light: boolean) => void }) {
  const [lead, ...rest] = cards;
  const studioAccent = lightMode ? "#b64b2a" : "#ff9b72";
  return (
    <div className={`dl-concept dl-studio${lightMode ? " is-light" : ""}`}>
      <header className="dl-studio-head">
        <strong>The Readout</strong>
        <nav className="dl-studio-nav" aria-label="Readout sections">
          <a href="#studio-stories">Stories</a>
          <a href="#studio-episodes">Episodes</a>
          <a href="#studio-papers">Papers</a>
          <a href="#studio-people">People</a>
          <a href="#studio-trials">Trials</a>
        </nav>
        <div className="dl-studio-head-tools">
          <label className="dl-studio-theme">
            <input type="checkbox" checked={lightMode} onChange={(event) => onLightModeChange(event.target.checked)} />
            <i aria-hidden="true" />
            <span>Light</span>
          </label>
          <label className="dl-studio-specialty">
            <span>Specialty</span>
            <select value={data.area} onChange={(event) => onAreaChange(event.target.value as typeof AREAS[number])}>
              {AREAS.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <span>{fmtDate(data.generatedAt)}</span>
        </div>
      </header>
      <main className="dl-studio-stories" id="studio-stories">
        <div className="dl-studio-stories-inner">
          <div className="dl-studio-stories-heading">
            <div className="dl-kicker">Top stories</div>
            <span>{cards.length} stor{cards.length === 1 ? "y" : "ies"}</span>
          </div>
          {lead && <StudioLeadStory card={lead} data={data} accent={studioAccent} />}
          {rest.length > 0 && <section className="dl-studio-story-list" aria-label="More stories">
            {rest.map((card, index) => <StudioStoryRow card={card} data={data} media={media} accent={studioAccent} index={index + 1} key={card.id} />)}
          </section>}
        </div>
      </main>
      <div className="dl-studio-rails"><div id="studio-episodes"><EpisodeRail data={data} limit={3} /></div><div id="studio-papers"><PaperRail data={data} media={media} limit={4} /></div></div>
      <div className="dl-studio-rails dl-studio-lower"><div id="studio-people"><PeopleRail data={data} /></div><div id="studio-trials"><TrialRail data={data} /></div></div>
    </div>
  );
}

function Editorial({ data, cards, media, onAreaChange }: { data: BriefingData; cards: HeroCard[]; media: Map<string, ArticleMedia>; onAreaChange: (area: typeof AREAS[number]) => void }) {
  const [lead, ...rest] = cards;
  const leadTweet = lead ? firstSourceTweet(lead, data) : null;
  const leadAbstract = lead ? paperAbstract(lead, data) : null;
  const leadVisual = lead ? studioVisual(lead, data, media) : null;
  return (
    <div className="dl-concept dl-editorial">
      <header className="dl-editorial-head">
        <div className="dl-editorial-brand"><small>CanvasMD</small><strong>The Readout</strong></div>
        <nav aria-label="Readout sections"><a href="#editorial-stories">Stories</a><a href="#editorial-listen">Listen</a><a href="#editorial-papers">Papers</a><a href="#editorial-people">People</a><a href="#editorial-trials">Trials</a></nav>
        <div className="dl-editorial-context">
          <label className="dl-editorial-specialty">
            <select aria-label="Specialty" value={data.area} onChange={(event) => onAreaChange(event.target.value as typeof AREAS[number])}>
              {AREAS.map((area) => <option value={area} key={area}>{AREA_FULL[area] ?? area}</option>)}
            </select>
          </label>
          <span>{fmtDate(data.generatedAt)}</span>
        </div>
      </header>
      <main>
        {lead && <section className="dl-editorial-lead" id="editorial-stories">
          <div className="dl-editorial-lead-primary">
            <div className="dl-editorial-lead-copy">
              <div className="dl-kicker">{KICKER[lead.kind]}</div>
              {lead.kind === "episode" && leadVisual && <div className="dl-editorial-mobile-episode-identity">
                <StudioVisual visual={leadVisual} headline={lead.headline} />
                <span>{lead.sourceLabel}</span>
              </div>}
              <div className={`dl-editorial-source${lead.kind === "episode" ? " is-episode" : ""}`}>{lead.sourceLabel}</div>
              <h1>{lead.url && lead.kind !== "episode" ? <a href={lead.url} target="_blank" rel="noreferrer">{lead.headline}</a> : lead.headline}</h1>
              {lead.excerpt && <p>{lead.excerpt}</p>}
              {leadAbstract && <AbstractDisclosure text={leadAbstract} />}
              {lead.kind === "episode" && <div className="dl-editorial-episode-meta">{lead.why}</div>}
              {lead.kind === "episode" && <StoryAction card={lead} />}
            </div>
            <div className="dl-editorial-lead-sources">
              <StorySources card={lead} data={data} accent="#b94c31" collapsedLabel="See all sources" editorial />
            </div>
          </div>
          <aside className={`dl-editorial-receipt${lead.kind === "episode" ? " is-episode" : ""}${leadTweet ? " has-tweet" : " is-art-only"}`} aria-label={leadTweet ? "A clinician source" : lead.kind === "episode" ? "Podcast artwork" : "Why this story surfaced"}>
            {leadVisual && <StudioVisual visual={leadVisual} headline={lead.headline} />}
            {leadTweet ? <><span className="dl-editorial-receipt-label">A clinician shared</span><EditorialTweet tweet={leadTweet} /></> : lead.kind !== "episode" && <div className="dl-editorial-receipt-note"><span>Why it surfaced</span><strong>{lead.why}</strong></div>}
          </aside>
        </section>}

        {rest.length > 0 && <section className="dl-editorial-more" aria-label="More stories">
          <div className="dl-editorial-section-head"><h2>More stories</h2><span>This week</span></div>
          <div className="dl-editorial-story-grid">
            {rest.map((card) => {
              const visual = studioVisual(card, data, media);
              const abstract = paperAbstract(card, data);
              return <article key={card.id}>
                <div className="dl-editorial-story-summary">
                  <div className="dl-editorial-story-copy">
                    <div className="dl-kicker">{KICKER[card.kind]}</div>
                    <small>{card.sourceLabel}</small>
                    <h3>{card.url && card.kind !== "episode" ? <a href={card.url} target="_blank" rel="noreferrer">{card.headline}</a> : card.headline}</h3>
                    <div className="dl-editorial-story-meta"><span>{card.why}</span></div>
                  </div>
                  {visual && <StudioVisual visual={visual} headline={card.headline} />}
                </div>
                {card.kind === "episode" && <StoryAction card={card} />}
                <div className="dl-editorial-story-actions">
                  {abstract && <AbstractDisclosure text={abstract} compact />}
                  <StorySources card={card} data={data} accent="#b94c31" collapsedLabel="See all sources" editorial />
                </div>
              </article>;
            })}
          </div>
        </section>}

        <div id="editorial-people" className="dl-editorial-people"><PeopleRail data={data} accent="#b94c31" /></div>
        <div className="dl-editorial-columns dl-editorial-media-columns">
          <div id="editorial-listen"><EpisodeRail data={data} limit={3} accent="#b94c31" /></div>
          <div id="editorial-papers"><PaperRail data={data} media={media} limit={5} accent="#b94c31" /></div>
        </div>
        <div id="editorial-trials" className="dl-editorial-trials"><TrialRail data={data} accent="#b94c31" /></div>
      </main>
    </div>
  );
}

function Signal({ data, cards, media }: { data: BriefingData; cards: HeroCard[]; media: Map<string, ArticleMedia> }) {
  return (
    <div className="dl-concept dl-signal">
      <header className="dl-signal-head"><h1>The Readout</h1><div><strong>{data.area}</strong><span>{fmtDate(data.generatedAt)}</span></div></header>
      <main>
        <div className="dl-signal-title"><span>Top stories</span><strong>{cards.length}</strong></div>
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
            <nav className="dl-essential-pager" aria-label="Top stories">
              <span>Top stories</span>
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
  const [studioLight, setStudioLight] = useState(false);
  const [data, setData] = useState<BriefingData | null>(null);
  const [articleMedia, setArticleMedia] = useState<Map<string, ArticleMedia>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setArea(safeArea(query.get("area")));
    setConcept(safeConcept(query.get("concept")));
    setStudioLight(query.get("theme") === "light");
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

  const setStudioTheme = (light: boolean) => {
    const url = new URL(window.location.href);
    setStudioLight(light);
    if (light) url.searchParams.set("theme", "light");
    else url.searchParams.delete("theme");
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
        {data && concept === "studio" && <Studio data={data} cards={cards} media={articleMedia} onAreaChange={(nextArea) => setLabState({ area: nextArea })} lightMode={studioLight} onLightModeChange={setStudioTheme} />}
        {data && concept === "editorial" && <Editorial data={data} cards={cards} media={articleMedia} onAreaChange={(nextArea) => setLabState({ area: nextArea })} />}
        {data && concept === "signal" && <Signal data={data} cards={cards} media={articleMedia} />}
      </div>
    </div>
  );
}
