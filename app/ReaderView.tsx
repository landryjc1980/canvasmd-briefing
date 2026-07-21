"use client";

import { useEffect, useState } from "react";
import { BriefingData, BriefingMover, BriefingSharer, BriefingPod, BriefingPaper } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { palOf, inkOf, barSegments, barSegmentsRaw, metricsLine, storyMetricLine, storyKicker, storiesOf, partitionStories, articleSource, isNewsDomain, cleanArticleTitle, cleanTweetText, clipTs, pileFaces, AREA_FULL, UP, DOWN } from "./briefVM";
import StanceBlock from "./StanceBlock";
import { logStorySeen } from "./gateClient";

// "The Reader" — the Weekly Brief. 2026-07-21 depth pass (previous single-column design
// preserved at ?design=flat / git tag design-2026-07-21-flat-reader):
//   • surface elevation: soft top light on the page field, cards a clear step lighter with a
//     lit top edge + shadow, hover lift on every expandable row
//   • desktop ≥1180px: two tracks — the editorial column + a right rail (guests, X, trials)
//     so the width works and the rail modules stop stretching the scroll
//   • type scale: lead story gets front-page size; rank numerals set in the area accent
//   • every expandable row is a real button (keyboard + screen readers), same click targets
// Evidence expands inline as an accordion under whatever you click — unchanged.

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

// Muted ink on the area bgs — was #7c7f88, which sat at ~3:1 on the navy (below WCAG AA
// for the 12px metric lines). This clears 4.5:1 on every area bg in the palette.
const MUT = "#9aa2b6";

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

// Raised surface: a step lighter than the page, lit top edge, soft drop — the depth system.
const cardBox: React.CSSProperties = { background: "rgba(255,255,255,.065)", border: "1px solid rgba(255,255,255,.09)", borderTop: "1px solid rgba(255,255,255,.16)", borderRadius: 13, padding: 14, marginBottom: 9, boxShadow: "0 8px 22px rgba(0,0,0,.2)" };
const evLabel = (accent: string): React.CSSProperties => ({ font: "600 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 11 });

// "shared by N · ♥ M" with zero parts dropped — never renders "shared by 0 · ♥ 0".
const paperMeta = (shared: number, likes: number): string | undefined => {
  const parts: string[] = [];
  if (shared) parts.push(`shared by ${shared}`);
  if (likes) parts.push(`♥ ${likes}`);
  return parts.length ? parts.join(" · ") : undefined;
};

function PodCard({ p, accent }: { p: BriefingPod; accent: string }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "700 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{p.showArt ? <img src={p.showArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(p.show)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13.5px system-ui", color: "#eef1f8" }}>{p.show}</div>
          <div style={{ font: "400 11px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.episodeTitle}</div>
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
  const text = cleanTweetText(t.text);
  const body = (<>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.12)", color: "#f4f7ff", font: "600 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>
          {t.avatar ? <img src={t.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(t.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}><span style={{ font: "600 13px system-ui", color: "#eef1f8" }}>{t.name}</span> {t.handle && <span style={{ font: "400 11.5px system-ui", color: MUT }}>@{t.handle}</span>}</div>
        {t.likes > 0 && <span style={{ font: "600 11px system-ui", color: "#e08aa0" }}>♥ {t.likes}</span>}
      </div>
      {text && <p style={{ margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#cbcdd5" }}>{text}</p>}
    </>);
  return t.tweetUrl
    ? <a href={t.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ ...cardBox, display: "block", textDecoration: "none" }}>{body}</a>
    : <div style={cardBox}>{body}</div>;
}
// Expands INLINE to the abstract + the clinicians' tweets about the paper (parity with
// the mobile story), so readers stay on the page. The ↗ still opens the source.
function PaperCard({ title, journal, domain, meta, url, abstract, posts, accent }: { title: string; journal: string | null; domain?: string | null; meta?: string; url?: string; abstract?: string | null; posts?: BriefingSharer[]; accent?: string }) {
  const [open, setOpen] = useState(false);
  const hasAbs = !!(abstract && abstract.trim());
  const hasPosts = !!(posts && posts.length);
  const canExpand = hasAbs || hasPosts;
  const toggleLabel = open ? "Hide" : hasAbs ? (hasPosts ? "Abstract + posts" : "Read abstract") : "See posts";
  const src = articleSource(journal, domain);
  const isNews = isNewsDomain(domain) && !journal;
  return (
    <div style={cardBox}>
      {url
        ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "#eef1f8", textDecoration: "none" }}>{cleanArticleTitle(title)}</a>
        : <div style={{ font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "#eef1f8" }}>{cleanArticleTitle(title)}</div>}
      {(src || meta) && <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 7 }}>
        <span style={{ font: "400 12px system-ui", color: MUT }}>{[src, meta].filter(Boolean).join(" · ")}</span>
        {isNews && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "rgba(255,255,255,.55)", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
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

// The expandable row. A real button now (keyboard + AT reach the evidence too), with the
// hover-lift surface from the .rv-row class; the click target is unchanged — the whole head.
function Row({ open, onToggle, accent, head, children }: { open: boolean; onToggle: () => void; accent: string; head: React.ReactNode; children: React.ReactNode }) {
  void accent;
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="rv-row"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{ cursor: "pointer", margin: "0 -12px", padding: "0 12px", borderRadius: 14 }}
      >{head}</div>
      {open && <div style={{ margin: "6px 0 24px 0", display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>}
    </div>
  );
}

// Long list sections (Most active on X, What's being read, …) show the top `cap` and tuck the
// rest behind a "Show N more" toggle so the desktop column doesn't scroll forever. Short lists
// (≤ cap) render in full with no button. Slicing from 0 keeps item indices stable when expanded.
function Capped<T>({ items, cap, accent, render }: { items: T[]; cap: number; accent: string; render: (item: T, i: number) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, cap);
  const extra = items.length - cap;
  return (
    <>
      {shown.map(render)}
      {extra > 0 && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => setOpen((o) => !o)} style={{ display: "inline-block", background: "none", border: "1px solid rgba(255,255,255,.18)", color: accent, font: "600 12.5px system-ui", borderRadius: 20, padding: "7px 20px", cursor: "pointer" }}>
            {open ? "Show less ↑" : `Show ${extra} more ↓`}
          </button>
        </div>
      )}
    </>
  );
}

// Overlapping avatars of the clinicians who shared an article (the "who's reading this" face-pile,
// mirrors the pharma dashboard). `ring` = page bg so the overlap reads as clean separated coins.
function FacePile({ faces, extra, ring }: { faces: string[]; extra: number; ring: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flex: "none" }}>
      {faces.slice(0, 4).map((f, i) => (
        <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ring}`, background: "rgba(255,255,255,.12)", marginLeft: i ? -8 : 0, flex: "none" }}>
          <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
      {extra > 0 && (
        <div style={{ height: 26, minWidth: 26, padding: "0 6px", boxSizing: "border-box", borderRadius: 13, border: `2px solid ${ring}`, background: "rgba(255,255,255,.1)", marginLeft: -8, display: "flex", alignItems: "center", justifyContent: "center", font: "600 10px system-ui", color: "rgba(255,255,255,.72)", flex: "none" }}>+{extra}</div>
      )}
    </div>
  );
}

export default function ReaderView({ data, area, areas, onArea, seen, compact = false }: { data: BriefingData; area: string; areas: string[]; onArea: (a: string) => void; seen?: Record<string, string>; compact?: boolean }) {
  // Ink editorial: neutral near-black page, the area's jewel tone demoted to a top
  // "cover wash" + the accent system. See inkOf in briefVM.
  const pal = inkOf(area);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false); // masthead area/tumor switcher (mobile parity)
  // Two-track layout kicks in on real desktop width (never on the compact/mobile pass).
  const [wide, setWide] = useState<boolean>(() => typeof window !== "undefined" && !compact && window.matchMedia("(min-width: 1180px)").matches);
  useEffect(() => {
    if (compact) { setWide(false); return; }
    const mq = window.matchMedia("(min-width: 1180px)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, [compact]);
  // Keep the document root the same color as the page so load-in and overscroll bounce
  // never flash the classic design's cream (globals.css paints --paper for ?design=classic).
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.backgroundColor;
    el.style.backgroundColor = pal.bg;
    return () => { el.style.backgroundColor = prev; };
  }, [pal.bg]);
  const doShare = async () => {
    try {
      const r = await fetch("/api/brief-share", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.ok || !j.url) { setShareMsg("Couldn't create a link"); setTimeout(() => setShareMsg(""), 3000); return; }
      const nav = navigator as any;
      // URL only — iMessage/Mail build a rich card from OG tags; adding text/title posts a second
      // plain bubble on top (ugly). URL alone = just the card.
      if (nav.share) { try { await nav.share({ url: j.url }); return; } catch (e: any) { if (e?.name === "AbortError") return; } }
      let copied = false;
      try { await navigator.clipboard.writeText(j.url); copied = true; } catch { /* activation lost */ }
      setShareMsg(copied ? "Link copied — send it to a colleague" : j.url);
      setTimeout(() => setShareMsg(""), copied ? 2800 : 6000);
    } catch { setShareMsg("Couldn't create a link"); setTimeout(() => setShareMsg(""), 3000); }
  };
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  // sticky section nav — jump-links + scroll-spy. On the wide layout the rail sections
  // (guests/KOLs, trials) live beside the column, so their pills drop out of the nav.
  const sections = [
    { id: "sec-top", label: "Top Stories", on: true },
    { id: "sec-kols", label: "KOLs", on: !wide && !!(data.guests?.length || data.topKols.length) },
    { id: "sec-episodes", label: "Episodes", on: !!data.episodes?.length },
    { id: "sec-papers", label: "Papers", on: data.topArticles.length > 0 },
    { id: "sec-trials", label: "Trials", on: !wide && data.trials.length > 0 },
    { id: "sec-drugs", label: "Drugs", on: data.movers.length > 0 },
  ].filter((s) => s.on);
  const [activeSec, setActiveSec] = useState<string>("sec-top");
  // The jump-link bar rides transparently on the cover wash at rest, and only grows its
  // ink-glass chrome once it actually sticks — a floating bar over the masthead read as a band.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const ids = ["sec-top", "sec-kols", "sec-episodes", "sec-papers", "sec-trials", "sec-drugs"].filter((id) => !wide || !["sec-kols", "sec-trials"].includes(id));
    let raf = 0;
    const check = () => {
      setStuck(window.scrollY > 120);
      let cur = "";
      for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 90) cur = id; }
      setActiveSec(cur || ids.find((id) => document.getElementById(id)) || "sec-top");
    };
    check();
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [area, wide]);
  const goSec = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  // "Since your last read": returning readers get NEW/UPDATED stories first, then a caught-up
  // divider, then the ones they've already read (editorial order inside each half).
  const part = partitionStories(storiesOf(data), seen);
  const stories = part.ordered;
  // The evidence toggle is the product — a bare 11.5px text link was invisible to
  // first-time readers. It's now a small accent-tinted pill that reads as a control.
  const SignalTag = ({ id, style }: { id: string; style?: React.CSSProperties }) => (
    <span style={{ display: "inline-flex", alignItems: "center", font: "600 12.5px system-ui", color: pal.accent, border: `1px solid ${pal.accent}59`, background: `${pal.accent}17`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap", ...style }}>
      {openId === id ? "Hide ↑" : "The signal ↓"}
    </span>
  );

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

  // Rail modules (guests / most-active / trials) render narrow on the wide layout, so they
  // use the stacked/compact arrangements and no drawer indent there.
  const narrow = compact || wide;

  // ---- section builders (placement differs by layout; content is identical) --------------

  const storiesSection = (
    <>
      <SectionHead id="sec-top" accent={pal.accent}>{part.mode === "split" ? "Since your last read" : "Top stories"}</SectionHead>
      {part.mode === "caughtup" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "0 0 22px", font: "500 13px system-ui", color: MUT }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
          You&rsquo;re all caught up — nothing new since your last read.
        </div>
      )}
      {stories.map((s, i) => {
        const id = "s:" + s.id;
        const isDrug = s.kind === "drug";
        const lead = i === 0;
        const faces = pileFaces(s);
        const chip = part.mode === "split" ? part.status.get(s.id) : undefined;
        // Front-page scale for the lead story; standard scale below the fold.
        const headlineFont = isDrug
          ? (lead ? (compact ? "500 26px/1.15" : "500 34px/1.12") : "500 22px/1.15")
          : (lead ? (compact ? "500 23px/1.28" : "500 30px/1.22") : "500 20px/1.3");
        // First-time discoverability: the LEAD story teases its evidence — the first 1–2
        // pieces render in a clipped, bottom-faded, non-interactive preview with the signal
        // pill beneath as the "see the rest" affordance. Clicking anywhere expands the real
        // drawer (the whole head is the button); once open the pill moves back to the metric
        // row as "Hide ↑". Teaser only — pointer-events off so a play button can't half-fire.
        const peekItems: React.ReactNode[] = [];
        if (lead) {
          if (s.podcast[0]) peekItems.push(<div key="pod"><div style={evLabel(pal.accent)}>On the podcasts</div><PodCard p={s.podcast[0]} accent={pal.accent} /></div>);
          if (peekItems.length < 2 && s.posts[0]) peekItems.push(<div key="x"><div style={evLabel(pal.accent)}>On X · verified clinicians</div><TweetCard t={s.posts[0]} /></div>);
          if (peekItems.length < 2 && s.papers[0]) peekItems.push(<div key="pp"><div style={evLabel(pal.accent)}>{s.kind === "paper" ? "The paper" : "Papers"}</div><PaperCard title={s.papers[0].title} journal={s.papers[0].journal} domain={s.papers[0].domain} url={s.papers[0].url} abstract={s.papers[0].abstract} accent={pal.accent} /></div>);
        }
        const showPeek = lead && openId !== id && peekItems.length > 0;
        return (
          <div key={id} data-sid={s.id} data-sfp={s.fp ?? ""}>
            {part.mode === "split" && i === part.freshCount && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "26px 0 10px" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.12)" }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 12px system-ui", color: MUT, whiteSpace: "nowrap" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
                  You&rsquo;re caught up — {stories.length - part.freshCount} stor{stories.length - part.freshCount === 1 ? "y" : "ies"} you&rsquo;ve already read
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.12)" }} />
              </div>
            )}
          <Row open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
            head={
              <div style={{ display: "flex", alignItems: "flex-start", gap: compact ? 0 : 20, padding: "22px 2px" }}>
                {!compact && <div style={{ font: lead ? "500 34px/1 'Newsreader',Georgia,serif" : "500 26px/1.1 'Newsreader',Georgia,serif", color: pal.accent, opacity: lead ? 1 : 0.45, width: 34, flex: "none" }}>{i + 1}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {compact && <span style={{ font: "600 15px 'Newsreader',Georgia,serif", color: pal.accent, lineHeight: 1 }}>{i + 1}</span>}
                    {(chip === "new" || chip === "updated") && (
                      <span style={{ font: "800 8.5px system-ui", letterSpacing: ".08em", color: pal.bg, background: chip === "new" ? pal.accent : "#fff", borderRadius: 4, padding: "2.5px 6px" }}>{chip === "new" ? "NEW" : "UPDATED"}</span>
                    )}
                    <span style={{ font: compact ? "700 11px system-ui" : "600 9px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: pal.accent }}>{storyKicker(s)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ font: `${headlineFont} 'Newsreader',Georgia,serif`, color: "#f8f9fc", letterSpacing: lead ? "-.01em" : "0" }}>{s.headline}</span>
                    {s.subtitle && <span style={{ font: "500 12px system-ui", letterSpacing: ".02em", color: MUT }}>{s.subtitle}</span>}
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
                    {faces.length > 0 && <FacePile faces={faces} extra={0} ring={pal.bg} />}
                    <span style={{ font: "400 12px system-ui", color: MUT }}>{storyMetricLine(s)}</span>
                    {(!lead || openId === id) && <SignalTag id={id} style={{ marginLeft: "auto" }} />}
                  </div>
                  {showPeek && (
                    <>
                      <div aria-hidden style={{ maxHeight: 250, overflow: "hidden", marginTop: 16, pointerEvents: "none", WebkitMaskImage: "linear-gradient(180deg, #000 38%, transparent 96%)", maskImage: "linear-gradient(180deg, #000 38%, transparent 96%)" }}>
                        {peekItems}
                      </div>
                      <div style={{ textAlign: "center", marginTop: 4 }}><SignalTag id={id} /></div>
                    </>
                  )}
                </div>
              </div>
            }>
            <div style={{ marginLeft: compact ? 0 : 54 }}>
              {s.podcast.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{s.podcast.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
              {s.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{s.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              {s.papers.length > 0 && <div><div style={evLabel(pal.accent)}>{s.kind === "paper" ? "The paper" : "Papers"}</div>{s.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} meta={paperMeta(p.sharers.length || p.posts?.length || 0, p.topLikes || 0)} url={p.url} abstract={p.abstract} posts={p.posts?.length ? p.posts : p.sharers} accent={pal.accent} />)}</div>}
            </div>
          </Row>
          </div>
        );
      })}
    </>
  );

  // This week's guests — box score (recent form + lifetime career)
  const guestsSection = !!data.guests?.length && (
    <>
      <SectionHead id="sec-kols" accent={pal.accent} rail={wide}>This week&rsquo;s guests</SectionHead>
      <Capped items={data.guests} cap={6} accent={pal.accent} render={(g, i) => {
        const eps = g.episodes.filter((e) => e.audioUrl);
        return (
        <Row key={"g:" + i} open={openId === "g:" + i} onToggle={() => { if (eps.length) toggle("g:" + i); }} accent={pal.accent}
          head={
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 2px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "500 17px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{g.name}</div>
                {(g.verified || g.affiliation) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {g.verified && <span style={{ font: "700 8px system-ui", letterSpacing: ".06em", color: pal.bg, background: pal.accent, borderRadius: 4, padding: "2px 5px", textTransform: "uppercase", flex: "none" }}>Verified</span>}
                    {g.affiliation && <span style={{ font: "400 12.5px system-ui", color: MUT }}>{g.affiliation}</span>}
                  </div>
                )}
                {eps.length > 0 && <div style={{ font: "600 11.5px system-ui", color: pal.accent, marginTop: 7 }}>{openId === "g:" + i ? "Hide ↑" : `▸ Listen · ${eps.length} episode${eps.length === 1 ? "" : "s"}`}</div>}
              </div>
              <div style={{ flex: "none", display: "flex", gap: 8, textAlign: "center" }}>
                <div style={{ ...statTile }}><div style={{ font: "600 21px 'Newsreader',Georgia,serif", color: pal.accent }}>{g.thisWeek}</div><div style={statTileLabel}>This wk</div></div>
                <div style={{ ...statTile }}><div style={{ font: "600 21px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{g.career}</div><div style={statTileLabel}>Career</div></div>
              </div>
            </div>
          }>
          {eps.map((ep, j) => (
            <div key={j} style={cardBox}>
              <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "700 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{ep.showArt ? <img src={ep.showArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(ep.show || g.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "600 13.5px system-ui", color: "#eef1f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.show || "Podcast"}</div><div style={{ font: "400 11px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.title}</div></div>
              </div>
              {ep.description && <p style={{ margin: "0 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.description}</p>}
              <AudioQuote audioUrl={ep.audioUrl!} startMs={0} label="Listen to the episode" accent={pal.accent} tone="dark" />
            </div>
          ))}
        </Row>
      );}} />
    </>
  );

  // KOLs
  const kolsSection = data.topKols.length > 0 && (
    <>
      <SectionHead id={data.guests?.length ? undefined : "sec-kols"} accent={pal.accent} rail={wide}>Most active on X</SectionHead>
      <Capped items={data.topKols} cap={6} accent={pal.accent} render={(k, i) => {
        const id = "k:" + i;
        return (
          <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
            head={
              <div style={{ display: "flex", alignItems: "center", gap: 15, padding: "16px 2px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "600 13px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{k.avatar ? <img src={k.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(k.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 17px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{k.name}{k.institution ? <span style={{ font: "400 12.5px system-ui", color: MUT }}>{"  ·  " + k.institution}</span> : ""}</div><div style={{ font: "400 12.5px system-ui", color: MUT, marginTop: 2 }}>{k.drugs.slice(0, 4).join(" · ") || (k.handle ? "@" + k.handle : "")}</div></div>
                <SignalTag id={id} />
              </div>
            }>
            <div style={{ marginLeft: narrow ? 0 : 55 }}>
              {k.posts.length > 0 && <div><div style={evLabel(pal.accent)}>Posts on X · {k.posts.length}</div>{k.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              {k.articles.length > 0 && <div><div style={evLabel(pal.accent)}>Articles shared · {k.articles.length}</div>{k.articles.map((a, j) => <PaperCard key={j} title={a.title} journal={a.journal} domain={a.domain} url={a.url} accent={pal.accent} />)}</div>}
            </div>
          </Row>
        );
      }} />
    </>
  );

  // Also worth hearing — area episodes the drug movers don't cover (untracked-topic blind
  // spot). Flat list of episode cards, same shape as a guest's episode.
  const episodesSection = !!data.episodes?.length && (
    <>
      <SectionHead id="sec-episodes" accent={pal.accent}>Also worth hearing</SectionHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <Capped items={data.episodes.filter((e) => e.audioUrl)} cap={6} accent={pal.accent} render={(ep, i) => (
          <div key={i} style={cardBox}>
            <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "700 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{ep.showArt ? <img src={ep.showArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(ep.show || "Podcast")}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "600 13.5px system-ui", color: "#eef1f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.show || "Podcast"}</div><div style={{ font: "400 11px system-ui", color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.title}</div></div>
            </div>
            {ep.description && <p style={{ margin: "0 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ep.description}</p>}
            <AudioQuote audioUrl={ep.audioUrl!} startMs={0} label="Listen to the episode" accent={pal.accent} tone="dark" />
          </div>
        )} />
      </div>
    </>
  );

  // papers
  const papersSection = data.topArticles.length > 0 && (
    <>
      <SectionHead id="sec-papers" accent={pal.accent}>What&rsquo;s being read</SectionHead>
      <Capped items={data.topArticles} cap={8} accent={pal.accent} render={(a, i) => {
        const id = "p:" + i;
        return (
          <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
            head={
              <div style={{ display: "flex", alignItems: "flex-start", gap: 15, padding: "16px 2px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "500 17px/1.4 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{cleanArticleTitle(a.title)}</div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 5 }}>
                    <span style={{ font: "400 12px system-ui", color: MUT }}>{[articleSource(a.journal, a.domain), a.kolSharers ? `shared by ${a.kolSharers} clinician${a.kolSharers === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}</span>
                    {isNewsDomain(a.domain) && !a.journal && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "rgba(255,255,255,.55)", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
                  </div>
                </div>
                <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 9 }}>
                  {a.faces.length > 0 && <FacePile faces={a.faces} extra={a.kolSharers - a.faces.length} ring={pal.bg} />}
                  <SignalTag id={id} />
                </div>
              </div>
            }>
            {a.abstract && <p style={{ margin: 0, font: "400 15px/1.6 'Newsreader',Georgia,serif", color: "#b7bac3" }}>{a.abstract}</p>}
            {a.posts.length > 0 && <div><div style={evLabel(pal.accent)}>What clinicians said · {a.posts.length}</div>{a.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
            {/* link to the source — also guarantees the expand is never empty (news items carry
                no abstract/posts, which previously made the last row look like it didn't open). */}
            {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", font: "600 13px system-ui", color: pal.accent, textDecoration: "none" }}>Open article ↗</a>}
          </Row>
        );
      }} />
    </>
  );

  // trials
  const trialsSection = data.trials.length > 0 && (
    <>
      <SectionHead id="sec-trials" accent={pal.accent} rail={wide}>Trials being discussed</SectionHead>
      <Capped items={data.trials} cap={6} accent={pal.accent} render={(t, i) => {
        const id = "t:" + i;
        const parts: string[] = [];
        if (t.podMentions) parts.push(`${t.podMentions} podcast${t.podMentions === 1 ? "" : "s"}`);
        if (t.xMentions) parts.push(`${t.xMentions} tweet${t.xMentions === 1 ? "" : "s"}`);
        if (t.articleMentions) parts.push(`${t.articleMentions} paper${t.articleMentions === 1 ? "" : "s"}`);
        const tFaces = pileFaces({ posts: [...t.posts, ...t.articles.flatMap((a) => a.sharers)], podcast: t.pods });
        return (
          <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
            head={narrow ? (
              /* narrow (mobile / rail): stack — acronym + (clamped) title full width, then a meta
                 row so the title isn't crushed into a sliver by the faces/counts/toggle */
              <div style={{ padding: "16px 2px" }}>
                <div style={{ font: "500 18px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{t.acronym || prettyPhase(t.phase)}</div>
                <div style={{ font: "400 12.5px/1.4 system-ui", color: MUT, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 11 }}>
                  {tFaces.length > 0 && <FacePile faces={tFaces} extra={0} ring={pal.bg} />}
                  <span style={{ font: "400 12px system-ui", color: MUT }}>{parts.join(" · ")}</span>
                  <SignalTag id={id} style={{ marginLeft: "auto" }} />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 2px" }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 17px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{t.acronym || prettyPhase(t.phase)}</div><div style={{ font: "400 12.5px system-ui", color: MUT, marginTop: 3 }}>{t.title}</div></div>
                {tFaces.length > 0 && <FacePile faces={tFaces} extra={0} ring={pal.bg} />}
                <span style={{ font: "400 12px system-ui", color: MUT, whiteSpace: "nowrap" }}>{parts.join(" · ")}</span>
                <SignalTag id={id} style={{ flex: "none" }} />
              </div>
            )}>
            {t.pods.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{t.pods.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
            {t.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{t.posts.map((tw, j) => <TweetCard key={j} t={tw} />)}</div>}
            {t.articles.length > 0 && <div><div style={evLabel(pal.accent)}>Related papers</div>{t.articles.map((p: BriefingPaper, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} meta={paperMeta(p.sharers.length, 0)} url={p.url} abstract={p.abstract} posts={p.sharers} accent={pal.accent} />)}</div>}
            <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ font: "600 12px system-ui", color: pal.accent }}>View on ClinicalTrials.gov ↗</a>
          </Row>
        );
      }} />
    </>
  );

  // Drugs — the full ranked drug board, relocated so the drug overview isn't lost
  // (unchanged rendering, sibling to Trials).
  const drugsSection = data.movers.length > 0 && (
    <>
      <SectionHead id="sec-drugs" accent={pal.accent}>Drugs</SectionHead>
      {data.movers.map((m, i) => {
        const id = "m:" + m.drugId;
        return (
          <Row key={id} open={openId === id} onToggle={() => toggle(id)} accent={pal.accent}
            head={
              <div style={{ display: "flex", alignItems: "flex-start", gap: compact ? 0 : 20, padding: "22px 2px" }}>
                {!compact && <div style={{ font: "500 26px/1.1 'Newsreader',Georgia,serif", color: pal.accent, opacity: i === 0 ? 1 : 0.45, width: 34, flex: "none" }}>{i + 1}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    {compact && <span style={{ font: "500 15px 'Newsreader',Georgia,serif", color: pal.accent, opacity: i === 0 ? 1 : 0.55, lineHeight: 1 }}>{i + 1}</span>}
                    <span style={{ font: "500 22px/1.1 'Newsreader',Georgia,serif", color: "#f8f9fc" }}>{m.drug}</span>
                    <span style={{ font: "500 12px system-ui", letterSpacing: ".02em", color: MUT }}>{[m.brand, m.company].filter(Boolean).join(" · ")}</span>
                    {m.delta !== 0 && <Delta delta={m.delta} />}
                  </div>
                  {m.why && <p style={{ margin: "10px 0 0", font: "400 17px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2" }}>{m.why}</p>}
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <Bar m={m} accent={pal.accent} />
                    {pileFaces(m).length > 0 && <FacePile faces={pileFaces(m)} extra={0} ring={pal.bg} />}
                    <span style={{ font: "400 12px system-ui", color: MUT }}>{metricsLine(m)}</span>
                    <SignalTag id={id} style={{ marginLeft: "auto" }} />
                  </div>
                </div>
              </div>
            }>
            <div style={{ marginLeft: compact ? 0 : 54 }}>
              {/* the field's read at the TOP of the drug's evidence drawer (self-suppresses if thin) */}
              <StanceBlock stance={m.stance} accent={pal.accent} style={{ marginBottom: 18 }} />
              {m.podcast.length > 0 && <div><div style={evLabel(pal.accent)}>On the podcasts</div>{m.podcast.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
              {m.posts.length > 0 && <div><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{m.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
              {m.papers.length > 0 && <div><div style={evLabel(pal.accent)}>Papers shared</div>{m.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} meta={paperMeta(p.sharers.length, p.topLikes)} url={p.url} abstract={p.abstract} posts={p.sharers} accent={pal.accent} />)}</div>}
            </div>
          </Row>
        );
      })}
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${pal.wash}C9 0px, ${pal.wash}55 260px, ${pal.wash}00 560px), radial-gradient(900px 420px at 50% -200px, rgba(255,255,255,.05), rgba(255,255,255,0) 70%), ${pal.bg}`, color: "#eef1f8", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      {/* rv-pills: hide the scrollbar; on mobile a right-edge fade signals there's more to scroll.
          rv-row: the hover-lift surface + keyboard focus ring on every expandable row. */}
      <style>{`
        .rv-pills::-webkit-scrollbar{display:none}.rv-pills{scrollbar-width:none}
        .rv-fade{-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 36px),transparent);mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 36px),transparent)}
        .rv-row{transition:background .16s ease}
        @media(hover:hover){.rv-row:hover{background:rgba(255,255,255,.045)}}
        @media(hover:hover){.rv-row[aria-expanded="true"],.rv-row[aria-expanded="true"]:hover{background:transparent}}
        .rv-row:focus-visible{outline:2px solid rgba(255,255,255,.45);outline-offset:-2px}
      `}</style>
      {/* share with a colleague — spreads the brief inside the account (referral graph). Desktop
          only: on mobile it collided with the area dropdown, so a share icon sits in the masthead. */}
      {!compact && <div style={{ position: "fixed", top: 18, right: 18, zIndex: 20, display: "flex", alignItems: "center", gap: 10 }}>
        {shareMsg && <span style={{ font: "600 12.5px system-ui", color: pal.bg, background: "#fff", borderRadius: 8, padding: "6px 11px" }}>{shareMsg}</span>}
        <button onClick={doShare} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", font: "600 13px system-ui", borderRadius: 20, padding: "8px 15px", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          Share
        </button>
      </div>}
      <div style={{ maxWidth: wide ? 1116 : 690, margin: "0 auto", padding: "34px 30px 120px" }}>
        {/* masthead — ONE line: wordmark · byline · freshness on the left, the tumor-area
            switcher as a dropdown on the right (mobile parity). Folding the area picker up here
            kills the whole separate tabs row — header is now just masthead + section pills. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingBottom: compact ? 3 : 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 11, rowGap: 3, minWidth: 0 }}>
            <h1 style={{ font: `500 ${compact ? 21 : 24}px/1 'Newsreader',Georgia,serif`, color: "#fff", letterSpacing: "-.01em", margin: 0, display: "inline" }}>The Readout</h1>
            {!compact && <span style={{ font: "600 9px system-ui", letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(255,255,255,.42)" }}>by CanvasMD</span>}
            {!compact && <span style={{ font: "500 10px system-ui", letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.28)" }}>· Updated {ago(data.generatedAt)}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
          {/* mobile share — a bare muted icon (no box) so the header stays quiet */}
          {compact && <button onClick={doShare} aria-label="Share" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, padding: 2, cursor: "pointer", flex: "none", order: 1 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          </button>}
          {compact && shareMsg && <span style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 40, font: "600 12.5px system-ui", color: pal.bg, background: "#fff", borderRadius: 8, padding: "8px 13px", boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>{shareMsg}</span>}
          {/* tumor-area dropdown — same interaction as the mobile header */}
          <div style={{ position: "relative", flex: "none" }}>
            <div role="button" tabIndex={0} aria-expanded={menuOpen} aria-label="Switch tumor area" onClick={() => setMenuOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMenuOpen((o) => !o); } }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", cursor: "pointer" }}>
              <span style={{ font: "600 14px system-ui", color: "#fff", whiteSpace: "nowrap" }}>{AREA_FULL[area] ?? area}</span>
              <span style={{ font: "700 12px system-ui", color: "rgba(255,255,255,.6)", lineHeight: 1 }}>▾</span>
            </div>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                <div style={{ position: "absolute", top: "calc(100% + 7px)", right: 0, width: 202, background: "rgba(16,18,26,.97)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, boxShadow: "0 20px 44px rgba(0,0,0,.4)", padding: 8, zIndex: 31 }}>
                  <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", padding: "6px 11px 8px" }}>Tumor area</div>
                  {areas.map((a) => {
                    const on = a === area;
                    return (
                      <div key={a} onClick={() => { setMenuOpen(false); if (a !== area) onArea(a); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(255,255,255,.1)" : "transparent" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: palOf(a).accent, flex: "none" }} />
                        <span style={{ flex: 1, font: "600 13.5px system-ui", color: on ? "#fff" : "rgba(255,255,255,.75)" }}>{AREA_FULL[a] ?? a}</span>
                        {on && <span style={{ color: pal.accent, font: "700 13px system-ui" }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          </div>
        </div>
        {/* mobile: byline + freshness on a quiet second line, so the wordmark sits inline with the
            share + area controls (not floating against a 3-line stack) */}
        {compact && <div style={{ font: "600 9px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,255,255,.32)", margin: "5px 0 13px" }}>By CanvasMD · Updated {ago(data.generatedAt)}</div>}
        {/* sticky section nav — jump-links with scroll-spy; sticks to the top on scroll so the
            reader can skip ahead/back without a long scroll. Glassy over the lit page field. */}
        {/* wide: the rail is quiet context, so the jump-links center on the EDITORIAL column
            (right padding = rail 320 + gap 46), not the full wrapper. The hard border under the
            bar read as cheap — replaced by the glass blur + a soft cast shadow. */}
        <div className={`rv-pills${compact ? " rv-fade" : ""}`} style={{ position: "sticky", top: 0, zIndex: 15, margin: compact ? "0 -20px" : "0 -30px", padding: compact ? "10px 20px" : wide ? "11px 396px 11px 30px" : "11px 30px", background: stuck ? `${pal.bg}E0` : "transparent", backdropFilter: stuck ? "blur(10px) saturate(1.15)" : "none", WebkitBackdropFilter: stuck ? "blur(10px) saturate(1.15)" : "none", boxShadow: stuck ? "0 14px 28px -18px rgba(0,0,0,.55)" : "none", transition: "background .2s ease, box-shadow .2s ease", display: "flex", justifyContent: compact ? "flex-start" : "center", flexWrap: compact ? "nowrap" : "wrap", gap: 8, overflowX: compact ? "auto" : "visible", WebkitOverflowScrolling: "touch" }}>
          {sections.map((s) => {
            const on = activeSec === s.id;
            return <button key={s.id} onClick={() => goSec(s.id)} style={{ cursor: "pointer", font: "600 12.5px system-ui", letterSpacing: ".01em", padding: "6px 14px", borderRadius: 20, border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.16)"}`, background: on ? "#fff" : "rgba(255,255,255,.05)", color: on ? pal.bg : "rgba(255,255,255,.72)", whiteSpace: "nowrap", flex: "none", transition: "background .15s, color .15s" }}>{s.label}</button>;
          })}
        </div>

        {/* No AI cover hero on either platform: lead with the #1 story — a real headline the
            field wrote, not a whole-week thesis the AI could get wrong (John: drop it on desktop
            like mobile). The recap/headline still exist on the payload for OG/social. The lead
            story instead gets front-page TYPE SCALE (see headlineFont above). */}

        {wide ? (
          /* two tracks: the editorial column + the rail. Rail modules (guests, most-active,
             trials) use their narrow/stacked arrangements; evidence still expands inline. */
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", columnGap: 46, alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              {storiesSection}
              {episodesSection}
              {papersSection}
              {drugsSection}
            </div>
            <aside style={{ minWidth: 0 }}>
              {guestsSection}
              {kolsSection}
              {trialsSection}
            </aside>
          </div>
        ) : (
          <>
            {storiesSection}
            {guestsSection}
            {kolsSection}
            {episodesSection}
            {papersSection}
            {trialsSection}
            {drugsSection}
          </>
        )}

        {/* footer — the positioning line lives here (end of the read), not stacked on the masthead */}
        <div style={{ textAlign: "center", marginTop: 40, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ font: "500 15px/1 'Newsreader',Georgia,serif", color: "rgba(255,255,255,.6)", letterSpacing: "-.01em" }}>The Readout</div>
          <div style={{ font: "400 12px/1.55 system-ui", color: "rgba(255,255,255,.4)", marginTop: 12, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>Signal from oncology&rsquo;s verified voices — identified clinicians and expert, physician-led podcasts. No bots, no anonymous accounts.</div>
        </div>
      </div>
    </div>
  );
}

const statTile: React.CSSProperties = { background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.08)", borderTop: "1px solid rgba(255,255,255,.14)", borderRadius: 11, padding: "8px 11px", minWidth: 56 };
const statTileLabel: React.CSSProperties = { font: "600 8px system-ui", letterSpacing: ".09em", textTransform: "uppercase", color: "#7d89a8", marginTop: 5 };

// Section header as a real h2, flanked by area-accent hairlines (the landmark the long
// scroll was missing). Rail variant is left-aligned with a single trailing rule.
function SectionHead({ children, id, accent, rail = false }: { children: React.ReactNode; id?: string; accent: string; rail?: boolean }) {
  return (
    <h2 id={id} style={{ display: "flex", alignItems: "center", gap: 14, margin: rail ? "54px 0 10px" : "54px 0 18px", scrollMarginTop: 66 }}>
      {!rail && <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${accent}42)` }} />}
      <span style={{ font: "700 12.5px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#b6bccb" }}>{children}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}42, transparent)` }} />
    </h2>
  );
}
