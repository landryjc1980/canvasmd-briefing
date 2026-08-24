"use client";

import { ReactNode, useState } from "react";
import { HeroCard } from "@/lib/types";
import AudioQuote from "@/components/AudioQuote";
import { evidenceBackedHeroWhy } from "@/app/clientEvidence";

// The source-anchored hero (spec §10): one card = one proposition anchored to one source
// object, answering the four reader questions — (1) why it surfaced, (2) what it is,
// (3) what the reader will learn, (4) how to reach the original. Server-authored: this
// component renders card fields verbatim and never re-ranks, re-counts, or synthesizes.
// Mounted ONLY when the payload says mode==="hero" (central resolution in the edge fn);
// callers keep the legacy Top Stories path as the fallback when cards are absent.

export const KIND_KICKER: Record<HeroCard["kind"], string> = {
  paper: "Paper",
  episode: "Episode",
  event: "Regulatory event",
  thread: "Clinician post",
  readout: "Trial readout",
  development: "Development",
  trial_milestone: "Trial milestone",
};

// The ONE wording for the evidence disclosure. Exported because the All page's ranked deck draws
// its own card anatomy (rank numeral, KIND · AREA kicker) but must open evidence the same way a
// hero card does — John, 2026-08-24: "the expanding to see evidence is different than for the
// stories, why not just make it the same." Two surfaces on one page cannot drift on this label.
export const heroEvidenceLabel = (open: boolean, compact: boolean, hasFaces: boolean): string =>
  open ? "Hide conversation ↑" : compact ? "Evidence ↓" : hasFaces ? "Conversation & evidence ↓" : "See evidence ↓";

const INK = { soft: "rgba(233,237,246,.75)", softer: "rgba(233,237,246,.45)", line: "rgba(255,255,255,.08)", ring: "rgba(20,26,40,1)" };
// Evidence is supplied by the mounting view (which owns the payload's dual-published
// legacy arrays): faces for the pile, and a lazily-rendered receipts drawer. RECEIPTS RULE
// (John, 2026-08-09): a count like "shared by 13 clinicians" must open into WHO and WHAT
// THEY SAID — counts without receipts are exactly what this product refuses to be.
export type HeroEvidence = { faces: string[]; drawer: ReactNode; context?: string | null; contextLabel?: "Abstract" | "Source context"; preview?: ReactNode; playback?: import("@/lib/types").BriefingPod } | null;

export default function HeroCards({ cards, accent, ink = INK, evidenceOf, variant = "full", idPrefix = "", defaultOpenId, shareUrlOf, openId: openIdProp, onOpenChange, seenIds, unseenDot }: { cards: HeroCard[]; accent: string; ink?: { soft: string; softer: string; line: string; ring?: string; surface?: string }; evidenceOf?: (c: HeroCard) => HeroEvidence; variant?: "full" | "compact"; idPrefix?: string; defaultOpenId?: string; shareUrlOf?: (c: HeroCard) => string; openId?: string | null; onOpenChange?: (id: string | null) => void; seenIds?: ReadonlySet<string>; unseenDot?: string }) {
  // defaultOpenId opens one card's evidence drawer on mount — the standalone /r/<slug> post page
  // passes the card's own id so a shared link lands on the FULL expanded card, evidence and all.
  // Passing `openId` switches the drawer to CONTROLLED mode (the All page owns one open card
  // across every area's deck and can auto-open a card a Since-your-last-read row points at).
  const [internalOpenId, setInternalOpenId] = useState<string | null>(defaultOpenId ?? null);
  const openId = openIdProp !== undefined ? openIdProp : internalOpenId;
  const setOpenId = (id: string | null) => {
    if (openIdProp === undefined) setInternalOpenId(id);
    onOpenChange?.(id);
  };
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
        const why = evidenceBackedHeroWhy(c.why, !!ev);
        const drawerId = `${idPrefix ? `${idPrefix}-` : ""}hero-ev-${c.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        // Seen-state (All page): a seen card dims while closed; an unseen one carries a quiet
        // 6px area-accent dot beside the kicker. No badges, no counts — no unread anxiety.
        const dimmed = !!seenIds?.has(c.id) && openId !== c.id;
        return (
          <article key={c.id} className={`readout-hero-card${lead ? " is-lead" : ""}${compact ? " is-compact" : ""}`} data-sid={c.id} data-stitle={c.headline} data-skind={c.kind} style={{ ...(compact ? { padding: "12px 2px", borderTop: i ? `1px solid ${ink.line}` : "none" } : {}), ...(seenIds ? { opacity: dimmed ? 0.55 : 1, transition: "opacity .35s ease" } : {}) }}>
          <div className="hero-row" style={{ alignItems: "baseline" }}>
            <div style={{ minWidth: 0 }}>
              <div className="readout-hero-kicker" style={{ font: `700 ${compact ? 9 : 11}px system-ui`, letterSpacing: compact ? "0.12em" : "0.14em", textTransform: "uppercase", color: accent }}>
                {unseenDot && seenIds && !seenIds.has(c.id) && <span aria-hidden style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: unseenDot, marginRight: 7, verticalAlign: "1px" }} />}
                {KIND_KICKER[c.kind] ?? c.kind}
                {(c.drugTags ?? []).length > 0 && <span style={{ opacity: .72, textTransform: "none", letterSpacing: 0, marginLeft: 8, font: `600 ${compact ? 9.5 : 11}px system-ui` }}>· {(c.drugTags ?? [])[0]}</span>}
              </div>
              <div className="readout-hero-source" style={compact ? { font: "500 12px system-ui", color: ink.soft, marginTop: 3 } : { color: ink.soft }}>{c.sourceLabel}</div>
              <h3 className="readout-hero-title" style={compact ? { font: "500 16px/1.4 'Newsreader',Georgia,serif", margin: "4px 0" } : undefined}>
                {c.url ? <a href={c.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "inherit", textDecoration: "none" }}>{c.headline}</a> : c.headline}
              </h3>
              {c.excerpt && (
                <p className="hero-excerpt" style={{ font: compact ? "400 13.5px/1.5 system-ui" : undefined, color: ink.soft, margin: compact ? "8px 0 0" : undefined, ...(compact && openId !== c.id ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>
                  {c.excerptVerbatim ? <>&ldquo;{c.excerpt}&rdquo;</> : c.excerpt}
                </p>
              )}
              {(c.kind === "paper" || c.kind === "readout") && ev?.context && (
                <details className="readout-hero-abstract" style={{ color: accent }}>
                  <summary aria-label={`Read ${ev.contextLabel?.toLowerCase() ?? "context"} for ${c.headline}`}>{ev.contextLabel ?? "Source context"} <span aria-hidden>↓</span></summary>
                  <p>{ev.context}</p>
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
                {why && <span style={{ font: "500 12.5px system-ui", color: ink.softer }}>{why}</span>}
                {ev && c.kind !== "episode" && (
                  <button onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    aria-expanded={openId === c.id} aria-controls={drawerId}
                    aria-label={`${openId === c.id ? "Hide" : "Show"} conversation and evidence for ${c.headline}`}
                    data-brief-event="source_open" data-brief-open={openId === c.id} data-brief-story={c.id} data-brief-target={`hero_${c.kind}`} data-brief-label={c.headline}
                    style={{ background: "none", border: 0, padding: "12px 4px", cursor: "pointer", font: "600 12.5px system-ui", color: accent, minHeight: 44 }}>
                    {heroEvidenceLabel(openId === c.id, compact, ev.faces.length > 0)}
                  </button>
                )}
                {shareUrlOf && (
                  <button onClick={() => shareCard(c)} aria-label={`Share ${c.headline}`} title="Share"
                    data-brief-event="story_share" data-brief-story={c.id} data-brief-label={c.headline}
                    style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, background: "none", border: 0, padding: 0, cursor: "pointer", font: "600 11.5px system-ui", color: shared === c.id ? accent : ink.softer, width: 44, height: 44 }}>
                    {shared === c.id ? "Copied" : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                    )}
                  </button>
                )}
              </div>
              {/* Episodes get the REAL seeking player (media fragment + JS re-seek) — a bare
                  href on a podcast enclosure opens at 0:00, which fails "reach the original
                  moment" (Codex acceptance item). */}
              {c.kind === "episode" && ev?.playback?.audioUrl && (
                <div style={{ marginTop: 10, width: "100%" }}>
                  <AudioQuote audioUrl={ev.playback.audioUrl} startMs={ev.playback.startMs ?? 0} durationSeconds={ev.playback.durationSeconds ?? c.durationSeconds} label="Listen to the clip" eventId={c.id} eventLabel={c.headline} accent={accent} tone="dark" />
                </div>
              )}
              {ev && c.kind === "episode" && (
                <button onClick={() => setOpenId(openId === c.id ? null : c.id)}
                  aria-expanded={openId === c.id} aria-controls={drawerId}
                  aria-label={`${openId === c.id ? "Hide" : "Show"} conversation and evidence for ${c.headline}`}
                  data-brief-event="source_open" data-brief-open={openId === c.id} data-brief-story={c.id} data-brief-target="hero_episode" data-brief-label={c.headline}
                  style={{ display: "inline-flex", alignItems: "center", background: "none", border: 0, padding: "8px 4px", marginTop: 4, cursor: "pointer", font: "600 12.5px system-ui", color: accent, minHeight: 44 }}>
                  {heroEvidenceLabel(openId === c.id, compact, ev.faces.length > 0)}
                </button>
              )}
              {ev && openId === c.id && <div id={drawerId} style={{ marginTop: 12 }}>{ev.drawer}</div>}
              {!!c.siblings?.length && (
                <div style={{ font: "400 12px system-ui", color: ink.softer, marginTop: 6 }}>
                  Related: {c.siblings.map((sb, j) => sb.url
                    ? <a key={j} href={sb.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "inherit" }}>{sb.label}{j < c.siblings!.length - 1 ? " · " : ""}</a>
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
