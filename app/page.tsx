"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BriefingData } from "@/lib/types";
import { AREAS } from "./ui";
import BroadsheetView from "./BroadsheetView";
import BriefView from "./BriefView";
import StoryView from "./StoryView";
import ReaderView from "./ReaderView";
import { palOf } from "./briefVM";
import { logSignal } from "./gateClient";
import "./briefing.css";
import "./brief.css";

// Weekly Briefing — "what moved this week in {area}", one tumor area at a time.
// DEFAULT experience = the responsive "story / reader" design (dark, one color per
// area): the phone-width story player on mobile, the centered reader on desktop,
// chosen by viewport. The earlier Brief/Broadsheet renderings are KEPT (not deleted)
// and reachable at ?design=classic as a fallback in case the new design needs work.

type ViewMode = "broadsheet" | "brief";

export default function BriefingPage() {
  const [area, setArea] = useState<string | undefined>(undefined);
  const [view, setView] = useState<ViewMode>("brief");
  const [classic, setClassic] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [data, setData] = useState<BriefingData | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Client-side cache: keep every area we've already fetched in memory so switching
  // tumor tabs is INSTANT (no blank flash, no round-trip). The server snapshot cache
  // makes each area ~160ms, but without this the browser re-fetched on every switch.
  // Alongside the payload we fetch the reader's per-area SEEN map once per session —
  // captured at load and held stable, so the deck never re-shuffles mid-visit (this
  // visit's views only affect the NEXT visit).
  const cacheRef = useRef<Record<string, { briefing: BriefingData; seen: Record<string, string> }>>({});
  const inflightRef = useRef<Record<string, Promise<void> | undefined>>({});
  const load = useCallback((a: string): Promise<void> => {
    if (cacheRef.current[a]) return Promise.resolve();
    const pending = inflightRef.current[a];
    if (pending) return pending;
    const p = Promise.all([
      fetch(`/api/briefing?area=${a}`).then((r) => r.json()),
      fetch(`/api/brief-seen?area=${a}`).then((r) => r.json()).catch(() => ({ seen: {} })),
    ])
      .then(([j, s]) => { if (j.error) throw new Error(j.error); cacheRef.current[a] = { briefing: j.briefing, seen: s?.seen ?? {} }; })
      .finally(() => { delete inflightRef.current[a]; });
    inflightRef.current[a] = p;
    return p;
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setArea(AREAS.includes(q.get("area") ?? "") ? (q.get("area") as string) : "GU");
    setView(q.get("view") === "broadsheet" ? "broadsheet" : "brief");
    setClassic(q.get("design") === "classic");
  }, []);

  // responsive: pick story (mobile) vs reader (desktop) by viewport width
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    if (!area) return;
    const cached = cacheRef.current[area];
    if (cached) { setData(cached.briefing); setSeen(cached.seen); setError(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null); setData(null);
    load(area)
      .then(() => { if (!cancelled) { const c = cacheRef.current[area]; setData(c.briefing); setSeen(c.seen); setError(null); } })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [area, load]);

  // Warm the other areas in the background once we know the current one, so the first
  // visit to each tab is already cached and switches feel instant.
  useEffect(() => {
    if (!area) return;
    for (const a of AREAS) if (a !== area) load(a).catch(() => {});
  }, [area, load]);

  // Signal: log a view per area shown (no-ops server-side if the reader isn't identified).
  useEffect(() => { if (area) logSignal("view", area); }, [area]);

  const sync = (next: Record<string, string>) => {
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(next)) u.searchParams.set(k, v);
    window.history.replaceState({}, "", u);
  };
  const pickArea = (a: string) => { setArea(a); sync({ area: a }); };
  const pickView = (v: ViewMode) => { setView(v); sync({ view: v }); };

  // ---- CLASSIC fallback (the original Brief/Broadsheet toggle) ----
  if (classic) {
    return (
      <div className={`bfroot ${view}`}>
        <div className="switchbar">
          <div className="sb-areas">
            {AREAS.map((a) => <button key={a} className={a === area ? "on" : ""} onClick={() => pickArea(a)}>{a}</button>)}
          </div>
          <div className="sb-view" role="tablist" aria-label="View">
            <button className={view === "brief" ? "on" : ""} onClick={() => pickView("brief")}>Brief</button>
            <button className={view === "broadsheet" ? "on" : ""} onClick={() => pickView("broadsheet")}>Broadsheet</button>
          </div>
        </div>
        {error && <div className="bf-banner">Couldn’t load the briefing: {error}</div>}
        {loading && !data && <div className="bf-state">Loading {area}…</div>}
        {data && area && (view === "brief" ? <BriefView data={data} area={area} /> : <BroadsheetView data={data} area={area} />)}
      </div>
    );
  }

  // ---- DEFAULT: responsive story / reader ----
  const bg = palOf(area ?? "GU").bg;
  if (!data || !area || isMobile === null) {
    return (
      <div style={{ position: "fixed", inset: 0, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.6)", font: "500 14px system-ui" }}>
        {error ? `Couldn’t load the briefing: ${error}` : `Loading ${area ?? ""}…`}
      </div>
    );
  }
  return isMobile
    ? <StoryView data={data} area={area} areas={AREAS} onArea={pickArea} seen={seen} />
    : <ReaderView data={data} area={area} areas={AREAS} onArea={pickArea} seen={seen} />;
}
