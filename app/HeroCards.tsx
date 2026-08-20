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
  paper: "Paper",
  episode: "In-depth episode",
  event: "Regulatory event",
  thread: "Clinician post",
  readout: "Trial readout",
  development: "Breaking development",
  trial_milestone: "Trial milestone",
};

const INK = { soft: "rgba(233,237,246,.75)", softer: "rgba(233,237,246,.45)", line: "rgba(255,255,255,.08)", ring: "rgba(20,26,40,1)" };
// Evidence is supplied by the mounting view (which owns the payload's dual-published
// legacy arrays): faces for the pile, and a lazily-rendered receipts drawer. RECEIPTS RULE
// (John, 2026-08-09): a count like "shared by 13 clinicians" must open into WHO and WHAT
// THEY SAID — counts without receipts are exactly what this product refuses to be.
export type HeroEvidence = { faces: string[]; drawer: ReactNode; abstract?: string | null; preview?: ReactNode } | null;

export default function HeroCards({ cards, accent, ink = INK, evidenceOf, variant = "full", idPrefix = "", defaultOpenId, shareUrlOf }: { cards: HeroCard[]; accent: string; ink?: { soft: string; softer: string; line: string; ring?: string; surface?: string }; evidenceOf?: (c: HeroCard) => HeroEvidence; variant?: "full" | "compact"; idPrefix?: string; defaultOpenId?: string; shareUrlOf?: (c: HeroCard) => string }) {
  // defaultOpenId opens one card's evidence drawer on mount — the standalone /r/<slug> post page
  // passes the card's own id so a shared link lands on the FULL expanded card, evidence and all.
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null);
  // shareUrlOf (opt-in) turns each card into a shareable unit: the quiet share control copies /
  // native-shares its /r/<slug> post page (where a colleague gets the branded unfurl + the card).
  const [shared, setShared] = useState<string | null>(null);
  const shareCard = async (c: HeroCard) => {
    const path = shareUrlOf?.(c);
    if (!path) return;
    const url = path.startsWith("http") ? path : `${location.origin}${path}`;
    const nav = navigator as unknown as { share?: (d: { url: string }) => Promise<void> };
    if (nav.share) { try { await nav.share({ url }); return; } catch (e) { if ((e as { name?: string })?.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); setShared(c.id); setTimeout(() => setShared((s) => (s === c.id ? null : s)), 2000); } catch { /* clipboard blocked (lost user activation) */ }
  };
  const compact = variant === "compact";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {cards.map((c, i) => {
        const lead = !compact && i === 0;
        const ev = evidenceOf?.(c) ?? null;
        const drawerId = `${idPrefix ? `${idPrefix}-` : ""}hero-ev-${c.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        return (
          <article key={c.id} className={`readout-hero-card${lead ? " is-lead" : ""}${compact ? " is-compact" : ""}`} data-sid={c.id} data-stitle={c.headline} data-skind={c.kind} style={compact ? { padding: "12px 2px", borderTop: i ? `1px solid ${ink.line}` : "none" } : undefined}>
          <div className="hero-row" style={{ alignItems: "baseline" }}>
            <div style={{ minWidth: 0 }}>
              <div className="readout-hero-kicker" style={{ font: `700 ${compact ? 9 : 11}px system-ui`, letterSpacing: compact ? "0.12em" : "0.14em", textTransform: "uppercase", color: accent }}>
                {KIND_KICKER[c.kind] ?? c.kind}
                {(c.drugTags ?? []).length > 0 && <span style={{ opacity: .72, textTransform: "none", letterSpacing: 0, marginLeft: 8, font: `600 ${compact ? 9.5 : 11}px system-ui` }}>· {(c.drugTags ?? [])[0]}</span>}
              </div>
              <div className="readout-hero-source" style={compact ? { font: "500 12px system-ui", color: ink.soft, marginTop: 3 } : { color: ink.soft }}>{c.sourceLabel}</div>
              <h3 className="readout-hero-title" style={compact ? { font: "500 16px/1.4 'Newsreader',Georgia,serif", margin: "4px 0" } : undefined}>
                {c.url && c.kind !== "episode" ? <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{c.headline}</a> : c.headline}
              </h3>
              {c.excerpt && (
                <p className="hero-excerpt" style={{ font: compact ? "400 13.5px/1.5 system-ui" : undefined, color: ink.soft, margin: compact ? "8px 0 0" : undefined, ...(compact && openId !== c.id ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>
                  {c.excerptVerbatim ? <>&ldquo;{c.excerpt}&rdquo;</> : c.excerpt}
                </p>
              )}
              {c.kind === "paper" && ev?.abstract && (
                <details className="readout-hero-abstract" style={{ color: accent }}>
                  <summary>Read abstract <span aria-hidden>↓</span></summary>
                  <p>{ev.abstract}</p>
                </details>
              )}
              {ev?.preview && !compact && (
                <div className="readout-hero-preview">
                  <div>Physician conversation</div>
                  {ev.preview}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {ev && ev.faces.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {/* Hero faces are URL-only (nulls filtered upstream), so the only failure here is a
                        stale pbs.twimg URL — onError peels the photo to an accent-tinted coin instead
                        of the browser's broken-image glyph. */}
                    {ev.faces.slice(0, 4).map((f, j) => (
                      <div key={j} style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ink.ring ?? "rgba(20,26,40,1)"}`, background: `${accent}24`, marginLeft: j ? -7 : 0 }}>
                        <img src={f} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ))}
                  </div>
                )}
                <span style={{ font: "500 12.5px system-ui", color: ink.softer }}>{c.why}</span>
                {ev && c.kind !== "episode" && (
                  <button onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    aria-expanded={openId === c.id} aria-controls={drawerId}
                    data-brief-event="source_open" data-brief-open={openId === c.id} data-brief-story={c.id} data-brief-target={`hero_${c.kind}`} data-brief-label={c.headline}
                    style={{ background: "none", border: 0, padding: "12px 4px", cursor: "pointer", font: "600 12.5px system-ui", color: accent, minHeight: 44 }}>
                    {openId === c.id ? "Hide conversation ↑" : compact ? "Evidence ↓" : ev.faces.length ? "Conversation & evidence ↓" : "See evidence ↓"}
                  </button>
                )}
                {shareUrlOf && (
                  <button onClick={() => shareCard(c)} aria-label="Share this story" title="Share"
                    data-brief-event="story_share" data-brief-story={c.id} data-brief-label={c.headline}
                    style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: 0, padding: "10px 2px", cursor: "pointer", font: "600 11.5px system-ui", color: shared === c.id ? accent : ink.softer, minHeight: 44 }}>
                    {shared === c.id ? "Copied" : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                    )}
                  </button>
                )}
              </div>
              {/* Episodes get the REAL seeking player (media fragment + JS re-seek) — a bare
                  href on a podcast enclosure opens at 0:00, which fails "reach the original
                  moment" (Codex acceptance item). */}
              {c.kind === "episode" && c.startMs != null && c.url && (
                <div style={{ marginTop: 10, width: "100%" }}>
                  <AudioQuote audioUrl={c.url} startMs={c.startMs} durationSeconds={c.durationSeconds} label={`Listen @ ${clipTs(c.startMs)}`} eventId={c.id} eventLabel={c.headline} accent={accent} tone="dark" />
                </div>
              )}
              {ev && c.kind === "episode" && (
                <button onClick={() => setOpenId(openId === c.id ? null : c.id)}
                  aria-expanded={openId === c.id} aria-controls={drawerId}
                  data-brief-event="source_open" data-brief-open={openId === c.id} data-brief-story={c.id} data-brief-target="hero_episode" data-brief-label={c.headline}
                  style={{ display: "inline-flex", alignItems: "center", background: "none", border: 0, padding: "8px 4px", marginTop: 4, cursor: "pointer", font: "600 12.5px system-ui", color: accent, minHeight: 44 }}>
                  {openId === c.id ? "Hide conversation ↑" : compact ? "Evidence ↓" : ev.faces.length ? "Conversation & evidence ↓" : "See evidence ↓"}
                </button>
              )}
              {ev && openId === c.id && <div id={drawerId} style={{ marginTop: 12 }}>{ev.drawer}</div>}
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
        );
      })}
    </div>
  );
}
