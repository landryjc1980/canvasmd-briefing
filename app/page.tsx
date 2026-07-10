"use client";

import { useEffect, useState } from "react";
import { BriefingData } from "@/lib/types";
import { AREAS } from "./ui";
import BroadsheetView from "./BroadsheetView";
import BriefView from "./BriefView";
import StoryView from "./StoryView";
import ReaderView from "./ReaderView";
import { palOf } from "./briefVM";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(true); setError(null); setData(null);
    fetch(`/api/briefing?area=${area}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setData(j.briefing)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [area]);

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
    ? <StoryView data={data} area={area} areas={AREAS} onArea={pickArea} />
    : <ReaderView data={data} area={area} areas={AREAS} onArea={pickArea} />;
}
