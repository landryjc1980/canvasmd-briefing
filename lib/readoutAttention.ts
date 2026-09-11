/** Fixed starts for edition attention. Observation time advances on each hourly refresh.
 * Keep anchor derivation aligned with backend _shared/readoutAttention.ts. */
export const READOUT_ATTENTION_VERSION = 1 as const;
export const READOUT_ATTENTION_TIME_ZONE = "America/New_York" as const;

export type ReadoutAttentionAnchor = {
  version: typeof READOUT_ATTENTION_VERSION;
  timeZone: typeof READOUT_ATTENTION_TIME_ZONE;
  startAt: string;
  sevenDayStartAt: string;
};

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validEditionDate(value: string): DateParts | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day, hour: 5, minute: 0, second: 0 }
    : null;
}

function zonedParts(value: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: READOUT_ATTENTION_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: number("year"), month: number("month"), day: number("day"), hour: number("hour"), minute: number("minute"), second: number("second") };
}

/** Convert an unambiguous 05:00 New York wall time to an ISO instant, including DST. */
function atNewYorkFive(parts: DateParts): string {
  const wallMs = Date.UTC(parts.year, parts.month - 1, parts.day, 5, 0, 0);
  let instantMs = wallMs;
  // Resolve the zone offset at the target instant twice; 05:00 is never a DST
  // transition ambiguity in New York, and the second pass covers offset changes.
  for (let index = 0; index < 2; index += 1) {
    const observed = zonedParts(new Date(instantMs));
    const observedWallMs = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    instantMs = wallMs - (observedWallMs - instantMs);
  }
  return new Date(instantMs).toISOString();
}

function dateShift(parts: DateParts, days: number): DateParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(), hour: 5, minute: 0, second: 0 };
}

export function readoutAttentionAnchor(editionDate: string): ReadoutAttentionAnchor {
  const date = validEditionDate(editionDate);
  if (!date) throw new Error(`Invalid Readout edition date: ${editionDate}`);
  return {
    version: READOUT_ATTENTION_VERSION,
    timeZone: READOUT_ATTENTION_TIME_ZONE,
    startAt: atNewYorkFive(dateShift(date, -1)),
    sevenDayStartAt: atNewYorkFive(dateShift(date, -7)),
  };
}

export function validReadoutAttentionAnchor(value: unknown, editionDate: string): ReadoutAttentionAnchor | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReadoutAttentionAnchor>;
  if (candidate.version !== READOUT_ATTENTION_VERSION || candidate.timeZone !== READOUT_ATTENTION_TIME_ZONE ||
      typeof candidate.startAt !== "string" || typeof candidate.sevenDayStartAt !== "string") return null;
  let expected: ReadoutAttentionAnchor;
  try {
    expected = readoutAttentionAnchor(editionDate);
  } catch {
    return null;
  }
  return candidate.startAt === expected.startAt && candidate.sevenDayStartAt === expected.sevenDayStartAt
    ? expected
    : null;
}

