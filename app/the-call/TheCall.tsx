"use client";

import { useEffect, useMemo, useState } from "react";
import type { BriefingData } from "@/lib/types";
import { buildPracticeCalls, CALL_AREAS } from "./callModel";
import type { PracticeCall } from "./callModel";
import styles from "./the-call.module.css";

type Decision = "yes" | "not-yet";
type DecisionMap = Record<string, Decision>;

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
  decision: Decision | null;
  onDecision: (decision: Decision) => void;
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

function Loading() {
  return (
    <main className={styles.loading} aria-busy="true">
      <div className={styles.loadingLine} />
      <div className={styles.loadingQuestion} />
      <div className={styles.loadingTitle} />
    </main>
  );
}

export default function TheCall() {
  const [briefings, setBriefings] = useState<BriefingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [area, setArea] = useState("All oncology");
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<DecisionMap>({});
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
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    Promise.allSettled(
      CALL_AREAS.map(async (callArea) => {
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
  }, [loadKey]);

  const calls = useMemo(() => buildPracticeCalls(briefings), [briefings]);
  const scopedCalls = useMemo(
    () => area === "All oncology" ? calls : calls.filter((call) => call.area === area),
    [area, calls]
  );
  const call = scopedCalls.length > 0 ? scopedCalls[index % scopedCalls.length] : null;
  const decision = call ? decisions[call.id] ?? null : null;
  const revealed = Boolean(call && (revealedId === call.id || decision));
  const generatedAt = briefings.reduce<string | null>((latest, briefing) => {
    if (!latest) return briefing.generatedAt;
    return new Date(briefing.generatedAt) > new Date(latest) ? briefing.generatedAt : latest;
  }, null);

  const choose = (nextDecision: Decision) => {
    if (!call) return;
    const next = { ...decisions, [call.id]: nextDecision };
    setDecisions(next);
    setRevealedId(call.id);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A private browser can still complete the current call in memory.
    }
  };

  const nextCall = () => {
    setIndex((current) => current + 1);
    setRevealedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeArea = (nextArea: string) => {
    setArea(nextArea);
    setIndex(0);
    setRevealedId(null);
  };

  if (loading) return <Loading />;

  if (failed || !call) {
    return (
      <main className={styles.errorState}>
        <div className={styles.wordmark}>CANVASMD / THE CALL</div>
        <h1>No anchored call is available right now.</h1>
        <p>The source snapshots did not return a usable paper, action, report, or episode.</p>
        <button type="button" onClick={() => setLoadKey((key) => key + 1)}>Try again</button>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.wordmark} href="/">CANVASMD</a>
        <span className={styles.productName}>The Call</span>
        <time>{formatUpdated(generatedAt)}</time>
        <select value={area} onChange={(event) => changeArea(event.target.value)} aria-label="Choose oncology specialty">
          <option>All oncology</option>
          {CALL_AREAS.map((callArea) => <option key={callArea}>{callArea}</option>)}
        </select>
      </header>

      <article className={styles.call} key={call.id}>
        <div className={styles.callMeta}>
          <span>{call.area}</span>
          <span>{call.sourceKind}</span>
        </div>

        <p className={styles.prompt}>{call.prompt}</p>
        <h1>{call.headline}</h1>
        <p className={styles.sourceLine}>{call.sourceLabel}</p>

        <DecisionButtons decision={decision} onDecision={choose} />

        {!revealed ? (
          <button type="button" className={styles.evidenceFirst} onClick={() => setRevealedId(call.id)}>
            Show me the evidence first
          </button>
        ) : (
          <>
            <div className={styles.answerLine}>
              <span>Your call</span>
              <strong>{decision === "yes" ? "Yes, now" : decision === "not-yet" ? "Not yet" : "Evidence first"}</strong>
            </div>
            <Evidence call={call} />
            <div className={styles.nextRow}>
              <span>Your answer stays in this browser.</span>
              <button type="button" onClick={nextCall}>Next call <span aria-hidden="true">&#8594;</span></button>
            </div>
          </>
        )}
      </article>
    </main>
  );
}
