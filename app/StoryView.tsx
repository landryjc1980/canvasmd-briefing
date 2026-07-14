"use client";

import { useEffect, useRef, useState } from "react";
import { BriefingData, BriefingMover, BriefingStory, BriefingSharer, BriefingPod, BriefingPaper, BriefingStance } from "@/lib/types";
import { palOf, barSegmentsRaw, metricsLine, storyMetricLine, storyKicker, storiesOf, partitionStories, articleSource, isNewsDomain, cleanArticleTitle, clipTs, AREA_FULL, UP, DOWN } from "./briefVM";
import RecapBlock from "./RecapBlock";
import StanceBlock from "./StanceBlock";
import { shareBrief, logStorySeen } from "./gateClient";
import "./design.css";

// "The 90-Second Brief" — the mobile Weekly Brief as a full-screen swipeable story
// (Instagram-Stories mechanics): one drug per screen, segmented autoplay progress,
// tap sides / swipe to navigate, chapter chips, a bottom sheet for full evidence.
// Fed by the real BriefingData. Renders on phones (page.tsx picks by viewport).

const DWELL = 6000;
const PEEK_H = 176; // collapsed story evidence peeks this tall — a real chunk of the top card(s), fading out
const ini = (s: string) => (s || "?").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";

type Screen = { kind: "intro" | "events" | "story" | "caughtup" | "kols" | "papers" | "trials" | "drugs"; si?: number; chapter: string };

function Delta({ delta }: { delta: number }) {
  if (!delta) return <span title="No change vs. the prior two weeks" style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.4)", font: "700 11px system-ui", padding: "3px 10px", borderRadius: 20 }}>— flat</span>;
  const up = delta > 0, c = up ? UP : DOWN;
  return <span title="Net change in evidence (episodes + X sharers + papers) vs. the prior two weeks" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.fg, font: "700 11px system-ui", padding: "3px 10px", borderRadius: 20 }}>{(up ? "▲ " : "▼ ") + Math.abs(delta)}</span>;
}
const cardBox: React.CSSProperties = { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 13, padding: 14, marginBottom: 9 };
const evLabel = (accent: string): React.CSSProperties => ({ font: "600 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 11 });
const fmtT = (s: number) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};
// Day-granular relative age for the regulatory log (events carry a date-only occurredOn),
// so a 12-day-old approval reads "12d ago" instead of a bare date the user has to decode.
const agoDay = (ymd?: string | null) => {
  if (!ymd) return "";
  const d = Math.round((Date.now() - new Date(`${ymd.slice(0, 10)}T00:00:00Z`).getTime()) / 86400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
};

// One KOL tweet — links to X if we have the url. Self-contained (stops its own
// propagation) so it works inside the sheet, paper expansions, etc.
function TweetCard({ t }: { t: BriefingSharer }) {
  const body = (<>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.12)", color: "#f4f7ff", font: "600 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{t.avatar ? <img src={t.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(t.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}><span style={{ font: "600 13px system-ui", color: "#eef1f8" }}>{t.name}</span> {t.handle && <span style={{ font: "400 11.5px system-ui", color: "#7c7f88" }}>@{t.handle}</span>}</div>
      {t.likes > 0 && <span style={{ font: "600 11px system-ui", color: "#ff8fa8" }}>♥ {t.likes}</span>}
    </div>
    {t.text && <p style={{ margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#cbcdd5" }}>{t.text}</p>}
  </>);
  return t.tweetUrl
    ? <a href={t.tweetUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ ...cardBox, display: "block", textDecoration: "none" }}>{body}</a>
    : <div onClick={(e) => e.stopPropagation()} style={cardBox}>{body}</div>;
}

// A paper card that expands INLINE to reveal the abstract AND the clinicians' tweets
// about it (so readers don't have to leave). The ↗ still opens the source.
function PaperCard({ title, journal, domain, meta, url, abstract, posts, accent }: { title: string; journal: string | null; domain?: string | null; meta?: string; url?: string; abstract?: string | null; posts?: BriefingSharer[]; accent: string }) {
  const [open, setOpen] = useState(false);
  const hasAbs = !!(abstract && abstract.trim());
  const hasPosts = !!(posts && posts.length);
  const canExpand = hasAbs || hasPosts;
  const toggleLabel = open ? "Hide" : hasAbs ? (hasPosts ? "Abstract + posts" : "Read abstract") : "See posts";
  // Source line: journal if we have one, else the news outlet's clean name; a small "News" badge
  // marks a non-journal outlet. No "via <publisher>" — the source name already answers "from where".
  const src = articleSource(journal, domain);
  const isNews = isNewsDomain(domain) && !journal;
  return (
    <div onClick={(e) => e.stopPropagation()} style={cardBox}>
      {/* whole header taps to expand (was a dead zone — abstract hid behind a tiny link) */}
      <div onClick={(e) => { if (canExpand) { e.stopPropagation(); setOpen((o) => !o); } }} style={{ cursor: canExpand ? "pointer" : "default", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "#eef1f8" }}>{cleanArticleTitle(title)}</div>
          {(src || meta) && <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 7 }}>
            <span style={{ font: "400 12px system-ui", color: "#7c7f88" }}>{[src, meta].filter(Boolean).join(" · ")}</span>
            {isNews && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "rgba(255,255,255,.55)", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
          </div>}
        </div>
        {canExpand && <span style={{ font: "700 13px system-ui", color: accent, flex: "none", transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>⌄</span>}
      </div>
      {open && hasAbs && <p style={{ margin: "11px 0 0", font: "400 13.5px/1.55 'Newsreader',Georgia,serif", color: "#c3c6d0" }}>{abstract}</p>}
      {open && hasPosts && <div style={{ marginTop: 12 }}>
        <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent, marginBottom: 9 }}>What clinicians said · {posts!.length}</div>
        {posts!.map((t, i) => <div key={i} style={{ marginTop: i ? 8 : 0 }}><TweetCard t={t} /></div>)}
      </div>}
      <div style={{ display: "flex", gap: 16, marginTop: 11 }}>
        {canExpand && <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "600 12px system-ui", color: accent }}>{toggleLabel}</button>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ font: "600 12px system-ui", color: "rgba(255,255,255,.55)", textDecoration: "none" }}>Open ↗</a>}
      </div>
    </div>
  );
}

// The evidence sheet is generic: movers, KOLs, and trials all open it with their own
// bundle of podcasts / tweets / papers.
type SheetEv = {
  title: string; sub?: string; stance?: BriefingStance | null;
  podcasts?: BriefingPod[]; posts?: BriefingSharer[];
  papers?: { title: string; journal: string | null; domain?: string | null; url?: string; abstract?: string | null; meta?: string; posts?: BriefingSharer[] }[];
};
const moverEv = (m: BriefingMover): SheetEv => ({
  title: m.drug, sub: metricsLine(m), stance: m.stance ?? null,
  podcasts: m.podcast, posts: m.posts,
  papers: m.papers.map((p) => ({ title: p.title, journal: p.journal, domain: p.domain, url: p.url, abstract: p.abstract, meta: `shared by ${p.sharers.length} · ♥ ${p.topLikes}`, posts: p.sharers })),
});
// The evidence sheet for ANY story atom (drug | paper | topic) — same generic bundle.
const storyEv = (s: BriefingStory): SheetEv => ({
  title: s.headline, sub: storyMetricLine(s),
  podcasts: s.podcast, posts: s.posts,
  papers: s.papers.map((p) => {
    const shared = p.sharers.length || p.posts?.length || 0;
    return { title: p.title, journal: p.journal, domain: p.domain, url: p.url, abstract: p.abstract, meta: shared ? `shared by ${shared}${p.topLikes ? ` · ♥ ${p.topLikes}` : ""}` : undefined, posts: p.posts?.length ? p.posts : p.sharers };
  }),
});

export default function StoryView({ data, area, areas, onArea, seen }: { data: BriefingData; area: string; areas: string[]; onArea: (a: string) => void; seen?: Record<string, string> }) {
  const pal = palOf(area);

  // Top Stories = the atom-agnostic hero (drug|paper|topic); falls back to drug movers so
  // the hero always renders even on an old snapshot without topStories.
  // "Since your last read": returning readers get NEW/UPDATED stories first, then a caught-up
  // interstitial, then the ones they've already read (editorial order inside each half).
  const part = partitionStories(storiesOf(data), seen);
  const stories = part.ordered;

  // Build the ordered screen list (skip empty sections). "Drugs" is the relocated ranked
  // movers board — a sibling to Trials, so the full drug overview isn't lost.
  const screens: Screen[] = [{ kind: "intro", chapter: "Intro" }];
  stories.forEach((_, i) => {
    if (part.mode === "split" && i === part.freshCount) screens.push({ kind: "caughtup", chapter: "Top Stories" });
    screens.push({ kind: "story", si: i, chapter: "Top Stories" });
  });
  // Regulatory log sits AFTER the stories — it's reference (approvals/trial updates up to 30d),
  // not the freshest headline, so it must not be the first thing a user swipes into.
  if (data.events.length) screens.push({ kind: "events", chapter: "Updates" });
  if (data.topKols.length) screens.push({ kind: "kols", chapter: "KOLs" });
  if (data.topArticles.length) screens.push({ kind: "papers", chapter: "Papers" });
  if (data.trials.length) screens.push({ kind: "trials", chapter: "Trials" });
  if (data.movers.length) screens.push({ kind: "drugs", chapter: "Drugs" });

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false); // autoplay is OFF until "Start the brief" / play
  const [hint, setHint] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false); // header area-switcher dropdown
  const [shareMsg, setShareMsg] = useState(""); // transient "Link copied" toast after a share
  const doShare = async () => {
    const r = await shareBrief();
    setShareMsg(r === "copied" ? "Link copied — send it to a colleague" : r === "error" ? "Couldn't create a share link" : "");
    if (r !== "shared") setTimeout(() => setShareMsg(""), 2600);
  };
  const [sheet, setSheet] = useState<SheetEv | null>(null);
  const [expanded, setExpanded] = useState(false); // story evidence expanded inline (replaces the sheet on story screens)
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null); // for swipe axis-lock so vertical scroll of expanded evidence never advances
  // swipe-down-to-dismiss for the evidence sheet (only when its content is scrolled to top)
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const sheetTouchY = useRef<number | null>(null);
  const [sheetDrag, setSheetDrag] = useState(0);

  // ONE persistent <audio> for the whole story (mounted at the root, below), so a
  // clip keeps playing when you close the sheet or move between screens.
  const audioRef = useRef<HTMLAudioElement>(null);
  const [clipId, setClipId] = useState<string | null>(null);
  const [clipLabel, setClipLabel] = useState<string>("");
  const [clipOn, setClipOn] = useState(false);
  const [clipCur, setClipCur] = useState(0);
  const [clipDur, setClipDur] = useState(0);
  const playClip = (url: string, startMs: number | null, id: string, label: string) => {
    const el = audioRef.current;
    if (!el) return;
    const at = startMs != null ? Math.max(0, Math.floor(startMs / 1000)) : 0;
    if (clipId === id) { el.paused ? el.play().catch(() => {}) : el.pause(); return; } // same clip → toggle
    setClipId(id); setClipLabel(label); setClipCur(0); setClipDur(0);
    el.src = at > 0 ? `${url}#t=${at}` : url;
    el.load();
    const seekPlay = () => {
      try { if (Math.abs(el.currentTime - at) > 1.5) el.currentTime = at; } catch { /* no range support */ }
      el.play().catch(() => {});
      el.removeEventListener("loadedmetadata", seekPlay);
    };
    el.addEventListener("loadedmetadata", seekPlay);
  };
  const toggleClip = () => { const el = audioRef.current; if (el) el.paused ? el.play().catch(() => {}) : el.pause(); };
  const stopClip = () => { const el = audioRef.current; if (el) { el.pause(); el.removeAttribute("src"); el.load(); } setClipId(null); setClipOn(false); setClipCur(0); setClipDur(0); };

  // reset when the area (data) changes
  useEffect(() => { setIdx(0); setSheet(null); setPlaying(false); }, [area]);
  useEffect(() => { setSheetDrag(0); }, [sheet]);
  useEffect(() => { setExpanded(false); }, [idx]); // collapse inline evidence when the screen changes
  useEffect(() => { const t = setTimeout(() => setHint(false), 3500); return () => clearTimeout(t); }, []);

  const go = (dir: number) => { setSheet(null); setIdx((i) => Math.max(0, Math.min(screens.length - 1, i + dir))); };
  const jump = (i: number) => { setSheet(null); setIdx(i); };

  // autoplay — paused while the sheet is open, a clip is playing, OR the story's evidence is
  // expanded inline (so the 6s timer never yanks you off a card you're reading)
  useEffect(() => {
    if (!playing || sheet || clipOn || expanded) return;
    if (idx >= screens.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx((i) => i + 1), DWELL);
    return () => clearTimeout(t);
  }, [idx, playing, sheet, clipOn, expanded, screens.length]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tap = (e: React.MouseEvent) => {
    setHint(false);
    if (expanded) return; // reading inline evidence — a stray tap must not advance the story
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    (e.clientX - r.left) < r.width * 0.3 ? go(-1) : go(1);
  };
  const tStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; touchY.current = e.touches[0].clientY; };
  const tEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = touchY.current == null ? 0 : e.changedTouches[0].clientY - touchY.current;
    touchX.current = null; touchY.current = null;
    // axis-lock: only a decisively HORIZONTAL swipe navigates, so scrolling the expanded
    // evidence (a vertical drag with slight horizontal drift) never advances the story.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { setHint(false); go(dx < 0 ? 1 : -1); }
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // sheet swipe-down: track vertical drag; only "pull" the sheet when its scroll is at the
  // top so normal content scrolling still works. Release past a threshold → dismiss.
  const sheetTStart = (e: React.TouchEvent) => { e.stopPropagation(); sheetTouchY.current = e.touches[0].clientY; };
  const sheetTMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (sheetTouchY.current == null) return;
    const dy = e.touches[0].clientY - sheetTouchY.current;
    if (dy > 0 && (sheetScrollRef.current?.scrollTop ?? 0) <= 0) setSheetDrag(dy);
    else if (sheetDrag !== 0) setSheetDrag(0);
  };
  const sheetTEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const dy = sheetDrag;
    sheetTouchY.current = null;
    if (dy > 90) setSheet(null); else setSheetDrag(0);
  };

  const cur = screens[idx];

  // Story impression — a story counts as SEEN when its screen is actually shown (each story is
  // a full screen here, so screen change = impression). Feeds Since-your-last-read next visit.
  useEffect(() => {
    if (cur?.kind === "story") { const s = stories[cur.si!]; if (s) logStorySeen(area, s.id, s.fp); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, area]);
  const chapters = ["Top Stories", "KOLs", "Papers", "Trials", "Drugs", "Updates"].filter((c) => screens.some((s) => s.chapter === c));

  // ---- card renderers (closures: use the shared player + stop) ----
  const clipBtn = (url: string, startMs: number | null, id: string, label: string) => {
    const active = clipId === id;
    const at = startMs != null ? Math.floor(startMs / 1000) : 0;
    const pct = active && clipDur > 0 ? Math.min(100, (clipCur / clipDur) * 100) : 0;
    return (
      <div onClick={(e) => { stop(e); playClip(url, startMs, id, label); }} style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(255,255,255,.06)", borderRadius: 11, padding: "8px 12px", cursor: "pointer" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: pal.accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          {active && clipOn
            ? <span style={{ display: "flex", gap: 2.5 }}><span style={{ width: 3, height: 11, background: "#101018", borderRadius: 1 }} /><span style={{ width: 3, height: 11, background: "#101018", borderRadius: 1 }} /></span>
            : <span style={{ width: 0, height: 0, borderLeft: "9px solid #101018", borderTop: "6px solid transparent", borderBottom: "6px solid transparent", marginLeft: 2 }} />}
        </div>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,.16)" }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: pal.accent }} /></div>
        <span style={{ font: "600 11px system-ui", color: pal.accent, whiteSpace: "nowrap" }}>{active && clipDur > 0 ? `${fmtT(clipCur)} / ${fmtT(clipDur)}` : `clip @ ${fmtT(at)}`}</span>
      </div>
    );
  };
  const podCard = (p: BriefingPod, key: number | string, compact = false) => (
    <div key={key} onClick={stop} style={cardBox}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "700 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>
          {p.showArt ? <img src={p.showArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(p.show)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "600 13.5px system-ui", color: "#eef1f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.show}</div><div style={{ font: "400 11px system-ui", color: "#7c7f88", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.episodeTitle}</div></div>
      </div>
      {/* on the mover screen we skip the gloss (the "why" above already sums it up); full gloss lives in the evidence sheet */}
      {!compact && <p style={{ margin: "11px 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2" }}>{p.gloss}</p>}
      <div style={{ marginTop: compact ? 11 : 0 }}>
        {p.audioUrl ? clipBtn(p.audioUrl, p.startMs, `${p.audioUrl}:${p.startMs}`, p.show) : <div style={{ font: "600 11px system-ui", color: pal.accent }}>clip {clipTs(p.startMs)}</div>}
      </div>
    </div>
  );
  const sectionHead = (label: string) => <div style={{ font: "600 20px/1.2 system-ui", color: "#f4f7ff", letterSpacing: "-.01em", margin: "6px 0 20px" }}>{label}</div>;
  return (
    <div onClick={tap} onTouchStart={tStart} onTouchEnd={tEnd}
      style={{ position: "fixed", inset: 0, background: pal.bg, overflow: "hidden", userSelect: "none", cursor: "pointer", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", transition: "background .4s ease", overscrollBehavior: "none" }}>
      <div style={{ position: "absolute", top: -70, left: "calc(50% - 220px)", width: 300, height: 300, background: pal.accent, opacity: .16, filter: "blur(80px)", borderRadius: "50%", pointerEvents: "none" }} />

      {/* persistent clip player — survives sheet close + screen changes */}
      <audio ref={audioRef} preload="none"
        onLoadedMetadata={(e) => setClipDur(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setClipCur(e.currentTarget.currentTime)}
        onPlay={() => setClipOn(true)} onPause={() => setClipOn(false)} onEnded={() => setClipOn(false)} />

      {/* centered phone-width column so mid/tablet widths read as a floating story, not full-bleed */}
      <div style={{ position: "relative", height: "100%", width: "min(100vw, 440px)", margin: "0 auto" }}>

      {/* dismiss backdrop for the area dropdown (below the header, above content) */}
      {menuOpen && <div onClick={(e) => { stop(e); setMenuOpen(false); }} style={{ position: "absolute", inset: 0, zIndex: 14 }} />}

      {/* top overlay: header + progress + chapters + controls. Stops clicks AND touches
          so the chrome (esp. the scrollable chapter bar) never triggers page navigation. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 15, padding: "max(12px, env(safe-area-inset-top)) 16px 14px", background: `linear-gradient(to bottom, ${pal.bg} 78%, ${pal.bg}00)` }} onClick={stop} onTouchStart={stop} onTouchEnd={stop} onTouchMove={stop}>
        {/* header — persists on every screen */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          {/* wordmark-only masthead — the serif lockup IS the mark (the pulse icon lives on in the
              favicon/social card, where a wordmark can't go); matches the signed-out gate page.
              Row is TOP-aligned so the area switcher sits level with the WORDMARK line (not the
              taller wordmark+kicker block); the switcher's -5px nudge centers its text on it. */}
          <div onClick={(e) => { stop(e); jump(0); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
            <span style={{ font: "500 20px/1 'Newsreader',Georgia,serif", color: "#fff", letterSpacing: "-.01em" }}>The Readout</span>
            <span style={{ font: "600 7.5px system-ui", letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,255,255,.5)", marginTop: 4 }}>by CanvasMD</span>
          </div>
          <div style={{ position: "relative", marginTop: -5 }}>
            <div onClick={(e) => { stop(e); setMenuOpen((o) => !o); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 2px", cursor: "pointer" }}>
              <span style={{ font: "600 14.5px system-ui", color: "#fff" }}>{AREA_FULL[area] ?? area}</span>
              <span style={{ font: "700 15px system-ui", color: "rgba(255,255,255,.75)", lineHeight: 1 }}>▾</span>
            </div>
            {menuOpen && (
              <div style={{ position: "absolute", top: 38, right: 0, width: 196, background: "rgba(16,18,26,.97)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, boxShadow: "0 20px 44px rgba(0,0,0,.4)", padding: 8, zIndex: 18 }}>
                <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", padding: "6px 11px 8px" }}>Tumor area</div>
                {areas.map((a) => {
                  const on = a === area;
                  return (
                    <div key={a} onClick={(e) => { stop(e); setMenuOpen(false); if (a !== area) onArea(a); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(255,255,255,.1)" : "transparent" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: palOf(a).accent, flex: "none" }} />
                      <span style={{ flex: 1, font: "600 13.5px system-ui", color: on ? "#fff" : "rgba(255,255,255,.75)" }}>{AREA_FULL[a] ?? a}</span>
                      {on && <span style={{ color: pal.accent, font: "700 13px system-ui" }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {/* progress bar + chapter chips + play controls are the mid-brief HUD — hidden on the
            COVER (intro) so it reads as a magazine front, not a dashboard; they appear once you
            tap "Start the brief". */}
        {cur.kind !== "intro" && (<>
        <div style={{ display: "flex", gap: 4 }}>
          {screens.map((s, i) => (
            <div key={i} onClick={() => jump(i)} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,.28)", overflow: "hidden", cursor: "pointer" }}>
              <div style={{ height: "100%", background: "#fff", borderRadius: 2, transformOrigin: "left",
                transform: i < idx ? "scaleX(1)" : i > idx ? "scaleX(0)" : undefined,
                animation: i === idx && playing && !sheet && !clipOn && !expanded ? `wbxgrow ${DWELL}ms linear forwards` : undefined,
                ...(i === idx && (!playing || sheet || clipOn || expanded) ? { transform: "scaleX(.35)" } : {}) }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div className="wbx-noscroll" style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, overflowX: "auto", touchAction: "pan-x" }}>
            {chapters.map((c) => {
              const target = screens.findIndex((s) => s.chapter === c);
              const on = cur.chapter === c;
              return <div key={c} onClick={() => jump(target)} style={{ flex: "none", font: "600 11px system-ui", padding: "5px 11px", borderRadius: 20, whiteSpace: "nowrap", cursor: "pointer", color: on ? pal.bg : "#fff", background: on ? "#fff" : "rgba(255,255,255,.14)" }}>{c}</div>;
            })}
          </div>
          <div onClick={() => setPlaying((p) => !p)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            {playing ? <span style={{ display: "flex", gap: 3 }}><span style={{ width: 3, height: 11, background: "#fff", borderRadius: 1 }} /><span style={{ width: 3, height: 11, background: "#fff", borderRadius: 1 }} /></span>
              : <span style={{ width: 0, height: 0, borderLeft: "9px solid #fff", borderTop: "6px solid transparent", borderBottom: "6px solid transparent", marginLeft: 2 }} />}
          </div>
          <div onClick={() => jump(0)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 15px system-ui", color: "#fff", flex: "none" }}>↺</div>
          <div onClick={(e) => { stop(e); doShare(); }} title="Share with a colleague" style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          </div>
        </div>
        {shareMsg && <div style={{ marginTop: 8, font: "600 12px system-ui", color: pal.bg, background: "#fff", borderRadius: 10, padding: "7px 12px", display: "inline-block" }}>{shareMsg}</div>}
        </>)}
      </div>

      {/* screen body — the cover (intro) needs less top padding since its HUD is hidden */}
      <div key={idx} style={{ position: "absolute", inset: 0, padding: `calc(env(safe-area-inset-top) + ${cur.kind === "intro" ? 70 : 128}px) 24px calc(${clipId ? 92 : 28}px + env(safe-area-inset-bottom))`, display: "flex", flexDirection: "column", animation: "wbxfade .3s ease", overflowY: "auto", overflowX: "hidden" }} className="wbx-noscroll">
        {cur.kind === "intro" && (
          <>
            {/* COVER — area-led. The tumor area is the display title (was a whispered 11px kicker);
                the story-player chrome is gone; credibility drops to a quiet footer. */}
            <div style={{ font: "700 11.5px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>This week in</div>
            <div style={{ font: "400 46px/1.02 'Newsreader',Georgia,serif", color: "#fff", letterSpacing: "-.02em", marginTop: 7 }}>{AREA_FULL[area] ?? area}</div>
            <div style={{ height: 1, background: `linear-gradient(90deg, ${pal.accent}, ${pal.accent}00)`, opacity: .5, margin: "20px 0 0" }} />
            {part.mode === "split" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 20, padding: "6px 13px", font: "600 12.5px system-ui", color: "#fff", alignSelf: "flex-start" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: pal.accent }} />
                {part.freshCount} stor{part.freshCount === 1 ? "y" : "ies"} new since your last read
              </div>
            )}
            {part.mode === "caughtup" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 18, font: "500 12.5px system-ui", color: "rgba(255,255,255,.6)", alignSelf: "flex-start" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
                You&rsquo;re all caught up
              </div>
            )}
            {data.headline && <h1 style={{ font: "400 31px/1.15 'Newsreader',Georgia,serif", color: "#f4f7ff", margin: `${part.mode === "plain" ? 20 : 20}px 0 0`, letterSpacing: "-.01em" }}>{data.headline}</h1>}
            <RecapBlock text={data.recap} accent={pal.accent} size={16.5} lines={4} />
            <div style={{ marginTop: "auto" }}>
              <div onClick={(e) => { stop(e); setPlaying(true); go(1); }} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 18, padding: "15px 20px", cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: pal.bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><div style={{ width: 0, height: 0, borderLeft: "12px solid #fff", borderTop: "8px solid transparent", borderBottom: "8px solid transparent", marginLeft: 3 }} /></div>
                <div><div style={{ font: "700 17px system-ui", color: pal.bg }}>Start the brief</div><div style={{ font: "500 12px system-ui", color: "#7a869e" }}>{stories.length} stor{stories.length === 1 ? "y" : "ies"} · {data.topKols.length} KOL{data.topKols.length === 1 ? "" : "s"}</div></div>
              </div>
              {/* credibility → quiet footer (was a 3-line gray paragraph up top) */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 15, font: "500 11.5px system-ui", color: "rgba(255,255,255,.42)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
                Verified voices only · Updated {ago(data.generatedAt)}
              </div>
            </div>
          </>
        )}

        {cur.kind === "events" && (
          <>
            {sectionHead("Approvals & trial updates")}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.events.map((e, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: 16 }}>
                  <div style={{ font: "600 10px system-ui", letterSpacing: ".1em", textTransform: "uppercase", color: pal.accent }}>{e.type.replace(/_/g, " ")}</div>
                  <div style={{ font: "600 17px/1.28 system-ui", color: "#f4f7ff", margin: "9px 0 6px" }}>{e.title}</div>
                  <div style={{ font: "400 13px system-ui", color: "rgba(255,255,255,.5)" }}>{[e.drug, e.company, agoDay(e.occurredOn)].filter(Boolean).join(" · ")}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ONE reusable story card — same shell for every atom. Only the metric line
            (drug = score + 3-channel bar; paper/topic = text) and the lead evidence adapt. */}
        {cur.kind === "story" && (() => {
          const s = stories[cur.si!];
          const isDrug = s.kind === "drug";
          const hasEv = s.podcast.length + s.posts.length + s.papers.length > 0;
          // NEW / UPDATED chip — only in split mode (a returning reader with a real partition)
          const chip = part.mode === "split" ? part.status.get(s.id) : undefined;
          return (
            <>
              <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 120px)", right: -8, font: "800 190px/0.72 system-ui", color: "rgba(255,255,255,.05)", pointerEvents: "none" }}>{cur.si! + 1}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                {(chip === "new" || chip === "updated") && (
                  <span style={{ font: "800 9px system-ui", letterSpacing: ".1em", color: pal.bg, background: chip === "new" ? pal.accent : "#fff", borderRadius: 5, padding: "3px 7px" }}>{chip === "new" ? "NEW" : "UPDATED"}</span>
                )}
                <span style={{ font: "600 10px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>{storyKicker(s)}</span>
              </div>
              <div style={{ font: isDrug ? "700 31px/1.12 system-ui" : "500 27px/1.2 'Newsreader',Georgia,serif", color: "#f4f7ff", letterSpacing: "-.01em", position: "relative", marginTop: 9 }}>{s.headline}</div>
              {(s.subtitle || (isDrug && s.delta !== 0)) && (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 7 }}>
                  {s.subtitle && <span style={{ font: "500 14px system-ui", color: "rgba(255,255,255,.6)" }}>{s.subtitle}</span>}
                  {isDrug && s.delta !== 0 && <Delta delta={s.delta} />}
                </div>
              )}
              {/* Score + area-rank live on the Drugs board (where the ranking is the point), NOT
                  here — a numeric "#1" on a mid-deck Top Story conflicts with the swipe position and
                  only drug atoms have it. The evidence-mix bar stays (it pairs with the metric line). */}
              {isDrug && (
                <div style={{ width: "100%", maxWidth: 240, height: 6, borderRadius: 4, display: "flex", gap: 2, overflow: "hidden", marginTop: 16 }}>
                  {barSegmentsRaw(s.bar).map((seg, i) => <div key={i} style={{ flex: seg.flex, background: pal.accent, opacity: seg.opacity, borderRadius: 4 }} />)}
                </div>
              )}
              {/* metric line — INFORMATIONAL ONLY. It used to toggle expand, but as an inline-flex
                  element sitting in the card's tap-to-advance flow (right above the description) its
                  hit-box clipped advance taps "sometimes" → accidental expand. Evidence now opens
                  solely via the dedicated summary-row button below, so every card-body tap navigates. */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "400 12.5px system-ui", color: "rgba(255,255,255,.62)", marginTop: isDrug ? 10 : 14, pointerEvents: "none" }}>
                <span>{storyMetricLine(s)}</span>
              </div>
              {s.description && <p style={{ font: "400 17px/1.34 'Newsreader',Georgia,serif", color: "#eaf0ff", margin: "14px 0 0" }}>{s.description}</p>}
              {/* How the field is reacting — shared component; self-suppresses under 4 opinions. */}
              <StanceBlock stance={s.stance} accent={pal.accent} style={{ marginTop: 16 }} />
              {/* Evidence as ONE continuous stack. Collapsed = a peek: clipped to PEEK_H with a
                  fade to the screen bg + a "what's here" row. Expanding happens ONLY via the two
                  explicit affordances (metric-line chevron + the summary row below) — the peek
                  container itself must NOT capture taps, or tap-to-advance dies on evidence-heavy
                  cards (the peek owns the bottom third of the screen). Card taps (clip/link/
                  abstract) stopPropagation themselves; dead-space taps bubble to the nav zones.
                  (autoplay + progress pause while expanded so you can read it — no sheet.) */}
              {hasEv && (() => {
                const ev = storyEv(s);
                const more: string[] = [];
                if (ev.podcasts?.length) more.push(`${ev.podcasts.length} clip${ev.podcasts.length === 1 ? "" : "s"}`);
                if (ev.posts?.length) more.push(`${ev.posts.length} take${ev.posts.length === 1 ? "" : "s"}`);
                if (ev.papers?.length) more.push(`${ev.papers.length} paper${ev.papers.length === 1 ? "" : "s"}`);
                return (
                  <div style={{ marginTop: expanded ? 18 : "auto", paddingTop: 16 }}>
                    <div style={{ position: "relative", maxHeight: expanded ? undefined : PEEK_H, overflow: expanded ? undefined : "hidden" }}>
                      {!!ev.podcasts?.length && <div style={{ marginBottom: 8 }}><div style={evLabel(pal.accent)}>On the podcasts</div>{ev.podcasts.map((p, j) => podCard(p, "ie" + j))}</div>}
                      {!!ev.posts?.length && <div style={{ marginBottom: 8 }}><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{ev.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                      {!!ev.papers?.length && <div><div style={evLabel(pal.accent)}>Papers</div>{ev.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} meta={p.meta} url={p.url} abstract={p.abstract} posts={p.posts} accent={pal.accent} />)}</div>}
                      {!expanded && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 58, background: `linear-gradient(to bottom, ${pal.bg}00, ${pal.bg})`, pointerEvents: "none" }} />}
                    </div>
                    <div onClick={(e) => { stop(e); setExpanded((v) => !v); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, padding: "12px 18px", borderRadius: 12, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", font: "700 13px system-ui", color: expanded ? "#fff" : pal.accent }}>
                      <span>{expanded ? "Hide" : (more.join(" · ") || "The signal")}</span>
                      <svg width="13" height="13" viewBox="0 0 14 14" style={{ flex: "none", transform: expanded ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
                        <path d="M2.5 5 L7 9.5 L11.5 5" stroke={expanded ? "#fff" : pal.accent} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                );
              })()}
            </>
          );
        })()}

        {/* caught-up interstitial — the honest divider between what's new for THIS reader and
            the stories they've already read (which follow, so completists can continue). */}
        {cur.kind === "caughtup" && (
          <div style={{ margin: "auto 0", textAlign: "center", padding: "0 8px" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(255,255,255,.1)", border: `2px solid ${pal.accent}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={pal.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 L10 18 L19.5 6.5" /></svg>
            </div>
            <div style={{ font: "500 24px/1.2 'Newsreader',Georgia,serif", color: "#f4f7ff", marginTop: 20 }}>You&rsquo;re all caught up</div>
            <div style={{ font: "400 14.5px/1.5 system-ui", color: "rgba(255,255,255,.6)", marginTop: 10 }}>
              {stories.length - part.freshCount} stor{stories.length - part.freshCount === 1 ? "y" : "ies"} you&rsquo;ve already read {stories.length - part.freshCount === 1 ? "is" : "are"} next — plus the rest of the brief.
            </div>
          </div>
        )}

        {cur.kind === "kols" && (
          <>
            {sectionHead("Most active on X")}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {data.topKols.slice(0, 10).map((k, i) => {
                const hasEv = k.posts.length + k.articles.length > 0;
                return (
                  <div key={i} onClick={(e) => { if (hasEv) { stop(e); setSheet({ title: k.name, sub: k.handle ? `@${k.handle}` : undefined, posts: k.posts, papers: k.articles.map((a) => ({ title: a.title, journal: a.journal, domain: a.domain, url: a.url })) }); } }}
                    style={{ display: "flex", alignItems: "center", gap: 13, padding: "9px 0", cursor: hasEv ? "pointer" : "default" }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "600 13px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{k.avatar ? <img src={k.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(k.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 16px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{k.name}</div>{k.institution && <div style={{ font: "400 11px system-ui", color: "rgba(255,255,255,.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.institution}</div>}<div style={{ font: "400 12px system-ui", color: "rgba(255,255,255,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.drugs.slice(0, 3).join(" · ") || (k.handle ? "@" + k.handle : "")}</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                      <span style={{ font: "600 12px system-ui", color: pal.accent }}>{k.tweets} post{k.tweets === 1 ? "" : "s"}</span>
                      {hasEv && <span style={{ font: "700 13px system-ui", color: pal.accent, lineHeight: 1 }}>›</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {cur.kind === "papers" && (
          <>
            {sectionHead("What’s being read")}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.topArticles.slice(0, 12).map((a, i) => <PaperCard key={i} title={a.title} journal={a.journal} domain={a.domain} meta={a.kolSharers ? `shared by ${a.kolSharers} clinician${a.kolSharers === 1 ? "" : "s"}` : undefined} url={a.url} abstract={a.abstract} posts={a.posts} accent={pal.accent} />)}
            </div>
          </>
        )}

        {cur.kind === "trials" && (
          <>
            {sectionHead("Trials being discussed")}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.trials.slice(0, 10).map((t, i) => {
                const hasEv = t.pods.length + t.posts.length + t.articles.length > 0;
                const parts: string[] = [];
                if (t.podMentions) parts.push(`${t.podMentions} podcast${t.podMentions === 1 ? "" : "s"}`);
                if (t.xMentions) parts.push(`${t.xMentions} tweet${t.xMentions === 1 ? "" : "s"}`);
                if (t.articleMentions) parts.push(`${t.articleMentions} paper${t.articleMentions === 1 ? "" : "s"}`);
                return (
                  <div key={i} onClick={(e) => { if (hasEv) { stop(e); setSheet({ title: t.acronym || t.nctId, sub: t.title, podcasts: t.pods, posts: t.posts, papers: t.articles.map((p) => ({ title: p.title, journal: p.journal, domain: p.domain, url: p.url, abstract: p.abstract, meta: `shared by ${p.sharers.length}`, posts: p.sharers })) }); } }}
                    style={{ borderTop: "1px solid rgba(255,255,255,.1)", padding: "13px 0", display: "flex", alignItems: "flex-start", gap: 10, cursor: hasEv ? "pointer" : "default" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "500 16px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{t.acronym || t.nctId}</div>
                      <div style={{ font: "400 12.5px system-ui", color: "rgba(255,255,255,.5)", marginTop: 3 }}>{t.title}</div>
                      {parts.length > 0 && <div style={{ font: "400 11.5px system-ui", color: "rgba(255,255,255,.4)", marginTop: 4 }}>discussed in {parts.join(" · ")}</div>}
                    </div>
                    {hasEv && <span style={{ font: "700 13px system-ui", color: pal.accent, lineHeight: 1, marginTop: 4, flex: "none" }}>›</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Drugs — the full ranked drug board, relocated so the drug overview isn't lost.
            Each row opens that drug's evidence sheet. */}
        {cur.kind === "drugs" && (
          <>
            {sectionHead("Drugs")}
            <div style={{ font: "400 13px system-ui", color: "rgba(255,255,255,.5)", margin: "-14px 0 18px" }}>The full ranked drug board · {AREA_FULL[area] ?? area}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.movers.map((m, i) => {
                const hasEv = m.podcast.length + m.posts.length + m.papers.length > 0;
                return (
                  <div key={i} onClick={(e) => { if (hasEv) { stop(e); setSheet(moverEv(m)); } }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderTop: "1px solid rgba(255,255,255,.09)", cursor: hasEv ? "pointer" : "default" }}>
                    <span style={{ font: "500 16px 'Newsreader',Georgia,serif", color: i === 0 ? pal.accent : "#6f727c", width: 22, flex: "none" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "500 16px system-ui", color: "#f4f7ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.drug}</div>
                      {metricsLine(m) && <div style={{ font: "400 11.5px system-ui", color: "rgba(255,255,255,.42)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{metricsLine(m)}</div>}
                    </div>
                    <span style={{ font: "700 18px system-ui", color: pal.accent, flex: "none" }}>{m.score}</span>
                    <Delta delta={m.delta} />
                    {hasEv && <span style={{ font: "700 13px system-ui", color: pal.accent, lineHeight: 1, flex: "none" }}>›</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* bottom sheet: full evidence */}
      {sheet && (
        <div onClick={(e) => { stop(e); setSheet(null); }} style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end" }}>
          <div ref={sheetScrollRef} onClick={stop} onTouchStart={sheetTStart} onTouchMove={sheetTMove} onTouchEnd={sheetTEnd} className="wbx-noscroll"
            style={{ position: "relative", width: "100%", maxHeight: "88%", overflowY: "auto", overscrollBehavior: "contain", background: pal.bg, borderRadius: "22px 22px 0 0", padding: "0 20px calc(24px + env(safe-area-inset-bottom))", animation: sheetDrag ? undefined : "wbxsheet .3s ease", boxShadow: "0 -20px 60px rgba(0,0,0,.5)", transform: sheetDrag ? `translateY(${sheetDrag}px)` : undefined, transition: sheetDrag ? "none" : "transform .25s ease" }}>
            {/* sticky grabber + close — pinned so the ✕ is always reachable while scrolling */}
            <div style={{ position: "sticky", top: 0, zIndex: 3, background: pal.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0 12px", margin: "0 -20px", }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,.25)" }} />
              <div onClick={(e) => { stop(e); setSheet(null); }} aria-label="Close" style={{ position: "absolute", right: 14, top: 6, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", font: "600 14px system-ui" }}>✕</div>
            </div>
            <div style={{ font: "600 20px 'Newsreader',Georgia,serif", color: "#f4f7ff", marginBottom: sheet.sub ? 4 : 16 }}>{sheet.title}</div>
            {sheet.sub && <div style={{ font: "400 12.5px system-ui", color: "rgba(255,255,255,.5)", marginBottom: 18 }}>{sheet.sub}</div>}
            {/* stance at the TOP of the drug evidence — the field's read before the raw evidence */}
            <StanceBlock stance={sheet.stance} accent={pal.accent} style={{ marginBottom: 18 }} />
            {!!sheet.podcasts?.length && <div style={{ marginBottom: 8 }}><div style={evLabel(pal.accent)}>On the podcasts</div>{sheet.podcasts.map((p, j) => podCard(p, j))}</div>}
            {!!sheet.posts?.length && <div style={{ marginBottom: 8 }}><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{sheet.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
            {!!sheet.papers?.length && <div><div style={evLabel(pal.accent)}>Papers</div>{sheet.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} meta={p.meta} url={p.url} abstract={p.abstract} posts={p.posts} accent={pal.accent} />)}</div>}
            <div onClick={(e) => { stop(e); setSheet(null); }} style={{ textAlign: "center", marginTop: 14, font: "600 13px system-ui", color: pal.accent, cursor: "pointer" }}>Close</div>
          </div>
        </div>
      )}

      {/* persistent now-playing bar — pause / stop the clip from any screen */}
      {clipId && (
        <div onClick={stop} style={{ position: "absolute", left: 12, right: 12, bottom: "calc(14px + env(safe-area-inset-bottom))", zIndex: 22, display: "flex", alignItems: "center", gap: 11, background: "rgba(14,17,26,.9)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 15, padding: "9px 10px 9px 9px", boxShadow: "0 12px 34px rgba(0,0,0,.45)" }}>
          <div onClick={(e) => { stop(e); toggleClip(); }} style={{ width: 34, height: 34, borderRadius: "50%", background: pal.accent, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", cursor: "pointer" }}>
            {clipOn
              ? <span style={{ display: "flex", gap: 2.5 }}><span style={{ width: 3, height: 12, background: "#101018", borderRadius: 1 }} /><span style={{ width: 3, height: 12, background: "#101018", borderRadius: 1 }} /></span>
              : <span style={{ width: 0, height: 0, borderLeft: "10px solid #101018", borderTop: "6px solid transparent", borderBottom: "6px solid transparent", marginLeft: 2 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 12.5px system-ui", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clipLabel || "Now playing"}</div>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.18)", marginTop: 5 }}><div style={{ width: `${clipDur > 0 ? Math.min(100, (clipCur / clipDur) * 100) : 0}%`, height: "100%", borderRadius: 2, background: pal.accent }} /></div>
          </div>
          <span style={{ font: "600 10.5px system-ui", color: "rgba(255,255,255,.5)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtT(clipCur)}</span>
          <div onClick={(e) => { stop(e); stopClip(); }} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", cursor: "pointer", color: "#fff", font: "600 13px system-ui" }}>✕</div>
        </div>
      )}

      {/* coach mark */}
      {hint && (
        <div style={{ position: "absolute", left: "50%", bottom: "calc(28px + env(safe-area-inset-bottom))", zIndex: 16, background: "rgba(12,15,24,.74)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 22, padding: "10px 17px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 22px rgba(0,0,0,.34), inset 0 0 0 1px rgba(255,255,255,.16)", pointerEvents: "none", animation: "wbxhint 3.4s ease forwards", whiteSpace: "nowrap" }}>
          <span style={{ font: "400 17px system-ui", color: "#fff" }}>‹</span>
          <span style={{ font: "600 12.5px system-ui", color: "#fff" }}>tap the sides or swipe</span>
          <span style={{ font: "400 17px system-ui", color: "#fff" }}>›</span>
        </div>
      )}

      </div>{/* /centered phone column */}
    </div>
  );
}
