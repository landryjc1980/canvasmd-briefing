import type { BriefingData, HeroCard } from "@/lib/types";

// ---- hero-mode contract (spec: thin weeks are signed-correct output) ------------------------
// The ONE accessor every view must use. In hero mode the server-authored deck is
// AUTHORITATIVE — `cards ?? []` — and an EMPTY deck is a valid quiet edition that must
// render as empty, never resurrect legacy topStories (Codex cutover review). Returns null
// only in legacy mode. Type-only imports keep this module loadable under node:test.
export function heroDeckOf(data: Pick<BriefingData, "mode" | "heroCandidates">): HeroCard[] | null {
  return data.mode === "hero" ? (data.heroCandidates?.cards ?? []) : null;
}

// Hero cards carry the same scope tags as every rail item. Unknown/old cards remain visible in
// the full brief, but never leak into a narrower Focus or live-coverage view.
export function scopedHeroCards(cards: HeroCard[], subArea: string | null, congressOnly: boolean): HeroCard[] {
  if (!subArea && !congressOnly) return cards;
  return cards.filter((card) =>
    (!subArea || (card.subAreas ?? []).includes(subArea)) &&
    (!congressOnly || card.congress === true));
}
