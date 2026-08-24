"use client";

// Per-device reader memory behind the All-page front door: the seen log, the visit clock,
// and the first-observed clock. Everything lives in localStorage under VERSIONED keys
// (`readout.*.v1`) so a future account-level migration can read v1 and move on. Every read
// and write is try/caught — private mode or a blocked storage quota degrades to "first
// visit, nothing seen", never an error.

export type SeenEntry = { at: string; sig: string[] };
export type SeenLog = Record<string, SeenEntry>;

const SEEN_KEY = "readout.seen.v1";
const VISIT_KEY = "readout.lastVisit.v1";
const FIRST_KEY = "readout.firstSeen.v1";

// A reload inside this window continues the same visit; a longer gap rolls the clock so
// "since your last read" measures from the START of the previous sitting.
const SESSION_GAP_MS = 30 * 60_000;
// Seen entries outlive any card's window (rolling briefs run days, not months) so UPDATED
// detection works across weeks; first-observed entries only matter while a card is alive.
const SEEN_MAX_AGE_MS = 120 * 86400_000;
const FIRST_MAX_AGE_MS = 45 * 86400_000;
const MAX_ENTRIES = 600;

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota */
  }
};

const pruneByAge = <T,>(map: Record<string, T>, atOf: (v: T) => string, maxAgeMs: number, nowMs: number): Record<string, T> => {
  const entries = Object.entries(map).filter(([, v]) => {
    const t = new Date(atOf(v)).getTime();
    return Number.isFinite(t) && nowMs - t <= maxAgeMs;
  });
  entries.sort((a, b) => new Date(atOf(b[1])).getTime() - new Date(atOf(a[1])).getTime());
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
};

export function readSeenLog(): SeenLog {
  const raw = read<SeenLog>(SEEN_KEY) ?? {};
  const clean: SeenLog = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v.at === "string" && Array.isArray(v.sig)) {
      clean[k] = { at: v.at, sig: v.sig.filter((s): s is string => typeof s === "string") };
    }
  }
  return clean;
}

// Marking seen always REFRESHES the stored artifact signature — re-reading an UPDATED story
// is what clears its UPDATED state on the next visit.
export function recordSeen(id: string, sig: string[], now = new Date()) {
  const log = readSeenLog();
  log[id] = { at: now.toISOString(), sig };
  write(SEEN_KEY, pruneByAge(log, (v) => v.at, SEEN_MAX_AGE_MS, now.getTime()));
}

// Visit clock: { prev, cur, at } — cur is the running session's start, at its last heartbeat.
// Idempotent within a session (React strict-mode double-init included). Returns BOTH clocks:
// `lastVisit` is what the band measures from, and `visitStart` is the stamp first-observed uses
// (see recordFirstObserved — the two must share one timeline or every card reads as NEW).
export function beginVisit(now = new Date()): { lastVisit: string | null; visitStart: string } {
  const rec = read<{ prev?: string | null; cur?: string | null; at?: string | null }>(VISIT_KEY) ?? {};
  const nowMs = now.getTime();
  const atMs = rec.at ? new Date(rec.at).getTime() : NaN;
  if (Number.isFinite(atMs) && nowMs - atMs <= SESSION_GAP_MS && rec.cur) {
    write(VISIT_KEY, { prev: rec.prev ?? null, cur: rec.cur, at: now.toISOString() });
    return { lastVisit: rec.prev ?? null, visitStart: rec.cur };
  }
  const prev = rec.cur && Number.isFinite(new Date(rec.cur).getTime()) ? rec.cur : null;
  write(VISIT_KEY, { prev, cur: now.toISOString(), at: now.toISOString() });
  return { lastVisit: prev, visitStart: now.toISOString() };
}

export function readFirstObserved(): Record<string, string> {
  const raw = read<Record<string, string>>(FIRST_KEY) ?? {};
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") clean[k] = v;
  return clean;
}

// Stamp the first time THIS device saw each card id — the client-side proxy for "first appeared
// in a build" that NEW-since-you-left needs. Only ever adds; never re-stamps.
//
// The stamp is the VISIT START, not the wall clock: the band asks "did this arrive after my last
// visit?" by comparing this stamp against `lastVisit`, and both are drawn from the same visit
// clock. Stamping at wall-clock time would put every card a few milliseconds past the visit that
// observed it, so on the next visit the whole edition would read as NEW.
export function recordFirstObserved(ids: string[], visitStart: string) {
  const map = readFirstObserved();
  const stampMs = new Date(visitStart).getTime();
  const stamp = Number.isFinite(stampMs) ? visitStart : new Date().toISOString();
  let changed = false;
  for (const id of ids) {
    if (!map[id]) {
      map[id] = stamp;
      changed = true;
    }
  }
  if (changed) write(FIRST_KEY, pruneByAge(map, (v) => v, FIRST_MAX_AGE_MS, Date.now()));
}
