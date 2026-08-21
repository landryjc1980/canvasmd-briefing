"use client";

// "Directional takes detected" — the shared stance block. One place so the drug story cards,
// the Drugs-board evidence sheet (mobile), and the Drugs-board drawer (desktop) never drift.
// Honest by construction: renders only at ≥4 classified excerpts (stanceParts self-gates), shows
// the real split (never a hollow %), and — the 2026-07-22 RECEIPTS pass — expands to the exact
// N classified takes behind the numbers, each traceable to its episode/tweet. The receipt IS the
// self-serve demo of the paid graph. Quote marks are earned: only verbatim source quotes wear
// them; everything else is labeled our classifier's paraphrase. Everything BENEATH this — per-KOL
// attribution, the trend over time, reach — is the paid dashboard.
//
// ⚠️ 2026-08-02 — THE HEADING IS A CLAIM. This block used to be titled "How the field is
// reacting", which asserts we MEASURED the field. We did not: only ~4% of takes are verbatim,
// the rest are our classifier's paraphrase, and some rows are almost entirely X posts. A smart
// reader who notices that discounts the whole product, so the heading now describes what we
// actually did — detect directional takes — and the method line sits ABOVE the fold rather than
// hidden inside the collapsed receipts.
// BANNED until speaker-level ownership is real: wording that claims measured sentiment, puts a
// view in professionals' mouths, or counts takes as people. `npm test` enforces the exact list.

import { useId, useState } from "react";
import { stanceParts } from "./briefVM";

// PAPER/INK palette (audit 2026-08-19): this block was the theme port's miss — it still wore
// the retired dark palette inside the light reader (take text #d0d4de on paper ~1.4:1; the
// "mixed" count literally white-on-white). Colors mirror the NATIVE twin's correct port:
// ink text, #087443 favorable, #b42318 skeptical. briefVM's UP/DOWN stay dark-theme tokens
// for the surfaces that actually are dark.
const S_INK = "#17181a", S_INK2 = "#4f5257", S_MUT = "#696c71", S_LINE = "#e2e2de";
const S_UP = "#087443", S_DOWN = "#b42318";
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
  v === "favorable" || v === "enthusiastic" ? S_UP : v === "skeptical" || v === "negative" ? S_DOWN : S_INK2;

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
        <p style={{ margin: 0, font: "400 13.5px/1.5 'Newsreader',Georgia,serif", color: S_INK }}>
          {t.verbatim ? <>&ldquo;{t.text}&rdquo;</> : t.text}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 4, font: "500 11px system-ui", color: S_MUT }}>
          <span style={{ color: vcol, fontWeight: 600 }}>{valenceLabel[t.valence] ?? t.valence}</span>
          <span aria-hidden>·</span>
          {t.url
            ? <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={stop} onKeyDown={stopKey} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: accent, textDecoration: "none" }}>{t.sourceLabel} ↗</a>
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
  const receiptsId = useId();
  const st = stanceParts(stance);
  if (!st || !stance) return null; // self-suppresses (thin signal / non-drug) → callers never leave an empty gap

  const takes = stance.takes ?? [];
  const hasReceipts = takes.length > 0;
  const lead = takes[0];
  // Relabel: "of N voiced opinions" overstated (podcast stance is episode-level, not per-speaker).
  // Honest breakdown = the counts split by source. Old snapshots (no episodeCount) fall back.
  // episodeCount/postCount are DISTINCT SOURCES (edge fn, 2026-08-02) — they no longer sum to
  // total, deliberately: "13 excerpts from 6 episodes and 5 posts" shows concentration that
  // "13 excerpts, 8 episodes, 5 posts" would hide. Old snapshots omit them → count-only line.
  const eps = stance.episodeCount, posts = stance.postCount;
  const src = [eps ? `${eps} podcast episode${eps === 1 ? "" : "s"}` : "", posts ? `${posts} X post${posts === 1 ? "" : "s"}` : ""].filter(Boolean);
  // The count is scoped to ONE axis (edge fn, 2026-08-02): every excerpt behind
  // these numbers carries `st.axis`, so the label says so — "6 excerpts on
  // efficacy", never efficacy+safety+convenience blended into one number.
  const breakdown =
    `${st.total} model-classified excerpt${st.total === 1 ? "" : "s"}` +
    (st.axis ? ` on ${st.axis}` : "") +
    (src.length ? ` · from ${src.join(" and ")}` : "");
  // Lead quote: render TEXT and attribution from the SAME source object so they can never credit
  // different sources. When receipts exist that's takes[0] (which the edge fn also uses for
  // stance.quote); old snapshots without takes fall back to the flat stance.quote/quoteVerbatim.
  const leadText = lead ? lead.text : st.quote;
  const leadVerbatim = lead ? lead.verbatim : !!stance.quoteVerbatim;

  return (
    <div style={{ padding: "14px 16px", background: "#fff", border: `1px solid ${S_LINE}`, borderLeft: `3px solid ${accent}`, borderRadius: 13, boxShadow: "0 4px 14px rgba(23,24,26,.06)", ...style }}>
      <div style={{ font: "600 10px/1.6 system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent, marginBottom: 9 }}>
        Directional takes detected
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", font: "600 13px system-ui" }}>
        {/* "5 favorable" reads as five DOCTORS. The unit is model-classified EXCERPTS — dedup is per
            post/episode and per amplification origin, never per author, so one clinician posting
            three times contributes three. Say "excerpts" in the headline, not just in the method
            line underneath (Codex 2026-08-05). */}
        <span style={{ color: S_UP }}>● {st.favorable} favorable excerpt{st.favorable === 1 ? "" : "s"}</span>
        {st.skeptical > 0 && <span style={{ color: S_DOWN }}>● {st.skeptical} skeptical</span>}
        {st.mixed > 0 && <span style={{ color: S_INK2 }}>● {st.mixed} mixed</span>}
      </div>
      <div style={{ font: "400 11.5px system-ui", color: S_INK2, marginTop: 6 }}>{breakdown} · last 30 days</div>
      {/* The method line sits ABOVE the fold on purpose. It used to live inside the collapsed
          receipts, so the default view showed a confident-looking tally with no indication that
          most of it is our classifier's paraphrase — the reader had to opt in to the caveat. */}
      <div style={{ font: "400 10.5px/1.5 system-ui", color: S_MUT, marginTop: 3 }}>
        Classified by an AI reader of verified-clinician posts and selected oncology podcast excerpts — not a survey.
      </div>

      {leadText && (
        <div style={{ margin: "12px 0 0" }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            {leadVerbatim && <span aria-hidden style={{ font: "600 28px/0.85 'Newsreader',Georgia,serif", color: accent, opacity: 0.75, flex: "none" }}>&ldquo;</span>}
            <p style={{ font: "italic 500 15px/1.5 'Newsreader',Georgia,serif", color: S_INK, margin: 0 }}>{leadText}{leadVerbatim ? "”" : ""}</p>
          </div>
          {lead && (
            <div style={{ font: "500 11px system-ui", color: S_MUT, marginTop: 6, marginLeft: leadVerbatim ? 18 : 0 }}>
              {leadVerbatim ? "" : "Paraphrased — "}
              {lead.url
                ? <a href={lead.url} target="_blank" rel="noopener noreferrer" onClick={stop} onKeyDown={stopKey} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: accent, textDecoration: "none" }}>{lead.sourceLabel} ↗</a>
                : <span>{lead.sourceLabel}</span>}
            </div>
          )}
        </div>
      )}

      {hasReceipts && (
        <>
          <button type="button" onClick={(e) => { stop(e); setOpen((o) => !o); }} onKeyDown={stopKey}
            aria-expanded={open} aria-controls={receiptsId}
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44, marginTop: 12, background: "none", border: 0, padding: "0 2px", cursor: "pointer", font: "600 12px system-ui", color: accent }}>
            {open ? "Hide the receipts ↑" : takes.length < st.total ? `See ${takes.length} of ${st.total} takes ↓` : `See all ${st.total} takes ↓`}
          </button>
          {open && (
            <div id={receiptsId} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${S_LINE}`, paddingTop: 12 }}>
              {takes.map((t, i) => <TakeRow key={i} t={t} accent={accent} />)}
              {takes.length < st.total && (
                <div style={{ font: "400 11px system-ui", color: S_MUT }}>Showing {takes.length} of {st.total}.</div>
              )}
              <div style={{ font: "400 10.5px/1.5 system-ui", color: S_MUT }}>
                &ldquo;Quoted&rdquo; takes are verbatim from the source; others are our classifier&rsquo;s paraphrase.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
