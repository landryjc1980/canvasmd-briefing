"use client";

import { useEffect, useState } from "react";
import { BriefingData, BriefingMover, BriefingSharer, BriefingPod, BriefingPaper } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { palOf, barSegments, barSegmentsRaw, metricsLine, storyMetricLine, storyKicker, storiesOf, partitionStories, articleSource, isNewsDomain, cleanArticleTitle, clipTs, heroStats, AREA_FULL, UP, DOWN } from "./briefVM";
import RecapBlock from "./RecapBlock";
import StanceBlock from "./StanceBlock";
import { shareBrief, logStorySeen } from "./gateClient";

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
  if (!delta) return <span title="No change vs. the prior two weeks" style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.4)", font: "700 11px system-ui", padding: "3px 9px", borderRadius: 20 }}>— flat</span>;
  const up = delta > 0, c = up ? UP : DOWN;
  return <span title="Net change in evidence (episodes + X sharers + papers) vs. the prior two weeks" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.fg, font: "700 11px system-ui", padding: "3px 9px", borderRadius: 20 }}>{(up ? "▲ " : "▼ ") + Math.abs(delta)}</span>;
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
function PaperCard({ title, journal, meta, url, abstract, posts, accent, news }: { title: string; journal: string | null; meta?: string; url?: string; abstract?: string | null; posts?: BriefingSharer[]; accent?: string; news?: boolean }) {
  const [open, setOpen] = useState(false);
  const hasAbs = !!(abstract && abstract.trim());
  const hasPosts = !!(posts && posts.length);
  const canExpand = hasAbs || hasPosts;
  const toggleLabel = open ? "Hide" : hasAbs ? (hasPosts ? "Abstract + posts" : "Read abstract") : "See posts";
  return (
    <div style={cardBox}>
      <div style={{ font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "#eef1f8" }}>{cleanArticleTitle(title)}</div>
      {(journal || meta || news) && <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 7 }}>
        {news && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".1em", color: "rgba(255,255,255,.6)", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "2px 6px" }}>NEWS</span>}
        <span style={{ font: "400 12px system-ui", color: "#7c7f88" }}>{[journal, meta].filter(Boolean).join(" · ")}</span>
      </div>}
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

export default function ReaderView({ data, area, areas, onArea, seen }: { data: BriefingData; area: string; areas: string[]; onArea: (a: string) => void; seen?: Record<string, string> }) {
  const pal = palOf(area);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const doShare = async () => {
    const r = await shareBrief();
    setShareMsg(r === "copied" ? "Link copied — send it to a colleague" : r === "error" ? "Couldn't create a link" : "Shared");
    setTimeout(() => setShareMsg(""), 2600);
  };
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const stats = heroStats(data);
  // "Since your last read": returning readers get NEW/UPDATED stories first, then a caught-up
  // divider, then the ones they've already read (editorial order inside each half).
  const part = partitionStories(storiesOf(data), seen);
  const stories = part.ordered;
  const tog = (id: string) => (openId === id ? "Hide ↑" : "Evidence ↓");

  // Story impression — a story counts as SEEN when its card actually scrolls into view (≥45%
  // visible). Logged once per story per page load (logStorySeen dedupes); feeds
  // Since-your-last-read next visit. Plain rect-check on scroll instead of
  // IntersectionObserver: IO callbacks are suppressed in embedded/backgrounded webviews
  // (verified in the in-app preview), and a rAF-throttled check over ≤7 cards is free.
  useEffect(() => {
    const check = () => {
      // Zero-rect guard: a hidden/display:none/transitioning layout reports all-zero rects,
      // and `0 >= 0*0.45` would mass-log EVERY story as seen without the reader seeing any.
      const vh = window.innerHeight;
      if (vh <= 0 || document.hidden) return;
      document.querySelectorAll<HTMLElement>("[data-sid]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height <= 0) return;
        const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (visible >= r.height * 0.45 && el.dataset.sid) logStorySeen(area, el.dataset.sid, el.dataset.sfp || undefined);
      });
    };
    check(); // whatever is visible on load counts as seen
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [area]);

  return (
    <div style={{ minHeight: "100vh", background: pal.bg, color: "#eef1f8", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", transition: "background .45s ease" }}>
      {/* share with a colleague — spreads the brief inside the account (referral graph) */}
      <div style={{ position: "fixed", top: 18, right: 18, zIndex: 20, display: "flex", alignItems: "center", gap: 10 }}>
        {shareMsg && <span style={{ font: "600 12.5px system-ui", color: pal.bg, background: "#fff", borderRadius: 8, padding: "6px 11px" }}>{shareMsg}</span>}
        <button onClick={doShare} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", font: "600 13px system-ui", borderRadius: 20, padding: "8px 15px", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          Share
        </button>
      </div>
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
          <div style={{ font: "400 12px/1.45 system-ui", color: "rgba(255,255,255,.4)", marginTop: 10, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>Signal from oncology&rsquo;s verified voices — identified clinicians and expert, physician-led podcasts. No bots, no anonymous accounts.</div>
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
          <RecapBlock text={data.recap} accent={pal.accent} size={19} lines={5} centered />
          <div style={{ display: "flex", justifyContent: "center", gap: 26, marginTop: 26 }}>
            <div><span style={{ font: "600 18px system-ui", color: "#f4f7ff" }}>{stats.moverCount}</span> <span style={{ font: "400 13px system-ui", color: "#7c7f88" }}>mover{stats.moverCount === 1 ? "" : "s"}</span></div>
            <div style={{ width: 1, background: "rgba(255,255,255,.12)" }} />
            <div><span style={{ font: "600 18px system-ui", color: "#f4f7ff" }}>{stats.postCount}</span> <span style={{ font: "400 13px system-ui", color: "#7c7f88" }}>KOL posts</span></div>
            <div style={{ width: 1, background: "rgba(255,255,255,.12)" }} />
            <div><span style={{ font: "600 18px system-ui", color: "#f4f7ff" }}>{stats.talkCount}</span> <span style={{ font: "400 13px system-ui", color: "#7c7f88" }}>podcast talks</span></div>
          </div>
        </div>

        {/* Top Stories — the atom-agnostic hero (drug | paper | topic). ONE story card,
            same shell; only the metric line (drug = score + bar; paper/topic = text) and the
            lead evidence adapt by kind. */}
        <SectionHead>{part.mode === "split" ? "Since your last read" : "Top stories"}</SectionHead>
        {part.mode === "caughtup" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "0 0 22px", font: "500 13px system-ui", color: "#8b93a4" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
            You&rsquo;re all caught up — nothing new since your last read.
          </div>
        )}
        {stories.map((s, i) => {
          const id = "s:" + s.id;
          const isDrug = s.kind === "drug";
          const chip = part.mode === "split" ? part.status.get(s.id) : undefined;
          return (
            <div key={id} data-sid={s.id} data-sfp={s.fp ?? ""}>
              {part.mode === "split" && i === part.freshCount && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "26px 0 10px" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.12)" }} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 12px system-ui", color: "#8b93a4", whiteSpace: "nowrap" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
                    You&rsquo;re caught up — {stories.length - part.freshCount} stor{stories.length - part.freshCount === 1 ? "y" : "ies"} you&rsquo;ve already read
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.12)" }} />
                </div>
              )}
            <Row open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
              head={
                <div style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: "22px 2px" }}>
                  <div style={{ font: "500 30px/1 'Newsreader',Georgia,serif", color: i === 0 ? pal.accent : "#5f626c", width: 30, flex: "none" }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      {(chip === "new" || chip === "updated") && (
                        <span style={{ font: "800 8.5px system-ui", letterSpacing: ".08em", color: pal.bg, background: chip === "new" ? pal.accent : "#fff", borderRadius: 4, padding: "2.5px 6px" }}>{chip === "new" ? "NEW" : "UPDATED"}</span>
                      )}
                      <span style={{ font: "600 9px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: pal.accent }}>{storyKicker(s)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ font: isDrug ? "500 22px/1.15 'Newsreader',Georgia,serif" : "500 20px/1.3 'Newsreader',Georgia,serif", color: "#f8f9fc" }}>{s.headline}</span>
                      {s.subtitle && <span style={{ font: "500 12px system-ui", letterSpacing: ".02em", color: "#7c7f88" }}>{s.subtitle}</span>}
                      {isDrug && s.delta !== 0 && <Delta delta={s.delta} />}
                    </div>
                    {s.description && <p style={{ margin: "10px 0 0", font: "400 17px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2" }}>{s.description}</p>}
                    <StanceBlock stance={s.stance} accent={pal.accent} style={{ marginTop: 14 }} />
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      {isDrug && s.bar && (
                        <div style={{ width: 132, height: 4, borderRadius: 3, display: "flex", gap: 2, overflow: "hidden" }}>
                          {barSegmentsRaw(s.bar).map((seg, k) => <div key={k} style={{ flex: seg.flex, background: pal.accent, opacity: seg.opacity, borderRadius: 3 }} />)}
                        </div>
                      )}
                      <span style={{ font: "400 12px system-ui", color: "#7c7f88" }}>{storyMetricLine(s)}</span>
                      <span style={{ marginLeft: "auto", font: "600 11.5px system-ui", color: pal.accent, whiteSpace: "nowrap" }}>{tog(id)}</span>
                    </div>
                  </div>
                  {/* Score + area-rank removed from Top Stories — they live on the Drugs board where
                      ranking is the point; only drug atoms have them and "#N" clashed with deck order.
                      The momentum arrow moved up beside the subtitle. */}
                </div>
              }>
              <div style={{ marginLeft: 50 }}>
                {s.podcast.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{s.podcast.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
                {s.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{s.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                {s.papers.length > 0 && <div><div style={evLabel(pal.accent)}>{s.kind === "paper" ? "The paper" : "Papers"}</div>{s.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} meta={p.sharers.length || p.posts?.length ? `shared by ${p.sharers.length || p.posts!.length}${p.topLikes ? ` · ♥ ${p.topLikes}` : ""}` : undefined} url={p.url} abstract={p.abstract} posts={p.posts?.length ? p.posts : p.sharers} accent={pal.accent} />)}</div>}
              </div>
            </Row>
            </div>
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
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 17px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{k.name}{k.institution ? <span style={{ font: "400 12.5px system-ui", color: "#7c7f88" }}>{"  ·  " + k.institution}</span> : ""}</div><div style={{ font: "400 12.5px system-ui", color: "#7c7f88", marginTop: 2 }}>{k.drugs.slice(0, 4).join(" · ") || (k.handle ? "@" + k.handle : "")}</div></div>
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "500 17px/1.4 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{cleanArticleTitle(a.title)}</div>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 5 }}>
                        {isNewsDomain(a.domain) && !a.journal && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".1em", color: "rgba(255,255,255,.6)", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "2px 6px" }}>NEWS</span>}
                        <span style={{ font: "400 12px system-ui", color: "#7c7f88" }}>{[articleSource(a.journal, a.domain), a.kolSharers ? `shared by ${a.kolSharers} clinician${a.kolSharers === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}</span>
                        {!!a.publishers?.length && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 20, padding: "2px 9px" }}><span style={{ font: "600 8.5px system-ui", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>via</span><span style={{ font: "600 11px system-ui", color: "#c8cad2" }}>{a.publishers.join(" · ")}</span></span>}
                      </div>
                    </div>
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

        {/* Drugs — the full ranked drug board, relocated so the drug overview isn't lost
            (unchanged rendering, sibling to Trials). */}
        {data.movers.length > 0 && <>
          <SectionHead>Drugs</SectionHead>
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
                      <div style={{ font: "600 9px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: "#6f727c", marginTop: 4 }}>signal · {area}-rel.</div>
                      <div style={{ marginTop: 6 }}><Delta delta={m.delta} /></div>
                    </div>
                  </div>
                }>
                <div style={{ marginLeft: 50 }}>
                  {/* the field's read at the TOP of the drug's evidence drawer (self-suppresses if thin) */}
                  <StanceBlock stance={m.stance} accent={pal.accent} style={{ marginBottom: 18 }} />
                  {m.podcast.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{m.podcast.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
                  {m.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{m.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                  {m.papers.length > 0 && <div><div style={evLabel(pal.accent)}>Papers shared</div>{m.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} meta={`shared by ${p.sharers.length} · ♥ ${p.topLikes}`} url={p.url} abstract={p.abstract} posts={p.sharers} accent={pal.accent} />)}</div>}
                </div>
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
