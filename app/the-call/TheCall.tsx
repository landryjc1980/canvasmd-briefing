"use client";

import { useEffect, useMemo, useState } from "react";
import type { BriefingData } from "@/lib/types";
import {
  areasForSelection,
  buildPracticeCalls,
  CALL_AREAS,
  practiceChangingCalls,
  unansweredPracticeCalls,
} from "./callModel";
import type { CallAreaSelection, CallDecision, CallDecisionMap, PracticeCall } from "./callModel";
import styles from "./the-call.module.css";

const STORAGE_KEY = "canvasmd-the-call-v1";

const formatUpdated = (value: string | null) => {
  if (!value) return "Updating";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated today";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const linkLabel = (call: PracticeCall) => {
  if (call.sourceKind === "Official action") return "Open official action";
  if (call.sourceKind === "Primary report") return "Open primary report";
  if (call.sourceKind === "Peer-reviewed paper") return "Open paper";
  return "Open episode";
};

function DecisionButtons({
  decision,
  onDecision,
}: {
  decision: CallDecision | null;
  onDecision: (decision: CallDecision) => void;
}) {
  return (
    <div className={styles.decisionButtons} aria-label="Your call">
      <button
        type="button"
        className={`${styles.yesButton} ${decision === "yes" ? styles.selectedYes : ""}`}
        aria-pressed={decision === "yes"}
        onClick={() => onDecision("yes")}
      >
        Yes, now
      </button>
      <button
        type="button"
        className={`${styles.waitButton} ${decision === "not-yet" ? styles.selectedWait : ""}`}
        aria-pressed={decision === "not-yet"}
        onClick={() => onDecision("not-yet")}
      >
        Not yet
      </button>
    </div>
  );
}

function Evidence({ call }: { call: PracticeCall }) {
  const note = call.fieldNote;
  return (
    <section className={styles.evidence} aria-label="Evidence behind this call">
      <div className={styles.receiptRow}>
        <div className={styles.receiptType}>{call.sourceKind}</div>
        <div className={styles.receiptContent}>
          <strong>{call.sourceLabel}</strong>
          {call.excerpt ? <p>{call.excerpt}</p> : <p>{call.headline}</p>}
          <a href={call.primaryUrl} target="_blank" rel="noreferrer">
            {linkLabel(call)} <span aria-hidden="true">&#8599;</span>
          </a>
        </div>
      </div>

      {call.deeperLink ? (
        <div className={styles.receiptRow}>
          <div className={styles.receiptType}>Go deeper</div>
          <div className={styles.receiptContent}>
            <strong>{call.deeperLink.sourceLabel}</strong>
            <p>{call.deeperLink.title}</p>
            <a href={call.deeperLink.url} target="_blank" rel="noreferrer">
              Open discussion <span aria-hidden="true">&#8599;</span>
            </a>
          </div>
        </div>
      ) : null}

      {note?.text ? (
        <div className={styles.receiptRow}>
          <div className={styles.receiptType}>One field note</div>
          <div className={styles.receiptContent}>
            <strong>{note.handle ? `${note.name} (@${note.handle})` : note.name}</strong>
            <p>{note.text}</p>
            {note.tweetUrl ? (
              <a href={note.tweetUrl} target="_blank" rel="noreferrer">
                Open exact post <span aria-hidden="true">&#8599;</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Brand() {
  return (
    <>
      <a className={styles.wordmark} href="/">CANVASMD</a>
      <span className={styles.productName}>The Call</span>
    </>
  );
}

function StartScreen({ onStart }: { onStart: (area: CallAreaSelection) => void }) {
  const [selection, setSelection] = useState<CallAreaSelection | "">("");

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}><Brand /></header>
      <section className={styles.startState}>
        <h1>Choose your oncology area.</h1>
        <div className={styles.startControls}>
          <label htmlFor="call-area">Oncology area</label>
          <select
            id="call-area"
            value={selection}
            onChange={(event) => setSelection(event.target.value as CallAreaSelection)}
          >
            <option value="" disabled>Select an area</option>
            <option>All oncology</option>
            {CALL_AREAS.map((callArea) => <option key={callArea}>{callArea}</option>)}
          </select>
          <button type="button" disabled={!selection} onClick={() => selection && onStart(selection)}>
            Start
          </button>
        </div>
      </section>
    </main>
  );
}

function Loading({ area, onChange }: { area: CallAreaSelection; onChange: () => void }) {
  return (
    <main className={styles.shell} aria-busy="true">
      <Topbar area={area} generatedAt={null} onChange={onChange} />
      <div className={styles.loading}>
        <div className={styles.loadingLine} />
        <div className={styles.loadingQuestion} />
        <div className={styles.loadingTitle} />
      </div>
    </main>
  );
}

function Topbar({
  area,
  generatedAt,
  onChange,
}: {
  area: CallAreaSelection;
  generatedAt: string | null;
  onChange: () => void;
}) {
  return (
    <header className={styles.topbar}>
      <Brand />
      <time>{formatUpdated(generatedAt)}</time>
      <span className={styles.topbarArea}>{area}</span>
      <button type="button" className={styles.changeArea} onClick={onChange}>Change</button>
    </header>
  );
}

export default function TheCall() {
  const [briefings, setBriefings] = useState<BriefingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [area, setArea] = useState<CallAreaSelection | null>(null);
  const [decisions, setDecisions] = useState<CallDecisionMap>({});
  const [revealedId, setRevealedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDecisions(JSON.parse(saved));
    } catch {
      // The product still works when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!area) {
      setBriefings([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    Promise.allSettled(
      areasForSelection(area).map(async (callArea) => {
        const response = await fetch(`/api/briefing?area=${encodeURIComponent(callArea)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`${callArea}: ${response.status}`);
        const payload = await response.json();
        return payload.briefing as BriefingData;
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      const next = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setBriefings(next);
      setFailed(next.length === 0);
      setLoading(false);
    });
    return () => controller.abort();
  }, [area, loadKey]);

  const calls = useMemo(() => buildPracticeCalls(briefings), [briefings]);
  const scopedCalls = useMemo(
    () => area === "All oncology" ? calls : calls.filter((call) => call.area === area),
    [area, calls]
  );
  const remainingCalls = useMemo(
    () => unansweredPracticeCalls(scopedCalls, decisions),
    [scopedCalls, decisions]
  );
  const keptCalls = useMemo(
    () => practiceChangingCalls(scopedCalls, decisions),
    [scopedCalls, decisions]
  );
  const call = remainingCalls[0] ?? null;
  const revealed = Boolean(call && revealedId === call.id);
  const generatedAt = briefings.reduce<string | null>((latest, briefing) => {
    if (!latest) return briefing.generatedAt;
    return new Date(briefing.generatedAt) > new Date(latest) ? briefing.generatedAt : latest;
  }, null);

  const saveDecisions = (next: CallDecisionMap) => {
    setDecisions(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A private browser can still complete the current call in memory.
    }
  };

  const choose = (nextDecision: CallDecision) => {
    if (!call) return;
    const next = { ...decisions, [call.id]: nextDecision };
    saveDecisions(next);
    setRevealedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startArea = (nextArea: CallAreaSelection) => {
    setLoading(true);
    setArea(nextArea);
    setRevealedId(null);
  };

  const changeArea = () => {
    setArea(null);
    setBriefings([]);
    setLoading(false);
    setRevealedId(null);
  };

  const reviewAgain = () => {
    const scopedIds = new Set(scopedCalls.map((scopedCall) => scopedCall.id));
    const next = Object.fromEntries(
      Object.entries(decisions).filter(([id]) => !scopedIds.has(id))
    ) as CallDecisionMap;
    saveDecisions(next);
    setRevealedId(null);
  };

  if (!area) return <StartScreen onStart={startArea} />;

  if (loading) return <Loading area={area} onChange={changeArea} />;

  if (failed || calls.length === 0 || scopedCalls.length === 0) {
    return (
      <main className={styles.errorState}>
        <div className={styles.wordmark}>CANVASMD / THE CALL</div>
        <h1>No anchored call is available right now.</h1>
        <p>The source snapshots did not return a usable paper, action, report, or episode.</p>
        <button type="button" onClick={() => setLoadKey((key) => key + 1)}>Try again</button>
      </main>
    );
  }

  if (!call) {
    return (
      <main className={styles.shell}>
        <Topbar area={area} generatedAt={generatedAt} onChange={changeArea} />
        <section className={styles.completeState}>
          <div className={styles.callMeta}><span>{area}</span></div>
          <p>You&apos;re caught up.</p>
          <h1>You&apos;ve made every current call in {area === "All oncology" ? "oncology" : area}.</h1>
          <section className={styles.keptCalls} aria-labelledby="practice-changing-title">
            <div className={styles.keptHeading}>
              <span>Yes, now</span>
              <h2 id="practice-changing-title">Practice-changing</h2>
            </div>
            {keptCalls.length > 0 ? (
              <ul>
                {keptCalls.map((keptCall) => (
                  <li key={keptCall.id}>
                    <a href={keptCall.primaryUrl} target="_blank" rel="noreferrer">
                      <strong>{keptCall.headline}</strong>
                      <span>{keptCall.sourceLabel} <span aria-hidden="true">&#8599;</span></span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nothing was marked practice-changing.</p>
            )}
          </section>
          <button type="button" onClick={reviewAgain}>Review again</button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <Topbar area={area} generatedAt={generatedAt} onChange={changeArea} />

      <article className={styles.call} key={call.id}>
        <div className={styles.callMeta}>
          <span>{call.area}</span>
          <span>{call.sourceKind}</span>
        </div>

        <p className={styles.prompt}>{call.prompt}</p>
        <h1>{call.headline}</h1>
        <p className={styles.sourceLine}>{call.sourceLabel}</p>

        <DecisionButtons decision={null} onDecision={choose} />

        {!revealed ? (
          <button type="button" className={styles.evidenceFirst} onClick={() => setRevealedId(call.id)}>
            Show me the evidence first
          </button>
        ) : (
          <Evidence call={call} />
        )}
      </article>
    </main>
  );
}
