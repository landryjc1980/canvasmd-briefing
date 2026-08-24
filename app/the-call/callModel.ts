import type { BriefingData, HeroCard, HeroSupportLink, HeroSupportPost } from "@/lib/types";

export const CALL_AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"] as const;
export type CallArea = (typeof CALL_AREAS)[number];
export type CallAreaSelection = "All oncology" | CallArea;

export type CallSourceKind = "Official action" | "Primary report" | "Peer-reviewed paper" | "Expert discussion";

export type PracticeCall = {
  id: string;
  area: string;
  headline: string;
  prompt: string;
  sourceKind: CallSourceKind;
  sourceLabel: string;
  excerpt: string | null;
  primaryUrl: string;
  fieldNote: HeroSupportPost | null;
  deeperLink: HeroSupportLink | null;
  card: HeroCard;
  priority: number;
};

export type CallDecision = "yes" | "not-yet";
export type CallDecisionMap = Record<string, CallDecision>;

const sourceKindFor = (card: HeroCard): CallSourceKind => {
  if (card.kind === "event") return "Official action";
  if (card.kind === "development" || card.kind === "readout" || card.kind === "trial_milestone") {
    return "Primary report";
  }
  if (card.kind === "paper") return "Peer-reviewed paper";
  return "Expert discussion";
};

const promptFor = (card: HeroCard) => {
  if (card.kind === "event") return "Would this change your next eligible patient's options?";
  if (card.kind === "development" || card.kind === "readout") {
    return "Is this enough to change the next treatment discussion?";
  }
  if (card.kind === "trial_milestone") return "Does this change what you watch for next?";
  if (card.kind === "paper") return "Does this paper change what you do?";
  return "Would this change how you frame the decision?";
};

const priorityFor = (card: HeroCard, serverIndex: number) => {
  const base = card.kind === "event"
    ? 120
    : card.kind === "development" || card.kind === "readout" || card.kind === "trial_milestone"
      ? 105
      : card.kind === "paper"
        ? 80
        : 55;
  const links = card.support?.links ?? [];
  const primary = links.some((link) => link.relationshipType === "primary_source") ? 20 : 0;
  const official = /food and drug administration|fda/i.test(card.sourceLabel) ? 15 : 0;
  const hasExcerpt = card.excerpt ? 5 : 0;
  const hasDeeperSource = links.some((link) => link.kind === "episode") ? 4 : 0;

  // Server order is only a final tie-breaker. Social volume never enters this score.
  return base + primary + official + hasExcerpt + hasDeeperSource - serverIndex * 0.01;
};

const fieldNoteFor = (card: HeroCard) =>
  (card.support?.clinicianPosts ?? []).find((post) => Boolean(post.text)) ?? null;

const deeperLinkFor = (card: HeroCard, primaryUrl: string) => {
  const links = (card.support?.links ?? []).filter((link) => link.url !== primaryUrl);
  return links.find((link) => link.kind === "episode")
    ?? links.find((link) => link.relationshipType !== "primary_source")
    ?? null;
};

export function buildPracticeCalls(briefings: BriefingData[]): PracticeCall[] {
  return briefings
    .flatMap((briefing) =>
      (briefing.heroCandidates?.cards ?? []).flatMap((card, serverIndex) => {
        if (!card.url) return [];
        const primaryLink = (card.support?.links ?? []).find(
          (link) => link.relationshipType === "primary_source"
        );
        const primaryUrl = primaryLink?.url ?? card.url;
        return [{
          id: `${briefing.area}:${card.id}`,
          area: briefing.area,
          headline: card.headline,
          prompt: promptFor(card),
          sourceKind: sourceKindFor(card),
          sourceLabel: primaryLink?.sourceLabel ?? card.sourceLabel,
          excerpt: card.excerpt ?? null,
          primaryUrl,
          fieldNote: fieldNoteFor(card),
          deeperLink: deeperLinkFor(card, primaryUrl),
          card,
          priority: priorityFor(card, serverIndex),
        } satisfies PracticeCall];
      })
    )
    .sort((a, b) => b.priority - a.priority || a.headline.localeCompare(b.headline));
}

export function unansweredPracticeCalls(calls: PracticeCall[], decisions: CallDecisionMap) {
  return calls.filter((call) => !decisions[call.id]);
}

export function areasForSelection(selection: CallAreaSelection | null): readonly CallArea[] {
  if (!selection) return [];
  return selection === "All oncology" ? CALL_AREAS : [selection];
}
