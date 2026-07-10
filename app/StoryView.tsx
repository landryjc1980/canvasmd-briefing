"use client";

import { useEffect, useRef, useState } from "react";
import { BriefingData, BriefingMover, BriefingSharer, BriefingPod, BriefingPaper } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { palOf, barSegments, metricsLine, clipTs, heroSplit, UP, DOWN } from "./briefVM";
import "./design.css";

// "The 90-Second Brief" — the mobile Weekly Brief as a full-screen swipeable story
// (Instagram-Stories mechanics): one drug per screen, segmented autoplay progress,
// tap sides / swipe to navigate, chapter chips, a bottom sheet for full evidence.
// Fed by the real BriefingData. Renders on phones (page.tsx picks by viewport).

const DWELL = 6000;
const ini = (s: string) => (s || "?").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";

type Screen = { kind: "intro" | "events" | "mover" | "kols" | "papers" | "trials" | "index"; mi?: number; chapter: string };

function Delta({ delta }: { delta: number }) {
  if (!delta) return null;
  const up = delta > 0, c = up ? UP : DOWN;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: c.bg, color: c.fg, font: "700 11px system-ui", padding: "3px 10px", borderRadius: 20 }}>{(up ? "▲ " : "▼ ") + Math.abs(delta)}</span>;
}
const cardBox: React.CSSProperties = { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 13, padding: 14, marginBottom: 9 };
const evLabel = (accent: string): React.CSSProperties => ({ font: "600 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 11 });

function PodCard({ p, accent }: { p: BriefingPod; accent: string }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "700 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{ini(p.show)}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "600 13.5px system-ui", color: "#eef1f8" }}>{p.show}</div><div style={{ font: "400 11px system-ui", color: "#7c7f88", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.episodeTitle}</div></div>
      </div>
      <p style={{ margin: "11px 0 12px", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#c8cad2" }}>{p.gloss}</p>
      {p.audioUrl ? <AudioQuote audioUrl={p.audioUrl} startMs={p.startMs} label={`clip ${clipTs(p.startMs)}`} /> : <div style={{ font: "600 11px system-ui", color: accent }}>clip {clipTs(p.startMs)}</div>}
    </div>
  );
}
function TweetCard({ t }: { t: BriefingSharer }) {
  return (
    <div style={cardBox}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.12)", color: "#f4f7ff", font: "600 10px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{t.avatar ? <img src={t.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(t.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}><span style={{ font: "600 13px system-ui", color: "#eef1f8" }}>{t.name}</span> {t.handle && <span style={{ font: "400 11.5px system-ui", color: "#7c7f88" }}>@{t.handle}</span>}</div>
        {t.likes > 0 && <span style={{ font: "600 11px system-ui", color: "#ff8fa8" }}>♥ {t.likes}</span>}
      </div>
      {t.text && <p style={{ margin: "9px 0 0", font: "400 14px/1.5 'Newsreader',Georgia,serif", color: "#cbcdd5" }}>{t.text}</p>}
    </div>
  );
}
function PaperCard({ title, journal, meta }: { title: string; journal: string | null; meta?: string }) {
  return (
    <div style={cardBox}>
      <div style={{ font: "500 15px/1.35 'Newsreader',Georgia,serif", color: "#eef1f8" }}>{title}</div>
      {(journal || meta) && <div style={{ font: "400 12px system-ui", color: "#7c7f88", marginTop: 7 }}>{[journal, meta].filter(Boolean).join(" · ")}</div>}
    </div>
  );
}

export default function StoryView({ data, area, areas, onArea }: { data: BriefingData; area: string; areas: string[]; onArea: (a: string) => void }) {
  const pal = palOf(area);
  const hero = heroSplit(data.recap);

  // Build the ordered screen list (skip empty sections).
  const screens: Screen[] = [{ kind: "intro", chapter: "Intro" }];
  if (data.events.length) screens.push({ kind: "events", chapter: "Events" });
  data.movers.forEach((_, i) => screens.push({ kind: "mover", mi: i, chapter: "Movers" }));
  if (data.topKols.length) screens.push({ kind: "kols", chapter: "KOLs" });
  if (data.topArticles.length) screens.push({ kind: "papers", chapter: "Papers" });
  if (data.trials.length) screens.push({ kind: "trials", chapter: "Trials" });
  screens.push({ kind: "index", chapter: "Recap" });

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hint, setHint] = useState(true);
  const [sheet, setSheet] = useState<BriefingMover | null>(null);
  const touchX = useRef<number | null>(null);

  // reset when the area (data) changes
  useEffect(() => { setIdx(0); setSheet(null); setPlaying(true); }, [area]);
  useEffect(() => { const t = setTimeout(() => setHint(false), 3500); return () => clearTimeout(t); }, []);

  const go = (dir: number) => { setSheet(null); setIdx((i) => Math.max(0, Math.min(screens.length - 1, i + dir))); };
  const jump = (i: number) => { setSheet(null); setIdx(i); };

  // autoplay
  useEffect(() => {
    if (!playing || sheet) return;
    if (idx >= screens.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx((i) => i + 1), DWELL);
    return () => clearTimeout(t);
  }, [idx, playing, sheet, screens.length]);

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
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    (e.clientX - r.left) < r.width * 0.3 ? go(-1) : go(1);
  };
  const tStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const tEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 45) { setHint(false); go(dx < 0 ? 1 : -1); }
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const cur = screens[idx];
  const chapters = ["Events", "Movers", "KOLs", "Papers", "Trials", "Recap"].filter((c) => screens.some((s) => s.chapter === c));

  return (
    <div onClick={tap} onTouchStart={tStart} onTouchEnd={tEnd}
      style={{ position: "fixed", inset: 0, background: pal.bg, overflow: "hidden", userSelect: "none", cursor: "pointer", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", transition: "background .4s ease" }}>
      <div style={{ position: "absolute", top: -70, left: "calc(50% - 220px)", width: 300, height: 300, background: pal.accent, opacity: .16, filter: "blur(80px)", borderRadius: "50%", pointerEvents: "none" }} />

      {/* centered phone-width column so mid/tablet widths read as a floating story, not full-bleed */}
      <div style={{ position: "relative", height: "100%", width: "min(100vw, 440px)", margin: "0 auto" }}>

      {/* top overlay: progress + chapters + controls */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 15, padding: "max(12px, env(safe-area-inset-top)) 16px 0" }} onClick={stop}>
        <div style={{ display: "flex", gap: 4 }}>
          {screens.map((s, i) => (
            <div key={i} onClick={() => jump(i)} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,.28)", overflow: "hidden", cursor: "pointer" }}>
              <div style={{ height: "100%", background: "#fff", borderRadius: 2, transformOrigin: "left",
                transform: i < idx ? "scaleX(1)" : i > idx ? "scaleX(0)" : undefined,
                animation: i === idx && playing && !sheet ? `wbxgrow ${DWELL}ms linear forwards` : undefined,
                ...(i === idx && (!playing || sheet) ? { transform: "scaleX(.35)" } : {}) }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <div className="wbx-noscroll" style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, overflowX: "auto" }}>
            {chapters.map((c) => {
              const target = screens.findIndex((s) => s.chapter === c);
              const on = cur.chapter === c;
              return <div key={c} onClick={() => jump(target)} style={{ flex: "none", font: "600 11px system-ui", padding: "5px 11px", borderRadius: 20, whiteSpace: "nowrap", cursor: "pointer", color: on ? pal.bg : "#fff", background: on ? "#fff" : "rgba(255,255,255,.14)" }}>{c === "Movers" ? `Movers` : c}</div>;
            })}
          </div>
          <div onClick={() => setPlaying((p) => !p)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            {playing ? <span style={{ display: "flex", gap: 3 }}><span style={{ width: 3, height: 11, background: "#fff", borderRadius: 1 }} /><span style={{ width: 3, height: 11, background: "#fff", borderRadius: 1 }} /></span>
              : <span style={{ width: 0, height: 0, borderLeft: "9px solid #fff", borderTop: "6px solid transparent", borderBottom: "6px solid transparent", marginLeft: 2 }} />}
          </div>
          <div onClick={() => jump(0)} style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 15px system-ui", color: "#fff", flex: "none" }}>↺</div>
        </div>
      </div>

      {/* screen body */}
      <div key={idx} style={{ position: "absolute", inset: 0, padding: "104px 24px calc(28px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", animation: "wbxfade .3s ease", overflowY: "auto" }} className="wbx-noscroll">
        {cur.kind === "intro" && (
          <>
            <div style={{ font: "600 11px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>This week in {area}</div>
            <div style={{ font: "500 13px system-ui", color: "rgba(255,255,255,.5)", marginTop: 6 }}>{data.windowDays}-day window</div>
            {hero.lead && <h1 style={{ font: "400 34px/1.16 'Newsreader',Georgia,serif", color: "#f4f7ff", margin: "20px 0 0", letterSpacing: "-.01em" }}>{hero.lead}</h1>}
            {hero.rest && <p style={{ font: "400 16px/1.5 system-ui", color: "rgba(255,255,255,.62)", margin: "16px 0 0" }}>{hero.rest}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 24 }} onClick={stop}>
              {areas.map((a) => {
                const on = a === area;
                return <div key={a} onClick={() => onArea(a)} style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "600 12.5px system-ui", padding: "8px 13px", borderRadius: 20, cursor: "pointer", color: on ? pal.bg : "#fff", background: on ? "#fff" : "rgba(255,255,255,.1)", border: `1px solid ${on ? "transparent" : "rgba(255,255,255,.14)"}` }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: palOf(a).accent }} />{a}</div>;
              })}
            </div>
            <div style={{ marginTop: "auto" }}>
              <div onClick={(e) => { stop(e); go(1); }} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 18, padding: "15px 20px", cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: pal.bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><div style={{ width: 0, height: 0, borderLeft: "12px solid #fff", borderTop: "8px solid transparent", borderBottom: "8px solid transparent", marginLeft: 3 }} /></div>
                <div><div style={{ font: "700 17px system-ui", color: pal.bg }}>Start the brief</div><div style={{ font: "500 12px system-ui", color: "#7a869e" }}>{data.movers.length} movers · {data.topKols.length} KOLs</div></div>
              </div>
            </div>
          </>
        )}

        {cur.kind === "events" && (
          <>
            <div style={{ font: "600 11px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>What happened</div>
            <h1 style={{ font: "600 30px/1.1 system-ui", color: "#f4f7ff", margin: "14px 0 0" }}>Regulatory moves this week</h1>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              {data.events.map((e, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: 16 }}>
                  <div style={{ font: "600 10px system-ui", letterSpacing: ".1em", textTransform: "uppercase", color: pal.accent }}>{e.type.replace(/_/g, " ")}</div>
                  <div style={{ font: "600 17px/1.28 system-ui", color: "#f4f7ff", margin: "9px 0 6px" }}>{e.title}</div>
                  <div style={{ font: "400 13px system-ui", color: "rgba(255,255,255,.5)" }}>{[e.drug, e.company, e.occurredOn?.slice(0, 10)].filter(Boolean).join(" · ")}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {cur.kind === "mover" && (() => {
          const m = data.movers[cur.mi!];
          return (
            <>
              <div style={{ position: "absolute", top: 92, right: -8, font: "800 220px/0.72 system-ui", color: "rgba(255,255,255,.05)", pointerEvents: "none" }}>{cur.mi! + 1}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                <span style={{ font: "600 11px system-ui", letterSpacing: ".16em", textTransform: "uppercase", color: pal.accent }}>Mover {String(cur.mi! + 1).padStart(2, "0")}</span>
                <Delta delta={m.delta} />
              </div>
              <div style={{ font: "700 31px/1.05 system-ui", color: "#f4f7ff", marginTop: 12, letterSpacing: "-.01em", position: "relative" }}>{m.drug}</div>
              <div style={{ font: "500 14px system-ui", color: "rgba(255,255,255,.6)", marginTop: 5 }}>{[m.brand, m.company].filter(Boolean).join(" · ")}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 16 }}>
                <span style={{ font: "700 64px/0.8 system-ui", color: pal.accent, letterSpacing: "-.03em" }}>{m.score}</span>
                <span style={{ font: "600 11px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>signal</span>
              </div>
              <div style={{ width: "100%", maxWidth: 240, height: 6, borderRadius: 4, display: "flex", gap: 2, overflow: "hidden", marginTop: 16 }}>
                {barSegments(m).map((s, i) => <div key={i} style={{ flex: s.flex, background: pal.accent, opacity: s.opacity, borderRadius: 4 }} />)}
              </div>
              <div style={{ font: "400 12.5px system-ui", color: "rgba(255,255,255,.52)", marginTop: 9 }}>{metricsLine(m)}</div>
              {m.why && <p style={{ font: "400 18px/1.36 'Newsreader',Georgia,serif", color: "#eaf0ff", margin: "15px 0 0" }}>{m.why}</p>}
              <div style={{ marginTop: "auto" }}>
                {m.podcast[0] && <PodCard p={m.podcast[0]} accent={pal.accent} />}
                {(m.podcast.length + m.posts.length + m.papers.length) > 0 && (
                  <div onClick={(e) => { stop(e); setSheet(m); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 4px", cursor: "pointer", font: "600 13px system-ui", color: pal.accent }}>
                    <span>See all evidence</span><span>→</span>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {cur.kind === "kols" && (
          <>
            <div style={{ font: "600 11px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>Most active on X</div>
            <h1 style={{ font: "600 30px/1.1 system-ui", color: "#f4f7ff", margin: "14px 0 20px" }}>The voices this week</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.topKols.slice(0, 8).map((k, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.1)", color: "#f4f7ff", font: "600 13px system-ui", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", overflow: "hidden" }}>{k.avatar ? <img src={k.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini(k.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: "500 16px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{k.name}</div><div style={{ font: "400 12px system-ui", color: "rgba(255,255,255,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.drugs.slice(0, 3).join(" · ")}</div></div>
                  <div style={{ font: "600 12px system-ui", color: pal.accent, flex: "none" }}>{k.tweets} post{k.tweets === 1 ? "" : "s"}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {cur.kind === "papers" && (
          <>
            <div style={{ font: "600 11px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>What&rsquo;s being read</div>
            <h1 style={{ font: "600 30px/1.1 system-ui", color: "#f4f7ff", margin: "14px 0 20px" }}>Papers clinicians shared</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.topArticles.slice(0, 8).map((a, i) => (
                <div key={i} style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 13 }}>
                  <div style={{ font: "500 16px/1.4 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{a.title}</div>
                  <div style={{ font: "400 12px system-ui", color: "rgba(255,255,255,.5)", marginTop: 5 }}>{[a.journal || a.domain, `shared by ${a.sharers}`].filter(Boolean).join(" · ")}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {cur.kind === "trials" && (
          <>
            <div style={{ font: "600 11px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>Trials being discussed</div>
            <h1 style={{ font: "600 30px/1.1 system-ui", color: "#f4f7ff", margin: "14px 0 20px" }}>On the field&rsquo;s radar</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.trials.slice(0, 8).map((t, i) => (
                <div key={i} style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 13 }}>
                  <div style={{ font: "500 16px 'Newsreader',Georgia,serif", color: "#f4f7ff" }}>{t.acronym || t.nctId}</div>
                  <div style={{ font: "400 12.5px system-ui", color: "rgba(255,255,255,.5)", marginTop: 3 }}>{t.title}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {cur.kind === "index" && (
          <>
            <div style={{ font: "600 11px system-ui", letterSpacing: ".18em", textTransform: "uppercase", color: pal.accent }}>The week, ranked</div>
            <h1 style={{ font: "400 28px/1.15 'Newsreader',Georgia,serif", color: "#f4f7ff", margin: "14px 0 18px" }}>{area} · this week&rsquo;s movers</h1>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.movers.map((m, i) => (
                <div key={i} onClick={(e) => { stop(e); jump(screens.findIndex((s) => s.kind === "mover" && s.mi === i)); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid rgba(255,255,255,.09)", cursor: "pointer" }}>
                  <span style={{ font: "500 16px 'Newsreader',Georgia,serif", color: i === 0 ? pal.accent : "#6f727c", width: 22, flex: "none" }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, font: "500 16px system-ui", color: "#f4f7ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.drug}</span>
                  <span style={{ font: "700 18px system-ui", color: pal.accent }}>{m.score}</span>
                  <Delta delta={m.delta} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* bottom sheet: full evidence */}
      {sheet && (
        <div onClick={(e) => { stop(e); setSheet(null); }} style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={stop} className="wbx-noscroll" style={{ width: "100%", maxHeight: "88%", overflowY: "auto", background: pal.bg, borderRadius: "22px 22px 0 0", padding: "10px 20px calc(24px + env(safe-area-inset-bottom))", animation: "wbxsheet .3s ease", boxShadow: "0 -20px 60px rgba(0,0,0,.5)" }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,.25)", margin: "0 auto 16px" }} />
            <div style={{ font: "600 20px 'Newsreader',Georgia,serif", color: "#f4f7ff", marginBottom: 4 }}>{sheet.drug}</div>
            <div style={{ font: "400 12.5px system-ui", color: "rgba(255,255,255,.5)", marginBottom: 18 }}>{metricsLine(sheet)}</div>
            {sheet.podcast.length > 0 && <div style={{ marginBottom: 8 }}><div style={evLabel(pal.accent)}>On the podcasts</div>{sheet.podcast.map((p, j) => <PodCard key={j} p={p} accent={pal.accent} />)}</div>}
            {sheet.posts.length > 0 && <div style={{ marginBottom: 8 }}><div style={evLabel(pal.accent)}>On X · verified clinicians</div>{sheet.posts.map((t, j) => <TweetCard key={j} t={t} />)}</div>}
            {sheet.papers.length > 0 && <div><div style={evLabel(pal.accent)}>Papers shared</div>{sheet.papers.map((p: BriefingPaper, j) => <PaperCard key={j} title={p.title} journal={p.journal} meta={`shared by ${p.sharers.length} · ♥ ${p.topLikes}`} />)}</div>}
            <div onClick={() => setSheet(null)} style={{ textAlign: "center", marginTop: 14, font: "600 13px system-ui", color: pal.accent }}>Close</div>
          </div>
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
