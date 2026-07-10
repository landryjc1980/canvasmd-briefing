// Shared view-model helpers for the new "story / reader" Weekly Brief designs
// (StoryView.tsx + ReaderView.tsx). Maps our real BriefingData onto the shapes the
// design mocks expect, and holds the dark jewel-tone per-area palette.

import { BriefingMover, BriefingData } from "@/lib/types";

// Dark jewel-tone palette, one color per tumor area (from the design handoff).
export type Pal = { bg: string; accent: string; soft: string };
export const PALETTE: Record<string, Pal> = {
  GU: { bg: "#14336B", accent: "#9FC0FF", soft: "#5A7FC4" },
  Breast: { bg: "#4A1836", accent: "#FFB0D4", soft: "#B46A8F" },
  Lung: { bg: "#22384F", accent: "#A9C4E6", soft: "#5F7D9E" },
  GI: { bg: "#463107", accent: "#F3CD8A", soft: "#B08B45" },
  Heme: { bg: "#4A1414", accent: "#FF9F95", soft: "#B05A52" },
  Gyn: { bg: "#0F3F39", accent: "#8FE8D8", soft: "#4F9A8F" },
};
export const palOf = (area: string): Pal => PALETTE[area] ?? PALETTE.GU;

// Full tumor-area names for the header switcher (the compact "GU" codes are for chips).
export const AREA_FULL: Record<string, string> = {
  GU: "Genitourinary",
  Breast: "Breast",
  Lung: "Lung",
  GI: "Gastrointestinal",
  Heme: "Hematologic",
  Gyn: "Gynecologic",
};

// Momentum pill colors (constant across areas).
export const UP = { fg: "#74E6A8", bg: "rgba(116,230,168,.16)" };
export const DOWN = { fg: "#FF9B8F", bg: "rgba(255,155,143,.18)" };

// The 3-segment monochrome signal bar: accent at opacities [1, .5, .24] sized by
// the podcast / X / paper split. Returns segment descriptors (flex + opacity).
export function barSegments(m: BriefingMover): { flex: number; opacity: number }[] {
  const raw = [m.podPct, m.xPct, m.articlePct];
  const ops = [1, 0.5, 0.24];
  return raw.map((f, i) => ({ flex: Math.max(f, 0), opacity: ops[i] })).filter((s) => s.flex > 0);
}

// "4 conversations · 2 on X · 3 papers · ♥ 214" — zeros omitted.
export function metricsLine(m: BriefingMover): string {
  const parts: string[] = [];
  if (m.podConvs) parts.push(`${m.podConvs} conversation${m.podConvs === 1 ? "" : "s"}`);
  if (m.xSharers) parts.push(`${m.xSharers} on X`);
  if (m.articleCount) parts.push(`${m.articleCount} paper${m.articleCount === 1 ? "" : "s"}`);
  if (m.topLikes) parts.push(`♥ ${m.topLikes}`);
  return parts.join(" · ");
}

// "5:30" clip timestamp from a start offset in ms.
export function clipTs(ms: number | null): string {
  if (ms == null) return "0:00";
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Split the recap into a serif "lead" line + the remainder paragraph for the hero.
export function heroSplit(recap: string | null): { lead: string; rest: string } {
  const t = (recap ?? "").trim();
  if (!t) return { lead: "", rest: "" };
  const m = t.match(/^(.+?[.?!])\s+(.*)$/s);
  return m ? { lead: m[1], rest: m[2] } : { lead: t, rest: "" };
}

// Aggregate stats for the hero row.
export function heroStats(data: BriefingData) {
  const talkCount = data.movers.reduce((n, m) => n + m.podConvs, 0);
  const postCount = data.topKols.reduce((n, k) => n + k.tweets, 0);
  return { moverCount: data.movers.length, postCount, talkCount };
}
