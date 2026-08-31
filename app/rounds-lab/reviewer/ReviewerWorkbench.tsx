"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { RoundsBrief } from "../RoundsBrief";
import RoundsPlayer, { type RoundsPlayback } from "../RoundsPlayer";
import {
  LOCAL_ROUNDS_BRIEFS,
  type SourceConversation,
  type SourceReference,
} from "../fixture";
import {
  getPublicationReadiness,
  serializeReviewExport,
  type ClaimReviewStatus,
  type ReviewVersion,
  type SourceTranscriptRecord,
} from "../reviewModel";
import {
  createEmptyReviewRecord,
  loadReviewRecord,
  persistReviewRecord,
  setEditorialDecision,
  updateClaimNote,
  updateClaimStatus,
  updateOverallNote,
  type ReviewRecord,
} from "../reviewState";
import {
  CORRECTION_ALLOWED_SURFACE,
  CORRECTION_TEST_FIXTURE,
  canRenderCorrectionOnSurface,
} from "./correctionFixture";
import {
  REVIEWER_QUESTION_RECORDS,
  getReviewerQuestionRecord,
} from "./reviewerFixture";
import {
  buildTranscriptSearchResults,
  normalizeTranscriptSearch,
  type SearchableTranscriptSource,
} from "./transcriptSearch";

type WorkspaceView = "claims" | "sources" | "history";
type MobileSurface = "evidence" | "proof";

const WORKSPACE_TABS: Array<[WorkspaceView, string]> = [
  ["claims", "1 · Review claims"],
  ["sources", "2 · Check sources"],
  ["history", "3 · Decide"],
];

const CLAIM_STATUSES: Array<{
  value: ClaimReviewStatus;
  label: string;
}> = [
  { value: "supported", label: "Supported" },
  { value: "unsupported", label: "Unsupported" },
  { value: "needs-verification", label: "Needs verification" },
];

function humanAccuracyReviewLabel(transcript: SourceTranscriptRecord): string {
  return transcript.humanAccuracyReviewed
    ? "human accuracy review recorded"
    : "human accuracy review not recorded";
}

function publicationCompletenessLabel(transcript: SourceTranscriptRecord): string {
  return transcript.completenessReceipt.status === "recorded"
    ? "publication completeness receipt recorded"
    : "publication completeness receipt not recorded";
}

function resolvedInitialQuestionId(
  proposedQuestionId: string | undefined,
  questionRecords: readonly (typeof REVIEWER_QUESTION_RECORDS)[number][],
): string {
  if (proposedQuestionId && getReviewerQuestionRecord(proposedQuestionId, questionRecords)) {
    return proposedQuestionId;
  }
  if (proposedQuestionId) return "";
  return questionRecords[0]?.questionId ?? "";
}

function downloadReview(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readableStatus(status: ClaimReviewStatus): string {
  if (status === "needs-verification") return "Needs verification";
  if (status === "unreviewed") return "Unreviewed";
  return status[0].toUpperCase() + status.slice(1);
}

function reviewerClaimSectionLabel(section: string): string {
  const labels: Record<string, string> = {
    "current-read": "Short answer",
    "movement": "Why it changed",
    "decision-boundary": "Where the choice gets difficult",
    "patient-factors": "Patient decision factors",
    "clinical-context": "Clinical facts",
  };
  return labels[section] ?? section.replaceAll("-", " ");
}

function coveragePercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function transcriptSpanRatio(coverage: {
  durationMs: number;
  startsAtMs: number | null;
  endsAtMs: number | null;
}): number {
  if (
    coverage.durationMs <= 0
    || coverage.startsAtMs === null
    || coverage.endsAtMs === null
  ) return 0;
  return Math.min(
    1,
    Math.max(0, coverage.endsAtMs - coverage.startsAtMs) / coverage.durationMs,
  );
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatReviewTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function preservedClinicalFacts(
  snapshot: NonNullable<ReviewVersion["snapshot"]>,
): ReadonlyArray<{ id: string; text: string }> {
  if (!snapshot.clinicalFacts) return [];
  return [
    ...(snapshot.clinicalFacts.status ? [snapshot.clinicalFacts.status] : []),
    ...snapshot.clinicalFacts.keyFacts,
  ];
}

function readableBlocker(
  blocker: string,
  claims: ReadonlyArray<{ claimId: string }>,
): string {
  return claims.reduce(
    (copy, claim, index) => copy
      .replaceAll(`Clinical claim ${claim.claimId}`, `Clinical claim ${index + 1}`)
      .replaceAll(`Claim ${claim.claimId}`, `Claim ${index + 1}`),
    blocker,
  );
}

export default function ReviewerWorkbench({
  initialQuestionId,
  questionRecords = REVIEWER_QUESTION_RECORDS,
  transcriptLoadIssues = [],
}: {
  initialQuestionId?: string;
  questionRecords?: typeof REVIEWER_QUESTION_RECORDS;
  transcriptLoadIssues?: ReadonlyArray<{
    assetId: string;
    sourceIds: readonly string[];
    message: string;
  }>;
}) {
  const [questionId, setQuestionId] = useState(() =>
    resolvedInitialQuestionId(initialQuestionId, questionRecords),
  );
  const questionRecord =
    getReviewerQuestionRecord(questionId, questionRecords);
  const brief = questionRecord
    ? LOCAL_ROUNDS_BRIEFS.find((candidate) => candidate.id === questionRecord.questionId)
    : undefined;
  const [view, setView] = useState<WorkspaceView>("claims");
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>("evidence");
  const [selectedClaimId, setSelectedClaimId] = useState(
    questionRecord?.claims[0]?.claimId ?? "",
  );
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [expandedTranscriptSourceIds, setExpandedTranscriptSourceIds] = useState<string[]>([]);
  const [playback, setPlayback] = useState<RoundsPlayback | null>(null);
  const [requestId, setRequestId] = useState(0);
  const playbackTriggerRef = useRef<HTMLElement | null>(null);
  const claimDetailRef = useRef<HTMLElement | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRecord>(() =>
    questionRecord
      ? createEmptyReviewRecord(
          questionRecord.questionId,
          questionRecord.versionId,
          questionRecord.claims.map((claim) => claim.claimId),
        )
      : createEmptyReviewRecord("missing", "missing", []),
  );
  const searchableTranscriptSources = useMemo<SearchableTranscriptSource[]>(() => {
    if (!questionRecord || !brief) return [];
    return questionRecord.transcripts.flatMap((transcript) => {
      if (!transcript.searchableTranscriptAvailable) return [];
      const source = brief.sources.find((candidate) => candidate.id === transcript.sourceId);
      return source ? [{ source, transcript }] : [];
    });
  }, [brief, questionRecord]);
  const transcriptSearchResults = useMemo(
    () => buildTranscriptSearchResults(searchableTranscriptSources, transcriptQuery),
    [searchableTranscriptSources, transcriptQuery],
  );

  useEffect(() => {
    if (!questionRecord) return;
    setHydrated(false);
    setReview(
      loadReviewRecord(
        window.localStorage,
        questionRecord.questionId,
        questionRecord.versionId,
        questionRecord.claims.map((claim) => claim.claimId),
      ),
    );
    setSelectedClaimId(questionRecord.claims[0]?.claimId ?? "");
    setTranscriptQuery("");
    setExpandedTranscriptSourceIds([]);
    setPlayback(null);
    setStorageError(null);
    setHydrated(true);
  }, [questionRecord]);

  useEffect(() => {
    if (
      !hydrated ||
      !questionRecord ||
      review.questionId !== questionRecord.questionId ||
      review.versionId !== questionRecord.versionId
    ) {
      return;
    }
    const saveTimer = window.setTimeout(() => {
      try {
        persistReviewRecord(window.localStorage, review);
        setStorageError(null);
      } catch {
        setStorageError("Local review could not be saved. Existing review records were left untouched.");
      }
    }, 250);
    return () => window.clearTimeout(saveTimer);
  }, [hydrated, questionRecord, review]);

  useEffect(() => {
    claimDetailRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedClaimId]);

  if (!brief || !questionRecord) {
    return (
      <main className="reviewer-empty">
        <p>No local Rounds questions are available for review.</p>
      </main>
    );
  }

  const selectedClaim =
    questionRecord.claims.find((claim) => claim.claimId === selectedClaimId) ??
    questionRecord.claims[0];
  const selectedClaimIndex = selectedClaim
    ? questionRecord.claims.findIndex((claim) => claim.claimId === selectedClaim.claimId)
    : 0;
  const selectedClaimTabId = `reviewer-claim-tab-${Math.max(0, selectedClaimIndex)}`;
  const selectedPassages = selectedClaim
    ? questionRecord.passages.filter((passage) =>
        selectedClaim.evidencePassageIds.includes(passage.id),
      )
    : [];
  const query = normalizeTranscriptSearch(transcriptQuery);
  const matchingPassages = questionRecord.passages.filter((passage) => {
    if (!query) return true;
    return normalizeTranscriptSearch([
      passage.sourceLabel,
      passage.episodeTitle,
      passage.timestamp,
      passage.contextLabel,
      passage.text,
      passage.contextBefore,
      passage.contextAfter,
    ]
      .filter(Boolean)
      .join(" "))
      .includes(query);
  });
  const filteredEvidenceWindows = Array.from(
    new Map(
      matchingPassages
        .filter((passage) => Boolean(passage.transcriptWindowId))
        .map((passage) => [
        passage.transcriptWindowId ?? passage.id,
        passage,
      ] as const),
    ).values(),
  );
  const filteredCitationTargets = matchingPassages.filter(
    (passage) => ["unavailable", "rights-restricted"].includes(
      passage.transcriptCompleteness,
    ),
  );
  const hasBoundedEvidenceWindows = questionRecord.passages.some(
    (passage) => Boolean(passage.transcriptWindowId),
  );
  const searchableTranscriptSegments = searchableTranscriptSources.flatMap(
    ({ source, transcript }) => transcript.segments.map((segment) => ({
      segment,
      source,
      transcript,
    })),
  );
  const readiness = getPublicationReadiness(questionRecord, review);
  const assessedClaims = questionRecord.claims.filter(
    (claim) => (review.claimStatuses[claim.claimId] ?? "unreviewed") !== "unreviewed",
  ).length;
  const searchableTranscriptCount = questionRecord.transcripts.filter(
    (transcript) => transcript.searchableTranscriptAvailable,
  ).length;
  const attestedTranscriptCount = questionRecord.transcripts.filter(
    (transcript) => transcript.completeTranscriptAvailable,
  ).length;
  const currentSourceIds = new Set(brief.sources.map((source) => source.id));
  const currentTranscriptLoadIssues = transcriptLoadIssues.filter((issue) =>
    issue.sourceIds.some((sourceId) => currentSourceIds.has(sourceId)),
  );
  const unassessedClaims = questionRecord.claims.filter(
    (claim) => (review.claimStatuses[claim.claimId] ?? "unreviewed") === "unreviewed",
  );
  const unsupportedClaims = questionRecord.claims.filter(
    (claim) => review.claimStatuses[claim.claimId] === "unsupported",
  );
  const needsVerificationClaims = questionRecord.claims.filter(
    (claim) => review.claimStatuses[claim.claimId] === "needs-verification",
  );
  const claimStatusBlockerPattern = /has an invalid or missing review status|has not been assessed|is marked unsupported|still needs verification/i;
  const governanceAndEvidenceBlockers = readiness.blockers.filter(
    (blocker) => !claimStatusBlockerPattern.test(blocker),
  );
  const showCorrection =
    questionRecord.questionId === CORRECTION_TEST_FIXTURE.questionId &&
    canRenderCorrectionOnSurface(
      CORRECTION_TEST_FIXTURE,
      CORRECTION_ALLOWED_SURFACE,
    );
  const currentVersion = questionRecord.versions.find(
    (version) => version.eligibleAsCurrent,
  );
  const previousVersion = [...questionRecord.versions].reverse().find(
    (version) => version.status === "superseded" && version.snapshot,
  );
  const previousClaims = new Map(
    previousVersion?.snapshot?.synthesisClaims.map((claim) => [claim.id, claim.text]) ?? [],
  );
  const currentClaims = new Map(
    currentVersion?.snapshot?.synthesisClaims.map((claim) => [claim.id, claim.text]) ?? [],
  );
  const comparedClaimIds = Array.from(
    new Set([...previousClaims.keys(), ...currentClaims.keys()]),
  );

  const onListen = (source: SourceConversation, reference: SourceReference) => {
    if (document.activeElement instanceof HTMLElement) {
      playbackTriggerRef.current = document.activeElement;
    }
    const nextRequestId = requestId + 1;
    setRequestId(nextRequestId);
    setPlayback({ source, reference, requestId: nextRequestId });
  };

  const closePlayback = () => {
    setPlayback(null);
    window.requestAnimationFrame(() => playbackTriggerRef.current?.focus());
  };

  const setTranscriptDisclosureOpen = (sourceId: string, open: boolean) => {
    setExpandedTranscriptSourceIds((current) => {
      if (open) {
        return current.includes(sourceId) ? current : [...current, sourceId];
      }
      return current.filter((candidate) => candidate !== sourceId);
    });
  };

  const chooseQuestion = (nextQuestionId: string) => {
    setQuestionId(nextQuestionId);
    const url = new URL(window.location.href);
    url.searchParams.set("question", nextQuestionId);
    window.history.replaceState(null, "", url);
  };

  const exportFilename = `rounds-review-${questionRecord.questionId}-${questionRecord.versionId}.json`;

  const handleWorkspaceTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const currentIndex = tabs.indexOf(event.target as HTMLButtonElement);
    if (currentIndex < 0) return;

    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    }

    const nextView = WORKSPACE_TABS[nextIndex]?.[0];
    if (!nextView) return;
    setView(nextView);
    tabs[nextIndex]?.focus();
  };

  const handleClaimIndexKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const claims = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-reviewer-claim-id]'),
    );
    const currentIndex = claims.indexOf(event.target as HTMLButtonElement);
    if (currentIndex < 0) return;

    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = claims.length - 1;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + claims.length) % claims.length;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % claims.length;
    }

    const nextClaimId = claims[nextIndex]?.dataset.reviewerClaimId;
    if (!nextClaimId) return;
    setSelectedClaimId(nextClaimId);
    claims[nextIndex]?.focus();
  };

  const showFirstClaim = (claims: typeof questionRecord.claims) => {
    setView("claims");
    setSelectedClaimId(claims[0]?.claimId ?? questionRecord.claims[0]?.claimId ?? "");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const claimDetail = document.getElementById("reviewer-selected-claim");
        claimDetail?.focus();
        claimDetail?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const selectAdjacentClaim = (offset: -1 | 1) => {
    const nextClaim = questionRecord.claims[selectedClaimIndex + offset];
    if (nextClaim) setSelectedClaimId(nextClaim.claimId);
  };

  return (
    <main className="reviewer-shell">
      <a
        className="reviewer-skip-link"
        href="#reviewer-evidence-desk"
        onClick={() => setMobileSurface("evidence")}
      >
        Skip to review workspace
      </a>
      <header className="reviewer-masthead">
        <a className="reviewer-wordmark" href="/rounds-lab">
          CanvasMD <span>Rounds</span>
        </a>
        <div className="reviewer-masthead-copy">
          <span>Local editorial workbench</span>
          <span aria-hidden="true">·</span>
          <span>Not for publication</span>
        </div>
      </header>

      <section className="reviewer-intro" aria-labelledby="reviewer-title">
        <div>
          <p className="reviewer-kicker">Reader brief and evidence, side by side</p>
          <h1 id="reviewer-title">Review the brief in three clear steps.</h1>
          <p>
            Review each claim, check the source conversations, then record an editorial
            decision. Publication checks remain separate.
          </p>
        </div>
        <label className="reviewer-question-picker">
          <span>Clinical question</span>
          <select
            value={questionRecord.questionId}
            onChange={(event) => chooseQuestion(event.target.value)}
          >
            {questionRecords.map((candidate) => (
              <option key={candidate.questionId} value={candidate.questionId}>
                {candidate.question}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="reviewer-status-ribbon" aria-label="Review status">
        <div>
          <span className="reviewer-status-label">Review progress</span>
          <strong>
            {assessedClaims} of {questionRecord.claims.length} claims assessed
          </strong>
        </div>
        <div>
          <span className="reviewer-status-label">Editorial language</span>
          <strong>{questionRecord.currentVersionLabel} · {review.editorialDecision}</strong>
        </div>
        <div>
          <span className="reviewer-status-label">Publication readiness</span>
          <strong className={readiness.ready ? "is-ready" : "is-blocked"}>
            {readiness.ready
              ? "Ready"
              : `${unassessedClaims.length + unsupportedClaims.length + needsVerificationClaims.length} claim checks · ${governanceAndEvidenceBlockers.length} other gates`}
          </strong>
        </div>
      </section>

      {storageError ? (
        <p className="reviewer-storage-error" role="alert">
          {storageError}
        </p>
      ) : null}

      <div className="reviewer-surface-switch" aria-label="Reviewer surface">
        <button
          type="button"
          aria-pressed={mobileSurface === "evidence"}
          onClick={() => setMobileSurface("evidence")}
        >
          Review workspace
        </button>
        <button
          type="button"
          aria-pressed={mobileSurface === "proof"}
          onClick={() => setMobileSurface("proof")}
        >
          Reader proof
        </button>
      </div>

      <div className="reviewer-layout">
        <section
          className={`reviewer-proof${mobileSurface === "proof" ? "" : " is-mobile-hidden"}`}
          aria-labelledby="reader-proof-title"
        >
          <div className="reviewer-section-heading">
            <div>
              <p className="reviewer-eyebrow">Reader proof</p>
              <h2 id="reader-proof-title">What the clinician will read</h2>
            </div>
            <a href={`/rounds-lab?question=${encodeURIComponent(brief.id)}`}>
              Open reader page
            </a>
          </div>
          <div className="reviewer-proof-frame">
            <div className="rounds-lab reviewer-reader-surface">
              <RoundsBrief
                brief={brief}
                playback={playback}
                onListen={onListen}
                idPrefix="reviewer-proof"
              />
            </div>
          </div>
        </section>

        <aside
          id="reviewer-evidence-desk"
          className={`reviewer-desk${mobileSurface === "evidence" ? "" : " is-mobile-hidden"}`}
          aria-labelledby="evidence-desk-title"
          tabIndex={-1}
        >
          <div className="reviewer-desk-head">
            <p className="reviewer-eyebrow">Three-step review</p>
            <h2 id="evidence-desk-title">Review the evidence and decide</h2>
            <p>Work through the claims, check the source conversations, then record the editorial decision.</p>
            <details className="reviewer-method-note">
              <summary>How this review record works</summary>
              <p>{questionRecord.aiAuditNote}</p>
            </details>
          </div>

          <div
            className="reviewer-view-tabs"
            role="tablist"
            aria-label="Review workspace"
            onKeyDown={handleWorkspaceTabKeyDown}
          >
            {WORKSPACE_TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`reviewer-tab-${value}`}
                aria-controls={`reviewer-panel-${value}`}
                aria-selected={view === value}
                tabIndex={view === value ? 0 : -1}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "claims" ? (
            <div
              className="reviewer-claims-view"
              role="tabpanel"
              id="reviewer-panel-claims"
              aria-labelledby="reviewer-tab-claims"
            >
              <nav
                className="reviewer-claim-index"
                aria-label="Material claims"
                role="tablist"
                onKeyDown={handleClaimIndexKeyDown}
              >
                {questionRecord.claims.map((claim, index) => {
                  const status = review.claimStatuses[claim.claimId] ?? "unreviewed";
                  const active = claim.claimId === selectedClaim?.claimId;
                  return (
                    <button
                      key={claim.claimId}
                      type="button"
                      role="tab"
                      id={`reviewer-claim-tab-${index}`}
                      className={active ? "is-active" : ""}
                      data-reviewer-claim-id={claim.claimId}
                      aria-selected={active}
                      aria-controls="reviewer-selected-claim"
                      tabIndex={active ? 0 : -1}
                      onClick={() => setSelectedClaimId(claim.claimId)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span>{claim.claimText}</span>
                      <small data-status={status}>{readableStatus(status)}</small>
                    </button>
                  );
                })}
              </nav>

              {selectedClaim ? (
                <article
                  ref={claimDetailRef}
                  className="reviewer-claim-detail"
                  id="reviewer-selected-claim"
                  role="tabpanel"
                  aria-labelledby={selectedClaimTabId}
                  tabIndex={-1}
                >
                  <div className="reviewer-mobile-claim-nav" aria-label="Move between claims">
                    <button
                      type="button"
                      disabled={selectedClaimIndex <= 0}
                      onClick={() => selectAdjacentClaim(-1)}
                    >
                      ← Previous
                    </button>
                    <span>{selectedClaimIndex + 1} of {questionRecord.claims.length}</span>
                    <button
                      type="button"
                      disabled={selectedClaimIndex >= questionRecord.claims.length - 1}
                      onClick={() => selectAdjacentClaim(1)}
                    >
                      Next →
                    </button>
                  </div>
                  <header>
                    <span>{reviewerClaimSectionLabel(selectedClaim.section)}</span>
                    <h3 id="reviewer-selected-claim-title">{selectedClaim.claimText}</h3>
                  </header>

                  <dl className="reviewer-audit-grid">
                    <div>
                      <dt>How evidence is used</dt>
                      <dd>{selectedClaim.evidenceUse.replaceAll("-", " ")}</dd>
                    </div>
                    <div>
                      <dt>Why these inputs</dt>
                      <dd>{selectedClaim.relevance}</dd>
                    </div>
                    <div>
                      <dt>What remains uncertain</dt>
                      <dd>{selectedClaim.materialUncertainty}</dd>
                    </div>
                    <div>
                      <dt>Why this changed</dt>
                      <dd>{selectedClaim.movementRationale}</dd>
                    </div>
                  </dl>

                  <section className="reviewer-evidence-group">
                    <h4>Evidence used</h4>
                    {selectedPassages.length > 0 ? (
                      selectedPassages.map((passage) => (
                        <div className="reviewer-passage" key={passage.id}>
                          <div>
                            <strong>{passage.sourceLabel}</strong>
                            <span>{passage.timestamp} · {passage.contextLabel}</span>
                          </div>
                          <dl className="reviewer-passage-provenance">
                            <div>
                              <dt>Episode support</dt>
                              <dd>{passage.source.episodeSupport.label}</dd>
                            </div>
                            <div>
                              <dt>Editorial provenance</dt>
                              <dd>{passage.source.editorialFamily}</dd>
                            </div>
                            <div>
                              <dt>Independence group</dt>
                              <dd>{passage.source.independenceCluster}</dd>
                            </div>
                            <div>
                              <dt>Transcript asset</dt>
                              <dd>
                                {questionRecord.transcripts.find(
                                  (candidate) => candidate.sourceId === passage.sourceId,
                                )?.methodLabel ?? "Not recorded"}
                              </dd>
                            </div>
                          </dl>
                          <p>{passage.text}</p>
                          {passage.contextBefore || passage.contextAfter ? (
                            <details>
                              <summary
                                aria-label={`Available surrounding context for ${passage.sourceLabel} at ${passage.timestamp}`}
                              >
                                Available surrounding context
                              </summary>
                              {passage.contextBefore ? <p>{passage.contextBefore}</p> : null}
                              {passage.contextAfter ? <p>{passage.contextAfter}</p> : null}
                            </details>
                          ) : null}
                          <div className="reviewer-passage-actions">
                            <button
                              type="button"
                              aria-label={`Play ${passage.sourceLabel}, ${passage.episodeTitle}, from ${passage.timestamp} in the full episode`}
                              onClick={() => onListen(passage.source, passage.reference)}
                            >
                              Hear full episode from {passage.timestamp}
                            </button>
                            <a href={passage.sourceUrl} target="_blank" rel="noreferrer">
                              Publisher context
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="reviewer-empty-note">
                        This clinical statement maps to the references below rather than a
                        podcast transcript passage.
                      </p>
                    )}

                    {selectedClaim.clinicalEvidenceIds.length > 0 ? (
                      <ul className="reviewer-reference-list">
                        {selectedClaim.clinicalEvidenceIds.map((evidenceId) => {
                          const evidence = questionRecord.clinicalReferences.find(
                            (candidate) => candidate.id === evidenceId,
                          );
                          return evidence ? (
                            <li key={evidence.id}>
                              <a href={evidence.url} target="_blank" rel="noreferrer">
                                {evidence.title}
                              </a>
                              <span>{evidence.label}</span>
                            </li>
                          ) : (
                            <li key={evidenceId}>Missing reference: {evidenceId}</li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </section>

                  <details className="reviewer-audit-details">
                    <summary>Qualifiers, exclusions, and wording history</summary>
                    <h4>Qualifying evidence</h4>
                    {selectedClaim.qualifyingEvidence.length > 0 ? (
                      <ul>
                        {selectedClaim.qualifyingEvidence.map((qualifier) => (
                          <li key={qualifier}>{qualifier}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No separate qualifier is recorded for this sentence.</p>
                    )}
                    <h4>Sources available but not used for this sentence</h4>
                    {selectedClaim.sourcesConsideredButExcluded.length > 0 ? (
                      <ul>
                        {selectedClaim.sourcesConsideredButExcluded.map((excluded) => (
                          <li key={excluded.sourceLabel}>
                            <strong>{excluded.sourceLabel}:</strong> {excluded.reason}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No other question-level source was available.</p>
                    )}
                    <h4>Wording diff</h4>
                    {selectedClaim.wordingDiff.previous ? (
                      <p><strong>Previous:</strong> {selectedClaim.wordingDiff.previous}</p>
                    ) : null}
                    <p><strong>Current:</strong> {selectedClaim.wordingDiff.current}</p>
                    <p>{selectedClaim.wordingDiff.explanation}</p>
                  </details>

                  <fieldset className="reviewer-claim-decision">
                    <legend>Your review</legend>
                    <div>
                      {CLAIM_STATUSES.map((status) => (
                        <button
                          key={status.value}
                          type="button"
                          aria-pressed={
                            review.claimStatuses[selectedClaim.claimId] === status.value
                          }
                          onClick={() =>
                            setReview((current) =>
                              updateClaimStatus(current, selectedClaim.claimId, status.value),
                            )
                          }
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                    <label>
                      <span>Reviewer note for this claim</span>
                      <textarea
                        value={review.claimNotes[selectedClaim.claimId] ?? ""}
                        onChange={(event) =>
                          setReview((current) =>
                            updateClaimNote(
                              current,
                              selectedClaim.claimId,
                              event.target.value,
                            ),
                          )
                        }
                        placeholder="Record what needs checking or changing…"
                      />
                    </label>
                  </fieldset>
                </article>
              ) : null}
            </div>
          ) : null}

          {view === "sources" ? (
            <div
              className="reviewer-sources-view"
              role="tabpanel"
              id="reviewer-panel-sources"
              aria-labelledby="reviewer-tab-sources"
            >
              <section className="reviewer-editorial-audit">
                <p className="reviewer-eyebrow">Source review</p>
                <h3>How the evidence was selected and challenged</h3>
                <p>{questionRecord.editorialAudit.stateRationale}</p>
                <dl>
                  <div>
                    <dt>Conversation review</dt>
                    <dd>
                      <ul>
                        {questionRecord.editorialAudit.sourceReviews.map((review) => {
                          const source = brief.sources.find((candidate) => candidate.id === review.sourceId);
                          return (
                            <li key={review.sourceId}>
                              <strong>{source?.citationLabel ?? review.sourceId}:</strong>{" "}
                              {review.status.replaceAll("-", " ")} · {review.note}
                            </li>
                          );
                        })}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt>Evidence selected</dt>
                    <dd>{questionRecord.editorialAudit.evidenceSelections.join("; ")}.</dd>
                  </div>
                  <div>
                    <dt>Source limitations</dt>
                    <dd>{questionRecord.editorialAudit.sourceLimitations.join(" ")}</dd>
                  </div>
                  <div>
                    <dt>Counterevidence</dt>
                    <dd>{questionRecord.editorialAudit.counterevidence.join(" ")}</dd>
                  </div>
                  <div>
                    <dt>Claims changed or held back</dt>
                    <dd>{questionRecord.editorialAudit.revisedOrBlockedClaims.join(" ")}</dd>
                  </div>
                  <div>
                    <dt>Still unresolved</dt>
                    <dd>{questionRecord.editorialAudit.unresolved.join("; ")}.</dd>
                  </div>
                </dl>
              </section>

              <section className="reviewer-transcript-coverage">
                <div>
                  <p className="reviewer-eyebrow">Transcript access</p>
                  <h3>
                    {searchableTranscriptCount} of {questionRecord.transcripts.length} source
                    conversations are searchable
                  </h3>
                </div>
                <p className="reviewer-blocker-copy">
                  {attestedTranscriptCount} carry a publication-grade human completeness
                  receipt. Search access does not clear the publication gate.
                </p>
                {currentTranscriptLoadIssues.length > 0 ? (
                  <p className="reviewer-blocker-copy">
                    {currentTranscriptLoadIssues.length} local transcript
                    {currentTranscriptLoadIssues.length === 1 ? " asset did" : " assets did"}
                    {" "}not load. The affected source rows remain explicit below.
                  </p>
                ) : null}
              </section>

              <label className="reviewer-search">
                <span>Search this question’s source transcripts</span>
                <input
                  type="search"
                  value={transcriptQuery}
                  onChange={(event) => setTranscriptQuery(event.target.value)}
                  placeholder="Episode, timestamp, topic, or passage"
                />
              </label>
              <p className="reviewer-search-scope">
                Searching this question’s {searchableTranscriptSources.length} source
                {searchableTranscriptSources.length === 1 ? " conversation" : " conversations"}
                {" "}with loaded transcript text.
              </p>
              <p className="reviewer-result-count" aria-live="polite">
                {query
                  ? `Showing ${transcriptSearchResults.shownMatchCount} of ${transcriptSearchResults.totalMatchCount} full-conversation transcript matches · ${countLabel(filteredEvidenceWindows.length, "bounded evidence window")} · ${countLabel(filteredCitationTargets.length, "citation target")} without local text`
                  : `${countLabel(searchableTranscriptSegments.length, "searchable transcript segment")} loaded · ${countLabel(filteredEvidenceWindows.length, "bounded evidence window")} · ${countLabel(filteredCitationTargets.length, "citation target")} without local text`}
              </p>

              {searchableTranscriptCount > 0 ? (
                <section className="reviewer-complete-transcript-results">
                  <h3>Full-conversation transcript{query ? " matches" : " access"}</h3>
                  {query ? (
                    transcriptSearchResults.shownMatchCount > 0 ? (
                      <div className="reviewer-transcript-results">
                        {transcriptSearchResults.groups.map(({ source, transcript, totalMatchCount, matches }) => (
                          <section className="reviewer-transcript-result-group" key={source.id}>
                            <div className="reviewer-transcript-result-group-heading">
                              <div>
                                <strong>{source.citationLabel}</strong>
                                <span>{source.episode} · {source.published}</span>
                                <span className="reviewer-transcript-result-trust">
                                  {transcript.origin} · {humanAccuracyReviewLabel(transcript)}
                                  {" · "}{publicationCompletenessLabel(transcript)}
                                </span>
                              </div>
                              <span>Showing {matches.length} of {totalMatchCount} in this source</span>
                            </div>
                            {matches.map((match) => (
                              <article key={match.id}>
                                <header>
                                  <div>
                                    <strong>{match.matchKind}</strong>
                                    <span>{match.contextLabel}</span>
                                  </div>
                                </header>
                                <p>{match.contextText}</p>
                                <div>
                                  <button
                                    type="button"
                                    aria-label={`Play ${source.citationLabel}, ${source.episode}, from ${match.anchorSegment.timestamp} in the full episode`}
                                    onClick={() => onListen(source, {
                                      sourceId: source.id,
                                      relevantAt: `${match.anchorSegment.timestamp} · Searchable transcript`,
                                      startMs: match.anchorSegment.startMs,
                                    })}
                                  >
                                    Play full episode in context
                                  </button>
                                </div>
                              </article>
                            ))}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="reviewer-empty-note">No transcript context matches this search.</p>
                    )
                  ) : (
                    <p className="reviewer-empty-note">
                      Enter a term to search every loaded full-conversation transcript. Each
                      source below identifies whether it came from the publisher or a local
                      machine pass, and whether human review is recorded.
                    </p>
                  )}
                </section>
              ) : null}

              {hasBoundedEvidenceWindows ? (
              <section className="reviewer-evidence-window-results">
                <h3>Bounded evidence windows</h3>
                <p className="reviewer-evidence-window-note">
                  These bounded windows support spot-checking only. A citation target may sit
                  within a wider window; the row does not claim the words begin at that exact second.
                </p>
                <div className="reviewer-transcript-results">
                {filteredEvidenceWindows.map((passage) => (
                  <article key={passage.id}>
                    <header>
                      <div>
                        <strong>{passage.sourceLabel}</strong>
                        <span>{passage.published}</span>
                      </div>
                      <span>{passage.transcriptCompleteness} evidence window</span>
                    </header>
                    <h4>{passage.timestamp} · {passage.contextLabel}</h4>
                    <p>{passage.text}</p>
                    <div>
                      <button
                        type="button"
                        aria-label={`Play ${passage.sourceLabel}, ${passage.episodeTitle}, from ${passage.timestamp} in the full episode`}
                        onClick={() => onListen(passage.source, passage.reference)}
                      >
                        Play full episode in context
                      </button>
                      <a href={passage.sourceUrl} target="_blank" rel="noreferrer">
                        Open episode page
                      </a>
                    </div>
                  </article>
                ))}
                {filteredEvidenceWindows.length === 0 ? (
                  <p className="reviewer-empty-note">No available evidence window matches this search.</p>
                ) : null}
                </div>
              </section>
              ) : null}

              {filteredCitationTargets.length > 0 ? (
                <section className="reviewer-citation-target-results">
                  <h3>Citation targets without local transcript text</h3>
                  <p className="reviewer-evidence-window-note">
                    Timing and topic are recorded, but no transcript wording is loaded. These
                    targets support episode-context playback—not sentence-level acceptance.
                  </p>
                  <div className="reviewer-transcript-results">
                    {filteredCitationTargets.map((passage) => (
                      <article key={passage.id}>
                        <header>
                          <div>
                            <strong>{passage.sourceLabel}</strong>
                            <span>{passage.published}</span>
                          </div>
                          <span>{passage.transcriptCompleteness}</span>
                        </header>
                        <h4>{passage.timestamp} · {passage.contextLabel}</h4>
                        <p>{passage.text}</p>
                        <div>
                          <button
                            type="button"
                            aria-label={`Play ${passage.sourceLabel}, ${passage.episodeTitle}, from ${passage.timestamp} in the full episode`}
                            onClick={() => onListen(passage.source, passage.reference)}
                          >
                            Play full episode in context
                          </button>
                          <a href={passage.sourceUrl} target="_blank" rel="noreferrer">
                            Open episode page
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="reviewer-source-inventory">
                <h3>All source conversations</h3>
                {brief.sources.map((source) => {
                  const transcript = questionRecord.transcripts.find(
                    (candidate) => candidate.sourceId === source.id,
                  );
                  const transcriptDisclosureOpen = expandedTranscriptSourceIds.includes(source.id);
                  return (
                    <article key={`${questionRecord.questionId}:${source.id}`}>
                      <div>
                        <p>{source.citationLabel}</p>
                        <h4>{source.episode}</h4>
                        <span>{source.published} · {source.sourceRole}</span>
                      </div>
                      <dl>
                        <div>
                          <dt>Provenance</dt>
                          <dd>{source.editorialFamily} · {source.independenceCluster}</dd>
                        </div>
                        <div>
                          <dt>Support context</dt>
                          <dd>{source.episodeSupport.label}</dd>
                        </div>
                        <div>
                          <dt>Transcript</dt>
                          <dd>{transcript?.availabilityNote ?? "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt>Transcript origin</dt>
                          <dd>{transcript?.origin ?? "Unknown"}</dd>
                        </div>
                        <div>
                          <dt>Method · checked</dt>
                          <dd>
                            {transcript?.methodLabel ?? "Not recorded"}
                            {transcript ? ` · checked ${transcript.checkedOn}` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>Temporal transcript span</dt>
                          <dd>
                            {transcript
                              ? `${coveragePercent(transcriptSpanRatio(transcript.coverage))} first-to-last · ${coveragePercent(transcript.coverage.coverageRatio)} timed cues · ${transcript.coverage.validatedComplete ? "whole-duration check passed" : "strict whole-duration check not passed"}`
                              : "Not recorded"}
                          </dd>
                        </div>
                        <div>
                          <dt>Publication attestation</dt>
                          <dd>
                            {transcript
                              ? transcript.completenessReceipt.status === "recorded"
                                ? `${transcript.completenessReceipt.scope.replaceAll("-", " ")} · ${transcript.completenessReceipt.recordedBy} · ${transcript.completenessReceipt.recordedOn} · asset ${transcript.completenessReceipt.transcriptAssetId ?? "missing"} · ${transcript.completenessReceipt.recordedSegmentCount ?? "unknown"} segments · ${transcript.completenessReceipt.recordedDurationMs ?? "unknown"}ms · ${transcript.completenessReceipt.transcriptContentSha256 ?? "digest missing"}`
                                : transcript.completenessReceipt.note
                              : "Not recorded"}
                          </dd>
                        </div>
                      </dl>
                      {transcript?.searchableTranscriptAvailable ? (
                        <details
                          className="reviewer-complete-transcript"
                          open={transcriptDisclosureOpen}
                          onToggle={(event) => setTranscriptDisclosureOpen(
                            source.id,
                            event.currentTarget.open,
                          )}
                        >
                          <summary
                            aria-label={`Read searchable transcript for ${source.citationLabel}: ${source.episode}`}
                          >
                            Read searchable transcript
                          </summary>
                          {transcriptDisclosureOpen ? (
                            <>
                              <p>
                                {transcript.origin} transcript · {transcript.methodLabel} · checked {transcript.checkedOn}
                              </p>
                              <p>
                                {humanAccuracyReviewLabel(transcript)}
                                {" · "}{publicationCompletenessLabel(transcript)}
                                {" · "}{transcript.completenessReceipt.note}
                              </p>
                              <div>
                                {transcript.segments.map((segment) => (
                                  <article key={segment.id}>
                                    <button
                                      type="button"
                                      aria-label={`Play ${source.citationLabel}, ${source.episode}, from ${segment.timestamp} in the full episode`}
                                      onClick={() => onListen(source, {
                                        sourceId: source.id,
                                        relevantAt: `${segment.timestamp} · Searchable transcript`,
                                        startMs: segment.startMs,
                                      })}
                                    >
                                      {segment.timestamp}
                                    </button>
                                    <p>{segment.text}</p>
                                  </article>
                                ))}
                              </div>
                            </>
                          ) : null}
                        </details>
                      ) : null}
                      <div className="reviewer-source-actions">
                        <button
                          type="button"
                          aria-label={`Hear ${source.citationLabel}, ${source.episode}, from ${source.relevantAt}`}
                          onClick={() =>
                            onListen(source, {
                              sourceId: source.id,
                              relevantAt: source.relevantAt,
                              startMs: source.relevantAtMs,
                            })
                          }
                        >
                          Hear episode from cited moment
                        </button>
                        {transcript?.transcriptUrl ? (
                          <a href={transcript.transcriptUrl} target="_blank" rel="noreferrer">
                            Open publisher transcript
                          </a>
                        ) : null}
                        <a href={source.url} target="_blank" rel="noreferrer">
                          Episode context
                        </a>
                      </div>
                    </article>
                  );
                })}
              </section>

              <section className="reviewer-clinical-references">
                <h3>Clinical references</h3>
                <ul>
                  {questionRecord.clinicalReferences.map((reference) => (
                    <li key={reference.id}>
                      <a href={reference.url} target="_blank" rel="noreferrer">
                        {reference.title}
                      </a>
                      <span>{reference.label} · {reference.kind}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {view === "history" ? (
            <div
              className="reviewer-history-view"
              role="tabpanel"
              id="reviewer-panel-history"
              aria-labelledby="reviewer-tab-history"
            >
              <section className="reviewer-version-compare">
                <p className="reviewer-eyebrow">Draft comparison</p>
                <h3>Previous snapshot → current draft</h3>
                {previousVersion?.snapshot && currentVersion?.snapshot ? (
                  <>
                    <div className="reviewer-comparison-columns">
                      <article>
                        <span>{previousVersion.label} · {previousVersion.date}</span>
                        <h4>Question</h4>
                        <p>{previousVersion.snapshot.question}</p>
                        <h4>{previousVersion.snapshot.answerLabel}</h4>
                        <p>{previousVersion.snapshot.answerHeading}</p>
                      </article>
                      <article>
                        <span>{currentVersion.label} · {currentVersion.date}</span>
                        <h4>Question</h4>
                        <p>{currentVersion.snapshot.question}</p>
                        <h4>{currentVersion.snapshot.answerLabel}</h4>
                        <p>{currentVersion.snapshot.answerHeading}</p>
                      </article>
                    </div>
                    <div className="reviewer-claim-diff">
                      <h4>Claim-level changes</h4>
                      {comparedClaimIds.map((claimId) => {
                        const previousText = previousClaims.get(claimId);
                        const currentText = currentClaims.get(claimId);
                        const change = !previousText
                          ? "Added"
                          : !currentText
                            ? "Removed"
                            : previousText === currentText
                              ? "Unchanged"
                              : "Reworded";
                        return (
                          <article key={claimId} data-change={change.toLocaleLowerCase()}>
                            <header>
                              <code>{claimId}</code>
                              <strong>{change}</strong>
                            </header>
                            {previousText ? (
                              <p><span>Previous</span>{previousText}</p>
                            ) : null}
                            {currentText ? (
                              <p><span>Current</span>{currentText}</p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="reviewer-first-version">
                    First reviewed version · no prior reader snapshot exists for comparison.
                  </p>
                )}
              </section>

              <section>
                <p className="reviewer-eyebrow">Version history</p>
                <h3>Current draft and prior versions</h3>
                <ol className="reviewer-version-list">
                  {questionRecord.versions.map((version) => (
                    <li key={version.versionId}>
                      <div>
                        <strong>{version.label}</strong>
                        <span>
                          {version.date} · {version.status.replaceAll("-", " ")} · {version.snapshotCoverage.replaceAll("-", " ")}
                        </span>
                      </div>
                      <p>{version.trigger}</p>
                      <p>{version.change}</p>
                      {version.snapshot ? (
                        <details>
                          <summary>Inspect reader snapshot</summary>
                          <p><strong>Question:</strong> {version.snapshot.question}</p>
                          <p><strong>{version.snapshot.answerLabel}:</strong> {version.snapshot.answerHeading}</p>
                          <ul>
                            {version.snapshot.synthesisClaims.map((claim) => (
                              <li key={claim.id}>{claim.text}</li>
                            ))}
                          </ul>
                          <p>
                            <strong>Movement:</strong>{" "}
                            {version.snapshot.movement.state} · {version.snapshot.movement.headline}
                          </p>
                          {version.snapshot.decisionBoundary ? (
                            <>
                              <p>
                                <strong>Decision boundary:</strong>{" "}
                                {version.snapshot.decisionBoundary.heading} {version.snapshot.decisionBoundary.context}
                              </p>
                              <ul>
                                {version.snapshot.decisionBoundary.lenses.map((lens) => (
                                  <li key={`${lens.label}:${lens.title}`}>
                                    <strong>{lens.label}:</strong> {lens.title} {lens.detail}
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : version.snapshotCoverage === "full-reader-core" ? (
                            <p><strong>Decision boundary:</strong> Not present in this version.</p>
                          ) : null}
                          {version.snapshot.patientFactors ? (
                            <>
                              <p>
                                <strong>{version.snapshot.patientFactors.label}:</strong>{" "}
                                {version.snapshot.patientFactors.heading} {version.snapshot.patientFactors.context}
                              </p>
                              <ul>
                                {version.snapshot.patientFactors.factors.map((factor) => (
                                  <li key={factor.id}>
                                    <strong>{factor.label}:</strong> {factor.implication} {factor.detail}
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : version.snapshotCoverage === "full-reader-core" ? (
                            <p><strong>Patient-factor section:</strong> Not present in this version.</p>
                          ) : null}
                          {preservedClinicalFacts(version.snapshot).length ? (
                            <>
                              <p><strong>Clinical facts preserved:</strong></p>
                              <ul>
                                {preservedClinicalFacts(version.snapshot).map((fact) => (
                                  <li key={fact.id}>{fact.text}</li>
                                ))}
                              </ul>
                            </>
                          ) : version.snapshotCoverage === "full-reader-core" ? (
                            <p><strong>Clinical-fact section:</strong> Not present in this version.</p>
                          ) : null}
                          <p>
                            <strong>Source conversation IDs:</strong>{" "}
                            {version.snapshot.sourceIds.length
                              ? version.snapshot.sourceIds.join(", ")
                              : "None recorded in this version."}
                          </p>
                          {version.snapshotCoverage !== "full-reader-core" ? (
                            <p className="reviewer-blocker-copy">
                              This local archive preserves only a partial reader-core snapshot;
                              it is not represented as a complete historical rendering.
                            </p>
                          ) : null}
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>

              {showCorrection ? (
                <details className="reviewer-correction">
                  <summary>Previous version — corrected · test-only workflow</summary>
                  <div role="note" aria-label="Correction fixture safeguard">
                    <strong>Reviewer-history only</strong>
                    <p>
                      This deliberately wrong value cannot be current, searched by readers,
                      or rendered on another surface.
                    </p>
                  </div>
                  <blockquote>
                    {CORRECTION_TEST_FIXTURE.supersededVersion.deliberatelyErroneousFixtureValue}
                  </blockquote>
                  <h4>Why it was corrected</h4>
                  <p>{CORRECTION_TEST_FIXTURE.correction.reason}</p>
                  <h4>Current reader-safe handling</h4>
                  <p>{CORRECTION_TEST_FIXTURE.correction.currentSafeSummary}</p>
                  <p className="reviewer-blocker-copy">
                    Independent human verification: required, not recorded.
                  </p>
                </details>
              ) : null}

              <section className="reviewer-verification-gate">
                <p className="reviewer-eyebrow">Independent verification</p>
                <h3>{questionRecord.independentVerification.status.replaceAll("-", " ")}</h3>
                <p>{questionRecord.independentVerification.reason}</p>
                <dl>
                  <div>
                    <dt>Accountable editor</dt>
                    <dd>{brief.governance.publishingOwnerRole}</dd>
                  </div>
                  <div>
                    <dt>Independent verifier</dt>
                    <dd>{questionRecord.independentVerification.completedBy ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Interpretive-review status</dt>
                    <dd>{questionRecord.interpretiveReview.status.replaceAll("-", " ")}</dd>
                  </div>
                </dl>
                <p><strong>Policy:</strong> {brief.governance.interpretiveReviewPolicy}.</p>
                {questionRecord.interpretiveReview.reasons.length > 0 ? (
                  <div className="reviewer-interpretive-review">
                    <h4>Why additional review is required</h4>
                    <ul>
                      {questionRecord.interpretiveReview.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <p>
                      Completed by: {questionRecord.interpretiveReview.completedBy ?? "Not recorded"}
                    </p>
                  </div>
                ) : (
                  <p>No additional interpretive-review trigger is recorded for this version.</p>
                )}
              </section>

              <section className="reviewer-overall-decision">
                <p className="reviewer-eyebrow">Accountable editor decision</p>
                <h3>Record the editorial decision.</h3>
                <p>
                  This records an editorial-language decision only. It cannot clear
                  independent verification or publish the brief.
                </p>
                <label>
                  <span>Overall review note</span>
                  <textarea
                    value={review.overallNote}
                    onChange={(event) =>
                      setReview((current) =>
                        updateOverallNote(current, event.target.value),
                      )
                    }
                    placeholder="Summarize the review decision…"
                  />
                </label>
                <div className="reviewer-decision-actions">
                  <button
                    type="button"
                    aria-pressed={review.editorialDecision === "approved"}
                    onClick={() =>
                      setReview((current) =>
                        setEditorialDecision(
                          current,
                          "approved",
                          current.overallNote || "Editorial language approved locally.",
                        ),
                      )
                    }
                  >
                    Approve editorial language
                  </button>
                  <button
                    type="button"
                    aria-pressed={review.editorialDecision === "returned"}
                    onClick={() =>
                      setReview((current) =>
                        setEditorialDecision(
                          current,
                          "returned",
                          current.overallNote || "Returned for revision.",
                        ),
                      )
                    }
                  >
                    Return for revision
                  </button>
                </div>
                <p className="reviewer-saved-note" aria-live="polite">
                  {storageError
                    ? "Not saved"
                    : hydrated
                    ? `Saved locally · ${formatReviewTime(review.updatedAt)}`
                    : "Loading local review state…"}
                </p>
              </section>

              <section className="reviewer-readiness">
                <div>
                  <p className="reviewer-eyebrow">Publication readiness</p>
                  <h3>{readiness.ready ? "No blockers" : "Not ready for publication"}</h3>
                </div>
                {readiness.blockers.length > 0 ? (
                  <ul className="reviewer-readiness-groups">
                    {unassessedClaims.length > 0 ? (
                      <li>
                        <button type="button" onClick={() => showFirstClaim(unassessedClaims)}>
                          {unassessedClaims.length} claim{unassessedClaims.length === 1 ? "" : "s"} still unassessed
                        </button>
                      </li>
                    ) : null}
                    {unsupportedClaims.length > 0 ? (
                      <li>
                        <button type="button" onClick={() => showFirstClaim(unsupportedClaims)}>
                          {unsupportedClaims.length} claim{unsupportedClaims.length === 1 ? " is" : "s are"} marked unsupported
                        </button>
                      </li>
                    ) : null}
                    {needsVerificationClaims.length > 0 ? (
                      <li>
                        <button type="button" onClick={() => showFirstClaim(needsVerificationClaims)}>
                          {needsVerificationClaims.length} claim{needsVerificationClaims.length === 1 ? " needs" : "s need"} verification
                        </button>
                      </li>
                    ) : null}
                    {governanceAndEvidenceBlockers.map((blocker, index) => (
                      <li key={`${index}:${blocker}`}>
                        {readableBlocker(blocker, questionRecord.claims)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p>
                  No publish control exists here. AI may organize and draft; it cannot
                  verify or publish.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    downloadReview(
                      exportFilename,
                      serializeReviewExport(questionRecord, review),
                    )
                  }
                >
                  Export review record · no full transcripts
                </button>
              </section>
            </div>
          ) : null}
        </aside>
      </div>

      <footer className="reviewer-footer">
        <p>{questionRecord.provenanceNote}</p>
        <p>
          Local fixture only · no reader tracking · no production writes · review state is
          stored only in this browser.
        </p>
      </footer>

      {playback ? (
        <RoundsPlayer playback={playback} onClose={closePlayback} />
      ) : null}
    </main>
  );
}
