"use client";

import { ReactNode, useState } from "react";
import { HeroCard } from "@/lib/types";
import { clipTs } from "./briefVM";
import AudioQuote from "@/components/AudioQuote";

// The source-anchored hero (spec §10): one card = one proposition anchored to one source
// object, answering the four reader questions — (1) why it surfaced, (2) what it is,
// (3) what the reader will learn, (4) how to reach the original. Server-authored: this
// component renders card fields verbatim and never re-ranks, re-counts, or synthesizes.
// Mounted ONLY when the payload says mode==="hero" (central resolution in the edge fn);
// callers keep the legacy Top Stories path as the fallback when cards are absent.

const KIND_KICKER: Record<HeroCard["kind"], string> = {
  paper: "Most-shared paper",
  episode: "In-depth episode",
  event: "Regulatory event",
  thread: "Clinician post",
  trial_milestone: "Trial milestone",
};

const INK = { soft: "rgba(233,237,246,.75)", softer: "rgba(233,237,246,.45)", line: "rgba(255,255,255,.08)" };
// Evidence is supplied by the mounting view (which owns the payload's dual-published
// legacy arrays): faces for the pile, and a lazily-rendered receipts drawer. RECEIPTS RULE
// (John, 2026-08-09): a count like "shared by 13 clinicians" must open into WHO and WHAT
// THEY SAID — counts without receipts are exactly what this product refuses to be.
export type HeroEvidence = { faces: string[]; drawer: ReactNode } | null;

export default function HeroCards({ cards, accent, ink = INK, evidenceOf, variant = "full", idPrefix = "" }: { cards: HeroCard[]; accent: string; ink?: { soft: string; softer: string; line: string }; evidenceOf?: (c: HeroCard) => HeroEvidence; variant?: "full" | "compact"; idPrefix?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const compact = variant === "compact";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {cards.map((c, i) => (
        <article key={c.id} style={{ padding: compact ? "12px 2px" : "18px 0", borderTop: i ? `1px solid ${ink.line}` : "none" }}>
          {/* ≤640px the gutter ordinal collapses into the kicker line (brief.css .hero-row) —
              a 32px side gutter on a 390px phone squishes every serif headline into extra wraps. */}
          <div className="hero-row" style={{ alignItems: "baseline", gap: 10 }}>
            {!compact && <span className="hero-index" style={{ font: "600 22px Georgia, serif", color: ink.softer, minWidth: 22 }}>{i + 1}</span>}
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `700 ${compact ? 9 : 11}px system-ui`, letterSpacing: compact ? "0.12em" : "0.14em", textTransform: "uppercase", color: accent }}>
                {!compact && <span className="hero-index-inline" style={{ font: "600 14px Georgia, serif", color: ink.softer, letterSpacing: "normal", marginRight: 8 }}>{i + 1}</span>}
                {KIND_KICKER[c.kind] ?? c.kind}
              </div>
              <h3 style={{ font: compact ? "500 16px/1.4 'Newsreader',Georgia,serif" : "600 20px/1.3 Georgia, serif", margin: compact ? "4px 0" : "6px 0 4px" }}>
                {c.url && c.kind !== "episode" ? <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{c.headline}</a> : c.headline}
              </h3>
              <div style={{ font: compact ? "400 12px system-ui" : "500 13px system-ui", color: ink.soft }}>{c.sourceLabel}</div>
              {c.excerpt && (
                <p className="hero-excerpt" style={{ font: compact ? "400 13.5px/1.5 system-ui" : "400 14.5px/1.55 system-ui", color: ink.soft, margin: "8px 0 0", ...(compact && openId !== c.id ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>
                  {c.excerptVerbatim ? <>&ldquo;{c.excerpt}&rdquo;</> : c.excerpt}
                </p>
              )}
              {(() => { const ev = evidenceOf?.(c) ?? null; const drawerId = `${idPrefix ? `${idPrefix}-` : ""}hero-ev-${c.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`; return (<>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {ev && ev.faces.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {ev.faces.slice(0, 4).map((f, j) => (
                      <div key={j} style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(20,26,40,1)", background: "rgba(255,255,255,.12)", marginLeft: j ? -7 : 0 }}>
                        <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                )}
                <span style={{ font: "500 12.5px system-ui", color: ink.softer }}>{c.why}</span>
                {ev && c.kind !== "episode" && (
                  <button onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    aria-expanded={openId === c.id} aria-controls={drawerId}
                    data-brief-event="source_open" data-brief-open={openId === c.id} data-brief-story={c.id} data-brief-target={`hero_${c.kind}`}
                    style={{ background: "none", border: 0, padding: "12px 4px", cursor: "pointer", font: "600 12.5px system-ui", color: accent, minHeight: 44 }}>
                    {openId === c.id ? "Hide sources ↑" : "Sources ↓"}
                  </button>
                )}
                {c.url && !(c.kind === "episode" && c.startMs != null) && (
                  <a href={c.url} target="_blank" rel="noreferrer" style={{ font: "600 12.5px system-ui", color: accent, textDecoration: "none" }}>
                    {c.kind === "thread" ? "Original post ↗" : c.kind === "event" ? "Primary source ↗" : "Original ↗"}
                  </a>
                )}
              </div>
              {/* Episodes get the REAL seeking player (media fragment + JS re-seek) — a bare
                  href on a podcast enclosure opens at 0:00, which fails "reach the original
                  moment" (Codex acceptance item). */}
              {c.kind === "episode" && c.startMs != null && c.url && (
                <div style={{ marginTop: 10, width: "100%" }}>
                  <AudioQuote audioUrl={c.url} startMs={c.startMs} durationSeconds={c.durationSeconds} label={`Listen @ ${clipTs(c.startMs)}`} accent={accent} tone="dark" />
                </div>
              )}
              {ev && c.kind === "episode" && (
                <button onClick={() => setOpenId(openId === c.id ? null : c.id)}
                  aria-expanded={openId === c.id} aria-controls={drawerId}
                  data-brief-event="source_open" data-brief-open={openId === c.id} data-brief-story={c.id} data-brief-target="hero_episode"
                  style={{ display: "inline-flex", alignItems: "center", background: "none", border: 0, padding: "8px 4px", marginTop: 4, cursor: "pointer", font: "600 12.5px system-ui", color: accent, minHeight: 44 }}>
                  {openId === c.id ? "Hide sources ↑" : "Sources ↓"}
                </button>
              )}
              {ev && openId === c.id && <div id={drawerId} style={{ marginTop: 12 }}>{ev.drawer}</div>}
              </>); })()}
              {!!c.siblings?.length && (
                <div style={{ font: "400 12px system-ui", color: ink.softer, marginTop: 6 }}>
                  Related: {c.siblings.map((sb, j) => sb.url
                    ? <a key={j} href={sb.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{sb.label}{j < c.siblings!.length - 1 ? " · " : ""}</a>
                    : <span key={j}>{sb.label}{j < c.siblings!.length - 1 ? " · " : ""}</span>)}
                </div>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
