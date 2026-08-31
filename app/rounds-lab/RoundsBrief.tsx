"use client";

import { useEffect, useId, useState } from "react";
import type {
  ClinicalFact,
  EvidenceLink,
  LocalDiscussionBrief,
  SourceConversation,
  SourceReference,
} from "./fixture";
import type { RoundsPlayback } from "./RoundsPlayer";
import type { RoundsQuestionEvent } from "./questionModel";

export type RoundsBriefProps = {
  brief: LocalDiscussionBrief;
  playback?: RoundsPlayback | null;
  onListen?: (source: SourceConversation, reference: SourceReference) => void;
  idPrefix?: string;
};

function resolveEvidence(fact: ClinicalFact, evidence: EvidenceLink[]) {
  return fact.evidenceIds.map((evidenceId) => {
    const item = evidence.find((candidate) => candidate.id === evidenceId);
    if (!item) throw new Error(`Rounds Lab fixture has an unresolved evidence ID: ${evidenceId}`);
    return item;
  });
}

function sourceCheckedOn(fact: ClinicalFact) {
  if ("sourceCheckedOn" in fact && typeof fact.sourceCheckedOn === "string") {
    return fact.sourceCheckedOn;
  }
  if ("verifiedOn" in fact && typeof fact.verifiedOn === "string") {
    return fact.verifiedOn;
  }
  return "Date not recorded";
}

function independentStatus(fact: ClinicalFact) {
  if (!("independentVerification" in fact) || !fact.independentVerification) {
    return "Independent human verification required before external use";
  }

  const verification = fact.independentVerification as {
    status?: "required" | "complete" | "not-required";
    completedOn?: string;
  };

  if (verification.status === "complete" && verification.completedOn) {
    return `Independently verified ${verification.completedOn}`;
  }
  if (verification.status === "not-required") return "Independent verification not required";
  return "Independent human verification required before external use";
}

function ClinicalFactBlock({
  label,
  fact,
  evidence,
}: {
  label: string;
  fact: ClinicalFact;
  evidence: EvidenceLink[];
}) {
  const linkedEvidence = resolveEvidence(fact, evidence);

  return (
    <div className="rl-clinical-fact" data-claim-id={fact.id}>
      {label && <small>{label}</small>}
      <p>{fact.text}</p>
      <div className="rl-fact-provenance">
        <span>Clinical source checked {sourceCheckedOn(fact)}</span>
        <span>{independentStatus(fact)}</span>
        {fact.jurisdiction && <span>{fact.jurisdiction}</span>}
        {linkedEvidence.map((item) => (
          <a href={item.url} target="_blank" rel="noreferrer" key={item.id} data-kind={item.kind}>
            {item.label} · {item.title} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ClinicalFactsBlock({
  label,
  facts,
  evidence,
}: {
  label: string;
  facts: ClinicalFact[];
  evidence: EvidenceLink[];
}) {
  return (
    <div className="rl-clinical-fact-group">
      <small>{label}</small>
      <div className="rl-clinical-fact-items">
        {facts.map((fact) => (
          <ClinicalFactBlock key={fact.id} label="" fact={fact} evidence={evidence} />
        ))}
      </div>
    </div>
  );
}

export function ClaimSourceLinks({
  sources,
  sourceRefs,
  activePlayback,
  onListen,
  anchorPrefix,
}: {
  sources: SourceConversation[];
  sourceRefs: SourceReference[];
  activePlayback?: RoundsPlayback | null;
  onListen?: (source: SourceConversation, reference: SourceReference) => void;
  anchorPrefix?: string;
}) {
  const resolvedSources = sourceRefs.map((reference) => {
    const source = sources.find((candidate) => candidate.id === reference.sourceId);
    if (!source) throw new Error(`Rounds Lab fixture has an unresolved source ID: ${reference.sourceId}`);
    return { source, reference };
  });

  if (!resolvedSources.length) return null;

  return (
    <ul className="rl-claim-sources" aria-label="Source conversations for this statement">
      {resolvedSources.map(({ source, reference }, index) => {
        const active = activePlayback?.source.id === source.id
          && activePlayback.reference.startMs === reference.startMs;
        const firstSourceOccurrence = resolvedSources.findIndex(
          (candidate) => candidate.source.id === source.id,
        ) === index;
        const [timeLabel, ...contextParts] = reference.relevantAt.split(" · ");
        const context = contextParts.join(" · ");
        const supportBadge = source.episodeSupport.kind === "sponsor-supported"
          ? "Sponsor-supported"
          : source.episodeSupport.kind === "commercial-partner-disclosed"
            ? "Commercial partner disclosed"
          : source.episodeSupport.kind === "educational-grant-supported"
            ? "Grant-supported"
            : null;

        return (
          <li
            key={`${source.id}-${reference.startMs}`}
            id={anchorPrefix && firstSourceOccurrence ? `${anchorPrefix}-${source.id}` : undefined}
            tabIndex={anchorPrefix && firstSourceOccurrence ? -1 : undefined}
          >
            <button
              type="button"
              data-active={active}
              data-support={source.episodeSupport.kind}
              aria-current={active ? "true" : undefined}
              aria-controls={activePlayback ? "rounds-full-episode-player" : undefined}
              onClick={() => onListen?.(source, reference)}
              disabled={!onListen}
              aria-label={`Play ${source.show}, ${source.episode}, from ${reference.relevantAt} in the full-episode player`}
            >
              <span className="rl-claim-source-name">{source.citationLabel}</span>
              <span className="rl-claim-source-time">{timeLabel}</span>
              {context && <span className="rl-claim-source-context">{context}</span>}
              {supportBadge && <span className="rl-claim-source-support">{supportBadge}</span>}
              <span className="rl-claim-source-arrow" aria-hidden="true">▶</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function sourceSupportSummary(source: SourceConversation): string {
  if (source.episodeSupport.kind === "sponsor-supported") return "sponsor-supported";
  if (source.episodeSupport.kind === "commercial-partner-disclosed") return "commercial support disclosed";
  if (source.episodeSupport.kind === "educational-grant-supported") return "educational grant";
  if (source.episodeSupport.kind === "publisher-produced") return "publisher-produced";
  if (source.episodeSupport.kind === "unsponsored") return "unsponsored";
  return source.episodeSupport.label.toLowerCase();
}

function ClaimSourceSummary({
  sources,
  sourceRefs,
  evidenceAnchorPrefix,
  onRevealEvidence,
}: {
  sources: SourceConversation[];
  sourceRefs: SourceReference[];
  evidenceAnchorPrefix: string;
  onRevealEvidence: (targetId: string) => void;
}) {
  const sourceIds = [...new Set(sourceRefs.map((reference) => reference.sourceId))];
  const resolved = sourceIds
    .map((sourceId) => sources.find((source) => source.id === sourceId))
    .filter((source): source is SourceConversation => Boolean(source));

  if (!resolved.length) return null;

  return (
    <span className="rl-answer-logic-sources">
      Conversation evidence:{" "}
      {resolved.map((source, index) => {
        const targetId = `${evidenceAnchorPrefix}-${source.id}`;
        const guestNames = source.guests?.map((guest) => guest.name).join(", ");
        return (
          <span key={source.id}>
            {index > 0 ? " · " : ""}
            <a
              href={`#${targetId}`}
              onClick={(event) => {
                event.preventDefault();
                onRevealEvidence(targetId);
              }}
            >
              {source.citationLabel}{guestNames ? ` · ${guestNames}` : ""} ({sourceSupportSummary(source)})
            </a>
          </span>
        );
      })}
    </span>
  );
}

function ConversationCredits({ brief }: { brief: LocalDiscussionBrief }) {
  const reviewStatus = new Map(
    brief.editorialAudit.sourceReviews.map((review) => [review.sourceId, review.status]),
  );
  const creditedSources = brief.sources.filter(
    (source) => reviewStatus.get(source.id) === "complete-asset-reviewed" && source.guests?.length,
  );
  const excludedCount = brief.editorialAudit.sourceReviews.filter(
    (review) => review.status === "partial-asset-excluded",
  ).length;
  const episodeCountLabel = ["Zero", "One", "Two", "Three", "Four"][creditedSources.length]
    ?? String(creditedSources.length);

  if (!creditedSources.length) return null;

  return (
    <section className="rl-conversation-credits" aria-labelledby={`conversation-credits-${brief.id}`}>
      <div className="rl-conversation-credits-intro">
        <small id={`conversation-credits-${brief.id}`}>Voices behind this brief</small>
        <p>
          {episodeCountLabel} {creditedSources.length === 1 ? "episode shapes" : "episodes shape"} this answer.
          {excludedCount === 1 ? " One earlier episode was left out because only part of its transcript was available." : ""}
          {excludedCount > 1 ? ` ${excludedCount} earlier episodes were left out because only part of their transcripts was available.` : ""}
        </p>
      </div>
      <ul>
        {creditedSources.map((source) => (
          <li key={source.id}>
            <div className="rl-conversation-credit-show">
              <strong>{source.show}</strong>
              <time>{source.published}</time>
            </div>
            <p>{source.episode}</p>
            {source.guests?.map((guest) => (
              <span className="rl-conversation-credit-guest" key={`${source.id}-${guest.name}`}>
                <b>Guest:</b> {guest.name}{guest.role ? ` · ${guest.role}` : ""}
              </span>
            ))}
            <span className="rl-conversation-credit-support" data-support={source.episodeSupport.kind}>
              {source.episodeSupport.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudyEvidenceLinks({
  brief,
  fullEvidenceId,
  onRevealFullEvidence,
}: {
  brief: LocalDiscussionBrief;
  fullEvidenceId: string;
  onRevealFullEvidence: (targetId: string) => void;
}) {
  const studyRoles = new Set<EvidenceLink["role"]>(["primary-study", "trial-registry"]);
  const studyRecords = brief.clinicalContext.evidence.filter((item) => studyRoles.has(item.role));
  const featured = studyRecords.length
    ? studyRecords
    : brief.clinicalContext.evidence.filter((item) => item.role === "regulatory");
  const evidenceLabel = studyRecords.length ? "Study evidence" : "Evidence links";

  return (
    <nav className="rl-study-evidence-links" aria-label="Evidence records">
      <small>{evidenceLabel}</small>
      <div>
        {featured.map((item) => (
          <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
            <strong>{item.label}</strong>
            <span>{item.title} <span aria-hidden="true">↗</span></span>
          </a>
        ))}
        <a
          className="rl-full-evidence-link"
          href={`#${fullEvidenceId}`}
          onClick={(event) => {
            event.preventDefault();
            onRevealFullEvidence(fullEvidenceId);
          }}
        >
          <strong>Full evidence</strong>
          <span>All papers, episodes, disclosures, and review notes <span aria-hidden="true">↓</span></span>
        </a>
      </div>
    </nav>
  );
}

function transcriptAvailability(source: SourceConversation): string | null {
  if (!("transcript" in source) || !source.transcript) {
    return null;
  }
  const transcript = source.transcript as { kind?: string; label?: string };
  return transcript.label ?? (transcript.kind === "complete" ? "Complete transcript available" : "Relevant transcript evidence available");
}

function movementSectionLabel(state: LocalDiscussionBrief["movement"]["state"]): string {
  if (state === "Newly tracked") return "Why this question is new";
  if (state === "Watch") return "Why we’re watching";
  if (state === "Steady") return "What we reviewed";
  return "Why the answer changed";
}

function narrativeStageLabel(claim: LocalDiscussionBrief["synthesisClaims"][number]): string {
  return claim.stageLabel ?? "Evidence summary";
}

function readerAnswerEvidenceLabel(brief: LocalDiscussionBrief): string {
  return brief.answerLabel;
}

function readerMovementLabel(state: LocalDiscussionBrief["movement"]["state"]): string {
  if (state === "Newly tracked") return "Newly tracked";
  if (state === "Updated") return "Updated answer";
  if (state === "Watch") return "Watching";
  return "No meaningful change";
}

function readerEventLabel(event: RoundsQuestionEvent): string {
  if (event.readerLabel) return event.readerLabel;
  const labels: Record<string, string> = {
    "question-created": "Question added",
    "brief-recorded": "Brief recorded",
    "materially-updated": "Answer updated",
    "watch-signal": "New signal reviewed",
    "steady-review": "Reviewed — no meaningful change",
    "sources-reviewed": "Evidence reviewed",
    "correction-issued": "Correction",
  };
  return labels[event.type] ?? event.type.replaceAll("-", " ");
}

function readerEventDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function focusAndScrollTo(targetId: string, block: ScrollLogicalPosition): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block,
      });
    });
  });
}

function decodedLocationHash(): string {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
}

export function RoundsBrief({
  brief,
  playback = null,
  onListen,
  idPrefix,
}: RoundsBriefProps) {
  const [expandedFactorId, setExpandedFactorId] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [answerEvidenceOpen, setAnswerEvidenceOpen] = useState(false);
  const generatedPrefix = useId();
  const prefix = idPrefix ?? generatedPrefix;
  const sourceRegionId = `${prefix}-sources-${brief.id}`;
  const movementLabel = movementSectionLabel(brief.movement.state);
  const revealAnswerEvidence = (targetId: string) => {
    setAnswerEvidenceOpen(true);
    focusAndScrollTo(targetId, "center");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${targetId}`);
  };
  const revealFullEvidence = (targetId: string) => {
    setSourcesOpen(true);
    focusAndScrollTo(targetId, "start");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${targetId}`);
  };

  useEffect(() => {
    const revealHashTarget = () => {
      const targetId = decodedLocationHash();
      if (targetId === sourceRegionId) {
        setSourcesOpen(true);
        focusAndScrollTo(targetId, "start");
        return;
      }
      if (targetId.startsWith(`${prefix}-answer-evidence-${brief.id}-`)) {
        setAnswerEvidenceOpen(true);
        focusAndScrollTo(targetId, "center");
      }
    };
    revealHashTarget();
    window.addEventListener("hashchange", revealHashTarget);
    return () => window.removeEventListener("hashchange", revealHashTarget);
  }, [brief.id, prefix, sourceRegionId]);

  return (
    <article className="rl-brief" id={`${prefix}-brief-${brief.id}`} data-question-id={brief.id}>
      <header className="rl-opening">
        <div className="rl-opening-grid">
          <div className="rl-opening-copy">
            <div className="rl-context-line">
              <span>{brief.area}</span>
              <span>{brief.readingTime}</span>
            </div>
            <h1>{brief.question}</h1>
          </div>
        </div>

        <ConversationCredits brief={brief} />

        <StudyEvidenceLinks
          brief={brief}
          fullEvidenceId={sourceRegionId}
          onRevealFullEvidence={revealFullEvidence}
        />

        <div className="rl-summary-grid">
          <div className="rl-current-read" aria-labelledby={`${prefix}-discussion-summary-${brief.id}`}>
            <div className="rl-discussion-intro">
              <div className="rl-flow-kicker">
                <span aria-hidden="true">1</span>
                <p id={`${prefix}-discussion-summary-${brief.id}`}>Short answer</p>
              </div>
              <p className="rl-answer-context">{readerAnswerEvidenceLabel(brief)}</p>
              <h2 data-claim-id={`${brief.id}:answer`}>{brief.answerHeading}</h2>
            </div>

            <div className="rl-answer-logic" aria-label="How this answer was reached">
              {brief.synthesisClaims.map((claim) => (
                <div key={claim.id} data-claim-id={claim.id} data-stage={claim.stage}>
                  <small>{narrativeStageLabel(claim)}</small>
                  <p className="rl-lead">{claim.text}</p>
                  {["previous", "new"].includes(claim.stage ?? "") ? (
                    <ClaimSourceSummary
                      sources={brief.sources}
                      sourceRefs={claim.sourceRefs}
                      evidenceAnchorPrefix={`${prefix}-answer-evidence-${brief.id}-${claim.id}`}
                      onRevealEvidence={revealAnswerEvidence}
                    />
                  ) : null}
                  {claim.sourceContext ? (
                    <p className="rl-answer-source-context">{claim.sourceContext}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <details
              className="rl-answer-evidence"
              open={answerEvidenceOpen}
              onToggle={(event) => setAnswerEvidenceOpen(event.currentTarget.open)}
            >
              <summary>
                <span>See the cited moments behind this answer</span>
                <span aria-hidden="true">+</span>
              </summary>
              <div>
                {brief.synthesisClaims.map((claim) => (
                  <div key={`${claim.id}:evidence`}>
                    <small>{narrativeStageLabel(claim)}</small>
                    <ClaimSourceLinks
                      sources={brief.sources}
                      sourceRefs={claim.sourceRefs}
                      activePlayback={playback}
                      onListen={onListen}
                      anchorPrefix={`${prefix}-answer-evidence-${brief.id}-${claim.id}`}
                    />
                  </div>
                ))}
              </div>
            </details>
          </div>

          <aside
            className="rl-movement-note"
            aria-label={`${movementLabel} for this question`}
            data-claim-id={`${brief.id}:movement`}
          >
            <div className="rl-flow-kicker rl-flow-kicker-compact">
              <span aria-hidden="true">2</span>
              <p>{movementLabel}</p>
            </div>
            <div className="rl-movement-topline">
              <span className="rl-movement-state" data-state={brief.movement.state}>
                {readerMovementLabel(brief.movement.state)} · <time>{brief.movement.date}</time>
              </span>
            </div>
            <strong>{brief.movement.headline}</strong>
            {brief.movement.evidenceQualifier ? (
              <p className="rl-evidence-qualifier">{brief.movement.evidenceQualifier}</p>
            ) : null}
            <details className="rl-movement-evidence">
              <summary>See the source moments</summary>
              <ClaimSourceLinks
                sources={brief.sources}
                sourceRefs={brief.movement.sourceRefs}
                activePlayback={playback}
                onListen={onListen}
              />
            </details>
            <small>{brief.movement.dateLabel} · Evidence reviewed through {brief.movement.reviewedThrough}</small>
          </aside>
        </div>
      </header>

      <details className="rl-discussion rl-progressive-section">
        <summary className="rl-progressive-summary">
          <div className="rl-differences-intro">
            <div className="rl-flow-kicker">
              <span aria-hidden="true">3</span>
              <p id={`${prefix}-discussion-lenses-${brief.id}`}>Where the choice gets difficult</p>
            </div>
            <h2 data-claim-id={`${brief.id}:boundary:heading`}>{brief.differencesHeading}</h2>
            <p className="rl-section-context" data-claim-id={`${brief.id}:boundary:context`}>
              {brief.differencesContext}
            </p>
          </div>
          <span className="rl-toggle-icon" aria-hidden="true">+</span>
        </summary>

        <div className="rl-differences" aria-labelledby={`${prefix}-discussion-lenses-${brief.id}`}>
          <ol className="rl-lens-list">
            {brief.lenses.map((lens, index) => (
              <li key={lens.title}>
                <div>
                  <p className="rl-lens-label">{lens.label}</p>
                  <h3 data-claim-id={`${brief.id}:lens:${index + 1}:title`}>{lens.title}</h3>
                  <p className="rl-lens-detail" data-claim-id={`${brief.id}:lens:${index + 1}:detail`}>
                    {lens.detail}
                  </p>
                  <ClaimSourceLinks
                    sources={brief.sources}
                    sourceRefs={lens.sourceRefs}
                    activePlayback={playback}
                    onListen={onListen}
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </details>

      <details className="rl-factors rl-progressive-section">
        <summary className="rl-progressive-summary">
          <div className="rl-factors-heading">
            <div className="rl-flow-kicker">
              <span aria-hidden="true">4</span>
              <p id={`${prefix}-decision-factors-${brief.id}`}>What changes the decision for a patient</p>
            </div>
            <h2 data-claim-id={`${brief.id}:factors:heading`}>{brief.factorsHeading}</h2>
            <p className="rl-section-context" data-claim-id={`${brief.id}:factors:context`}>
              {brief.factorsContext}
            </p>
          </div>
          <span className="rl-toggle-icon" aria-hidden="true">+</span>
        </summary>

        <ol className="rl-factor-list" aria-labelledby={`${prefix}-decision-factors-${brief.id}`}>
          {brief.factors.map((factor) => {
            const factorPanelId = `${prefix}-factor-panel-${brief.id}-${factor.id}`;
            const factorKey = `${brief.id}-${factor.id}`;
            const expanded = expandedFactorId === factorKey;

            return (
              <li key={factor.id}>
                <button
                  type="button"
                  className="rl-factor-summary"
                  aria-expanded={expanded}
                  aria-controls={factorPanelId}
                  onClick={() => setExpandedFactorId(expanded ? null : factorKey)}
                >
                  <span className="rl-factor-label">{factor.label}</span>
                  <strong
                    className="rl-factor-implication"
                    data-claim-id={`${brief.id}:factor:${factor.id}:implication`}
                  >
                    {factor.implication}
                  </strong>
                  <span className="rl-factor-toggle" aria-hidden="true">{expanded ? "−" : "+"}</span>
                </button>
                <div className="rl-factor-body" id={factorPanelId} hidden={!expanded}>
                  <p data-claim-id={`${brief.id}:factor:${factor.id}:detail`}>{factor.detail}</p>
                  <ClaimSourceLinks
                    sources={brief.sources}
                    sourceRefs={factor.sourceRefs}
                    activePlayback={playback}
                    onListen={onListen}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </details>

      <details className="rl-clinical-context">
        <summary>
          <span>
            <span className="rl-flow-kicker">
              <span aria-hidden="true">5</span>
              <small id={`${prefix}-source-checked-context-${brief.id}`}>Clinical facts</small>
            </span>
            <strong>Source-checked status and key numbers</strong>
          </span>
          <span className="rl-toggle-icon" aria-hidden="true">+</span>
        </summary>
        <div className="rl-context-heading">
          <span>Source-checked facts, shown separately from the discussion synthesis</span>
        </div>
        <div
          className="rl-context-ledger"
          aria-labelledby={`${prefix}-source-checked-context-${brief.id}`}
        >
          <ClinicalFactBlock
            label="Current status"
            fact={brief.clinicalContext.status}
            evidence={brief.clinicalContext.evidence}
          />
          <ClinicalFactsBlock
            label={brief.clinicalContext.keyFactsLabel}
            facts={brief.clinicalContext.keyFacts}
            evidence={brief.clinicalContext.evidence}
          />
        </div>
      </details>

      <section className="rl-sources" aria-labelledby={`${prefix}-source-conversations-${brief.id}`}>
        <button
          type="button"
          className="rl-source-toggle"
          aria-expanded={sourcesOpen}
          aria-controls={sourceRegionId}
          onClick={() => setSourcesOpen((open) => !open)}
        >
          <span>
            <span className="rl-flow-kicker">
              <span aria-hidden="true">6</span>
              <small id={`${prefix}-source-conversations-${brief.id}`}>Full evidence</small>
            </span>
            <strong>All study records, papers, conversations, disclosures, and review notes</strong>
          </span>
          <span className="rl-toggle-icon" aria-hidden="true">{sourcesOpen ? "−" : "+"}</span>
        </button>

        <div className="rl-source-list" id={sourceRegionId} hidden={!sourcesOpen} tabIndex={-1}>
          <div className="rl-source-verification">
            <div>
              <small>Study records and papers</small>
              {brief.clinicalContext.evidence.map((item) => (
                <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
                  <strong>{item.label}</strong>
                  <span>{item.title} <span aria-hidden="true">↗</span></span>
                </a>
              ))}
            </div>
            <div>
              <small>Editorial status</small>
              <p>Local editorial draft · independent human fact verification required before external use · v{brief.governance.version}</p>
            </div>
          </div>

          {brief.sources.map((source) => {
            const defaultReference: SourceReference = {
              sourceId: source.id,
              relevantAt: source.relevantAt,
              startMs: source.relevantAtMs,
            };
            const timeLabel = source.relevantAt.split(" · ")[0];
            const sourceReview = brief.editorialAudit.sourceReviews.find(
              (review) => review.sourceId === source.id,
            );
            const availability = transcriptAvailability(source);

            return (
              <article className="rl-source" key={source.id}>
                <div className="rl-source-copy">
                  <p>{source.citationLabel}</p>
                  <h3>{source.episode}</h3>
                  <div className="rl-source-meta">
                    <span>Episode published {source.published}</span>
                    {source.guests?.length ? (
                      <span>Guest: {source.guests.map((guest) => guest.name).join(", ")}</span>
                    ) : null}
                    <span>{source.sourceRole}</span>
                    <span>{source.editorialFamily}</span>
                    <span data-support={source.episodeSupport.kind}>{source.episodeSupport.label}</span>
                    {sourceReview ? (
                      <span data-review-status={sourceReview.status}>
                        {sourceReview.status === "complete-asset-reviewed"
                          ? "Complete transcript reviewed"
                          : "Not used in this answer · only part of the transcript was available"}
                      </span>
                    ) : null}
                  </div>
                  <p className="rl-source-independence">Independence context: {source.independenceCluster}</p>
                  <small>{source.relevantAt}</small>
                  {availability ? <small>{availability}</small> : null}
                </div>
                <div className="rl-source-actions">
                  <button
                    type="button"
                    data-active={playback?.source.id === source.id && playback.reference.startMs === source.relevantAtMs}
                    aria-current={playback?.source.id === source.id && playback.reference.startMs === source.relevantAtMs ? "true" : undefined}
                    aria-controls={playback ? "rounds-full-episode-player" : undefined}
                    onClick={() => onListen?.(source, defaultReference)}
                    disabled={!onListen}
                    aria-label={`Play ${source.episode} from ${source.relevantAt} in the full-episode player`}
                  >
                    Hear from {timeLabel} <span aria-hidden="true">▶</span>
                  </button>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    Episode page <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>
            );
          })}
          <p className="rl-source-method">
            These are selected source conversations, not a measure of consensus across the field. Support and independence notes show how each episode was produced. Listening points open the complete episode in context without assigning a position to an individual clinician.
          </p>
          <div className="rl-source-review-notes">
            <div>
              <small>Source limitations</small>
              <ul>
                {brief.editorialAudit.sourceLimitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
            <div>
              <small>Claims changed or held back</small>
              <ul>
                {brief.editorialAudit.revisedOrBlockedClaims.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rl-source-governance">
            <div>
              <small>Accountability</small>
              <p>One {brief.governance.publishingOwnerRole} is accountable for the question, the short answer, what changed, and the publication decision.</p>
              <p>{brief.governance.factVerificationPolicy}. {brief.governance.interpretiveReviewPolicy}.</p>
              <p>AI may assist extraction, organization, tagging, and drafting; it cannot verify or publish.</p>
            </div>
            <div>
              <small>Question history</small>
              <div className="rl-version-list">
                {[...brief.versions].reverse().map((version) => (
                  <details key={version.id}>
                    <summary>
                      <span>
                        <strong>
                          v{version.version} · {version.status === "current" ? "Current" : "Archived"}
                        </strong>
                        <span>{version.recordedOn} · {version.movementState}</span>
                      </span>
                      <span aria-hidden="true">+</span>
                    </summary>
                    <p>{version.trigger}</p>
                    <p>
                      <strong>{version.snapshot.answerLabel}</strong>
                      {version.snapshot.answerHeading}
                    </p>
                  </details>
                ))}
              </div>
              <details className="rl-event-history">
                <summary>Review activity · {brief.events.length} events</summary>
                <ol>
                  {brief.events.map((event) => (
                    <li key={event.id}>
                      <strong><time dateTime={event.occurredOn}>{readerEventDate(event.occurredOn)}</time> · {readerEventLabel(event)}</strong>
                      <span>{event.summary}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

export default RoundsBrief;
