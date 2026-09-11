import type { BriefingEvidenceOverlayItem, ReadoutWindowPayload } from "./types";
import { validReadoutAttentionAnchor } from "./readoutAttention";

export type ReadoutAttentionWindow = NonNullable<ReadoutWindowPayload["attentionWindow"]>;
const TIME_ZONE = "America/New_York";

const localDate = (now: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);

/** A label requires the saved edition and the returned evidence to agree. */
export function attentionWindowForPayload(payload: ReadoutWindowPayload | null): ReadoutAttentionWindow | null {
  const scope = payload?.attentionWindow;
  const edition = payload?.currentEdition as { editionDate?: string; attentionAnchor?: unknown } | null;
  if (!scope || !edition?.editionDate || scope.editionDate !== edition.editionDate ||
      scope.timeZone !== TIME_ZONE || scope.kind !== (payload?.windowDays === 7 ? "seven-day" : "edition")) return null;
  const anchor = validReadoutAttentionAnchor(edition.attentionAnchor, edition.editionDate);
  const startAt = scope.kind === "seven-day" ? anchor?.sevenDayStartAt : anchor?.startAt;
  return startAt && scope.startAt === startAt ? scope : null;
}

export function attentionOverlayMatches(
  overlay: BriefingEvidenceOverlayItem | null | undefined,
  scope: ReadoutAttentionWindow | null,
): overlay is BriefingEvidenceOverlayItem {
  if (!overlay || !scope || overlay.windowStartAt !== scope.startAt) return false;
  const asOf = Date.parse(overlay.windowAsOf ?? "");
  return Number.isFinite(asOf) && asOf >= Date.parse(scope.startAt) &&
    Number.isInteger(overlay.windowClinicianCount) && overlay.windowClinicianCount >= 0 &&
    Array.isArray(overlay.windowSharerPeople) && Array.isArray(overlay.windowPosts);
}

export function attentionSinceLabel(scope: ReadoutAttentionWindow, now = new Date()): string {
  const start = new Date(scope.startAt);
  const todayNoon = Date.parse(`${localDate(now)}T12:00:00Z`);
  const yesterday = new Date(todayNoon - 86400_000).toISOString().slice(0, 10);
  if (scope.kind === "edition" && localDate(start) === yesterday) return "since yesterday morning";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, month: "short", day: "numeric",
    ...(localDate(start).slice(0, 4) === localDate(now).slice(0, 4) ? {} : { year: "numeric" as const }),
  }).format(start);
  return `since ${date}`;
}

export function attentionExactStart(scope: ReadoutAttentionWindow): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, month: "short", day: "numeric", year: "numeric",
  }).format(new Date(scope.startAt));
  return `5 AM ET on ${date}`;
}

export function publicationSourceLabel(journal: string, date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return journal;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return journal;
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(parsed);
  return `${journal} · published ${label}`;
}
