// The All-page front door: the "Most discussed across oncology" cross-specialty deck, the
// "Approvals & readouts" rail, and the "Since your last read" band — composed CLIENT-SIDE over
// the per-area hero payloads the page already fetches. Nothing here re-scores the engine: the
// only ranking inputs are each area's OWN authoritative deck order (a rank percentile, so GU's
// panel size can't outvote Gyn's) and plain receipt counts already in the payload. No
// model-scored importance, no AI verdicts, anywhere.

// This module deliberately has NO runtime imports — only types. The rules below are the ones
// worth pinning in tests (a quiet week hands the page one card per area, so the floor and the
// diversity cap never show themselves in production data), and keeping the module import-free
// means `node --test` can load it directly, exactly as it loads heroContract/heroEvidence.
// Turning a payload into per-card metrics lives next door in allCardMetrics.ts.

import type { BriefingStory, HeroCard } from "@/lib/types";
import type { SeenLog } from "./readerMemory";

// ---- typed-artifact signatures (the honest "UPDATED" trigger) -------------------------------
// A story's signature is the set of typed artifacts behind it: its anchor plus every support
// link (paper / article / episode ids). Shares, reposts, and like counts are deliberately NOT
// in the signature — "+N shares" must never read as "UPDATED".

export const artifactSig = (card: HeroCard): string[] => {
  const ids = new Set<string>([`${card.kind}:${card.anchorId}`]);
  for (const link of card.support?.links ?? []) ids.add(`${link.kind}:${link.id}`);
  return [...ids].sort();
};

// Legacy-mode stories (no hero deck) use their evidence objects the same way.
export const storySig = (story: BriefingStory): string[] => {
  const ids = new Set<string>();
  for (const p of story.papers ?? []) ids.add(`paper:${p.url ?? p.title}`);
  for (const pod of story.podcast ?? []) if (pod.episodeId) ids.add(`episode:${pod.episodeId}`);
  return [...ids].sort();
};

export const gainReason = (gained: string[]): string | null => {
  const kinds = new Set(gained.map((g) => g.split(":")[0]));
  if (kinds.has("paper")) return "Paper added";
  if (kinds.has("article")) return "Article added";
  if (kinds.has("episode")) return "Podcast discussion added";
  return gained.length ? "Source added" : null;
};

// Plain receipt counts for one card, resolved next door in allCardMetrics.ts. The conversation
// span is nullable on purpose: when the payload carries no first/last share timestamps the
// "over N days" clause is OMITTED rather than invented.
export type CardMetrics = { clinicians: number; spanDays: number | null; podcasts: number };

// ---- cross-specialty ranking (order of operations is LOCKED) --------------------------------
// (a) ABSOLUTE floor first — a story below the bar stays in its specialty rail.
// (b) Within-specialty rank percentile is the comparable score (raw counts favor big panels).
// (c) Event class is a deterministic WEIGHT — regulatory/readout above equal-percentile papers,
//     never a trump card.
// (d) Diversity cap: max 2 per specialty in the first 6.
// (e) No obligation to represent every specialty.

export type AreaEntries = { area: string; entries: { card: HeroCard; metrics: CardMetrics }[] };
export type DeckEntry = { card: HeroCard; area: string; metrics: CardMetrics; rankScore: number };

export const clearsFloor = (card: HeroCard, metrics: CardMetrics): boolean =>
  metrics.clinicians >= 3 || card.kind === "event" || card.kind === "readout";

const eventWeight = (card: HeroCard): number => (card.kind === "event" || card.kind === "readout" ? 0.1 : 0);

const byRank = (areaOrder: string[]) => (x: DeckEntry, y: DeckEntry): number =>
  y.rankScore - x.rankScore ||
  y.metrics.clinicians - x.metrics.clinicians ||
  areaOrder.indexOf(x.area) - areaOrder.indexOf(y.area) ||
  (x.card.id < y.card.id ? -1 : x.card.id > y.card.id ? 1 : 0);

export function rankAcrossSpecialties(perArea: AreaEntries[], areaOrder: string[], cap = 6): DeckEntry[] {
  const scored: DeckEntry[] = [];
  for (const { area, entries } of perArea) {
    const len = entries.length;
    entries.forEach(({ card, metrics }, i) => {
      if (!clearsFloor(card, metrics)) return; // (a)
      const percentile = (len - i) / len; // (b)
      scored.push({ card, area, metrics, rankScore: percentile + eventWeight(card) }); // (c)
    });
  }
  scored.sort(byRank(areaOrder));
  const deck: DeckEntry[] = [];
  for (const entry of scored) {
    if (deck.length >= cap) break;
    if (deck.some((d) => d.card.id === entry.card.id)) continue; // same story surfaced by two areas
    if (deck.filter((d) => d.area === entry.area).length >= 2) continue; // (d)
    deck.push(entry);
  }
  return deck;
}

// ---- "Since your last read" -----------------------------------------------------------------
// NEW = never marked seen AND first observed after the reader's last visit. UPDATED = marked
// seen before, and the story's typed-artifact signature has since GAINED an artifact. Away
// longer than a week → no band at all (the front page IS the catch-up).

export type BandRow = { card: HeroCard; area: string; status: "new" | "updated"; reason: string | null; score: number };

const BAND_MAX_AWAY_MS = 7 * 86400_000;

export function computeBand(opts: {
  perArea: AreaEntries[];
  areaOrder: string[];
  seen: SeenLog;
  firstObserved: Record<string, string>;
  lastVisit: string | null;
  now?: Date;
  cap?: number;
}): BandRow[] {
  const { perArea, areaOrder, seen, firstObserved, lastVisit } = opts;
  if (!lastVisit) return [];
  const lastVisitMs = new Date(lastVisit).getTime();
  if (!Number.isFinite(lastVisitMs)) return [];
  const nowMs = (opts.now ?? new Date()).getTime();
  const away = nowMs - lastVisitMs;
  if (away < 0 || away > BAND_MAX_AWAY_MS) return [];

  const rows: BandRow[] = [];
  const considered = new Set<string>();
  for (const { area, entries } of perArea) {
    const len = entries.length;
    entries.forEach(({ card }, i) => {
      if (considered.has(card.id)) return;
      considered.add(card.id);
      const score = (len ? (len - i) / len : 0) + eventWeight(card);
      const rec = seen[card.id];
      if (!rec) {
        const first = firstObserved[card.id];
        const firstMs = first ? new Date(first).getTime() : NaN;
        if (!Number.isFinite(firstMs) || firstMs > lastVisitMs) rows.push({ card, area, status: "new", reason: null, score });
        return;
      }
      const gained = artifactSig(card).filter((x) => !rec.sig.includes(x));
      if (gained.length) rows.push({ card, area, status: "updated", reason: gainReason(gained), score });
    });
  }
  rows.sort((x, y) =>
    y.score - x.score ||
    areaOrder.indexOf(x.area) - areaOrder.indexOf(y.area) ||
    (x.card.id < y.card.id ? -1 : x.card.id > y.card.id ? 1 : 0));
  return rows.slice(0, opts.cap ?? 8);
}

// ---- "Approvals & readouts" rail ------------------------------------------------------------

export type ApprovalEntry = { card: HeroCard; area: string; date: string | null };

// The rail dates each development by the server's CANONICAL ACTION DATE (`card.occurredOn`) — the
// same value the specialty card's "Nd ago" is floored from, so one event cannot read as two dates.
//
// It used to infer the date from `card.support.links` instead: no support edge has ever carried
// `relationshipType === "primary_source"` (the graph's types are covers_approval / discusses_trial /
// …), so that lookup ALWAYS fell through to the first link with a timestamp — and links arrive
// sorted newest-first, making the date "when coverage last mentioned this", not "when the FDA
// acted". The Aug-13 iberdomide approval carried a CancerNetwork link stamped Aug 23 and the rail
// printed Aug 23 while the card printed 11d ago (audit 2026-08-24). Support is never a date source.
export function approvalsRail(perArea: { area: string; entries: { card: HeroCard }[] }[], cap = 8): ApprovalEntry[] {
  const out: ApprovalEntry[] = [];
  const taken = new Set<string>();
  for (const { area, entries } of perArea) {
    for (const { card } of entries) {
      if (card.kind !== "event" && card.kind !== "readout") continue;
      if (taken.has(card.id)) continue;
      taken.add(card.id);
      // No canonical date ⇒ show no date. A missing stamp is honest; an inferred one is not.
      out.push({ card, area, date: card.occurredOn ?? null });
    }
  }
  out.sort((x, y) =>
    (y.date ? new Date(y.date).getTime() : 0) - (x.date ? new Date(x.date).getTime() : 0) ||
    (x.card.id < y.card.id ? -1 : x.card.id > y.card.id ? 1 : 0));
  return out.slice(0, cap);
}

// Chip label only — never a ranking input.
export const approvalChipLabel = (card: HeroCard): string =>
  card.kind === "readout" ? "READOUT"
    : /approv/i.test(`${card.headline} ${card.sourceLabel}`) ? "FDA APPROVAL"
    : "REGULATORY";
