"use client";

// "How the field is reacting" — the shared stance block. One place so the drug story cards,
// the Drugs-board evidence sheet (mobile), and the Drugs-board drawer (desktop) never drift.
// Honest by construction: renders only at ≥4 voiced opinions (stanceParts self-gates), shows
// the real split (never a hollow %), and — the 2026-07-22 RECEIPTS pass — expands to the exact
// N classified takes behind the numbers, each traceable to its episode/tweet. The receipt IS the
// self-serve demo of the paid graph. Quote marks are earned: only verbatim source quotes wear
// them; everything else is labeled our classifier's paraphrase. Everything BENEATH this — per-KOL
// attribution, the trend over time, reach — is the paid dashboard.

import { useState } from "react";
import { stanceParts, UP, DOWN } from "./briefVM";
import { BriefingStance, BriefingStanceTake } from "@/lib/types";

// Absolute short date ("Jul 3") — stable, no relative-time recompute flicker.
const shortDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const valenceLabel: Record<string, string> = {
  enthusiastic: "enthusiastic", favorable: "favorable", equipoise: "mixed", skeptical: "skeptical", negative: "negative",
};
const valenceColor = (v: string): string =>
  v === "favorable" || v === "enthusiastic" ? UP.fg : v === "skeptical" || v === "negative" ? DOWN.fg : "rgba(255,255,255,.6)";

// Stop a click/keydown inside the block from bubbling to the Row head (a role="button" the block
// sometimes renders inside): expanding the receipts, or opening a source link, must NOT also
// toggle the story's evidence drawer.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const stopKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); };

function TakeRow({ t, accent }: { t: BriefingStanceTake; accent: string }) {
  const vcol = valenceColor(t.valence);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span aria-hidden style={{ marginTop: 6, width: 7, height: 7, borderRadius: "50%", background: vcol, flex: "none" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, font: "400 13.5px/1.5 'Newsreader',Georgia,serif", color: "#d0d4de" }}>
          {t.verbatim ? <>&ldquo;{t.text}&rdquo;</> : t.text}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 4, font: "500 11px system-ui", color: "#8b93a6" }}>
          <span style={{ color: vcol, fontWeight: 600 }}>{valenceLabel[t.valence] ?? t.valence}</span>
          <span aria-hidden>·</span>
          {t.url
            ? <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={stop} onKeyDown={stopKey} style={{ color: accent, textDecoration: "none" }}>{t.sourceLabel} ↗</a>
            : <span>{t.sourceLabel}</span>}
          {t.occurredAt && <><span aria-hidden>·</span><span>{shortDate(t.occurredAt)}</span></>}
          {t.practiceChanging && <span style={{ font: "700 8px system-ui", letterSpacing: ".06em", textTransform: "uppercase", color: accent, border: `1px solid ${accent}55`, borderRadius: 4, padding: "1.5px 5px" }}>Practice-changing</span>}
        </div>
      </div>
    </div>
  );
}

export default function StanceBlock({ stance, accent, style }: { stance?: BriefingStance | null; accent: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const st = stanceParts(stance);
  if (!st || !stance) return null; // self-suppresses (thin signal / non-drug) → callers never leave an empty gap

  const takes = stance.takes ?? [];
  const hasReceipts = takes.length > 0;
  const lead = takes[0];
  // Relabel: "of N voiced opinions" overstated (podcast stance is episode-level, not per-speaker).
  // Honest breakdown = the counts split by source. Old snapshots (no episodeCount) fall back.
  const eps = stance.episodeCount, posts = stance.postCount;
  const breakdown =
    eps === undefined && posts === undefined
      ? `${st.total} classified mentions`
      : [`${st.total} classified mention${st.total === 1 ? "" : "s"}`,
         [eps ? `${eps} episode${eps === 1 ? "" : "s"}` : "", posts ? `${posts} post${posts === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")]
          .filter(Boolean).join(" — ");
  // Lead quote: render TEXT and attribution from the SAME source object so they can never credit
  // different sources. When receipts exist that's takes[0] (which the edge fn also uses for
  // stance.quote); old snapshots without takes fall back to the flat stance.quote/quoteVerbatim.
  const leadText = lead ? lead.text : st.quote;
  const leadVerbatim = lead ? lead.verbatim : !!stance.quoteVerbatim;

  return (
    <div style={{ padding: "14px 16px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderTop: "1px solid rgba(255,255,255,.16)", borderLeft: `3px solid ${accent}`, borderRadius: 13, boxShadow: "0 8px 22px rgba(0,0,0,.18)", ...style }}>
      <div style={{ font: "600 10px/1.6 system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent, marginBottom: 9 }}>
        How the field is reacting{st.axis ? ` · on ${st.axis}` : ""}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", font: "600 13px system-ui" }}>
        <span style={{ color: UP.fg }}>● {st.favorable} favorable</span>
        {st.skeptical > 0 && <span style={{ color: DOWN.fg }}>● {st.skeptical} skeptical</span>}
        {st.mixed > 0 && <span style={{ color: "rgba(255,255,255,.55)" }}>● {st.mixed} mixed</span>}
      </div>
      <div style={{ font: "400 11.5px system-ui", color: "#9aa2b6", marginTop: 6 }}>{breakdown} · last 30 days</div>

      {leadText && (
        <div style={{ margin: "12px 0 0" }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            {leadVerbatim && <span aria-hidden style={{ font: "600 28px/0.85 'Newsreader',Georgia,serif", color: accent, opacity: 0.75, flex: "none" }}>&ldquo;</span>}
            <p style={{ font: "italic 500 15px/1.5 'Newsreader',Georgia,serif", color: "#d6dcea", margin: 0 }}>{leadText}{leadVerbatim ? "”" : ""}</p>
          </div>
          {lead && (
            <div style={{ font: "500 11px system-ui", color: "#8b93a6", marginTop: 6, marginLeft: leadVerbatim ? 18 : 0 }}>
              {leadVerbatim ? "" : "Paraphrased — "}
              {lead.url
                ? <a href={lead.url} target="_blank" rel="noopener noreferrer" onClick={stop} onKeyDown={stopKey} style={{ color: accent, textDecoration: "none" }}>{lead.sourceLabel} ↗</a>
                : <span>{lead.sourceLabel}</span>}
            </div>
          )}
        </div>
      )}

      {hasReceipts && (
        <>
          <button type="button" onClick={(e) => { stop(e); setOpen((o) => !o); }} onKeyDown={stopKey}
            style={{ marginTop: 12, background: "none", border: 0, padding: 0, cursor: "pointer", font: "600 12px system-ui", color: accent }}>
            {open ? "Hide the receipts ↑" : takes.length < st.total ? `See ${takes.length} of ${st.total} takes ↓` : `See all ${st.total} takes ↓`}
          </button>
          {open && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12 }}>
              {takes.map((t, i) => <TakeRow key={i} t={t} accent={accent} />)}
              {takes.length < st.total && (
                <div style={{ font: "400 11px system-ui", color: "#7e8698" }}>Showing {takes.length} of {st.total}.</div>
              )}
              <div style={{ font: "400 10.5px/1.5 system-ui", color: "#7e8698" }}>
                &ldquo;Quoted&rdquo; takes are verbatim from the source; others are our classifier&rsquo;s paraphrase. Classified by an AI reader of verified-clinician podcasts &amp; posts.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
