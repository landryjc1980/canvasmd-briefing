export type ReadoutWindow = "today" | "7d";

export const READOUT_WINDOWS: ReadoutWindow[] = ["today", "7d"];

/** The tablist's roving-focus behavior, kept pure so keyboard paths stay testable. */
export function readoutWindowKeyboardTarget(current: ReadoutWindow, key: string): ReadoutWindow | null {
  const index = READOUT_WINDOWS.indexOf(current);
  if (key === "Home") return READOUT_WINDOWS[0];
  if (key === "End") return READOUT_WINDOWS[READOUT_WINDOWS.length - 1];
  if (key === "ArrowRight" || key === "ArrowDown") return READOUT_WINDOWS[(index + 1) % READOUT_WINDOWS.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return READOUT_WINDOWS[(index - 1 + READOUT_WINDOWS.length) % READOUT_WINDOWS.length];
  return null;
}

export function etEditionDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function etEditionHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));
}

export function activeReadoutEditionDate(now = new Date()): string {
  if (etEditionHour(now) >= 6) return etEditionDate(now);
  return etEditionDate(new Date(now.getTime() - 12 * 60 * 60 * 1000));
}

/** The frozen morning source set is promoted under this ET-dated run identity. */
export function scheduledReadoutSourceRunId(now = new Date()): string {
  return `scheduled-${prepublicationEditionDate(now).replace(/-/g, "")}06`;
}

/** The canonical morning being prepared is today, even while public readers show yesterday. */
export function prepublicationEditionDate(now = new Date()): string {
  return etEditionDate(now);
}

export function hasScheduledReadoutSourceRun(sourceRunId: unknown, now = new Date()): boolean {
  return sourceRunId === scheduledReadoutSourceRunId(now);
}

/** A retry may preserve only the exact, versioned canonical publication shape. */
export function hasFrozenPrepublishedEdition(value: unknown, editionDate: string): boolean {
  const edition = value as { schemaVersion?: unknown; area?: unknown; editionDate?: unknown; selectionVersion?: unknown } | null;
  return !!edition && edition.schemaVersion === 2 && edition.area === "All" &&
    edition.editionDate === editionDate && /^readout-v1-[a-f0-9]{64}$/.test(String(edition.selectionVersion ?? ""));
}

export function readoutWindowDays(window: ReadoutWindow): 1 | 7 {
  return window === "7d" ? 7 : 1;
}
