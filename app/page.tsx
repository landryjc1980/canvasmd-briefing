"use client";

import { useEffect, useState } from "react";
import { BriefingData } from "@/lib/types";
import { AREAS } from "./ui";
import BroadsheetView from "./BroadsheetView";
import BriefView from "./BriefView";
import "./briefing.css";
import "./brief.css";

// Weekly Briefing — "what moved this week in {area}", one tumor area at a time.
// Two renderings of the *same* BriefingData, chosen by a segmented toggle:
//   Broadsheet — the dense clinical-journal look (regulatory rail + fused-signal spine).
//   Brief      — the calm Apple/poetic distillation (one editorial line + a hushed list).
// Data lives in lib/briefing.ts; the views are BroadsheetView.tsx / BriefView.tsx.

type ViewMode = "broadsheet" | "brief";

export default function BriefingPage() {
  const [area, setArea] = useState<string | undefined>(undefined);
  const [view, setView] = useState<ViewMode>("brief");
  const [data, setData] = useState<BriefingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const a = q.get("area");
    const v = q.get("view");
    setArea(AREAS.includes(a ?? "") ? (a as string) : "GU");
    setView(v === "broadsheet" ? "broadsheet" : "brief");
  }, []);

  useEffect(() => {
    if (!area) return;
    setLoading(true); setError(null); setData(null); // clear stale area so its data never shows under the new masthead
    fetch(`/api/briefing?area=${area}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setData(j.briefing)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [area]);

  const sync = (next: { area?: string; view?: ViewMode }) => {
    const u = new URL(window.location.href);
    if (next.area) u.searchParams.set("area", next.area);
    if (next.view) u.searchParams.set("view", next.view);
    window.history.replaceState({}, "", u);
  };
  const pickArea = (a: string) => { setArea(a); sync({ area: a }); };
  const pickView = (v: ViewMode) => { setView(v); sync({ view: v }); };

  return (
    <div className={`bfroot ${view}`}>
      <div className="switchbar">
        <div className="sb-areas">
          {AREAS.map((a) => (
            <button key={a} className={a === area ? "on" : ""} onClick={() => pickArea(a)}>{a}</button>
          ))}
        </div>
        <div className="sb-view" role="tablist" aria-label="View">
          <button className={view === "brief" ? "on" : ""} onClick={() => pickView("brief")}>Brief</button>
          <button className={view === "broadsheet" ? "on" : ""} onClick={() => pickView("broadsheet")}>Broadsheet</button>
        </div>
      </div>

      {error && <div className="bf-banner">Couldn’t load the briefing: {error}</div>}
      {loading && !data && <div className="bf-state">Loading {area}…</div>}

      {data && area && (
        view === "brief"
          ? <BriefView data={data} area={area} />
          : <BroadsheetView data={data} area={area} />
      )}
    </div>
  );
}
