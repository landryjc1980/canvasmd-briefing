"use client";

import { Fragment, useState } from "react";
import { BriefingData, BriefingArticle } from "@/lib/types";
// Reuse the exact evidence machinery from the single-area reader so the expand /
// Hide-at-bottom / clips / receipts behave identically everywhere.
import { Row, PodCard, TweetCard, PaperCard, FacePile, evLabel } from "./ReaderView";
import StanceBlock from "./StanceBlock";
import { inkOf, palOf, AREA_FULL, storiesOf, storyKicker, storyMetricLine, pileFaces, cleanArticleTitle, articleSource, isNewsDomain } from "./briefVM";

// "All oncology" — a front page, NOT a merged feed. The lead story from each area,
// grouped by area and shown in its own color, never re-ranked across areas (their
// scores are area-relative — cross-ranking would be dishonest). The one section that
// DOES merge is "what the field is reading": papers ranked by a plain, comparable
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
  const goArea = (a: string) => { const el = document.getElementById(areaId(a)); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 62); };

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
  const reading = [...best.values()].filter((x) => x.p.kolSharers >= 2).sort((x, y) => y.p.kolSharers - x.p.kolSharers).slice(0, 8);

  const wash = "#232a3a"; // a neutral top wash for All (no single area owns the page)

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

        {/* area jump-pills (the section bar, repurposed as area nav) */}
        <div className="all-pills" style={{ display: "flex", gap: 8, flexWrap: compact ? "nowrap" : "wrap", overflowX: compact ? "auto" : "visible", margin: "16px -4px 0", padding: "0 4px", WebkitOverflowScrolling: "touch" }}>
          {AREAS.map((a) => (
            <button key={a} onClick={() => goArea(a)} style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", font: "600 12.5px system-ui", padding: "7px 13px", borderRadius: 9, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)", color: "#cdd2de", whiteSpace: "nowrap", flex: "none" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: palOf(a).accent, flex: "none" }} />{a}
            </button>
          ))}
        </div>

        {/* six area groups */}
        {AREAS.map((a) => {
          const brief = briefsByArea[a];
          const acc = inkOf(a).accent;
          const stories = brief ? storiesOf(brief) : [];
          const lead = stories[0];
          const full = AREA_FULL[a] ?? a;
          return (
            <div key={a} id={areaId(a)} style={{ marginTop: 30, scrollMarginTop: 62 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: acc, flex: "none" }} />
                <span style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#e7eaf2" }}>{full}</span>
                {stories.length > 0 && <span style={{ font: "400 11px system-ui", color: MUT2 }}>· {stories.length} {stories.length === 1 ? "story" : "stories"}</span>}
                <button onClick={() => onArea(a)} style={{ marginLeft: "auto", background: "none", border: 0, cursor: "pointer", font: "600 12px system-ui", color: acc }}>Full {a} brief →</button>
              </div>
              {lead ? (() => {
                const id = "all:" + a;
                const open = openId === id;
                const faces = pileFaces(lead);
                return (
                  <div style={{ background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)", borderTop: "1px solid rgba(255,255,255,.15)", borderLeft: `3px solid ${acc}`, borderRadius: 15, padding: "0 20px" }}>
                    <Row open={open} onToggle={() => toggle(id)} accent={acc}
                      head={
                        <div style={{ padding: "18px 2px" }}>
                          <div style={{ font: "700 9.5px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: acc, marginBottom: 7 }}>{storyKicker(lead)}</div>
                          <h3 style={{ font: `500 ${compact ? 20 : 21}px/1.18 'Newsreader',Georgia,serif`, color: "#f8f9fc", letterSpacing: "-.005em", margin: 0 }}>{lead.headline}</h3>
                          {lead.subtitle && <div style={{ font: "500 11.5px system-ui", color: MUT, marginTop: 6 }}>{lead.subtitle}</div>}
                          {lead.description && <p style={{ margin: "10px 0 0", font: "400 13.5px/1.5 system-ui", color: "#aab0bf", ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{lead.description}</p>}
                          <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            {faces.length > 0 && <FacePile faces={faces} extra={0} ring={INK} />}
                            <span style={{ font: "400 12px system-ui", color: MUT }}>{storyMetricLine(lead)}</span>
                            {!open && <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", font: "600 12px system-ui", color: acc, border: `1px solid ${acc}59`, background: `${acc}17`, borderRadius: 20, padding: "5px 12px", whiteSpace: "nowrap" }}>Evidence ↓</span>}
                          </div>
                        </div>
                      }>
                      <StanceBlock stance={lead.stance} accent={acc} />
                      {lead.podcast.length > 0 && <div><div style={evLabel(acc)}>On the podcasts</div>{lead.podcast.map((p, j) => <PodCard key={j} p={p} accent={acc} />)}</div>}
                      {lead.posts.length > 0 && <div><div style={evLabel(acc)}>On X · verified clinicians</div>{lead.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
                      {lead.papers.length > 0 && <div><div style={evLabel(acc)}>{lead.kind === "paper" ? "The paper" : "Papers"}</div>{lead.papers.map((p, j) => <PaperCard key={j} title={p.title} journal={p.journal} domain={p.domain} url={p.url} abstract={p.abstract} posts={p.posts?.length ? p.posts : p.sharers} accent={acc} />)}</div>}
                    </Row>
                  </div>
                );
              })() : (
                <div style={{ font: "400 13.5px/1.5 system-ui", color: MUT, padding: "2px 2px 4px" }}>Quiet week in {full}. <button onClick={() => onArea(a)} style={{ background: "none", border: 0, cursor: "pointer", font: "600 13.5px system-ui", color: acc, padding: 0 }}>See the full brief →</button></div>
              )}
            </div>
          );
        })}

        {/* the ONE merged section — honest by a comparable count */}
        {reading.length > 0 && (
          <div style={{ marginTop: 40, paddingTop: 26, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ font: "700 12px system-ui", letterSpacing: ".15em", textTransform: "uppercase", color: "#cdd2de" }}>What the field is reading</span>
              <span style={{ font: "400 11.5px system-ui", color: MUT2 }}>· across oncology · ranked by clinicians who shared it</span>
            </div>
            {reading.map(({ p, area }, i) => {
              const acc = inkOf(area).accent;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "14px 2px", borderBottom: i < reading.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                  <span style={{ font: "700 8px system-ui", letterSpacing: ".05em", textTransform: "uppercase", color: INK, background: acc, borderRadius: 4, padding: "3px 6px", flex: "none", marginTop: 3 }}>{area}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {p.url
                      ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ font: "500 15px/1.32 'Newsreader',Georgia,serif", color: "#f2f4fa", textDecoration: "none", display: "block" }}>{cleanArticleTitle(p.title)}</a>
                      : <div style={{ font: "500 15px/1.32 'Newsreader',Georgia,serif", color: "#f2f4fa" }}>{cleanArticleTitle(p.title)}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, font: "400 11.5px system-ui", color: MUT }}>
                      <span>{articleSource(p.journal, p.domain)}</span>
                      {isNewsDomain(p.domain) && !p.journal && <span style={{ font: "700 8px system-ui", letterSpacing: ".08em", color: "rgba(255,255,255,.55)", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 5, padding: "1.5px 5px" }}>News</span>}
                    </div>
                  </div>
                  <div style={{ flex: "none", textAlign: "right" }}>
                    <div style={{ font: "600 18px/1 'Newsreader',Georgia,serif", color: "#eef1f8", fontVariantNumeric: "tabular-nums" }}>{p.kolSharers}</div>
                    <div style={{ font: "600 8px system-ui", letterSpacing: ".06em", textTransform: "uppercase", color: MUT2, marginTop: 4 }}>{p.kolSharers === 1 ? "Clinician" : "Clinicians"}</div>
                  </div>
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
