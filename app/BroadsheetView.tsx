"use client";

import { useState } from "react";
import { BriefingData, BriefingMover, BriefingEvent, BriefingSharer, BriefingKol, BriefingArticle, BriefingTrial } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { AREA_META, SHAPE, Avatar, Chevron, kfmt, ago, clip, weekOf } from "./ui";

const prettyPhase = (p: string | null): string => {
  if (!p) return "";
  const nums = p.split("/").map((x) => x.replace(/[^0-9]/g, "")).filter(Boolean);
  return nums.length ? `Phase ${nums.join("/")}` : p.replace(/_/g, " ").toLowerCase();
};

// The "Broadsheet" rendering — the serif/petrol clinical-journal look. One editorial
// page per tumor area: a regulatory rail up top, then a ranked spine of moving drugs,
// each expanding to a two-column receipts drawer (what KOLs SAID on X + on podcasts).

// ---- regulatory rail: "what actually happened" -----------------------------
function EventRail({ events, area }: { events: BriefingEvent[]; area: string }) {
  const past = events.filter((e) => !e.ahead);
  const ahead = events.filter((e) => e.ahead);
  if (!past.length && !ahead.length) {
    return <div className="rail rail-empty">No regulatory events in {area} this week.</div>;
  }
  const icon = (t: string) => (t === "drug_approval" ? "✔" : t === "trial_results_posted" ? "◆" : t === "trial_status_change" ? "▲" : "◇");
  return (
    <div className="rail">
      <div className="rail-label">What happened</div>
      {past.map((e, i) => (
        <div className="rail-row" key={i}>
          <span className="rail-ic">{icon(e.type)}</span>
          <span className="rail-drug">{e.drug ?? e.title}</span>
          {e.company && <span className="rail-co">{e.company}</span>}
          <span className="rail-title">{e.drug ? e.title.replace(/^FDA (label expansion|approval): [^(]+/i, "").replace(/^[:\s]+/, "") || e.title : ""}</span>
          <span className="rail-when">{e.occurredOn ? ago(e.occurredOn) : ""}</span>
        </div>
      ))}
      {ahead.length > 0 && (
        <div className="rail-ahead">Coming up: {ahead.map((e) => e.title).join(" · ")}</div>
      )}
    </div>
  );
}

// One KOL tweet — the actual take, with expandable full text (no truncation loss).
function XTake({ s }: { s: BriefingSharer }) {
  const [open, setOpen] = useState(false);
  const long = (s.text?.length ?? 0) > 240;
  const body = s.text ? (open || !long ? s.text : s.text.slice(0, 240).trimEnd() + "…") : null;
  return (
    <div className="dtweet">
      <div className="dtweet-top">
        <Avatar name={s.name} src={s.avatar} cls="sm" />
        <span className="sh-name"><b>{s.name}</b>{s.handle && <span className="sh-h">@{s.handle}</span>}</span>
        <span className="sh-likes">♥ {kfmt(s.likes)}</span>
      </div>
      {body && (
        <p className="dtweet-text">
          {body}
          {long && <button className="dtweet-more" onClick={() => setOpen(!open)}>{open ? " less" : " more"}</button>}
        </p>
      )}
      {s.tweetUrl && <a className="dtweet-link" href={s.tweetUrl} target="_blank" rel="noopener noreferrer">View on X ↗</a>}
    </div>
  );
}

function MoverDrawer({ m }: { m: BriefingMover }) {
  return (
    <div className="drawer">
      <div className="dcol">
        <div className="dcol-head">On the podcasts — what was said</div>
        {m.podcast.length === 0 ? (
          <div className="dempty">No podcast discussion in the window.</div>
        ) : (
          m.podcast.map((c, i) => (
            <div className="dconv" key={i}>
              <p className="dconv-gloss">{c.gloss}</p>
              <div className="dconv-meta">
                <b>{c.show}</b>{c.episodeTitle ? ` · ${clip(c.episodeTitle, 60)}` : ""} · {ago(c.publishedAt)}
                {c.mentionCount > 1 && <span className="dconv-n">{c.mentionCount} mentions</span>}
              </div>
              {c.audioUrl && <AudioQuote audioUrl={c.audioUrl} startMs={c.startMs} label={null} />}
            </div>
          ))
        )}
      </div>
      <div className="dcol">
        <div className="dcol-head">On X — what clinicians said</div>
        {m.posts.length === 0 && m.papers.length === 0 ? (
          <div className="dempty">No clinician posts on X this week.</div>
        ) : (
          <>
            {m.posts.map((s, i) => <XTake key={i} s={s} />)}
            {m.papers.length > 0 && (
              <div className="dpapers">
                <div className="dpapers-head">Journal papers they shared</div>
                {m.papers.map((p, i) => (
                  <div className="dpaper" key={i}>
                    <a className="dpaper-title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title} ↗</a>
                    {p.journal && <span className="dpaper-journal">{p.journal}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// One mover row: collapsed = the 10-sec read, expanded = the receipts.
function Mover({ m, rank }: { m: BriefingMover; rank: number }) {
  const shape = SHAPE[m.signalShape] ?? SHAPE.both;
  return (
    <details className="mover" open={rank === 1}>
      <summary>
        <div className="m-rank">{String(rank).padStart(2, "0")}</div>
        <div className="m-main">
          <div className="m-head">
            <span className="m-drug">{m.drug}</span>
            {m.brand && <span className="m-brand">{m.brand}</span>}
            {m.company && <span className="m-co">· {m.company}</span>}
            <span className={`m-shape ${shape.cls}`}>{shape.label}</span>
            {m.delta !== 0 && <span className={`m-delta ${m.delta > 0 ? "up" : "down"}`} title="podcast discussion vs the prior 2 weeks">{m.delta > 0 ? "▲" : "▼"} {Math.abs(m.delta)}</span>}
          </div>
          {m.why && <p className="m-why">{clip(m.why)}</p>}
          <div className="m-signal">
            <div className="bar" title={`${m.podPct}% podcasts · ${m.xPct}% X · ${m.articlePct}% papers`}>
              <span className="bar-pod" style={{ width: `${m.podPct}%` }} />
              <span className="bar-x" style={{ width: `${m.xPct}%` }} />
              <span className="bar-art" style={{ width: `${m.articlePct}%` }} />
            </div>
            <span className="m-metrics">
              {m.podConvs > 0 && <><b>{m.podConvs}</b> podcast{m.podConvs === 1 ? "" : "s"}</>}
              {m.xSharers > 0 && <>{m.podConvs > 0 ? " · " : ""}<b>{m.xSharers}</b> on X</>}
              {m.articleCount > 0 && <>{m.podConvs > 0 || m.xSharers > 0 ? " · " : ""}<b>{m.articleCount}</b> paper{m.articleCount === 1 ? "" : "s"}</>}
              {m.topLikes > 0 && <> · ♥ {kfmt(m.topLikes)}</>}
              {m.eventChip && <span className="m-eventchip">{m.eventChip}</span>}
            </span>
            <div className="m-faces">
              {m.avatars.map((a, i) => <Avatar key={i} name="" src={a} cls="sm" />)}
              {m.shows.length > 0 && <span className="m-shows">{m.shows.join(" · ")}</span>}
            </div>
          </div>
        </div>
        <div className="m-score">{m.score}<span>signal</span></div>
        <span className="m-open">receipts <Chevron /></span>
      </summary>
      <MoverDrawer m={m} />
    </details>
  );
}

// Expandable abstract, broadsheet-styled.
function Abstract({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 260;
  const body = open || !long ? text : text.slice(0, 260).trimEnd() + "…";
  return (
    <p className="bs-abstract">
      {body}
      {long && <button className="bs-more" onClick={(e) => { e.preventDefault(); setOpen(!open); }}>{open ? " less" : " more"}</button>}
    </p>
  );
}

// A collapsible broadsheet section with a show-all toggle (mirrors the Brief's
// section list, styled as journal columns).
function Section<T>({ title, note, items, initial, render }: {
  title: string; note: string; items: T[]; initial: number; render: (it: T, i: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const shown = open ? items : items.slice(0, initial);
  return (
    <section>
      <div className="sec-head">
        <h2>{title}</h2>
        <div className="rule" />
        <span className="count">{note}</span>
      </div>
      {shown.map(render)}
      {items.length > initial && (
        <button className="bs-secmore" onClick={() => setOpen(!open)}>{open ? "Show less" : `Show all ${items.length}`}</button>
      )}
    </section>
  );
}

// "The voices" — most active clinicians on X this week.
function VoiceRow({ k }: { k: BriefingKol }) {
  return (
    <details className="bvoice">
      <summary>
        <Avatar name={k.name} src={k.avatar} cls="sm" />
        <div className="bvoice-main">
          <div className="bvoice-name">{k.name}{k.handle && <span className="bvoice-h">@{k.handle}</span>}</div>
          <div className="bvoice-drugs">{k.drugs.map((d, i) => <span className="bvoice-chip" key={i}>{d}</span>)}</div>
        </div>
        <div className="bvoice-stat">
          <b>{k.tweets}</b> post{k.tweets === 1 ? "" : "s"} · <b>{k.drugs.length}</b> drug{k.drugs.length === 1 ? "" : "s"}
          {k.peakLikes > 0 && <> · ♥ {kfmt(k.peakLikes)}</>}
        </div>
        <span className="m-open"><Chevron /></span>
      </summary>
      <div className="bvoice-open">
        {k.posts.map((s, i) => <XTake key={i} s={s} />)}
        {k.articles.length > 0 && (
          <div className="dpapers">
            <div className="dpapers-head">Papers they shared</div>
            {k.articles.map((a, i) => (
              <div className="dpaper" key={i}>
                <a className="dpaper-title" href={a.url} target="_blank" rel="noopener noreferrer">{a.title} ↗</a>
                {a.journal && <span className="dpaper-journal">{a.journal}</span>}
              </div>
            ))}
          </div>
        )}
        {k.handle && <a className="dtweet-link" href={`https://x.com/${k.handle}`} target="_blank" rel="noopener noreferrer">See @{k.handle} on X ↗</a>}
      </div>
    </details>
  );
}

// "What the field is reading" — top papers clinicians shared.
function ReadingRow({ a }: { a: BriefingArticle }) {
  const hasPosts = (a.posts?.length ?? 0) > 0;
  return (
    <div className="bread">
      <div className="bread-top">
        <div className="bread-main">
          <a className="bread-title" href={a.url} target="_blank" rel="noopener noreferrer">{a.title} ↗</a>
          {(a.journal || a.domain) && <div className="bread-src">{a.journal || a.domain}</div>}
        </div>
        <div className="bread-side">
          {a.faces.length > 0 && <div className="bread-faces">{a.faces.map((f, i) => <Avatar key={i} name="" src={f} cls="sm" />)}</div>}
          <span className="bread-count"><b>{a.sharers}</b> shared{a.topLikes > 0 ? ` · ♥ ${kfmt(a.topLikes)}` : ""}</span>
        </div>
      </div>
      <Abstract text={a.abstract} />
      {hasPosts && (
        <details className="bread-posts">
          <summary className="bread-see">See what {a.posts.length === 1 ? "the clinician" : `${a.posts.length} clinicians`} said<Chevron /></summary>
          <div className="bread-takes">{a.posts.map((s, i) => <XTake key={i} s={s} />)}</div>
        </details>
      )}
    </div>
  );
}

// "Trials in discussion" — mention-ranked, expanding to the receipts.
function TrialRow({ t }: { t: BriefingTrial }) {
  const drugs = t.interventions
    .filter((d) => !/placebo|surgery|observation|best supportive|dissection|cystectomy|nephrectomy|radiation|radiotherapy|resection/i.test(d))
    .slice(0, 4);
  const parts: string[] = [];
  if (t.podMentions) parts.push(`${t.podMentions} podcast${t.podMentions === 1 ? "" : "s"}`);
  if (t.xMentions) parts.push(`${t.xMentions} tweet${t.xMentions === 1 ? "" : "s"}`);
  if (t.articleMentions) parts.push(`${t.articleMentions} paper${t.articleMentions === 1 ? "" : "s"}`);
  return (
    <details className="btrial">
      <summary>
        <span className={`btrial-phase${t.resultsFresh ? " is-fresh" : ""}`}>{prettyPhase(t.phase) || "Trial"}</span>
        <div className="btrial-body">
          <div className="btrial-title">{t.acronym && <span className="btrial-acr">{t.acronym}</span>}{clip(t.title, 84)}</div>
          {drugs.length > 0 && <div className="btrial-drugs">{drugs.map((d, i) => <span className="btrial-drug" key={i}>{d}</span>)}</div>}
          <div className="btrial-meta">discussed in {parts.join(" · ")}{t.resultsFresh && <span className="btrial-fresh"> · ✦ results out</span>}</div>
        </div>
        <span className="m-open"><Chevron /></span>
      </summary>
      <div className="drawer">
        {t.pods.length > 0 && (
          <div className="dcol">
            <div className="dcol-head">On the podcasts</div>
            {t.pods.map((c, i) => (
              <div className="dconv" key={i}>
                <p className="dconv-gloss">{c.gloss}</p>
                <div className="dconv-meta"><b>{c.show}</b> · {ago(c.publishedAt)}</div>
                {c.audioUrl && <AudioQuote audioUrl={c.audioUrl} startMs={c.startMs} label={null} />}
              </div>
            ))}
          </div>
        )}
        {(t.posts.length > 0 || t.articles.length > 0) && (
          <div className="dcol">
            {t.posts.length > 0 && <div className="dcol-head">On X</div>}
            {t.posts.map((s, i) => <XTake key={i} s={s} />)}
            {t.articles.length > 0 && (
              <div className="dpapers">
                <div className="dpapers-head">In the papers</div>
                {t.articles.map((p, i) => (
                  <div className="dpaper" key={i}>
                    <a className="dpaper-title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title} ↗</a>
                    {p.journal && <span className="dpaper-journal">{p.journal}</span>}
                    <Abstract text={p.abstract} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <a className="dtweet-link btrial-ctgov" href={t.url} target="_blank" rel="noopener noreferrer">View on ClinicalTrials.gov ↗</a>
      </div>
    </details>
  );
}

export default function BroadsheetView({ data, area }: { data: BriefingData; area: string }) {
  const meta = AREA_META[area] ?? AREA_META.GU;
  const podTotal = data.movers.reduce((n, m) => n + m.podConvs, 0);
  const xTotal = data.movers.reduce((n, m) => n + m.xSharers, 0);
  return (
    <div className="wb">
      <div className="wbwrap">
        <header>
          <div className="mast-top">
            <div className="brand"><b>CanvasMD</b> · Clinical Intelligence</div>
            <div className="issue">{area.toUpperCase()} EDITION{` · ${data.windowDays}-DAY WINDOW`}</div>
          </div>
          <h1>{meta.title}<span className="subhead">{meta.strap}</span></h1>
          <div className="dateline">
            <span>Week of <b>{weekOf(data.generatedAt)}</b></span>
            <span className="dot" />
            <span><b className="mono">{data.movers.length}</b> drugs moving</span>
            <span className="dot" />
            <span><b className="mono">{podTotal}</b> podcast conversations</span>
            <span className="dot" />
            <span><b className="mono">{xTotal}</b> clinician posts on X</span>
          </div>
          <div className="hint">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
            Each drug fuses podcast discussion + X posting — click any row for the receipts (what was said + the papers).
          </div>
        </header>

        <EventRail events={data.events} area={data.area} />

        <section>
          <div className="sec-head">
            <h2>The week&rsquo;s movers</h2>
            <div className="rule" />
            <span className="count">podcasts + X · fused signal</span>
          </div>
          {data.movers.length === 0 ? (
            <div className="empty">Nothing moving in {data.area} this week yet.</div>
          ) : (
            data.movers.map((m, i) => <Mover key={m.drugId} m={m} rank={i + 1} />)
          )}
        </section>

        <Section title="The voices" note="most active clinicians on X" items={data.topKols} initial={5}
          render={(k, i) => <VoiceRow key={i} k={k} />} />

        <Section title="What the field is reading" note="papers clinicians shared" items={data.topArticles} initial={5}
          render={(a, i) => <ReadingRow key={i} a={a} />} />

        <Section title="Trials in discussion" note="matched across podcasts, X &amp; papers" items={data.trials} initial={4}
          render={(t, i) => <TrialRow key={i} t={t} />} />

        {data.recap && (
          <div className="recap">
            <span className="recap-eyebrow">The week, in a sentence</span>
            <p>{data.recap}</p>
          </div>
        )}

        <footer>
          <span>Generated from the <b>CanvasMD</b> intelligence graph — podcasts · verified-clinician X · journals · FDA</span>
        </footer>
      </div>
    </div>
  );
}
