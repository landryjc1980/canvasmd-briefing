"use client";

import { useState } from "react";
import { BriefingData, BriefingMover, BriefingSharer, BriefingPod, BriefingPaper } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { palOf, barSegments, metricsLine, clipTs, heroStats, AREA_FULL, UP, DOWN } from "./briefVM";
import RecapBlock from "./RecapBlock";

// "The Reader" — the desktop Weekly Brief: a single centered 690px editorial column
// on the area's solid dark accent-bg. No dashboard panels; evidence expands inline
// as an accordion under whatever you click. Fed by the real BriefingData.

const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};

const prettyPhase = (p: string | null): string => {
  if (!p) return "Trial";
  const nums = p.split("/").map((x) => x.replace(/[^0-9]/g, "")).filter(Boolean);
  return nums.length ? `Phase ${nums.join("/")}` : p.replace(/_/g, " ");
};
const ini = (s: string) =>
  (s || "?").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";

function Delta({ delta }: { delta: number }) {
  if (!delta) return null;
  const up = delta > 0, c = up ? UP : DOWN;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.fg, font: "700 11px system-ui", padding: "3px 9px", borderRadius: 20 }}>{(up ? "▲ " : "▼ ") + Math.abs(delta)}</span>;
}

function Bar({ m, accent }: { m: BriefingMover; accent: string }) {
  return (
    <div style={{ width: 132, height: 4, borderRadius: 3, display: "flex", gap: 2, overflow: "hidden" }}>
      {barSegments(m).map((s, i) => <div key={i} style={{ flex: s.flex, background: accent, opacity: s.opacity, borderRadius: 3 }} />)}
    </div>
  );
}

const cardBox: React.CSSProperties = { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 13, padding: 14, marginBottom: 9 };
const evLabel = (accent: string): React.CSSProperties => ({ font: "600 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 11 });

function PodCard({ p, accent }: { p: BriefingPod; accent: string }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "700 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{p.showArt ? <img src={p.showArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(p.show)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13.5px system-ui", color: "#eef1f8" }}>{p.show}</div>
          <div style={{ font: "400 11px system-ui", color: "#7c7f88", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.episodeTitle}</div>
        </div>
      </div>
      <p style={{ margin: "11px 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2" }}>{p.gloss}</p>
      {p.audioUrl
        ? <AudioQuote audioUrl={p.audioUrl} startMs={p.startMs} label={`clip ${clipTs(p.startMs)}`} accent={accent} tone="dark" />
        : <div style={{ font: "600 11px system-ui", color: accent }}>clip {clipTs(p.startMs)}</div>}
    </div>
  );
}
function TweetCard({ t }: { t: BriefingSharer }) {
  const body = (<>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.12)", color: "#f4f7ff", font: "600 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>
          {t.avatar ? <img src={t.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(t.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}><span style={{ font: "600 13px system-ui", color: "#eef1f8" }}>{t.name}</span> {t.handle && <span style={{ font: "400 11.5px system-ui", color: "#7c7f88" }}>@{t.handle}</span>}</div>
        {t.likes > 0 && <span style={{ font: "600 11px system-ui", color: "#e08aa0" }}>♥ {t.likes}</span>}
      </div>
      {t.text && <p style={{ margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#cbcdd5" }}>{t.text}</p>}
    </>);
  return t.tweetUrl
    ? <a href={t.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ ...cardBox, display: "block", textDecoration: "none" }}>{body}</a>
    : <div style={cardBox}>{body}</div>;
}
// Expands INLINE to the abstract + the clinicians' tweets about the paper (parity with
// the mobile story), so readers stay on the page. The ↗ still opens the source.
function PaperCard({ title, journal, meta, url, abstract, posts, accent }: { title: string; journal: string | null; meta?: string; url?: string; abstract?: string | null; posts?: BriefingSharer[]; accent?: string }) {
  const [open, setOpen] = useState(false);
  const hasAbs = !!(abstract && abstract.trim());
  const hasPosts = !!(posts && posts.length);
  const canExpand = hasAbs || hasPosts;
  const toggleLabel = open ? "Hide" : hasAbs ? (hasPosts ? "Abstract + posts" : "Read abstract") : "See posts";
  return (
    <div style={cardBox}>
      <div style={{ font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "#eef1f8" }}>{title}</div>
      {(journal || meta) && <div style={{ font: "400 12px system-ui", color: "#7c7f88", marginTop: 7 }}>{[journal, meta].filter(Boolean).join(" · ")}</div>}
      {open && hasAbs && <p style={{ margin: "11px 0 0", font: "400 13.5px/1.55 'Newsreader',Georgia,serif", color: "#c3c6d0" }}>{abstract}</p>}
      {open && hasPosts && <div style={{ marginTop: 12 }}>
        <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent ?? "#9aa0ac", marginBottom: 9 }}>What clinicians said · {posts!.length}</div>
        {posts!.map((t, i) => <div key={i} style={{ marginTop: i ? 8 : 0 }}><TweetCard t={t} /></div>)}
      </div>}
      <div style={{ display: "flex", gap: 16, marginTop: 11 }}>
        {canExpand && <button onClick={() => setOpen((o) => !o)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "600 12px system-ui", color: accent ?? "#9aa0ac" }}>{toggleLabel}</button>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ font: "600 12px system-ui", color: "rgba(255,255,255,.55)", textDecoration: "none" }}>Open ↗</a>}
      </div>
    </div>
  );
}

function Row({ open, onToggle, accent, head, children }: { open: boolean; onToggle: () => void; accent: string; head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,.09)" }}>
      <div onClick={onToggle} style={{ cursor: "pointer" }}>{head}</div>
      {open && <div style={{ margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>}
    </div>
  );
}

export default function ReaderView({ data, area, areas, onArea }: { data: BriefingData; area: string; areas: string[]; onArea: (a: string) => void }) {
  const pal = palOf(area);
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const stats = heroStats(data);
  const tog = (id: string) => (openId === id ? "Hide ↑" : "Evidence ↓");

  return (
    <div style={{ minHeight: "100vh", background: pal.bg, color: "#eef1f8", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", transition: "background .45s ease" }}>
      <div style={{ maxWidth: 690, margin: "0 auto", padding: "52px 30px 120px" }}>
        {/* masthead — ReadoutMD wordmark (matches the mobile header) */}
        <div style={{ textAlign: "center", paddingBottom: 15, borderBottom: "1px solid rgba(255,255,255,.14)" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
            <svg width="30" height="30" viewBox="0 0 25 25" style={{ flex: "none" }}>
              <rect width="25" height="25" rx="7.5" fill={pal.accent} />
              <path d="M4.5 12.5 h3.2 l2 -5 l3 10 l2 -5 h5.3" stroke={pal.bg} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ font: "700 22px system-ui", color: "#fff", letterSpacing: "-.01em" }}>Readout<span style={{ color: pal.accent, fontWeight: 600 }}>MD</span></div>
          </div>
          <div style={{ font: "500 10.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: "#6f727c", marginTop: 12 }}>The Weekly Brief · Updated {ago(data.generatedAt)}</div>
        </div>
        {/* area links */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px 26px", marginTop: 20, paddingBottom: 26, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          {areas.map((a) => {
            const on = a === area;
            return <span key={a} onClick={() => onArea(a)} style={{ cursor: "pointer", font: "600 13px system-ui", letterSpacing: ".02em", paddingBottom: 4, color: on ? "#f4f7ff" : "#71747f", borderBottom: `2px solid ${on ? pal.accent : "transparent"}` }}>{a}</span>;
          })}
        </div>
        {/* hero */}
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <div style={{ font: "600 11px system-ui", letterSpacing: ".2em", textTransform: "uppercase", color: pal.accent }}>This week in {AREA_FULL[area] ?? area}</div>
          {data.headline && <h1 style={{ font: "400 38px/1.15 'Newsreader',Georgia,serif", color: "#f8f9fc", margin: "14px auto 0", maxWidth: 600, letterSpacing: "-.01em" }}>{data.headline}</h1>}
          <RecapBlock text={data.recap} accent={pal.accent} size={19} lines={3} centered />
          <div style={{ display: "flex", justifyContent: "center", gap: 26, marginTop: 26 }}>
            <div><span style={{ font: "600 18px system-ui", color: "#f4f7ff" }}>{stats.moverCount}</span> <span style={{ font: "400 13px system-ui", color: "#7c7f88" }}>movers</span></div>
            <div style={{ width: 1, background: "rgba(255,255,255,.12)" }} />
            <div><span style={{ font: "600 18px system-ui", color: "#f4f7ff" }}>{stats.postCount}</span> <span style={{ font: "400 13px system-ui", color: "#7c7f88" }}>KOL posts</span></div>
            <div style={{ width: 1, background: "rgba(255,255,255,.12)" }} />
            <div><span style={{ font: "600 18px system-ui", color: "#f4f7ff" }}>{stats.talkCount}</span> <span style={{ font: "400 13px system-ui", color: "#7c7f88" }}>podcast talks</span></div>
          </div>
        </div>

        {/* movers */}
        <SectionHead>This week&rsquo;s movers</SectionHead>
        {data.movers.map((m, i) => {
          const id = "m:" + m.drugId;
          return (
            <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
              head={
                <div style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: "22px 2px" }}>
                  <div style={{ font: "500 30px/1 'Newsreader',Georgia,serif", color: i === 0 ? pal.accent : "#5f626c", width: 30, flex: "none" }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ font: "500 22px/1.1 'Newsreader',Georgia,serif", color: "#f8f9fc" }}>{m.drug}</span>
                      <span style={{ font: "500 12px system-ui", letterSpacing: ".02em", color: "#7c7f88" }}>{[m.brand, m.company].filter(Boolean).join(" · ")}</span>
                    </div>
                    {m.why && <p style={{ margin: "10px 0 0", font: "400 17px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2" }}>{m.why}</p>}
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
                      <Bar m={m} accent={pal.accent} />
                      <span style={{ font: "400 12px system-ui", color: "#7c7f88" }}>{metricsLine(m)}</span>
                      <span style={{ marginLeft: "auto", font: "600 11.5px system-ui", color: pal.accent, whiteSpace: "nowrap" }}>{tog(id)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div style={{ font: "500 34px/1 'Newsreader',Georgia,serif", color: pal.accent, letterSpacing: "-.01em" }}>{m.score}</div>
                    <div style={{ marginTop: 6 }}><Delta delta={m.delta} /></div>
                  </div>
                </div>
              }>
              <div style={{ marginLeft: 50 }}>
                {m.podcast.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{m.podcast.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
                {m.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{m.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                {m.papers.length > 0 && <div><div style={evLabel(pal.accent)}>Papers shared</div>{m.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} meta={`shared by ${p.sharers.length} · ♥ ${p.topLikes}`} url={p.url} abstract={p.abstract} posts={p.sharers} accent={pal.accent} />)}</div>}
              </div>
            </Row>
          );
        })}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.09)" }} />

        {/* KOLs */}
        {data.topKols.length > 0 && <>
          <SectionHead>Most active on X</SectionHead>
          {data.topKols.map((k, i) => {
            const id = "k:" + i;
            return (
              <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
                head={
                  <div style={{ display: "flex", alignItems: "center", gap: 15, padding: "16px 2px" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "600 13px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{k.avatar ? <img src={k.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(k.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 17px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{k.name}</div><div style={{ font: "400 12.5px system-ui", color: "#7c7f88", marginTop: 2 }}>{k.drugs.slice(0, 4).join(" · ") || (k.handle ? "@" + k.handle : "")}</div></div>
                    <span style={{ font: "600 11.5px system-ui", color: pal.accent, whiteSpace: "nowrap" }}>{tog(id)}</span>
                  </div>
                }>
                <div style={{ marginLeft: 55 }}>
                  {k.posts.length > 0 && <div><div style={evLabel(pal.accent)}>Posts on X · {k.posts.length}</div>{k.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                  {k.articles.length > 0 && <div><div style={evLabel(pal.accent)}>Articles shared · {k.articles.length}</div>{k.articles.map((a, j) => <PaperCard key={j} title={a.title} journal={a.journal} url={a.url} accent={pal.accent} />)}</div>}
                </div>
              </Row>
            );
          })}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.09)" }} />
        </>}

        {/* papers */}
        {data.topArticles.length > 0 && <>
          <SectionHead>What&rsquo;s being read</SectionHead>
          {data.topArticles.map((a, i) => {
            const id = "p:" + i;
            return (
              <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
                head={
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 15, padding: "16px 2px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 17px/1.4 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{a.title}</div><div style={{ font: "400 12px system-ui", color: "#7c7f88", marginTop: 5 }}>{[a.journal || a.domain, `shared by ${a.sharers}`].filter(Boolean).join(" · ")}</div></div>
                    <span style={{ font: "600 11.5px system-ui", color: pal.accent, whiteSpace: "nowrap", flex: "none" }}>{tog(id)}</span>
                  </div>
                }>
                {a.abstract && <p style={{ margin: 0, font: "400 15px/1.6 'Newsreader',Georgia,serif", color: "#b7bac3" }}>{a.abstract}</p>}
                {a.posts.length > 0 && <div><div style={evLabel(pal.accent)}>What clinicians said · {a.posts.length}</div>{a.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              </Row>
            );
          })}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.09)" }} />
        </>}

        {/* trials */}
        {data.trials.length > 0 && <>
          <SectionHead>Trials being discussed</SectionHead>
          {data.trials.map((t, i) => {
            const id = "t:" + i;
            const parts: string[] = [];
            if (t.podMentions) parts.push(`${t.podMentions} podcast${t.podMentions === 1 ? "" : "s"}`);
            if (t.xMentions) parts.push(`${t.xMentions} tweet${t.xMentions === 1 ? "" : "s"}`);
            if (t.articleMentions) parts.push(`${t.articleMentions} paper${t.articleMentions === 1 ? "" : "s"}`);
            return (
              <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
                head={
                  <div style={{ display: "flex", alignItems: "center", gap: 15, padding: "16px 2px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 17px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{t.acronym || prettyPhase(t.phase)}</div><div style={{ font: "400 12.5px system-ui", color: "#7c7f88", marginTop: 3 }}>{t.title}</div></div>
                    <span style={{ font: "400 12px system-ui", color: "#7c7f88", whiteSpace: "nowrap" }}>{parts.join(" · ")}</span>
                    <span style={{ font: "600 11.5px system-ui", color: pal.accent, whiteSpace: "nowrap", flex: "none" }}>{tog(id)}</span>
                  </div>
                }>
                {t.pods.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{t.pods.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
                {t.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{t.posts.map((tw, j) => <TweetCard key={j} t={tw} />)}</div>}
                {t.articles.length > 0 && <div><div style={evLabel(pal.accent)}>Related papers</div>{t.articles.map((p: BriefingPaper, j) => <PaperCard key={j} title={p.title} journal={p.journal} meta={`shared by ${p.sharers.length}`} url={p.url} abstract={p.abstract} posts={p.sharers} accent={pal.accent} />)}</div>}
                <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ font: "600 12px system-ui", color: pal.accent }}>View on ClinicalTrials.gov ↗</a>
              </Row>
            );
          })}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.09)" }} />
        </>}
      </div>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div style={{ font: "600 11px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: "#6f727c", textAlign: "center", margin: "48px 0 8px" }}>{children}</div>;
}
