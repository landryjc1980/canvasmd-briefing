"use client";

import { useState } from "react";
import { BriefingData, BriefingMover, BriefingSharer, BriefingKol, BriefingArticle, BriefingTrial, BriefingPod } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { AREA_META, Avatar, kfmt, ago, clip, weekOf } from "./ui";
import { podConvLabel, podEpisodeCount } from "./briefVM";

const prettyPhase = (p: string | null): string => {
  if (!p) return "";
  const nums = p.split("/").map((x) => x.replace(/[^0-9]/g, "")).filter(Boolean);
  return nums.length ? `Phase ${nums.join("/")}` : p.replace(/_/g, " ").toLowerCase();
};
const prettyStatus = (s: string | null): string =>
  s ? s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";

// The "Brief" rendering — the VISUAL counterpart to the Broadsheet's journal look.
// Same BriefingData, but built around images + color instead of paragraphs: each drug
// is a card with a face-pile of the real oncologists talking about it, a colored
// podcast-vs-X signal bar, a momentum badge, and a bold score. Area-themed accent
// color runs through the whole page. Scoped under .brief (brief.css).

// ---- who covered this drug: X clinician faces + podcast show artwork ---------
// X people fill first; podcast show artwork fills the rest so a podcast-only mover
// still shows real imagery instead of a blank row. Faces only — the counts live on
// the metrics line below the bar (matches the native card).
function FacePile({ m }: { m: BriefingMover }) {
  const people = m.posts.slice(0, 6).map((s) => ({ src: s.avatar, name: s.name, show: false }));
  const art = m.showArt.slice(0, Math.max(0, 6 - people.length)).map((src) => ({ src, name: "", show: true }));
  const faces = [...people, ...art];
  if (faces.length === 0) return null;
  return (
    <div className="bc-faces">
      {faces.map((f, i) => (
        <span className={`bc-face${f.show ? " is-show" : ""}`} key={i} style={{ zIndex: faces.length - i }} title={f.name}>
          <Avatar name={f.name} src={f.src} />
        </span>
      ))}
    </div>
  );
}

// ---- the colored podcast↔X↔paper signal bar (bar only) ----------------------
function SignalBar({ m }: { m: BriefingMover }) {
  const empty = m.podConvs === 0 && m.xSharers === 0 && m.articleCount === 0; // regulatory-only
  return (
    <div className={`bc-bar${empty ? " is-empty" : ""}`}>
      {!empty && (
        <>
          <span className="bc-bar-pod" style={{ width: `${m.podPct}%` }} />
          <span className="bc-bar-x" style={{ width: `${m.xPct}%` }} />
          <span className="bc-bar-art" style={{ width: `${m.articlePct}%` }} />
        </>
      )}
    </div>
  );
}

// ---- one clinician tweet, full text on tap ----------------------------------
function Take({ s }: { s: BriefingSharer }) {
  const [open, setOpen] = useState(false);
  const long = (s.text?.length ?? 0) > 220;
  const body = s.text ? (open || !long ? s.text : s.text.slice(0, 220).trimEnd() + "…") : null;
  return (
    <div className="bk-take">
      <div className="bk-take-top">
        <Avatar name={s.name} src={s.avatar} cls="sm" />
        <span className="bk-take-name">{s.name}{s.handle && <span className="bk-take-h">@{s.handle}</span>}</span>
        {s.likes > 0 && <span className="bk-take-likes">♥ {kfmt(s.likes)}</span>}
      </div>
      {body && (
        <p className="bk-take-text">
          {body}
          {long && <button className="bk-more" onClick={() => setOpen(!open)}>{open ? " less" : " more"}</button>}
        </p>
      )}
      {s.tweetUrl && <a className="bk-take-link" href={s.tweetUrl} target="_blank" rel="noopener noreferrer">On X ↗</a>}
    </div>
  );
}

// The PubMed abstract, clipped with an inline expand (used on papers + reading rows).
function Abstract({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 260;
  const body = open || !long ? text : text.slice(0, 260).trimEnd() + "…";
  return (
    <p className="bk-abstract">
      {body}
      {long && <button className="bk-more" onClick={(e) => { e.preventDefault(); setOpen(!open); }}>{open ? " less" : " more"}</button>}
    </p>
  );
}

// A podcast/tweet gloss that clamps to 3 lines and expands on tap (matches native).
function Gloss({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = (text?.length ?? 0) > 170;
  return (
    <>
      <p className={`bk-gloss${open || !long ? " is-open" : ""}`}>{text}</p>
      {long && <button className="bk-more bk-gloss-more" onClick={() => setOpen(!open)}>{open ? "Show less" : "Show more"}</button>}
    </>
  );
}

// One podcast conversation — show artwork + show/episode title INLINE on the top row,
// then the gloss FULL WIDTH below, then the inline listen-at-the-moment player.
function PodConv({ c }: { c: BriefingPod }) {
  return (
    <div className="bk-conv">
      <div className="bk-conv-head">
        {c.showArt
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="bk-showart" src={c.showArt} alt="" loading="lazy" />
          : <span className="bk-showart bk-showart-ph" aria-hidden>🎙</span>}
        <div className="bk-conv-meta">
          <span className="bk-conv-show">{c.show}</span>
          <span className="bk-conv-ep">{c.episodeTitle ? `${c.episodeTitle} · ` : ""}{ago(c.publishedAt)}</span>
        </div>
      </div>
      <Gloss text={c.gloss} />
      {c.audioUrl && (
        <div className="bk-listen">
          <AudioQuote audioUrl={c.audioUrl} startMs={c.startMs} label={null} />
        </div>
      )}
    </div>
  );
}

function BriefCard({ m, rank }: { m: BriefingMover; rank: number }) {
  const convs = m.podcast.slice(0, 3);
  const rising = m.delta > 0;
  const cardKind = m.signalShape; // both | pods | x | regulatory → colors the accents
  const metrics: string[] = [];
  const conv = podConvLabel(podEpisodeCount(m), m.podcast?.length ?? m.podConvs);
  if (conv) metrics.push(conv);
  if (m.xSharers > 0) metrics.push(`${m.xSharers} on X`);
  if (m.articleCount > 0) metrics.push(`${m.articleCount} paper${m.articleCount === 1 ? "" : "s"}`);
  const quiet = metrics.length === 0; // regulatory-only mover, no chatter yet
  return (
    <details className={`bcard k-${cardKind}`} id={`drug-${m.drugId}`}>
      <summary>
        {/* row 1: rank + name — everything else spans the full card width below */}
        <div className="bc-row1">
          <span className="bc-rank">{String(rank).padStart(2, "0")}</span>
          <div className="bc-head">
            <span className="bc-drug">{m.drug}</span>
            {m.brand && <span className="bc-brand">{m.brand}</span>}
            {m.company && <span className="bc-co">{m.company}</span>}
            {m.delta !== 0 && <span className={`bc-delta ${rising ? "up" : "down"}`}>{rising ? "▲" : "▼"} {Math.abs(m.delta)}</span>}
          </div>
          <div className="bc-score">
            <span className="bc-score-n">{m.score}</span>
            <span className="bc-score-l">signal</span>
          </div>
        </div>
        {m.eventChip && <span className="bc-eventchip">✦ {m.eventChip}</span>}
        {m.why && <p className="bc-why">{m.why}</p>}
        <SignalBar m={m} />
        <div className="bc-metrics">
          {quiet ? "Just approved — no chatter yet" : metrics.join(" · ")}
          {!quiet && m.topLikes > 0 ? ` · ♥ ${kfmt(m.topLikes)}` : ""}
        </div>
        <FacePile m={m} />
        <span className="bc-chev" aria-hidden />
      </summary>
      <div className="bc-open">
        {convs.length > 0 && (
          <div className="bk-said">
            <span className="bk-eyebrow">🎙 On the podcasts ({m.podcast.length})</span>
            {convs.map((c, i) => <PodConv c={c} key={i} />)}
            {m.podcast.length > 3 && <div className="bk-morecount">+{m.podcast.length - 3} more clip{m.podcast.length - 3 === 1 ? "" : "s"} this week</div>}
          </div>
        )}
        {m.posts.length > 0 && (
          <div className="bk-heard">
            <span className="bk-eyebrow">𝕏 On X — {m.posts.length} clinician{m.posts.length === 1 ? "" : "s"}</span>
            {m.posts.map((s, i) => <Take key={i} s={s} />)}
          </div>
        )}
        {m.papers.length > 0 && (
          <div className="bk-papers">
            <span className="bk-eyebrow">📄 Journal papers shared</span>
            {m.papers.map((p, i) => (
              <div className="bk-paper" key={i}>
                <a className="bk-paper-title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title} ↗</a>
                <span className="bk-paper-meta">{p.journal ? `${p.journal} · ` : ""}{p.sharers.length} shared{p.topLikes > 0 ? ` · ♥ ${kfmt(p.topLikes)}` : ""}</span>
                <Abstract text={p.abstract} />
              </div>
            ))}
          </div>
        )}
        {convs.length === 0 && m.posts.length === 0 && m.papers.length === 0 && <div className="bk-empty">A regulatory move — no chatter yet.</div>}
      </div>
    </details>
  );
}

// ---- a section shell with a heading + show-all toggle ----------------------
function Section<T>({ title, icon, items, initial, render, note }: {
  title: string; icon: string; items: T[]; initial: number; render: (it: T, i: number) => React.ReactNode; note?: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const shown = open ? items : items.slice(0, initial);
  return (
    <section className="b-sec">
      <div className="b-sec-head">
        <span className="b-sec-ic">{icon}</span>
        <h2 className="b-sec-title">{title}</h2>
        <span className="b-sec-count">{items.length}</span>
      </div>
      {note && <div className="b-sec-note">{note}</div>}
      <div className="b-sec-body">{shown.map(render)}</div>
      {items.length > initial && (
        <button className="b-sec-more" onClick={() => setOpen(!open)}>
          {open ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}

function KolRow({ k }: { k: BriefingKol }) {
  return (
    <details className="kol">
      <summary>
        <Avatar name={k.name} src={k.avatar} cls="lg" />
        <div className="kol-body">
          <div className="kol-name">{k.name}{k.handle && <span className="kol-h">@{k.handle}</span>}</div>
          <div className="kol-drugs">{k.drugs.map((d, i) => <span className="kol-chip" key={i}>{d}</span>)}</div>
        </div>
        <div className="kol-stat">
          <b>{k.tweets}</b> post{k.tweets === 1 ? "" : "s"}<span className="kol-dot" /><b>{k.drugs.length}</b> drug{k.drugs.length === 1 ? "" : "s"}
          {k.peakLikes > 0 && <><span className="kol-dot" />♥ {kfmt(k.peakLikes)}</>}
        </div>
        <span className="kol-caret" aria-hidden>›</span>
      </summary>
      <div className="kol-open">
        {k.posts.map((s, i) => <Take key={i} s={s} />)}
        {k.articles.length > 0 && (
          <div className="kol-arts">
            <span className="bk-eyebrow">📄 Articles they shared</span>
            {k.articles.map((a, i) => (
              <a className="kol-art" key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                <span className="kol-art-title">{a.title}</span>
                {a.journal && <span className="kol-art-journal">{a.journal}</span>}
              </a>
            ))}
          </div>
        )}
        {k.handle && <a className="kol-profile" href={`https://x.com/${k.handle}`} target="_blank" rel="noopener noreferrer">See @{k.handle} on X ↗</a>}
      </div>
    </details>
  );
}

function ArticleRow({ a }: { a: BriefingArticle }) {
  const hasPosts = (a.posts?.length ?? 0) > 0;
  return (
    <div className="art">
      <div className="art-top">
        <div className="art-main">
          <a className="art-title" href={a.url} target="_blank" rel="noopener noreferrer">{a.title} ↗</a>
          {(a.journal || a.domain) && <div className="art-src">{a.journal || a.domain}</div>}
        </div>
        <div className="art-side">
          {a.faces.length > 0 && <div className="art-faces">{a.faces.map((f, i) => <Avatar key={i} name="" src={f} cls="sm" />)}</div>}
          <span className="art-count"><b>{a.sharers}</b> shared{a.topLikes > 0 ? ` · ♥ ${kfmt(a.topLikes)}` : ""}</span>
        </div>
      </div>
      <Abstract text={a.abstract} />
      {hasPosts && (
        <details className="art-posts">
          <summary className="art-see">
            See what {a.posts.length === 1 ? "the clinician" : `${a.posts.length} clinicians`} said
            <span className="art-see-caret" aria-hidden>›</span>
          </summary>
          <div className="art-takes">
            {a.posts.map((s, i) => <Take key={i} s={s} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function Recap({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 240;
  const body = open || !long ? text : text.slice(0, 240).trimEnd() + "…";
  return (
    <p className="b-recap">
      {body}
      {long && <button className="b-recap-more" onClick={() => setOpen(!open)}>{open ? " Show less" : " Show more"}</button>}
    </p>
  );
}

function TrialRow({ t }: { t: BriefingTrial }) {
  const drugs = t.interventions
    .filter((d) => !/placebo|surgery|observation|best supportive|dissection|cystectomy|nephrectomy|radiation|radiotherapy|resection/i.test(d))
    .slice(0, 4);
  const parts: string[] = [];
  if (t.podMentions) parts.push(`${t.podMentions} podcast${t.podMentions === 1 ? "" : "s"}`);
  if (t.xMentions) parts.push(`${t.xMentions} tweet${t.xMentions === 1 ? "" : "s"}`);
  if (t.articleMentions) parts.push(`${t.articleMentions} paper${t.articleMentions === 1 ? "" : "s"}`);
  return (
    <details className="trial">
      <summary>
        <span className={`trial-phase${t.resultsFresh ? " is-fresh" : ""}`}>{prettyPhase(t.phase) || "Trial"}</span>
        <div className="trial-body">
          <div className="trial-title">{t.acronym && <span className="trial-acr">{t.acronym}</span>}{clip(t.title, 84)}</div>
          {drugs.length > 0 && <div className="trial-drugs">{drugs.map((d, i) => <span className="trial-drug" key={i}>{d}</span>)}</div>}
          <div className="trial-meta">
            <span className="trial-mentions">discussed in {parts.join(" · ")}</span>
            {t.resultsFresh && <span className="trial-fresh"> · ✦ results out</span>}
          </div>
        </div>
        <span className="trial-caret" aria-hidden>›</span>
      </summary>
      <div className="trial-open">
        {t.pods.length > 0 && (
          <div className="bk-said">
            <span className="bk-eyebrow">🎙 On the podcasts</span>
            {t.pods.map((c, i) => <PodConv c={c} key={i} />)}
          </div>
        )}
        {t.posts.length > 0 && (
          <div className="bk-heard">
            <span className="bk-eyebrow">𝕏 On X</span>
            {t.posts.map((s, i) => <Take key={i} s={s} />)}
          </div>
        )}
        {t.articles.length > 0 && (
          <div className="bk-papers">
            <span className="bk-eyebrow">📄 In the papers</span>
            {t.articles.map((p, i) => (
              <div className="bk-paper" key={i}>
                <a className="bk-paper-title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title} ↗</a>
                {p.journal && <span className="bk-paper-meta">{p.journal}</span>}
                <Abstract text={p.abstract} />
              </div>
            ))}
          </div>
        )}
        <a className="trial-ctgov" href={t.url} target="_blank" rel="noopener noreferrer">View on ClinicalTrials.gov ↗</a>
      </div>
    </details>
  );
}

export default function BriefView({ data, area }: { data: BriefingData; area: string }) {
  const meta = AREA_META[area] ?? AREA_META.GU;
  const reg = data.events.filter((e) => !e.ahead && e.type === "drug_approval"); // trial readouts live in the Trials section now
  const ahead = data.events.filter((e) => e.ahead);
  const moverIds = new Set(data.movers.map((m) => m.drugId)); // only these have a rendered anchor to jump to
  const jumpToDrug = (drugId: string | null) => {
    if (!drugId) return;
    const el = document.getElementById(`drug-${drugId}`) as HTMLDetailsElement | null;
    if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
  const podTotal = data.movers.reduce((n, m) => n + podEpisodeCount(m), 0);
  const xTotal = data.movers.reduce((n, m) => n + m.xSharers, 0);
  return (
    <div className={`brief area-${area}`}>
      <div className="briefwrap">
        <header className="b-hero">
          <div className="b-eyebrow">The Brief · {meta.short} · Week of {weekOf(data.generatedAt)}</div>
          <h1 className="b-title">{meta.title}</h1>
          {data.recap && <Recap text={data.recap} />}
          <div className="b-stats">
            <span className="b-stat"><b>{data.movers.length}</b> drugs moving</span>
            <span className="b-stat"><b>{reg.length}</b> regulatory event{reg.length === 1 ? "" : "s"}</span>
            <span className="b-stat"><b>{xTotal}</b> clinician posts</span>
            <span className="b-stat"><b>{podTotal}</b> podcast talks</span>
          </div>
        </header>

        {reg.length > 0 && (
          <div className="b-reg">
            {reg.slice(0, 4).map((e, i) => {
              const canJump = !!(e.drugId && moverIds.has(e.drugId)); // only jump when the card is actually rendered
              const body = (
                <>
                  <span className="b-reg-ic">✔</span>
                  <b>{e.drug ?? e.title}</b>
                  <span className="b-reg-what">approved</span>
                  <span className="b-reg-when">{e.occurredOn ? ago(e.occurredOn) : ""}</span>
                  {canJump && <span className="b-reg-go" aria-hidden>›</span>}
                </>
              );
              return canJump
                ? <button className="b-reg-pill is-link" key={i} onClick={() => jumpToDrug(e.drugId)} title={`Jump to ${e.drug ?? "the drug"}`}>{body}</button>
                : <span className="b-reg-pill" key={i}>{body}</span>;
            })}
            {ahead.length > 0 && <span className="b-reg-ahead">Ahead · {ahead.map((e) => e.title).join(" · ")}</span>}
          </div>
        )}

        <div className="b-secbar">The drugs moving in {meta.short}</div>
        <div className="b-cards">
          {data.movers.length === 0 ? (
            <div className="b-empty">Nothing moved in {meta.short} this week yet.</div>
          ) : (
            data.movers.map((m, i) => <BriefCard key={m.drugId} m={m} rank={i + 1} />)
          )}
        </div>

        <Section title="Most active on X" icon="𝕏" items={data.topKols} initial={5}
          render={(k, i) => <KolRow key={i} k={k as BriefingKol} />} />

        <Section title="What the field is reading" icon="📄" items={data.topArticles} initial={5}
          render={(a, i) => <ArticleRow key={i} a={a as BriefingArticle} />} />

        <Section title="Trials being discussed" icon="🧪" items={data.trials} initial={4}
          note="Trials the field talked about this week — matched across podcasts, tweets and papers; ranked by mentions."
          render={(t, i) => <TrialRow key={i} t={t as BriefingTrial} />} />

        <div className="b-foot">Distilled from podcasts, verified-clinician X, journals, FDA and ClinicalTrials.gov — every figure links to a real source.</div>
      </div>
    </div>
  );
}
