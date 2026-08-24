// One hero card → the plain counts its receipts line quotes ("18 clinicians over 5 days · 3
// podcasts"). Every number here is resolved from the SAME evidence the card's drawer opens, via
// resolveHeroEvidence — never a second selection pass, and never a score. Split out of
// allFrontPage.ts so the ranking rules there stay free of runtime imports and testable directly.

import type { BriefingStory, HeroCard } from "@/lib/types";
import { podEpisodeCount } from "./briefVM";
import { representedClinicianCount, representedClinicianCountAcrossLanes, resolveHeroEvidence, type CardBrief } from "./heroEvidence";
import type { CardMetrics } from "./allFrontPage";

export function cardMetrics(card: HeroCard, brief: CardBrief): CardMetrics {
  const resolved = resolveHeroEvidence(card, brief);
  let clinicians = 0;
  let podcasts = 0;
  if (resolved?.kind === "paper") {
    const story = resolved.story as BriefingStory;
    clinicians = representedClinicianCountAcrossLanes(story.posts, resolved.publisherPosts, resolved.otherPosts);
    podcasts = podEpisodeCount(story);
  } else if (resolved?.kind === "article" || resolved?.kind === "event") {
    clinicians = representedClinicianCountAcrossLanes(resolved.posts, resolved.publisherPosts, resolved.otherPosts);
  } else if (resolved?.kind === "episode") {
    clinicians = (card.amplifiers ?? []).length;
  } else if (resolved?.kind === "thread") {
    clinicians = representedClinicianCount([resolved.post]);
  }
  if (!podcasts) podcasts = new Set((card.support?.links ?? []).filter((l) => l.kind === "episode").map((l) => l.id)).size;
  // The producer's own authored-clinician census outranks what the capped receipt arrays can
  // show — the payload caps receipts for size, and a count must never shrink to fit them.
  const authored = card.conversation?.authoredClinicians;
  if (typeof authored === "number" && authored > clinicians) clinicians = authored;
  // "over N days" needs real first/last touch timestamps; a one-day span is not a span.
  const conv = card.conversation;
  const spanDays = conv && conv.firstTouchAt && conv.lastTouchAt && conv.spanDays >= 2 ? conv.spanDays : null;
  return { clinicians, spanDays, podcasts };
}
