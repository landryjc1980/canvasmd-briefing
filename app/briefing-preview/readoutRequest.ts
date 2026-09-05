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

export function readoutWindowDays(window: ReadoutWindow): 1 | 7 {
  return window === "7d" ? 7 : 1;
}
