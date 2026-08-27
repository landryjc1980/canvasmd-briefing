export type ReadoutWindow = "today" | "7d";

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
