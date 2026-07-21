"use client";

// "How the field is reacting" — the shared stance block. One place so the drug story cards,
// the Drugs-board evidence sheet (mobile), and the Drugs-board drawer (desktop) never drift.
// Honest by construction: renders only at ≥4 voiced opinions (stanceParts self-gates), shows
// the real split (never a hollow %), and carries one traceable quote. Everything BENEATH this —
// all N opinions, per-KOL attribution, the trend over time — is the paid dashboard.

import { stanceParts, UP, DOWN } from "./briefVM";
import { BriefingStance } from "@/lib/types";

export default function StanceBlock({ stance, accent, style }: { stance?: BriefingStance | null; accent: string; style?: React.CSSProperties }) {
  const st = stanceParts(stance);
  if (!st) return null; // self-suppresses (thin signal / non-drug) → callers never leave an empty gap
  return (
    <div style={{ padding: "14px 16px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderTop: "1px solid rgba(255,255,255,.16)", borderLeft: `3px solid ${accent}`, borderRadius: 13, boxShadow: "0 8px 22px rgba(0,0,0,.18)", ...style }}>
      <div style={{ font: "600 10px/1.6 system-ui", letterSpacing: ".12em", textTransform: "uppercase", color: accent, marginBottom: 9 }}>
        How the field is reacting{st.axis ? ` · on ${st.axis}` : ""}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", font: "600 13px system-ui" }}>
        <span style={{ color: UP.fg }}>● {st.favorable} favorable</span>
        {st.skeptical > 0 && <span style={{ color: DOWN.fg }}>● {st.skeptical} skeptical</span>}
        {st.mixed > 0 && <span style={{ color: "rgba(255,255,255,.55)" }}>● {st.mixed} mixed</span>}
        <span style={{ color: "rgba(255,255,255,.42)", font: "400 11.5px system-ui" }}>of {st.total} voiced opinions</span>
      </div>
      {st.quote && (
        <div style={{ display: "flex", gap: 9, margin: "12px 0 0", alignItems: "flex-start" }}>
          <span aria-hidden style={{ font: "600 28px/0.85 'Newsreader',Georgia,serif", color: accent, opacity: 0.75, flex: "none" }}>&ldquo;</span>
          <p style={{ font: "italic 500 15px/1.5 'Newsreader',Georgia,serif", color: "#d6dcea", margin: 0 }}>{st.quote}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
