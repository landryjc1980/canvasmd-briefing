"use client";

import { useEffect, useState } from "react";
import { BriefingData, BriefingArticle, BriefingStory } from "@/lib/types";
// Reuse the exact evidence machinery from the single-area reader so the expand /
// Hide-at-bottom / clips / receipts behave identically everywhere.
import { Row, PodCard, TweetCard, PaperCard, FacePile, evLabel, paperMeta } from "./ReaderView";
import StanceBlock from "./StanceBlock";
import { inkOf, palOf, AREA_FULL, storiesOf, storyKicker, storyMetricLine, pileFaces, cleanArticleTitle, articleSource, isNewsDomain } from "./briefVM";

// "All oncology" — a front page that reads as ONE continuous scroll: every area's full
// story list, grouped by area and shown in its own color, never re-ranked across areas
// (their scores are area-relative — cross-ranking would be dishonest). The one section
// that DOES merge is "what the field is reading": papers ranked by a plain, comparable
// count (verified clinicians who shared it), which means the same thing in any area.

const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn"];
const INK = "#0D1017";
const MUT = "#9aa2b6";
const MUT2 = "#7e8698";
const areaId = (a: string) => "all-" + a;

export default function AllView({ briefsByArea, areas, onArea, compact = false, primary, onSetPrimary }: {
  briefsByArea: Record<string, BriefingData>;
  areas: string[];
  onArea: (a: string) => void;
  compact?: boolean;
  primary?: string | null;
  onSetPrimary?: (a: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = (id: string) => setOpenId((c) => (c === id ? null : id));
  // The pill bar sticks — glassy chrome only once it actually sticks (same treatment as the
  // tumor pages' section nav), plus scroll-spy so the bar always shows where you are.
  const [stuck, setStuck] = useState(false);
  const [activeSec, setActiveSec] = useState<string>(areaId("GU"));
  useEffect(() => {
    const ids = [...AREAS.map(areaId), "all-reading"];
    let raf = 0;
    const check = () => {
      setStuck(window.scrollY > 120);
      let cur = "";
      for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 90) cur = id; }
      setActiveSec(cur || areaId("GU"));
    };
    check();
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; check(); }); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  // rAF glide (ported from ReaderView.goSec): the FacePile avatars above a jump target lazy-load
  // and shift layout mid-flight, so the target is re-measured every frame; wheel/touch cancels.
  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = 62; // clear the sticky pill bar
    const targetNow = () => el.getBoundingClientRect().top + window.scrollY - offset;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, targetNow()); return; }
    const start = window.scrollY;
    const t0 = performance.now();
    const D = 520;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let raf = 0;
    const cancel = () => { cancelAnimationFrame(raf); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); };
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      window.scrollTo(0, start + (targetNow() - start) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else cancel();
    };
    raf = requestAnimationFrame(step);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
  };
  const goArea = (a: string) => goTo(areaId(a));

  // ---- cross-area reading list: dedupe by title, keep the max clinician-share, rank by it ----
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const best = new Map<string, { p: BriefingArticle; area: string }>();
  for (const a of AREAS) {
    for (const p of briefsByArea[a]?.topArticles ?? []) {
      const k = norm(p.title); if (!k) continue;
      const cur = best.get(k);
      if (!cur || p.kolSharers > cur.p.kolSharers) best.set(k, { p, area: a });
    }
  }
  const reading = [...best.values()].filter((x) => x.p.kolSharers >= 2).sort((x, y) => y.p.kolSharers - x.p.kolSharers).slice(0, 10);

  const wash = "#232a3a"; // a neutral top wash for All (no single area owns the page)

  const evidenceChip = (acc: string) => (
    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", font: "600 12px system-ui", color: acc, border: `1px solid ${acc}59`, background: `${acc}17`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>Evidence ↓</span>
  );

  // One story row — the lead gets the front-page step-up, the rest match the tumor-page
  // rows (number, kicker, 2-line teaser, facts line) so the page is dense but scannable.
  const renderStory = (s: BriefingStory, i: number, a: string, acc: string) => {
    const lead = i === 0;
    const id = `all:${a}:${i}`;
    const open = openId === id;
    const faces = pileFaces(s);
    const headlineFont = lead ? (compact ? "500 20px/1.18" : "500 21px/1.18") : (compact ? "500 17.5px/1.3" : "500 18.5px/1.25");
    return (
      <div key={id} style={{ background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)", ...(lead ? { borderTop: "1px solid rgba(255,255,255,.15)", borderLeft: `3px solid ${acc}` } : {}), borderRadius: 15, padding: "0 20px", marginBottom: 10 }}>
        <Row open={open} onToggle={() => toggle(id)} accent={acc}
          head={
            <div style={{ display: "flex", alignItems: "flex-start", gap: !lead && !compact ? 16 : 0, padding: lead ? "18px 2px" : "15px 2px" }}>
              {!lead && !compact && <div style={{ font: "500 21px/1.1 'Newsreader',Georgia,serif", color: acc, opacity: 0.45, width: 26, flex: "none" }}>{i + 1}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  {!lead && compact && <span style={{ font: "600 13px 'Newsreader',Georgia,serif", color: acc, lineHeight: 1 }}>{i + 1}</span>}
                  <span style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: acc }}>{storyKicker(s)}</span>
                </div>
                <h3 style={{ font: `${headlineFont} 'Newsreader',Georgia,serif`, color: "#f8f9fc", letterSpacing: lead ? "-.005em" : "0", margin: 0 }}>{s.headline}</h3>
                {s.subtitle && <div style={{ font: "500 11.5px system-ui", color: MUT, marginTop: 6 }}>{s.subtitle}</div>}
                {s.description && <p style={{ margin: "9px 0 0", font: "400 13.5px/1.5 system-ui", color: "#aab0bf", ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{s.description}</p>}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {faces.length > 0 && <FacePile faces={faces} extra={0} ring={INK} />}
                  <span style={{ font: "400 12px system-ui", color: MUT }}>{storyMetricLine(s)}</span>
                  {!open && evidenceChip(acc)}
                </div>
              </div>
            </div>
          }>
          <div style={{ marginLeft: !lead && !compact ? 42 : 0, display: "flex", flexDirection: "column", gap: 18 }}>
            <StanceBlock stance={s.stance} accent={acc} />
            {s.podcast.length > 0 && <div><div style={evLabel(acc)}>On the podcasts</div>{s.podcast.map((p, j) => <PodCard key={j} p={p} accent={acc} />)}</div>}
            {s.posts.length > 0 && <div><div style={evLabel(acc)}>On X · verified clinicians</div>{s.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
            {s.papers.length > 0 && <div><div style={evLabel(acc)}>{s.kind === "paper" ? "The paper" : "Papers"}</div>{s.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} meta={paperMeta(p.sharers.length || p.posts?.length || 0, p.topLikes || 0)} url={p.url} abstract={p.abstract} posts={p.posts?.length ? p.posts : p.sharers} accent={acc} />)}</div>}
          </div>
        </Row>
      </div>
    );
  };

  const editionMenu = (
    <div style={{ position: "relative", flex: "none" }}>
      <div role="button" tabIndex={0} aria-expanded={menuOpen} aria-label="Switch tumor area"
        onClick={() => setMenuOpen((o) => !o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMenuOpen((o) => !o); } }}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 13px", cursor: "pointer", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 20 }}>
        <span style={{ font: "600 13.5px system-ui", color: "#fff", whiteSpace: "nowrap" }}>All oncology</span>
        <span style={{ font: "700 11px system-ui", color: "#c7cbd6", lineHeight: 1 }}>▾</span>
      </div>
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", top: "calc(100% + 7px)", left: 0, width: 220, background: "rgba(16,18,26,.97)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, boxShadow: "0 20px 44px rgba(0,0,0,.4)", padding: 8, zIndex: 31 }}>
            <div style={{ font: "600 10px system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", padding: "6px 11px 8px" }}>Tumor area</div>
            {areas.map((a) => {
              const on = a === "All";
              const label = a === "All" ? "All oncology" : (AREA_FULL[a] ?? a);
              const isHome = a === primary;
              return (
                <button key={a} type="button" role="menuitem" aria-current={on} onClick={() => { setMenuOpen(false); if (!on) onArea(a); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(255,255,255,.1)" : "transparent", border: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: a === "All" ? "conic-gradient(from 0deg, #7AA2FF, #F08AA6, #46C7B8, #E2803B, #9B8CFF, #E070C0, #7AA2FF)" : palOf(a).accent }} />
                  <span style={{ flex: 1, font: "600 13.5px system-ui", color: on ? "#fff" : "rgba(255,255,255,.78)" }}>{label}</span>
                  {isHome && <span title="Your default" style={{ color: "rgba(255,255,255,.5)", font: "700 12px system-ui" }}>⌂</span>}
                  {on && <span style={{ color: "#c7cbd6", font: "700 13px system-ui" }}>✓</span>}
                </button>
              );
            })}
            {onSetPrimary && primary !== "All" && (
              <>
                <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "6px 4px" }} />
                <button type="button" onClick={() => { onSetPrimary("All"); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: "transparent", border: 0, color: "#c7cbd6", font: "600 12.5px system-ui" }}>
                  <span aria-hidden style={{ font: "700 13px system-ui" }}>⌂</span>Make All oncology my default
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );

  const generatedAt = briefsByArea.GU?.generatedAt;

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${wash}80 0px, ${wash}22 220px, ${wash}00 460px), ${INK}`, color: "#eef1f8", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <style>{`
        .rv-row{transition:background .16s ease}
        @media(hover:hover){.rv-row:hover{background:rgba(255,255,255,.045)}}
        @media(hover:hover){.rv-row[aria-expanded="true"],.rv-row[aria-expanded="true"]:hover{background:transparent}}
        .rv-row:focus-visible{outline:2px solid rgba(255,255,255,.45);outline-offset:-2px}
        .rv-drawer{animation:rvDrawerIn .26s cubic-bezier(.4,0,.2,1)}
        @keyframes rvDrawerIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        .all-pills::-webkit-scrollbar{display:none}.all-pills{scrollbar-width:none}
        @media(prefers-reduced-motion:reduce){.rv-drawer{animation:none}}
      `}</style>

      <div style={{ maxWidth: compact ? 690 : 760, margin: "0 auto", padding: "34px 26px 120px" }}>
        {/* masthead */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ font: `500 ${compact ? 21 : 24}px/1 'Newsreader',Georgia,serif`, color: "#fff", letterSpacing: "-.01em", margin: 0 }}>The Readout</h1>
          {editionMenu}
        </div>
        <div style={{ font: "600 9.5px system-ui", letterSpacing: ".2em", textTransform: "uppercase", color: MUT2, marginTop: 10 }}>By CanvasMD · Every tumor area{generatedAt ? " · this week" : ""}</div>
        {/* the rainbow rule — the one place that signals "everything" */}
        <div aria-hidden style={{ height: 2, borderRadius: 2, marginTop: 13, background: "linear-gradient(90deg, #7AA2FF, #F08AA6, #46C7B8, #E2803B, #9B8CFF, #E070C0)" }} />

        {/* area jump-pills — sticky with scroll-spy, glass chrome once stuck (tumor-page parity) */}
        <div className="all-pills" style={{ position: "sticky", top: 0, zIndex: 15, display: "flex", gap: 8, flexWrap: compact ? "nowrap" : "wrap", overflowX: compact ? "auto" : "visible", margin: "16px -26px 0", padding: "10px 26px", background: stuck ? `${INK}E0` : "transparent", backdropFilter: stuck ? "blur(10px) saturate(1.15)" : "none", WebkitBackdropFilter: stuck ? "blur(10px) saturate(1.15)" : "none", boxShadow: stuck ? "0 14px 28px -18px rgba(0,0,0,.55)" : "none", transition: "background .2s ease, box-shadow .2s ease", WebkitOverflowScrolling: "touch" }}>
          {AREAS.map((a) => {
            const on = activeSec === areaId(a);
            return (
              <button key={a} onClick={() => goArea(a)} style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", font: "600 12.5px system-ui", padding: "7px 13px", borderRadius: 9, border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.14)"}`, background: on ? "#fff" : "rgba(255,255,255,.04)", color: on ? INK : "#cdd2de", whiteSpace: "nowrap", flex: "none", transition: "background .15s, color .15s" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: palOf(a).accent, flex: "none" }} />{a}
              </button>
            );
          })}
          {/* the merged reading list lives below all six areas — give it a direct jump */}
          {reading.length > 0 && (() => {
            const on = activeSec === "all-reading";
            return (
              <button onClick={() => goTo("all-reading")} style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", font: "600 12.5px system-ui", padding: "7px 13px", borderRadius: 9, border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.14)"}`, background: on ? "#fff" : "rgba(255,255,255,.04)", color: on ? INK : "#cdd2de", whiteSpace: "nowrap", flex: "none", transition: "background .15s, color .15s" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg, #7AA2FF, #E070C0)", flex: "none" }} />Papers
              </button>
            );
          })()}
        </div>

        {/* six area groups — EVERY story in each (one continuous scroll, no clicks to see more) */}
        {AREAS.map((a) => {
          const brief = briefsByArea[a];
          const acc = inkOf(a).accent;
          const stories = brief ? storiesOf(brief) : [];
          const full = AREA_FULL[a] ?? a;
          return (
            <div key={a} id={areaId(a)} style={{ marginTop: 34, scrollMarginTop: 62 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: acc, flex: "none" }} />
                <span style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#e7eaf2" }}>{full}</span>
                {stories.length > 0 && <span style={{ font: "400 11px system-ui", color: MUT2 }}>· {stories.length} {stories.length === 1 ? "story" : "stories"}</span>}
                <button onClick={() => onArea(a)} style={{ marginLeft: "auto", background: "none", border: 0, cursor: "pointer", font: "600 12px system-ui", color: acc }}>Full {a} brief →</button>
              </div>
              {stories.length > 0 ? (
                <>
                  {stories.map((s, i) => renderStory(s, i, a, acc))}
                  {/* the tail: what the full brief adds beyond the stories */}
                  <div style={{ font: "400 12px system-ui", color: MUT2, padding: "2px 2px 0" }}>
                    Drugs board, trials &amp; guests in the <button onClick={() => onArea(a)} style={{ background: "none", border: 0, cursor: "pointer", font: "600 12px system-ui", color: acc, padding: 0 }}>full {full} brief →</button>
                  </div>
                </>
              ) : (
                <div style={{ font: "400 13.5px/1.5 system-ui", color: MUT, padding: "2px 2px 4px" }}>Quiet week in {full}. <button onClick={() => onArea(a)} style={{ background: "none", border: 0, cursor: "pointer", font: "600 13.5px system-ui", color: acc, padding: 0 }}>See the full brief →</button></div>
              )}
            </div>
          );
        })}

        {/* the ONE merged section — honest by a comparable count; rows behave exactly like
            the tumor pages' "What's being read" (expand → abstract + what clinicians said) */}
        {reading.length > 0 && (
          <div id="all-reading" style={{ marginTop: 40, paddingTop: 26, borderTop: "1px solid rgba(255,255,255,.08)", scrollMarginTop: 62 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#cdd2de" }}>What the field is reading</span>
              <span style={{ font: "400 11.5px system-ui", color: MUT2 }}>· across oncology · ranked by clinicians who shared it</span>
            </div>
            {reading.map(({ p, area }, i) => {
              const acc = inkOf(area).accent;
              const id = "r:" + i;
              const open = openId === id;
              return (
                <div key={id} style={{ borderBottom: i < reading.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                  <Row open={open} onToggle={() => toggle(id)} accent={acc}
                    head={
                      <div style={{ padding: "16px 2px" }}>
                        <div style={{ font: "500 16px/1.4 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{cleanArticleTitle(p.title)}</div>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 9 }}>
                          <span style={{ font: "700 8px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: INK, background: acc, borderRadius: 4, padding: "3px 6px", flex: "none" }}>{area}</span>
                          {p.faces.length > 0 && <FacePile faces={p.faces} extra={p.kolSharers - p.faces.length} ring={INK} />}
                          <span style={{ font: "400 12px system-ui", color: MUT }}>{[articleSource(p.journal, p.domain), p.kolSharers ? `shared by ${p.kolSharers} clinician${p.kolSharers === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}</span>
                          {isNewsDomain(p.domain) && !p.journal && <span style={{ font: "700 8.5px system-ui", letterSpacing: ".08em", color: "rgba(255,255,255,.55)", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 5, padding: "1.5px 6px" }}>News</span>}
                          {!open && evidenceChip(acc)}
                        </div>
                      </div>
                    }>
                    {p.abstract && <p style={{ margin: 0, font: "400 15px/1.6 'Newsreader',Georgia,serif", color: "#b7bac3" }}>{p.abstract}</p>}
                    {p.posts.length > 0 && <div><div style={evLabel(acc)}>What clinicians said · {p.posts.length}</div>{p.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                    {/* link to the source — also guarantees the expand is never empty */}
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", font: "600 13px system-ui", color: acc, textDecoration: "none" }}>Open article ↗</a>}
                  </Row>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 44, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ font: "500 15px/1 'Newsreader',Georgia,serif", color: "rgba(255,255,255,.6)" }}>The Readout</div>
          <div style={{ font: "400 12px/1.55 system-ui", color: MUT, marginTop: 12, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>Signal from oncology&rsquo;s verified voices — identified clinicians and expert, physician-led podcasts. Pick an area above to go deep.</div>
        </div>
      </div>
    </div>
  );
}
