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
    <div style={{ padding: "13px 15px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 13, ...style }}>
      <div style={{ font: "600 10px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent, marginBottom: 9 }}>
        How the field is reacting{st.axis ? ` · on ${st.axis}` : ""}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", font: "600 13px system-ui" }}>
        <span style={{ color: UP.fg }}>● {st.favorable} favorable</span>
        {st.skeptical > 0 && <span style={{ color: DOWN.fg }}>● {st.skeptical} skeptical</span>}
        {st.mixed > 0 && <span style={{ color: "rgba(255,255,255,.55)" }}>● {st.mixed} mixed</span>}
        <span style={{ color: "rgba(255,255,255,.38)", font: "400 11.5px system-ui" }}>of {st.total} voiced opinions</span>
      </div>
      {st.quote && (
        <p style={{ font: "400 14px/1.42 'Newsreader',Georgia,serif", color: "#c9d2e6", fontStyle: "italic", margin: "11px 0 0" }}>&ldquo;{st.quote}&rdquo;</p>
      )}
    </div>
  );
}
