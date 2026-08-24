"use client";

import { useEffect, useMemo, useState } from "react";
import type { BriefingData } from "@/lib/types";
import {
  buildSignals,
  OncologySignal,
  SIGNAL_AREAS,
  SIGNAL_STATE_LABELS,
} from "./signalModel";
import styles from "./awesome.module.css";

type View = "priority" | "practice" | "debate" | "rising";

const VIEW_LABELS: Record<View, string> = {
  priority: "Priority",
  practice: "Practice signal",
  debate: "Debate",
  rising: "Rising",
};

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const formatDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
};

const formatUpdated = (value: string | null) => {
  if (!value) return "Updating";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const activityDelta = (delta: number) => `${delta > 0 ? "+" : ""}${delta}`;

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <strong>{compact.format(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

function SignalRow({
  signal,
  selected,
  onSelect,
}: {
  signal: OncologySignal;
  selected: boolean;
  onSelect: () => void;
}) {
  const stance = signal.mover.stance;
  return (
    <button
      type="button"
      className={`${styles.signalRow} ${selected ? styles.signalRowSelected : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.rowTopline}>
        <span className={styles.areaTag} data-area={signal.area}>{signal.area}</span>
        <span className={styles.stateTag} data-state={signal.state}>{SIGNAL_STATE_LABELS[signal.state]}</span>
        <span className={`${styles.delta} ${signal.mover.delta < 0 ? styles.deltaDown : ""}`}>
          {activityDelta(signal.mover.delta)}
        </span>
      </span>
      <strong className={styles.drugName}>{signal.mover.drug}</strong>
      <span className={styles.companyLine}>
        {[signal.mover.brand, signal.mover.company].filter(Boolean).join(" / ") || "Company not linked"}
      </span>
      <span className={styles.rowMetrics}>
        <span>{signal.mover.xSharers} physician{signal.mover.xSharers === 1 ? "" : "s"} on X</span>
        <span>{signal.mover.podEpisodes} podcast{signal.mover.podEpisodes === 1 ? "" : "s"}</span>
        <span>{signal.mover.articleCount} paper{signal.mover.articleCount === 1 ? "" : "s"}</span>
      </span>
      {stance ? (
        <span className={styles.miniStance} aria-label={`${stance.total} classified directional takes`}>
          <span className={styles.favorable} style={{ width: `${(stance.favorable / stance.total) * 100}%` }} />
          <span className={styles.mixed} style={{ width: `${(stance.mixed / stance.total) * 100}%` }} />
          <span className={styles.skeptical} style={{ width: `${(stance.skeptical / stance.total) * 100}%` }} />
        </span>
      ) : null}
    </button>
  );
}

function Detail({ signal }: { signal: OncologySignal }) {
  const { mover } = signal;
  const stance = mover.stance;
  const evidenceTotal = mover.podEpisodes + mover.xSharers + mover.articleCount;
  const favorablePct = stance?.total ? Math.round((stance.favorable / stance.total) * 100) : 0;
  const mixedPct = stance?.total ? Math.round((stance.mixed / stance.total) * 100) : 0;
  const skepticalPct = stance?.total ? Math.round((stance.skeptical / stance.total) * 100) : 0;

  return (
    <article className={styles.detail}>
      <header className={styles.detailHeader}>
        <div className={styles.detailEyebrow}>
          <span className={styles.areaTag} data-area={signal.area}>{signal.area}</span>
          <span className={styles.stateTag} data-state={signal.state}>{SIGNAL_STATE_LABELS[signal.state]}</span>
          <span>{signal.channelCount} evidence channel{signal.channelCount === 1 ? "" : "s"}</span>
        </div>
        <div className={styles.detailTitleRow}>
          <div>
            <h2>{mover.drug}</h2>
            <p>{[mover.brand, mover.company].filter(Boolean).join(" / ") || "Observed field activity"}</p>
          </div>
          <div className={`${styles.heroDelta} ${mover.delta < 0 ? styles.deltaDown : ""}`}>
            <strong>{activityDelta(mover.delta)}</strong>
            <span>activity delta</span>
          </div>
        </div>
        {signal.peers.length > 0 ? (
          <div className={styles.crossArea}>
            <span>Also active in</span>
            {signal.peers.map((peer) => (
              <span key={peer.area} className={styles.peerChip} data-area={peer.area}>
                {peer.area} {activityDelta(peer.delta)}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className={styles.metricBand} aria-label="Observed activity">
        <Metric value={mover.xSharers} label="physicians on X" />
        <Metric value={mover.podEpisodes} label="podcast episodes" />
        <Metric value={mover.articleCount} label="shared papers" />
        <Metric value={mover.topLikes} label="top post likes" />
      </section>

      <section className={styles.readSection}>
        <div className={styles.sectionLabel}>Field read</div>
        <p className={styles.fieldRead}>
          {mover.why || `${evidenceTotal} observed signals across ${signal.channelCount} field channels this week.`}
        </p>
        <div className={styles.signalMix}>
          <div className={styles.mixLabelRow}>
            <span>Evidence mix</span>
            <span>{evidenceTotal} observed signals</span>
          </div>
          <div className={styles.mixBar} aria-label="Podcast, X, and paper evidence mix">
            <span className={styles.mixPods} style={{ width: `${mover.podPct}%` }} />
            <span className={styles.mixX} style={{ width: `${mover.xPct}%` }} />
            <span className={styles.mixPapers} style={{ width: `${mover.articlePct}%` }} />
          </div>
          <div className={styles.mixLegend}>
            <span><i className={styles.legendPods} />Podcasts {mover.podPct}%</span>
            <span><i className={styles.legendX} />Physician X {mover.xPct}%</span>
            <span><i className={styles.legendPapers} />Papers {mover.articlePct}%</span>
          </div>
        </div>
      </section>

      {stance ? (
        <section className={styles.stanceSection}>
          <div className={styles.sectionHeading}>
            <div>
              <div className={styles.sectionLabel}>Directional reaction</div>
              <h3>{stance.total} classified takes</h3>
            </div>
            {stance.axis ? <span className={styles.axisChip}>Axis: {stance.axis}</span> : null}
          </div>
          <div className={styles.stanceBar} aria-label={`${favorablePct}% favorable, ${mixedPct}% mixed, ${skepticalPct}% skeptical`}>
            <span className={styles.favorable} style={{ width: `${favorablePct}%` }} />
            <span className={styles.mixed} style={{ width: `${mixedPct}%` }} />
            <span className={styles.skeptical} style={{ width: `${skepticalPct}%` }} />
          </div>
          <div className={styles.stanceLegend}>
            <span><strong>{stance.favorable}</strong> favorable</span>
            <span><strong>{stance.mixed}</strong> mixed</span>
            <span><strong>{stance.skeptical}</strong> skeptical</span>
            {stance.practiceChanging ? <span className={styles.practiceFlag}>Practice-changing language detected</span> : null}
          </div>
        </section>
      ) : (
        <section className={styles.noStance}>
          <div className={styles.sectionLabel}>Directional reaction</div>
          <p>Not enough classified opinion to call a directional field signal.</p>
        </section>
      )}

      <section className={styles.receiptsSection}>
        <div className={styles.sectionHeading}>
          <div>
            <div className={styles.sectionLabel}>Receipts</div>
            <h3>What the field actually said and shared</h3>
          </div>
          <span className={styles.receiptCount}>{Math.min(signal.receipts.length, 8)} shown</span>
        </div>
        {signal.receipts.length > 0 ? (
          <div className={styles.receiptList}>
            {signal.receipts.slice(0, 8).map((receipt) => {
              const content = (
                <>
                  <span className={styles.receiptTopline}>
                    <span className={styles.receiptKind} data-kind={receipt.kind}>
                      {receipt.kind === "x" ? "Physician X" : receipt.kind === "podcast" ? "Podcast" : "Paper"}
                    </span>
                    {receipt.valence ? <span className={styles.valence}>{receipt.valence}</span> : null}
                    {receipt.occurredAt ? <time>{formatDate(receipt.occurredAt)}</time> : null}
                  </span>
                  <strong>{receipt.title}</strong>
                  <span className={styles.receiptBody}>{receipt.body}</span>
                  {receipt.url ? <span className={styles.openReceipt}>Open receipt <span aria-hidden="true">&#8599;</span></span> : null}
                </>
              );
              return receipt.url ? (
                <a key={receipt.id} className={styles.receipt} href={receipt.url} target="_blank" rel="noreferrer">
                  {content}
                </a>
              ) : (
                <div key={receipt.id} className={styles.receipt}>{content}</div>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyText}>The activity is counted, but no serialized receipt is available in this snapshot.</p>
        )}
      </section>

      {signal.trials.length > 0 ? (
        <section className={styles.trialSection}>
          <div className={styles.sectionLabel}>Trial watch</div>
          <div className={styles.trialList}>
            {signal.trials.map((trial) => (
              <a key={trial.nctId} href={trial.url} target="_blank" rel="noreferrer" className={styles.trialRow}>
                <span>
                  <strong>{trial.acronym || trial.nctId}</strong>
                  <small>{[trial.phase, trial.status].filter(Boolean).join(" / ")}</small>
                </span>
                <span>{trial.totalMentions} mentions</span>
                <span aria-hidden="true">&#8599;</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function LoadingState() {
  return (
    <main className={styles.loadingShell} aria-busy="true">
      <div className={styles.loadingHeader} />
      <div className={styles.loadingGrid}>
        <div className={styles.loadingRail} />
        <div className={styles.loadingDetail} />
      </div>
    </main>
  );
}

export default function SignalRoom() {
  const [briefings, setBriefings] = useState<BriefingData[]>([]);
  const [failedAreas, setFailedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const [view, setView] = useState<View>("priority");
  const [area, setArea] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailedAreas([]);

    Promise.allSettled(
      SIGNAL_AREAS.map(async (signalArea) => {
        const response = await fetch(`/api/briefing?area=${encodeURIComponent(signalArea)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`${signalArea}: ${response.status}`);
        const payload = await response.json();
        return payload.briefing as BriefingData;
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      const next: BriefingData[] = [];
      const failed: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value?.movers) next.push(result.value);
        else failed.push(SIGNAL_AREAS[index]);
      });
      setBriefings(next);
      setFailedAreas(failed);
      setLoading(false);
    });

    return () => controller.abort();
  }, [loadKey]);

  const signals = useMemo(() => buildSignals(briefings), [briefings]);
  const visibleSignals = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return signals.filter((signal) => {
      if (area !== "All" && signal.area !== area) return false;
      if (view === "practice" && !signal.practiceChanging) return false;
      if (view === "debate" && !signal.debated) return false;
      if (view === "rising" && signal.mover.delta <= 0) return false;
      if (!needle) return true;
      return [signal.mover.drug, signal.mover.brand, signal.mover.company, signal.area]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [area, query, signals, view]);

  const selected = visibleSignals.find((signal) => signal.id === selectedId) || visibleSignals[0] || null;
  const generatedAt = briefings.reduce<string | null>((latest, briefing) => {
    if (!latest) return briefing.generatedAt;
    return new Date(briefing.generatedAt) > new Date(latest) ? briefing.generatedAt : latest;
  }, null);
  const practiceCount = signals.filter((signal) => signal.practiceChanging).length;
  const debateCount = signals.filter((signal) => signal.debated).length;
  const breakoutCount = signals.filter((signal) => signal.state === "breakout").length;

  if (loading) return <LoadingState />;

  if (briefings.length === 0) {
    return (
      <main className={styles.errorState}>
        <span>CANVASMD / SIGNAL ROOM</span>
        <h1>The live field signal could not be loaded.</h1>
        <p>No existing data was changed. The briefing service did not return a usable snapshot.</p>
        <button type="button" onClick={() => setLoadKey((key) => key + 1)}>Retry</button>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a href="/" className={styles.brand}>CANVASMD</a>
        <span className={styles.productName}>Signal Room</span>
        <span className={styles.liveStatus}><i />{briefings.length} specialties live</span>
        <time className={styles.updated}>Updated {formatUpdated(generatedAt)}</time>
        <a href="/" className={styles.readoutLink}>Readout</a>
      </header>

      {failedAreas.length > 0 ? (
        <div className={styles.partialBanner}>
          Showing a partial field view. {failedAreas.join(", ")} did not load.
          <button type="button" onClick={() => setLoadKey((key) => key + 1)}>Retry</button>
        </div>
      ) : null}

      <section className={styles.overview}>
        <div className={styles.overviewTitle}>
          <span>Observed oncology activity / this week</span>
          <h1>Where oncology attention is building</h1>
          <p>Cross-specialty physician conversation, traced back to the source.</p>
        </div>
        <div className={styles.overviewStats}>
          <div><strong>{signals.length}</strong><span>active drug signals</span></div>
          <div><strong>{breakoutCount}</strong><span>breakouts</span></div>
          <div><strong>{debateCount}</strong><span>live debates</span></div>
          <div><strong>{practiceCount}</strong><span>practice signals</span></div>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.rail}>
          <div className={styles.railControls}>
            <div className={styles.viewTabs} role="tablist" aria-label="Signal view">
              {(Object.keys(VIEW_LABELS) as View[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  className={view === key ? styles.activeTab : ""}
                  onClick={() => setView(key)}
                >
                  {VIEW_LABELS[key]}
                </button>
              ))}
            </div>
            <div className={styles.searchRow}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Drug, company, specialty"
                aria-label="Search signals"
              />
              <select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Filter by specialty">
                <option>All</option>
                {SIGNAL_AREAS.map((signalArea) => <option key={signalArea}>{signalArea}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.resultCount}>{visibleSignals.length} signals</div>
          <div className={styles.signalList}>
            {visibleSignals.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                selected={signal.id === selected?.id}
                onSelect={() => setSelectedId(signal.id)}
              />
            ))}
            {visibleSignals.length === 0 ? (
              <div className={styles.emptyRail}>
                <strong>No signals in this view.</strong>
                <button type="button" onClick={() => { setView("priority"); setArea("All"); setQuery(""); }}>
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </aside>
        <div className={styles.detailPane}>
          {selected ? <Detail signal={selected} /> : null}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Observed physician conversation and linked evidence. Field signal, not a forecast.</span>
        <span>Read-only data / no sponsored ranking</span>
      </footer>
    </main>
  );
}
