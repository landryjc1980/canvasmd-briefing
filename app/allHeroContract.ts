import type { HeroCard } from "@/lib/types";

// The All Oncology page is a scan, not six full briefs stacked together. It uses the
// authoritative hero order but limits the initial surface; expanding never re-ranks.
export function visibleAllHeroCards(cards: HeroCard[], compact: boolean, expanded: boolean): HeroCard[] {
  if (expanded) return cards;
  return cards.slice(0, compact ? 2 : 3);
}

export function featuredHeroPaperKeys(cards: HeroCard[]): Set<string> {
  const keys = new Set<string>();
  for (const card of cards) {
    if (card.kind !== "paper") continue;
    if (card.anchorId) keys.add(`u:${card.anchorId}`);
    if (card.url) keys.add(`u:${card.url}`);
    if (card.headline) keys.add(`t:${card.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`);
  }
  return keys;
}
