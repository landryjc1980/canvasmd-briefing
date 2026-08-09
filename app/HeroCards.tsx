"use client";

import { HeroCard } from "@/lib/types";
import { clipTs } from "./briefVM";

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
export default function HeroCards({ cards, ink = INK }: { cards: HeroCard[]; ink?: { soft: string; softer: string; line: string } }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {cards.map((c, i) => (
        <article key={c.id} style={{ padding: "18px 0", borderTop: i ? `1px solid ${ink.line}` : "none" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ font: "600 22px Georgia, serif", color: ink.softer, minWidth: 22 }}>{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "700 11px system-ui", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent, #c96)" }}>
                {KIND_KICKER[c.kind] ?? c.kind}
              </div>
              <h3 style={{ font: "600 20px/1.3 Georgia, serif", margin: "6px 0 4px" }}>
                {c.url ? <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{c.headline}</a> : c.headline}
              </h3>
              <div style={{ font: "500 13px system-ui", color: ink.soft }}>{c.sourceLabel}</div>
              {c.excerpt && (
                <p style={{ font: "400 14.5px/1.55 system-ui", color: ink.soft, margin: "8px 0 0" }}>
                  {c.excerptVerbatim ? <>&ldquo;{c.excerpt}&rdquo;</> : c.excerpt}
                </p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ font: "500 12.5px system-ui", color: ink.softer }}>{c.why}</span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" style={{ font: "600 12.5px system-ui", color: "var(--accent, #c96)", textDecoration: "none" }}>
                    {c.kind === "episode" && c.startMs != null ? `Listen @ ${clipTs(c.startMs)}` : c.kind === "thread" ? "Original post ↗" : c.kind === "event" ? "Primary source ↗" : "Original ↗"}
                  </a>
                )}
              </div>
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
