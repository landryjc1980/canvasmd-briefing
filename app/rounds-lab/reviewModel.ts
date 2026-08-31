import type {
  CompleteTranscriptEditorialAudit,
  EvidenceLink,
  SourceConversation,
  SourceReference,
} from "./fixture";
import type { RoundsBriefContentSnapshot } from "./questionModel";
// @ts-expect-error Node's native TypeScript test runner requires the explicit extension.
import { transcriptContentSha256 } from "./transcriptIntegrity.ts";

export type ClaimReviewStatus =
  | "unreviewed"
  | "supported"
  | "unsupported"
  | "needs-verification";

export type EditorialDecision = "undecided" | "approved" | "returned";

export type EvidenceUse =
  | "direct-support"
  | "paraphrase"
  | "cross-source-synthesis"
  | "clinical-fact-source-check"
  | "editorial-interpretation";

export type TranscriptCompleteness =
  | "complete"
  | "partial"
  | "unavailable"
  | "rights-restricted";

export type TranscriptOrigin = "publisher" | "human" | "machine" | "unknown";

export type TranscriptSearchScope =
  | "full-conversation"
  | "bounded-windows"
  | "none";

export type TranscriptAssetKind =
  | "publisher-transcript"
  | "local-machine-transcript"
  | "bounded-evidence"
  | "unavailable";

export type TranscriptSegment = {
  id: string;
  sourceId: string;
  startMs: number;
  endMs: number;
  timestamp: string;
  text: string;
};

export type TranscriptCoverage = {
  durationMs: number;
  segmentCount: number;
  startsAtMs: number | null;
  endsAtMs: number | null;
  maximumGapMs: number | null;
  coveredDurationMs: number;
  coverageRatio: number;
  maximumSegmentDurationMs: number | null;
  totalWordCount: number;
  wordsPerMinute: number;
  minimumExpectedWordCount: number;
  uniqueWordCount: number;
  dominantWordRatio: number;
  granular: boolean;
  textDensityPlausible: boolean;
  lexicalDiversityPlausible: boolean;
  continuous: boolean;
  validatedComplete: boolean;
};

export type TranscriptCompletenessReceipt = {
  status: "not-recorded" | "recorded";
  scope: "entire-source-conversation";
  recordedBy: string | null;
  recordedOn: string | null;
  transcriptAssetId: string | null;
  transcriptContentSha256: string | null;
  recordedSegmentCount: number | null;
  recordedDurationMs: number | null;
  note: string;
};

export type ReviewEvidencePassage = {
  id: string;
  sourceId: string;
  sourceLabel: string;
  episodeTitle: string;
  published: string;
  startMs: number;
  timestamp: string;
  contextLabel: string;
  text: string;
  contextBefore?: string;
  contextAfter?: string;
  transcriptCompleteness: TranscriptCompleteness;
  transcriptUrl?: string;
  sourceUrl: string;
  source: SourceConversation;
  reference: SourceReference;
  transcriptWindowId?: string;
  transcriptWindowStartMs?: number;
  transcriptWindowEndMs?: number;
};

export type ExcludedSource = {
  sourceLabel: string;
  reason: string;
};

export type ClaimAuditRecord = {
  claimId: string;
  claimText: string;
  section: "current-read" | "decision-boundary" | "patient-factor" | "clinical-fact";
  evidenceUse: EvidenceUse;
  evidencePassageIds: string[];
  clinicalEvidenceIds: string[];
  relevance: string;
  sourcesConsideredButExcluded: ExcludedSource[];
  qualifyingEvidence: string[];
  materialUncertainty: string;
  movementRationale: string;
  wordingDiff: {
    previous: string | null;
    current: string;
    explanation: string;
  };
};

export type ReviewVersion = {
  versionId: string;
  label: string;
  date: string;
  status: "current-draft" | "superseded" | "corrected";
  trigger: string;
  change: string;
  eligibleAsCurrent: boolean;
  exportEligible: boolean;
  snapshotCoverage: "full-reader-core" | "partial-reader-core" | "not-available";
  snapshot?: RoundsBriefContentSnapshot;
};

export type SourceTranscriptRecord = {
  sourceId: string;
  sourceLabel: string;
  episodeTitle: string;
  sourceDurationMs: number;
  completeness: TranscriptCompleteness;
  searchableTranscriptAvailable: boolean;
  searchScope: TranscriptSearchScope;
  assetKind: TranscriptAssetKind;
  humanAccuracyReviewed: boolean;
  completeTranscriptAvailable: boolean;
  availabilityNote: string;
  transcriptUrl?: string;
  passageIds: string[];
  origin: TranscriptOrigin;
  methodLabel: string;
  checkedOn: string;
  segments: TranscriptSegment[];
  coverage: TranscriptCoverage;
  completenessReceipt: TranscriptCompletenessReceipt;
};

export type IndependentVerification = {
  required: boolean;
  status: "not-required" | "required" | "complete";
  reason: string;
  completedBy: string | null;
  completedOn: string | null;
};

export type InterpretiveReview = {
  required: boolean;
  status: "not-required" | "required" | "complete";
  reasons: string[];
  completedBy: string | null;
  completedOn: string | null;
};

export type ReviewerQuestionRecord = {
  questionId: string;
  versionId: string;
  currentVersionLabel: string;
  question: string;
  movementState: string;
  claims: ClaimAuditRecord[];
  passages: ReviewEvidencePassage[];
  transcripts: SourceTranscriptRecord[];
  clinicalReferences: EvidenceLink[];
  versions: ReviewVersion[];
  accountableEditorId: string;
  independentVerification: IndependentVerification;
  interpretiveReview: InterpretiveReview;
  provenanceNote: string;
  aiAuditNote: string;
  editorialAudit: CompleteTranscriptEditorialAudit;
};

export type ReviewSnapshot = {
  questionId: string;
  versionId: string;
  claimStatuses: Record<string, ClaimReviewStatus>;
  claimNotes: Record<string, string>;
  overallNote: string;
  editorialDecision: EditorialDecision;
  editorialDecisionNote: string;
  updatedAt: string;
};

export type PublicationReadiness = {
  ready: boolean;
  blockers: string[];
};

const VALID_CLAIM_REVIEW_STATUSES = new Set<ClaimReviewStatus>([
  "unreviewed",
  "supported",
  "unsupported",
  "needs-verification",
]);

function hasRecordedIdentityAndTime(
  identity: string | null | undefined,
  recordedOn: string | null | undefined,
): boolean {
  return Boolean(
    identity?.trim()
    && recordedOn?.trim()
    && Number.isFinite(Date.parse(recordedOn)),
  );
}

function hasAuditableCompleteTranscript(
  transcript: SourceTranscriptRecord,
  authoritativeSourceDurationMs: number | null | undefined,
): boolean {
  const receipt = transcript.completenessReceipt;
  const currentCoverage = evaluateTranscriptCoverage(
    authoritativeSourceDurationMs ?? 0,
    transcript.segments,
  );
  const segmentIds = new Set(transcript.segments.map((segment) => segment.id));
  const segmentIdentityIsConsistent = Boolean(
    segmentIds.size === transcript.segments.length
    && transcript.segments.every((segment) => segment.sourceId === transcript.sourceId)
  );
  const coverageKeys = Object.keys(currentCoverage) as Array<keyof TranscriptCoverage>;
  const storedCoverageMatchesCurrentSegments = coverageKeys.every(
    (key) => Object.is(transcript.coverage[key], currentCoverage[key]),
  );
  return Boolean(
    transcript.completeTranscriptAvailable
    && hasSearchableFullConversationTranscript(
      transcript,
      authoritativeSourceDurationMs,
    )
    && transcript.completeness === "complete"
    && authoritativeSourceDurationMs !== null
    && authoritativeSourceDurationMs !== undefined
    && authoritativeSourceDurationMs > 0
    && transcript.sourceDurationMs === authoritativeSourceDurationMs
    && transcript.coverage.durationMs === authoritativeSourceDurationMs
    && segmentIdentityIsConsistent
    && currentCoverage.validatedComplete
    && storedCoverageMatchesCurrentSegments
    && transcript.origin !== "unknown"
    && transcript.methodLabel.trim()
    && transcript.checkedOn.trim()
    && Number.isFinite(Date.parse(transcript.checkedOn))
    && receipt?.status === "recorded"
    && receipt.scope === "entire-source-conversation"
    && hasRecordedIdentityAndTime(
      receipt.recordedBy,
      receipt.recordedOn,
    )
    && receipt.transcriptAssetId?.trim()
    && /^sha256:[a-f0-9]{64}$/i.test(receipt.transcriptContentSha256 ?? "")
    && receipt.transcriptContentSha256 === transcriptContentSha256(transcript.segments)
    && receipt.recordedSegmentCount === currentCoverage.segmentCount
    && receipt.recordedSegmentCount === transcript.segments.length
    && receipt.recordedDurationMs === currentCoverage.durationMs
  );
}

/**
 * A reviewer may search a full-conversation transcript before it is safe to
 * clear a publication gate. This check is deliberately structural: it proves
 * source identity, useful temporal span, density, and granularity, but not the
 * accuracy of machine-recognized words or human completeness attestation.
 */
function hasSearchableFullConversationTranscript(
  transcript: SourceTranscriptRecord,
  authoritativeSourceDurationMs: number | null | undefined,
): boolean {
  if (
    authoritativeSourceDurationMs === null
    || authoritativeSourceDurationMs === undefined
    || authoritativeSourceDurationMs <= 0
  ) {
    return false;
  }
  const currentCoverage = evaluateTranscriptCoverage(
    authoritativeSourceDurationMs,
    transcript.segments,
  );
  const coverageKeys = Object.keys(currentCoverage) as Array<keyof TranscriptCoverage>;
  const segmentIds = new Set(transcript.segments.map((segment) => segment.id));
  return Boolean(
    transcript.searchableTranscriptAvailable
    && transcript.searchScope === "full-conversation"
    && transcript.sourceDurationMs === authoritativeSourceDurationMs
    && transcript.coverage.durationMs === authoritativeSourceDurationMs
    && segmentIds.size === transcript.segments.length
    && transcript.segments.every((segment) => segment.sourceId === transcript.sourceId)
    && transcript.segments.every((segment) => (
      segment.startMs >= 0
      && segment.endMs > segment.startMs
      && segment.endMs <= authoritativeSourceDurationMs + 5_000
    ))
    && coverageKeys.every(
      (key) => Object.is(transcript.coverage[key], currentCoverage[key]),
    )
    && currentCoverage.segmentCount > 0
    && currentCoverage.startsAtMs !== null
    && currentCoverage.startsAtMs <= 15_000
    && currentCoverage.endsAtMs !== null
    && currentCoverage.endsAtMs >= authoritativeSourceDurationMs - 15_000
    && currentCoverage.maximumGapMs !== null
    && currentCoverage.maximumGapMs <= 30_000
    && currentCoverage.coverageRatio >= 0.94
    && currentCoverage.granular
    && currentCoverage.textDensityPlausible
    && currentCoverage.lexicalDiversityPlausible
  );
}

export function evaluateTranscriptCoverage(
  durationMs: number,
  segments: readonly TranscriptSegment[],
): TranscriptCoverage {
  const ordered = [...segments].sort((left, right) => left.startMs - right.startMs);
  const timingsAreValid = ordered.every((segment) => (
    segment.startMs >= 0
    && segment.endMs > segment.startMs
    && segment.endMs <= durationMs + 5_000
    && segment.text.trim().length > 0
  ));
  const gaps = ordered.slice(1).map((segment, index) => (
    Math.max(0, segment.startMs - ordered[index].endMs)
  ));
  const maximumGapMs = ordered.length > 0
    ? (gaps.length ? Math.max(...gaps) : 0)
    : null;
  const startsAtMs = ordered[0]?.startMs ?? null;
  const endsAtMs = ordered.at(-1)?.endMs ?? null;
  const mergedRanges: Array<{ startMs: number; endMs: number }> = [];
  for (const segment of ordered) {
    const prior = mergedRanges.at(-1);
    if (!prior || segment.startMs > prior.endMs) {
      mergedRanges.push({ startMs: segment.startMs, endMs: segment.endMs });
    } else {
      prior.endMs = Math.max(prior.endMs, segment.endMs);
    }
  }
  const coveredDurationMs = mergedRanges.reduce(
    (total, range) => total + Math.max(0, range.endMs - range.startMs),
    0,
  );
  const coverageRatio = durationMs > 0
    ? Math.min(1, coveredDurationMs / durationMs)
    : 0;
  const maximumSegmentDurationMs = ordered.length > 0
    ? Math.max(...ordered.map((segment) => segment.endMs - segment.startMs))
    : null;
  const normalizedWords = ordered.flatMap((segment) => (
    segment.text.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []
  ));
  const totalWordCount = normalizedWords.length;
  const wordFrequency = new Map<string, number>();
  for (const word of normalizedWords) {
    wordFrequency.set(word, (wordFrequency.get(word) ?? 0) + 1);
  }
  const uniqueWordCount = wordFrequency.size;
  const dominantWordCount = wordFrequency.size
    ? Math.max(...wordFrequency.values())
    : 0;
  const dominantWordRatio = totalWordCount > 0
    ? dominantWordCount / totalWordCount
    : 1;
  const granular = Boolean(
    maximumSegmentDurationMs !== null
    && maximumSegmentDurationMs <= 120_000
  );
  const durationMinutes = durationMs / 60_000;
  const wordsPerMinute = durationMinutes > 0 ? totalWordCount / durationMinutes : 0;
  const minimumExpectedWordCount = Math.ceil(durationMinutes * 75);
  const textDensityPlausible = totalWordCount >= minimumExpectedWordCount;
  const minimumExpectedUniqueWords = Math.min(
    250,
    Math.max(25, Math.ceil(durationMinutes * 8)),
  );
  const lexicalDiversityPlausible = Boolean(
    uniqueWordCount >= minimumExpectedUniqueWords
    && dominantWordRatio <= 0.12
  );
  const continuous = ordered.length > 0 && maximumGapMs !== null && maximumGapMs <= 5_000;
  const validatedComplete = Boolean(
    durationMs > 0
    && timingsAreValid
    && startsAtMs !== null
    && startsAtMs <= 5_000
    && endsAtMs !== null
    && endsAtMs >= durationMs - 5_000
    && continuous
    && coverageRatio >= 0.985
    && granular
    && textDensityPlausible
    && lexicalDiversityPlausible
  );

  return {
    durationMs,
    segmentCount: ordered.length,
    startsAtMs,
    endsAtMs,
    maximumGapMs,
    coveredDurationMs,
    coverageRatio,
    maximumSegmentDurationMs,
    totalWordCount,
    wordsPerMinute,
    minimumExpectedWordCount,
    uniqueWordCount,
    dominantWordRatio,
    granular,
    textDensityPlausible,
    lexicalDiversityPlausible,
    continuous,
    validatedComplete,
  };
}

export function getPublicationReadiness(
  question: ReviewerQuestionRecord,
  review: ReviewSnapshot,
): PublicationReadiness {
  const blockers: string[] = [];

  if (review.questionId !== question.questionId) {
    blockers.push("Review identity does not match the tracked clinical question.");
  }
  if (review.versionId !== question.versionId) {
    blockers.push("Review identity does not match the current question version.");
  }

  if (review.editorialDecision !== "approved") {
    blockers.push("Editorial language has not been approved by the accountable editor.");
  }

  if (question.claims.length === 0) {
    blockers.push("Publication requires at least one reviewable claim.");
  }

  for (const claim of question.claims) {
    const status = review.claimStatuses[claim.claimId] as ClaimReviewStatus | undefined;
    if (!status || !VALID_CLAIM_REVIEW_STATUSES.has(status)) {
      blockers.push(`Claim ${claim.claimId} has an invalid or missing review status.`);
    } else if (status === "unreviewed") {
      blockers.push(`Claim ${claim.claimId} has not been assessed.`);
    } else if (status === "unsupported") {
      blockers.push(`Claim ${claim.claimId} is marked unsupported.`);
    } else if (status === "needs-verification") {
      blockers.push(`Claim ${claim.claimId} still needs verification.`);
    }
  }

  const passageIds = new Set(question.passages.map((passage) => passage.id));
  const clinicalReferenceIds = new Set(question.clinicalReferences.map((reference) => reference.id));
  const transcriptBySourceId = new Map(
    question.transcripts.map((transcript) => [transcript.sourceId, transcript]),
  );
  const authoritativeDurationBySourceId = new Map<string, number>();
  const passageIdsBySourceId = new Map<string, string[]>();
  if (passageIds.size !== question.passages.length) {
    blockers.push("Evidence integrity check failed: passage identifiers are not unique.");
  }
  if (transcriptBySourceId.size !== question.transcripts.length) {
    blockers.push("Evidence integrity check failed: transcript source identifiers are not unique.");
  }
  for (const claim of question.claims) {
    if (claim.section === "clinical-fact") {
      if (!claim.clinicalEvidenceIds.length) {
        blockers.push(`Clinical claim ${claim.claimId} has no clinical-reference mapping.`);
      }
    } else if (!claim.evidencePassageIds.length) {
      blockers.push(`Claim ${claim.claimId} has no traceable episode-passage mapping.`);
    }
    for (const passageId of claim.evidencePassageIds) {
      if (!passageIds.has(passageId)) {
        blockers.push(`Claim ${claim.claimId} maps to missing passage ${passageId}.`);
      }
    }
    for (const referenceId of claim.clinicalEvidenceIds) {
      if (!clinicalReferenceIds.has(referenceId)) {
        blockers.push(`Clinical claim ${claim.claimId} maps to missing reference ${referenceId}.`);
      }
    }
  }

  for (const passage of question.passages) {
    passageIdsBySourceId.set(
      passage.sourceId,
      [...(passageIdsBySourceId.get(passage.sourceId) ?? []), passage.id],
    );
    if (!transcriptBySourceId.has(passage.sourceId)) {
      blockers.push(`Evidence passage ${passage.id} has no source-transcript inventory record.`);
    }
    if (
      passage.source.id !== passage.sourceId
      || passage.reference.sourceId !== passage.sourceId
      || passage.reference.startMs !== passage.startMs
    ) {
      blockers.push(`Evidence passage ${passage.id} has inconsistent source or timing metadata.`);
    }
    const sourceDurationMs = passage.source.durationSeconds * 1_000;
    const priorDurationMs = authoritativeDurationBySourceId.get(passage.sourceId);
    if (!Number.isFinite(sourceDurationMs) || sourceDurationMs <= 0) {
      blockers.push(`Evidence passage ${passage.id} has no valid authoritative source duration.`);
    } else if (priorDurationMs !== undefined && priorDurationMs !== sourceDurationMs) {
      blockers.push(`Evidence source ${passage.sourceId} has conflicting authoritative durations.`);
    } else {
      authoritativeDurationBySourceId.set(passage.sourceId, sourceDurationMs);
      if (
        passage.startMs >= sourceDurationMs
        || passage.reference.startMs >= sourceDurationMs
        || (passage.transcriptWindowStartMs ?? passage.startMs) >= sourceDurationMs
        || (passage.transcriptWindowEndMs ?? passage.startMs) > sourceDurationMs
      ) {
        blockers.push(`Evidence passage ${passage.id} falls outside the authoritative source duration.`);
      }
    }
  }

  const materialPassageIds = new Set(
    question.claims.flatMap((claim) => claim.evidencePassageIds),
  );
  const materialSourceIds = new Set(
    question.passages
      .filter((passage) => materialPassageIds.has(passage.id))
      .map((passage) => passage.sourceId),
  );

  for (const transcript of question.transcripts) {
    for (const id of transcript.passageIds) {
      const passage = question.passages.find((candidate) => candidate.id === id);
      if (!passage || passage.sourceId !== transcript.sourceId) {
        blockers.push(
          `Transcript inventory ${transcript.sourceId} maps to a missing or mismatched passage ${id}.`,
        );
      }
    }
    const derivedPassageIds = passageIdsBySourceId.get(transcript.sourceId) ?? [];
    const recordedPassageIds = new Set(transcript.passageIds);
    if (
      recordedPassageIds.size !== transcript.passageIds.length
      || recordedPassageIds.size !== derivedPassageIds.length
      || derivedPassageIds.some((id) => !recordedPassageIds.has(id))
    ) {
      blockers.push(
        `Transcript inventory ${transcript.sourceId} does not match the cited passage set.`,
      );
    }
    // A question may retain a candidate source or bounded canary window solely
    // to show what the challenge pass excluded. Only sources reached through
    // a current claim's passage mapping create publication-completeness gates.
    // passageIds remains a validated inventory projection and cannot switch
    // those gates off when a material claim still reaches the source.
    if (!materialSourceIds.has(transcript.sourceId)) continue;
    if (
      transcript.completeTranscriptAvailable
      && transcript.completeness !== "complete"
    ) {
      blockers.push(
        `Transcript inventory ${transcript.sourceId} is marked available without complete status.`,
      );
    }
    if (
      transcript.completeTranscriptAvailable
      && (
        !transcript.searchableTranscriptAvailable
        || transcript.searchScope !== "full-conversation"
      )
    ) {
      blockers.push(
        `Transcript inventory ${transcript.sourceId} is marked publication-complete without searchable full-conversation access.`,
      );
    }
    const authoritativeDurationMs = authoritativeDurationBySourceId.get(transcript.sourceId);
    if (transcript.sourceDurationMs !== authoritativeDurationMs) {
      blockers.push(
        `Transcript inventory ${transcript.sourceId} does not match the authoritative source duration.`,
      );
    }
    if (
      transcript.searchableTranscriptAvailable
      && !hasSearchableFullConversationTranscript(transcript, authoritativeDurationMs)
    ) {
      blockers.push(
        `Transcript inventory ${transcript.sourceId} is marked searchable but fails source-identity, temporal-span, density, or granularity checks.`,
      );
    }
    if (
      transcript.completeTranscriptAvailable
      && !hasAuditableCompleteTranscript(transcript, authoritativeDurationMs)
    ) {
      blockers.push(
        `Transcript inventory ${transcript.sourceId} lacks auditable whole-conversation provenance, granularity, or completeness attestation.`,
      );
    }
  }

  const independentVerification = question.independentVerification;
  if (!independentVerification) {
    blockers.push("Independent clinical-fact verification record is missing.");
  } else if (
    independentVerification.required &&
    independentVerification.status !== "complete"
  ) {
    blockers.push(independentVerification.reason);
  }

  const interpretiveReview = question.interpretiveReview;
  if (!interpretiveReview) {
    blockers.push("Risk-based interpretive-review record is missing.");
  } else if (interpretiveReview.required && interpretiveReview.status !== "complete") {
    const reviewReasons = interpretiveReview.reasons
      .map((reason) => reason.trim().replace(/[.;]+$/, ""))
      .filter(Boolean)
      .join("; ");
    blockers.push(
      reviewReasons
        ? `Risk-based interpretive review is required: ${reviewReasons}.`
        : "Risk-based interpretive review is required.",
    );
  }

  if (
    interpretiveReview?.status === "complete"
    && interpretiveReview.completedBy === question.accountableEditorId
  ) {
    blockers.push("Required interpretive review must be completed by someone other than the accountable editor.");
  }
  if (
    interpretiveReview?.status === "complete"
    && !hasRecordedIdentityAndTime(
      interpretiveReview.completedBy,
      interpretiveReview.completedOn,
    )
  ) {
    blockers.push("Completed interpretive review requires a reviewer identity and valid completion time.");
  }

  if (
    independentVerification?.status === "complete" &&
    independentVerification.completedBy === question.accountableEditorId
  ) {
    blockers.push(
      "Independent fact verification must be completed by someone other than the accountable editor.",
    );
  }
  if (
    independentVerification?.status === "complete"
    && !hasRecordedIdentityAndTime(
      independentVerification.completedBy,
      independentVerification.completedOn,
    )
  ) {
    blockers.push("Completed independent fact verification requires a verifier identity and valid completion time.");
  }

  const unavailableTranscripts = question.transcripts.filter(
    (transcript) => (
      materialSourceIds.has(transcript.sourceId)
      &&
      !hasSearchableFullConversationTranscript(
        transcript,
        authoritativeDurationBySourceId.get(transcript.sourceId),
      )
    ),
  );
  if (unavailableTranscripts.length > 0) {
    blockers.push(
      `Searchable full-conversation transcript unavailable for ${unavailableTranscripts
        .map((transcript) => transcript.sourceLabel)
        .join(", ")}.`,
    );
  }

  const unattestedTranscripts = question.transcripts.filter(
    (transcript) => (
      materialSourceIds.has(transcript.sourceId)
      &&
      hasSearchableFullConversationTranscript(
        transcript,
        authoritativeDurationBySourceId.get(transcript.sourceId),
      )
      && !hasAuditableCompleteTranscript(
        transcript,
        authoritativeDurationBySourceId.get(transcript.sourceId),
      )
    ),
  );
  if (unattestedTranscripts.length > 0) {
    blockers.push(
      `Transcript publication attestation incomplete for ${unattestedTranscripts
        .map((transcript) => transcript.sourceLabel)
        .join(", ")}.`,
    );
  }

  if (question.versions.some((version) => (
    version.status === "superseded" && version.snapshotCoverage !== "full-reader-core"
  ))) {
    blockers.push("At least one superseded version has only a partial archived reader snapshot.");
  }

  return { ready: blockers.length === 0, blockers };
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

/**
 * Produces a stable, local review artifact from observable review inputs.
 * It deliberately excludes private model scratch work and browser/device data.
 */
export function serializeReviewExport(
  question: ReviewerQuestionRecord,
  review: ReviewSnapshot,
): string {
  const readiness = getPublicationReadiness(question, review);
  const payload = {
    schema: "canvasmd-rounds-review/v1",
    question: {
      id: question.questionId,
      text: question.question,
      versionId: question.versionId,
      movementState: question.movementState,
    },
    accountableEditorId: question.accountableEditorId,
    review: {
      editorialDecision: review.editorialDecision,
      editorialDecisionNote: review.editorialDecisionNote,
      claimStatuses: sortedRecord(review.claimStatuses),
      claimNotes: sortedRecord(review.claimNotes),
      overallNote: review.overallNote,
      updatedAt: review.updatedAt,
    },
    evidenceAudit: question.claims
      .slice()
      .sort((left, right) => left.claimId.localeCompare(right.claimId))
      .map((claim) => ({
        claimId: claim.claimId,
        claimText: claim.claimText,
        section: claim.section,
        evidenceUse: claim.evidenceUse,
        relevance: claim.relevance,
        movementRationale: claim.movementRationale,
        evidencePassages: claim.evidencePassageIds
          .slice()
          .sort()
          .map((passageId) => question.passages.find((passage) => passage.id === passageId))
          .filter(Boolean)
          .map((passage) => ({
            id: passage?.id,
            sourceId: passage?.sourceId,
            sourceLabel: passage?.sourceLabel,
            episodeTitle: passage?.episodeTitle,
            published: passage?.published,
            startMs: passage?.startMs,
            timestamp: passage?.timestamp,
            contextLabel: passage?.contextLabel,
            text: passage?.text,
            contextBefore: passage?.contextBefore,
            contextAfter: passage?.contextAfter,
            transcriptCompleteness: passage?.transcriptCompleteness,
            transcriptWindowId: passage?.transcriptWindowId,
            sourceUrl: passage?.sourceUrl,
            sourceProvenance: passage
              ? {
                  sourceRole: passage.source.sourceRole,
                  editorialFamily: passage.source.editorialFamily,
                  independenceCluster: passage.source.independenceCluster,
                  episodeSupport: passage.source.episodeSupport,
                }
              : null,
          })),
        clinicalReferences: claim.clinicalEvidenceIds
          .slice()
          .sort()
          .map((referenceId) => question.clinicalReferences.find((reference) => reference.id === referenceId))
          .filter(Boolean),
        sourcesConsideredButExcluded: claim.sourcesConsideredButExcluded,
        qualifyingEvidence: claim.qualifyingEvidence,
        materialUncertainty: claim.materialUncertainty,
        wordingDiff: claim.wordingDiff,
      })),
    sourceConversations: Array.from(
      new Map(
        question.passages.map((passage) => [passage.source.id, passage.source]),
      ).values(),
    )
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((source) => ({
        id: source.id,
        sourceLabel: source.citationLabel,
        episodeTitle: source.episode,
        published: source.published,
        sourceRole: source.sourceRole,
        editorialFamily: source.editorialFamily,
        independenceCluster: source.independenceCluster,
        episodeSupport: source.episodeSupport,
        url: source.url,
      })),
    transcriptInventory: question.transcripts
      .slice()
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId))
      .map(({ segments, ...transcript }) => ({
        ...transcript,
        segmentCount: segments.length,
      })),
    versionHistory: question.versions
      .filter((version) => version.exportEligible)
      .map(({ exportEligible: _exportEligible, ...version }) => version),
    completeTranscriptEditorialAudit: question.editorialAudit,
    provenanceNote: question.provenanceNote,
    aiAuditNote: question.aiAuditNote,
    independentVerification: question.independentVerification,
    interpretiveReview: question.interpretiveReview,
    publicationReadiness: readiness,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
