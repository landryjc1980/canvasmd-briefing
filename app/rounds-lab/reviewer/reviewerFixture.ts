// LOCAL_REVIEW_FIXTURE: reviewer-only projections of the local Rounds fixture.
// This file does not read from or write to production systems.

// Node's native TypeScript test runner requires explicit extensions here.
// @ts-expect-error This local-only fixture is bundled by Next in the prototype.
import { LOCAL_ROUNDS_BRIEFS, type LocalDiscussionBrief, type SourceConversation, type SourceReference } from "../fixture.ts";
// @ts-expect-error See the local native-test import note above.
import { evaluateTranscriptCoverage } from "../reviewModel.ts";
// @ts-expect-error See the local native-test import note above.
import { transcriptContentSha256 } from "../transcriptIntegrity.ts";
import type {
  ClaimAuditRecord,
  EvidenceUse,
  ReviewEvidencePassage,
  ReviewerQuestionRecord,
  ReviewVersion,
  SourceTranscriptRecord,
  TranscriptCompleteness,
  TranscriptOrigin,
  TranscriptSegment,
} from "../reviewModel.ts";
// @ts-expect-error See the local native-test import note above.
import { LOCAL_CANARY_TRANSCRIPT_WINDOWS, type CanaryTranscriptWindow } from "./canaryEvidenceFixture.ts";
// @ts-expect-error See the local native-test import note above.
import { CORRECTION_ALLOWED_SURFACE, CORRECTION_TEST_FIXTURE, canRenderCorrectionOnSurface } from "./correctionFixture.ts";
import type {
  LocalTranscriptAsset,
  LocalTranscriptAssetMap,
} from "./transcripts/types.ts";

type TranscriptPassageInput = {
  id?: string;
  startMs: number;
  timestamp?: string;
  contextLabel?: string;
  text: string;
  contextBefore?: string;
  contextAfter?: string;
};

type TranscriptSegmentInput = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

type TranscriptEnhancedSource = SourceConversation & {
  transcript?: {
    completeness?: TranscriptCompleteness;
    url?: string;
    locallySearchableCompleteTranscript?: boolean;
    passages?: TranscriptPassageInput[];
    segments?: TranscriptSegmentInput[];
    origin?: TranscriptOrigin;
    methodLabel?: string;
    checkedOn?: string;
    completenessReceipt?: SourceTranscriptRecord["completenessReceipt"];
  };
};

const LOCAL_TRANSCRIPT_ASSET_CHECKED_ON = "Aug 29, 2026";

const EMPTY_TRANSCRIPT_ASSETS: LocalTranscriptAssetMap = Object.freeze({});

type ClaimInput = {
  id: string;
  text: string;
  section: ClaimAuditRecord["section"];
  sourceRefs: SourceReference[];
  evidenceUse: EvidenceUse;
  clinicalEvidenceIds?: string[];
  uncertainty?: string;
};

function passageId(reference: SourceReference): string {
  return `${reference.sourceId}@${reference.startMs}`;
}

function normalizeSourceIdentity(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[?&#].*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canaryWindowsFor(source: SourceConversation): CanaryTranscriptWindow[] {
  const sourceUrl = normalizeSourceIdentity(source.url);
  const sourceAudio = normalizeSourceIdentity(source.audioUrl);
  const sourceTitle = normalizeSourceIdentity(source.episode);
  return LOCAL_CANARY_TRANSCRIPT_WINDOWS.filter((window) => {
    const episodeUrl = normalizeSourceIdentity(window.episode.url);
    const audioUrl = normalizeSourceIdentity(window.audio.audioUrl);
    const title = normalizeSourceIdentity(window.episode.title);
    return (
      sourceUrl === episodeUrl ||
      sourceAudio === audioUrl ||
      sourceTitle === title ||
      (sourceTitle.length > 20 &&
        title.length > 20 &&
        (sourceTitle.includes(title) || title.includes(sourceTitle)))
    );
  });
}

function transcriptAssetFor(
  source: SourceConversation,
  transcriptAssets: LocalTranscriptAssetMap,
): LocalTranscriptAsset | undefined {
  const asset = transcriptAssets[source.id];
  return asset?.sourceIds.includes(source.id) ? asset : undefined;
}

function transcriptSegmentsForSource(
  source: SourceConversation,
  asset: LocalTranscriptAsset,
): TranscriptSegment[] {
  return asset.segments.map((segment) => ({
    ...segment,
    id: `${source.id}:${segment.id}`,
    sourceId: source.id,
  }));
}

function publicationCompletenessForAsset(
  asset: LocalTranscriptAsset,
): "complete" | "partial" {
  return asset.completeness === "complete"
    && asset.coverage.validatedComplete
    && asset.provenance.humanAccuracyReviewed
    && asset.provenance.wholeConversationAttested
    ? "complete"
    : "partial";
}

function fullTranscriptContext(
  source: SourceConversation,
  asset: LocalTranscriptAsset,
  reference: SourceReference,
): Pick<
  ReviewEvidencePassage,
  "text" | "contextBefore" | "contextAfter" | "contextLabel" | "transcriptWindowStartMs" | "transcriptWindowEndMs"
> | null {
  const segments = transcriptSegmentsForSource(source, asset);
  if (!segments.length) return null;
  const nearest = segments.reduce((best, segment) => {
    const bestDistance = Math.min(
      Math.abs(best.startMs - reference.startMs),
      reference.startMs >= best.startMs && reference.startMs <= best.endMs ? 0 : Infinity,
    );
    const distance = reference.startMs >= segment.startMs && reference.startMs <= segment.endMs
      ? 0
      : Math.abs(segment.startMs - reference.startMs);
    return distance < bestDistance ? segment : best;
  }, segments[0]);
  const anchorMs = nearest.startMs;
  const join = (items: TranscriptSegment[]) => (
    items.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim()
  );
  const before = segments.filter((segment) => (
    segment.endMs > anchorMs - 45_000 && segment.endMs <= anchorMs - 10_000
  ));
  const focus = segments.filter((segment) => (
    segment.endMs > anchorMs - 10_000 && segment.startMs < anchorMs + 35_000
  ));
  const after = segments.filter((segment) => (
    segment.startMs >= anchorMs + 35_000 && segment.startMs < anchorMs + 65_000
  ));
  const visible = focus.length ? focus : [nearest];
  const windowStartMs = visible[0].startMs;
  const windowEndMs = visible.at(-1)?.endMs ?? nearest.endMs;
  return {
    text: join(visible),
    contextBefore: join(before) || undefined,
    contextAfter: join(after) || undefined,
    contextLabel:
      `${asset.assetKind === "publisher-transcript" ? "Publisher" : "Local machine"} transcript context ${formatTimestamp(windowStartMs)}–${formatTimestamp(windowEndMs)}`,
    transcriptWindowStartMs: windowStartMs,
    transcriptWindowEndMs: windowEndMs,
  };
}

function versionId(brief: LocalDiscussionBrief): string {
  const possibleBrief = brief as LocalDiscussionBrief & { currentVersionId?: string };
  return possibleBrief.currentVersionId ?? `${brief.id}-v${brief.governance.version}`;
}

function claimInputs(brief: LocalDiscussionBrief): ClaimInput[] {
  const inputs: ClaimInput[] = [
    {
      id: `${brief.id}:movement`,
      text: [brief.movement.headline, brief.movement.evidenceQualifier].filter(Boolean).join(" "),
      section: "current-read",
      sourceRefs: brief.movement.sourceRefs,
      evidenceUse:
        brief.movement.sourceRefs.length > 1
          ? "cross-source-synthesis"
          : "editorial-interpretation",
      uncertainty:
        "The movement label applies only to this selected, reviewed source set; it is not a claim about field prevalence.",
    },
    {
      id: `${brief.id}:answer`,
      text: `${brief.answerLabel} ${brief.answerHeading}`,
      section: "current-read",
      sourceRefs: brief.synthesisClaims.flatMap((claim) => claim.sourceRefs),
      evidenceUse: "cross-source-synthesis",
      uncertainty:
        "This concise read is an editorial synthesis of selected conversations, not a treatment recommendation or consensus claim.",
    },
    ...brief.synthesisClaims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      section: "current-read" as const,
      sourceRefs: claim.sourceRefs,
      evidenceUse:
        claim.sourceRefs.length > 1
          ? ("cross-source-synthesis" as const)
          : ("paraphrase" as const),
      uncertainty: claim.sourceContext,
    })),
    {
      id: `${brief.id}:boundary:heading`,
      text: brief.differencesHeading,
      section: "decision-boundary",
      sourceRefs: brief.lenses.flatMap((lens) => lens.sourceRefs),
      evidenceUse: "editorial-interpretation",
      uncertainty:
        "The boundary describes how the selected discussions were organized; it does not count or rank speakers.",
    },
    {
      id: `${brief.id}:boundary:context`,
      text: brief.differencesContext,
      section: "decision-boundary",
      sourceRefs: brief.lenses.flatMap((lens) => lens.sourceRefs),
      evidenceUse: "editorial-interpretation",
      uncertainty:
        "The boundary describes how the selected discussions were organized; it does not count or rank speakers.",
    },
    ...brief.lenses.flatMap((lens, index) => [
      {
        id: `${brief.id}:lens:${index + 1}:title`,
        text: lens.title,
        section: "decision-boundary" as const,
        sourceRefs: lens.sourceRefs,
        evidenceUse:
          lens.sourceRefs.length > 1
            ? ("cross-source-synthesis" as const)
            : ("paraphrase" as const),
      },
      {
        id: `${brief.id}:lens:${index + 1}:detail`,
        text: lens.detail,
        section: "decision-boundary" as const,
        sourceRefs: lens.sourceRefs,
        evidenceUse:
          lens.sourceRefs.length > 1
            ? ("cross-source-synthesis" as const)
            : ("paraphrase" as const),
      },
    ]),
    {
      id: `${brief.id}:factors:heading`,
      text: brief.factorsHeading,
      section: "patient-factor",
      sourceRefs: brief.factors.flatMap((factor) => factor.sourceRefs),
      evidenceUse: "editorial-interpretation",
      uncertainty:
        "This heading organizes patient-specific decision factors; it is not a treatment recommendation.",
    },
    {
      id: `${brief.id}:factors:context`,
      text: brief.factorsContext,
      section: "patient-factor",
      sourceRefs: brief.factors.flatMap((factor) => factor.sourceRefs),
      evidenceUse: "editorial-interpretation",
      uncertainty:
        "This context sentence frames the listed factors and must be checked against each mapped source conversation.",
    },
    ...brief.factors.flatMap((factor) => [
      {
        id: `${brief.id}:factor:${factor.id}:implication`,
        text: factor.implication,
        section: "patient-factor" as const,
        sourceRefs: factor.sourceRefs,
        evidenceUse: "editorial-interpretation" as const,
        uncertainty:
          "This is a decision-shaping factor, not a claim that the same factor determines care for every patient.",
      },
      {
        id: `${brief.id}:factor:${factor.id}:detail`,
        text: factor.detail,
        section: "patient-factor" as const,
        sourceRefs: factor.sourceRefs,
        evidenceUse: "editorial-interpretation" as const,
        uncertainty:
          "This is a decision-shaping factor, not a claim that the same factor determines care for every patient.",
      },
    ]),
    {
      id: brief.clinicalContext.status.id,
      text: brief.clinicalContext.status.text,
      section: "clinical-fact",
      sourceRefs: [],
      evidenceUse: "clinical-fact-source-check",
      clinicalEvidenceIds: brief.clinicalContext.status.evidenceIds,
      uncertainty:
        "The source was checked in the local draft, but independent human fact verification is not recorded.",
    },
    ...brief.clinicalContext.keyFacts.map((fact) => ({
      id: fact.id,
      text: fact.text,
      section: "clinical-fact" as const,
      sourceRefs: [],
      evidenceUse: "clinical-fact-source-check" as const,
      clinicalEvidenceIds: fact.evidenceIds,
      uncertainty:
        "The source was checked in the local draft, but independent human fact verification is not recorded.",
    })),
  ];

  return inputs.filter((input, index) => {
    const first = inputs.findIndex((candidate) => candidate.id === input.id);
    return first === index && input.text.trim().length > 0;
  });
}

function transcriptPassage(
  source: TranscriptEnhancedSource,
  reference: SourceReference,
  transcriptAssets: LocalTranscriptAssetMap,
): ReviewEvidencePassage {
  const supplied = source.transcript?.passages?.find(
    (passage) => passage.startMs === reference.startMs,
  );
  const canaryWindow = canaryWindowsFor(source).find(
    (window) =>
      reference.startMs >= window.contextInterval.startMs &&
      reference.startMs <= window.contextInterval.endMs,
  );
  const transcriptAsset = transcriptAssetFor(source, transcriptAssets);
  const assetContext = transcriptAsset
    ? fullTranscriptContext(source, transcriptAsset, reference)
    : null;
  const [timestamp, ...contextParts] = reference.relevantAt.split(" · ");
  const completeness = transcriptAsset
    ? publicationCompletenessForAsset(transcriptAsset)
    : source.transcript?.completeness ??
    (canaryWindow ? "partial" : "unavailable");
  const transcriptWindowLabel = canaryWindow
    ? `Citation target ${timestamp} · ${contextParts.join(" · ") || "cited episode topic"} · transcript window ${formatTimestamp(canaryWindow.audio.startMs)}–${formatTimestamp(canaryWindow.audio.endMs)}`
    : null;

  return {
    id: passageId(reference),
    sourceId: source.id,
    sourceLabel: source.citationLabel,
    episodeTitle: source.episode,
    published: source.published,
    startMs: reference.startMs,
    timestamp: supplied?.timestamp ?? timestamp,
    contextLabel:
      supplied?.contextLabel ??
      assetContext?.contextLabel ??
      transcriptWindowLabel ??
      (contextParts.join(" · ") || "Cited episode moment"),
    text:
      supplied?.text ??
      assetContext?.text ??
      canaryWindow?.text ??
      "Transcript evidence unavailable in local fixture for this cited moment. Review the full episode in context; complete transcript search remains blocked until an approved transcript is supplied.",
    contextBefore:
      supplied?.contextBefore ?? assetContext?.contextBefore ?? (canaryWindow?.discourseText || undefined),
    contextAfter: supplied?.contextAfter ?? assetContext?.contextAfter,
    transcriptCompleteness: completeness,
    transcriptUrl: transcriptAsset?.transcriptUrl ?? source.transcript?.url,
    sourceUrl: source.url,
    source,
    reference,
    transcriptWindowId: transcriptAsset ? undefined : canaryWindow?.id,
    transcriptWindowStartMs:
      assetContext?.transcriptWindowStartMs ?? canaryWindow?.audio.startMs,
    transcriptWindowEndMs:
      assetContext?.transcriptWindowEndMs ?? canaryWindow?.audio.endMs,
  };
}

function formatTimestamp(startMs: number): string {
  const totalSeconds = Math.floor(startMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function canaryPassage(
  source: SourceConversation,
  window: CanaryTranscriptWindow,
): ReviewEvidencePassage {
  const timestamp = formatTimestamp(window.audio.startMs);
  const reference: SourceReference = {
    sourceId: source.id,
    relevantAt: `${timestamp} · Bounded transcript evidence window`,
    startMs: window.audio.startMs,
  };
  return {
    id: `canary:${window.id}`,
    sourceId: source.id,
    sourceLabel: source.citationLabel,
    episodeTitle: source.episode,
    published: source.published,
    startMs: window.audio.startMs,
    timestamp,
    contextLabel: `Transcript window ${formatTimestamp(window.audio.startMs)}–${formatTimestamp(window.audio.endMs)}`,
    text: window.text,
    contextBefore: window.discourseText || undefined,
    transcriptCompleteness: "partial",
    sourceUrl: source.url,
    source,
    reference,
    transcriptWindowId: window.id,
    transcriptWindowStartMs: window.audio.startMs,
    transcriptWindowEndMs: window.audio.endMs,
  };
}

function passagesFor(
  brief: LocalDiscussionBrief,
  inputs: ClaimInput[],
  transcriptAssets: LocalTranscriptAssetMap,
): ReviewEvidencePassage[] {
  const sources = new Map(brief.sources.map((source) => [source.id, source]));
  const references = inputs.flatMap((input) => input.sourceRefs);
  const uniqueReferences = references.filter(
    (reference, index) =>
      references.findIndex((candidate) => passageId(candidate) === passageId(reference)) === index,
  );

  const citedPassages = uniqueReferences.flatMap((reference) => {
    const source = sources.get(reference.sourceId);
    return source
      ? [transcriptPassage(source as TranscriptEnhancedSource, reference, transcriptAssets)]
      : [];
  });

  const canaryPassages = brief.sources.flatMap((source) =>
    transcriptAssetFor(source, transcriptAssets)
      ? []
      : canaryWindowsFor(source).map((window) => canaryPassage(source, window)),
  );
  return [...citedPassages, ...canaryPassages].filter(
    (passage, index, all) =>
      all.findIndex((candidate) => candidate.id === passage.id) === index,
  );
}

function transcriptsFor(
  brief: LocalDiscussionBrief,
  passages: ReviewEvidencePassage[],
  transcriptAssets: LocalTranscriptAssetMap,
): SourceTranscriptRecord[] {
  return brief.sources.map((baseSource) => {
    const source = baseSource as TranscriptEnhancedSource;
    const canaryWindows = canaryWindowsFor(source);
    const transcriptAsset = transcriptAssetFor(source, transcriptAssets);
    const segments: TranscriptSegment[] = transcriptAsset
      ? transcriptSegmentsForSource(source, transcriptAsset)
      : (source.transcript?.segments ?? []).map(
      (segment) => ({
        ...segment,
        sourceId: source.id,
        timestamp: formatTimestamp(segment.startMs),
      }));
    const coverage = evaluateTranscriptCoverage(
      source.durationSeconds * 1_000,
      segments,
    );
    const temporalSpanRatio = coverage.startsAtMs !== null && coverage.endsAtMs !== null
      ? Math.min(
          1,
          Math.max(0, coverage.endsAtMs - coverage.startsAtMs) /
            (source.durationSeconds * 1_000),
        )
      : 0;
    const completeness = transcriptAsset
      ? publicationCompletenessForAsset(transcriptAsset)
      : source.transcript?.completeness ??
      (canaryWindows.length > 0 ? "partial" : "unavailable");
    const origin = transcriptAsset?.provenance.origin ?? source.transcript?.origin ?? "unknown";
    const methodLabel = transcriptAsset?.provenance.methodLabel ?? source.transcript?.methodLabel ??
      (canaryWindows.length > 0
        ? "Origin and transcription method are not recorded in the local canary evidence pack."
        : "No locally searchable transcript asset is loaded; origin and method are not recorded.");
    const checkedOn = transcriptAsset?.provenance.inventoryCheckedOn ??
      source.transcript?.checkedOn ?? LOCAL_TRANSCRIPT_ASSET_CHECKED_ON;
    const completenessReceipt = transcriptAsset
      ? {
          status: "not-recorded" as const,
          scope: "entire-source-conversation" as const,
          recordedBy: null,
          recordedOn: null,
          transcriptAssetId: `local-review:${transcriptAsset.assetId}`,
          transcriptContentSha256: transcriptContentSha256(segments),
          recordedSegmentCount: segments.length,
          recordedDurationMs: source.durationSeconds * 1_000,
          note:
            `${transcriptAsset.provenance.note} The local asset identity and digest are recorded, but this is not a human completeness receipt.`,
        }
      : source.transcript?.completenessReceipt ?? {
      status: "not-recorded" as const,
      scope: "entire-source-conversation" as const,
      recordedBy: null,
      recordedOn: null,
      transcriptAssetId: null,
      transcriptContentSha256: null,
      recordedSegmentCount: null,
      recordedDurationMs: null,
      note: "No whole-conversation completeness attestation is recorded for this local asset.",
    };
    const searchableTranscriptAvailable = transcriptAsset
      ? transcriptAsset.searchScope === "full-conversation"
      : Boolean(
        completeness === "complete" &&
        source.transcript?.locallySearchableCompleteTranscript &&
        segments.length > 0
      );
    const completeTranscriptAvailable = Boolean(
      !transcriptAsset &&
        completeness === "complete" &&
        searchableTranscriptAvailable &&
        coverage.validatedComplete &&
        origin !== "unknown" &&
        methodLabel.trim() &&
        checkedOn.trim() &&
        completenessReceipt.status === "recorded" &&
        completenessReceipt.recordedBy?.trim() &&
        completenessReceipt.recordedOn?.trim() &&
        completenessReceipt.transcriptAssetId?.trim() &&
        /^sha256:[a-f0-9]{64}$/i.test(completenessReceipt.transcriptContentSha256 ?? "") &&
        completenessReceipt.transcriptContentSha256 === transcriptContentSha256(segments) &&
        completenessReceipt.recordedSegmentCount === coverage.segmentCount &&
        completenessReceipt.recordedDurationMs === coverage.durationMs,
    );
    return {
      sourceId: source.id,
      sourceLabel: source.citationLabel,
      episodeTitle: source.episode,
      sourceDurationMs: source.durationSeconds * 1_000,
      completeness,
      searchableTranscriptAvailable,
      searchScope: searchableTranscriptAvailable
        ? "full-conversation"
        : canaryWindows.length > 0
          ? "bounded-windows"
          : "none",
      assetKind: transcriptAsset?.assetKind ?? (
        canaryWindows.length > 0 ? "bounded-evidence" : "unavailable"
      ),
      humanAccuracyReviewed:
        transcriptAsset?.provenance.humanAccuracyReviewed ?? false,
      completeTranscriptAvailable,
      availabilityNote: transcriptAsset
        ? transcriptAsset.assetKind === "publisher-transcript"
          ? `Publisher transcript is loaded and searchable from its first to last cue across ${Math.round(temporalSpanRatio * 1_000) / 10}% of the episode timeline; several opening or closing seconds are not captioned, and CanvasMD has not independently reviewed word accuracy.`
          : `Full-conversation machine transcript is loaded and searchable across ${Math.round(coverage.coverageRatio * 1_000) / 10}% of the episode timeline; human accuracy review and completeness attestation are not recorded.`
        : completeTranscriptAvailable
          ? "Publication-attested complete transcript is loaded and searchable in this local reviewer fixture."
        : canaryWindows.length > 0
          ? `${canaryWindows.length} bounded transcript window${canaryWindows.length === 1 ? " is" : "s are"} loaded with preceding discourse from the local canary evidence pack; the complete transcript is not loaded.`
        : source.transcript?.url
          ? "A publisher transcript can be opened, but a complete searchable copy is not loaded in this local fixture."
          : "Only cited timing and editorial evidence mappings are available locally; complete transcript review remains blocked.",
      transcriptUrl: transcriptAsset?.transcriptUrl ?? source.transcript?.url,
      passageIds: passages
        .filter((passage) => passage.sourceId === source.id)
        .map((passage) => passage.id),
      origin,
      methodLabel,
      checkedOn,
      segments,
      coverage,
      completenessReceipt,
    };
  });
}

function versionsFor(brief: LocalDiscussionBrief): ReviewVersion[] {
  const normalized: ReviewVersion[] = brief.versions.map((version) => {
    const isCurrent = version.status === "current";
    const status: ReviewVersion["status"] = version.status === "current"
      ? "current-draft"
      : version.status;
    return {
      versionId: version.id,
      label: `Version ${version.version}`,
      date: version.recordedOn,
      status,
      trigger: version.trigger,
      change: isCurrent
        ? brief.governance.history[0]?.change ?? "Current reviewed brief."
        : `Superseded reader-core snapshot: ${version.snapshot.answerHeading}`,
      eligibleAsCurrent: isCurrent,
      exportEligible: true,
      snapshotCoverage: "full-reader-core",
      snapshot: version.snapshot,
    };
  });

  if (brief.id !== CORRECTION_TEST_FIXTURE.questionId) return normalized;
  return [
    ...normalized,
    {
      versionId: CORRECTION_TEST_FIXTURE.supersededVersion.versionId,
      label: CORRECTION_TEST_FIXTURE.supersededVersion.label,
      date: CORRECTION_TEST_FIXTURE.correction.recordedOn,
      status: "corrected",
      trigger: "Clinical-fact correction fixture",
      change: CORRECTION_TEST_FIXTURE.correction.reason,
      eligibleAsCurrent: false,
      exportEligible: canRenderCorrectionOnSurface(CORRECTION_TEST_FIXTURE, "export"),
      snapshotCoverage: "not-available",
    },
  ];
}

function priorWording(
  versions: ReviewVersion[],
  claimId: string,
  briefId: string,
): string | null {
  let prior: ReviewVersion | undefined;
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    const candidate = versions[index];
    if (candidate.status === "superseded" && candidate.snapshot) {
      prior = candidate;
      break;
    }
  }
  if (!prior?.snapshot) return null;
  if (claimId === `${briefId}:answer`) return prior.snapshot.answerHeading;
  return (
    prior.snapshot.synthesisClaims.find((claim) => claim.id === claimId)?.text ?? null
  );
}

function isCommerciallySupported(source: SourceConversation): boolean {
  return source.episodeSupport.kind === "sponsor-supported"
    || source.episodeSupport.kind === "commercial-partner-disclosed"
    || source.episodeSupport.kind === "educational-grant-supported";
}

function hasUncertainCommercialSupport(source: SourceConversation): boolean {
  return source.episodeSupport.kind === "support-not-established"
    || source.episodeSupport.kind === "program-context"
    || source.episodeSupport.kind === "publisher-produced";
}

function interpretiveReviewFor(
  brief: LocalDiscussionBrief,
  inputs: ClaimInput[],
): ReviewerQuestionRecord["interpretiveReview"] {
  const sources = new Map(brief.sources.map((source) => [source.id, source]));
  const reasons = new Set<string>();

  for (const input of inputs) {
    const mappedSources = input.sourceRefs
      .map((reference) => sources.get(reference.sourceId))
      .filter((source): source is SourceConversation => Boolean(source));
    const includesCommercialSupport = mappedSources.some(isCommerciallySupported);
    const hasIndependentCounterweight = mappedSources.some(
      (source) => source.episodeSupport.kind === "unsponsored",
    ) && new Set(mappedSources.map((source) => source.independenceCluster)).size > 1;
    if (includesCommercialSupport && !hasIndependentCounterweight) {
      reasons.add(
        "At least one material sentence relies on commercially supported conversation evidence without a separately independent mapped conversation.",
      );
    }
    if (mappedSources.some(hasUncertainCommercialSupport)) {
      reasons.add(
        "At least one material sentence relies on conversation evidence whose commercial support status is not established in the local record.",
      );
    }
  }

  if (brief.clinicalContext.status.text.toLocaleLowerCase().includes("off-label")) {
    reasons.add("The current brief contains consequential off-label-use context.");
  }
  const hasRecordedCorrection = brief.events.some(
    (event) => event.type === "correction-issued",
  );
  const hasReviewerOnlyCorrectionFixture =
    brief.id === CORRECTION_TEST_FIXTURE.questionId
    && canRenderCorrectionOnSurface(
      CORRECTION_TEST_FIXTURE,
      CORRECTION_ALLOWED_SURFACE,
    );
  if (hasRecordedCorrection || hasReviewerOnlyCorrectionFixture) {
    reasons.add("This question carries a clinical-fact correction history.");
  }

  const recordedReasons = [...reasons];
  return recordedReasons.length > 0
    ? {
        required: true,
        status: "required",
        reasons: recordedReasons,
        completedBy: null,
        completedOn: null,
      }
    : {
        required: false,
        status: "not-required",
        reasons: [],
        completedBy: null,
        completedOn: null,
      };
}

function reviewerRecord(
  brief: LocalDiscussionBrief,
  transcriptAssets: LocalTranscriptAssetMap,
): ReviewerQuestionRecord {
  const inputs = claimInputs(brief);
  const passages = passagesFor(brief, inputs, transcriptAssets);
  const passageIds = new Set(passages.map((passage) => passage.id));
  const versions = versionsFor(brief);
  const sourceTopics = new Map(
    brief.sources.map((source) => [
      source.id,
      Array.from(new Set(
        inputs
          .flatMap((input) => input.sourceRefs)
          .filter((reference) => reference.sourceId === source.id)
          .map((reference) => (
            reference.relevantAt.split(" · ").slice(1).join(" · ")
            || reference.relevantAt
          )),
      )),
    ]),
  );

  const claims: ClaimAuditRecord[] = inputs.map((input) => {
    const usedSourceIds = new Set(input.sourceRefs.map((reference) => reference.sourceId));
    const mappedSources = brief.sources.filter((source) => usedSourceIds.has(source.id));
    const evidencePassageIds = input.sourceRefs
      .map((reference) => passageId(reference))
      .filter((id) => passageIds.has(id));
    const previous = priorWording(versions, input.id, brief.id);
    const claimLabel = input.text.trim().replace(/[.!?]+$/, "");
    const mappedInputs = input.sourceRefs.map((reference) => {
      const source = brief.sources.find((candidate) => candidate.id === reference.sourceId);
      const [timestamp, ...topicParts] = reference.relevantAt.split(" · ");
      return `${source?.citationLabel ?? reference.sourceId} at ${timestamp}, labeled “${topicParts.join(" · ") || "cited episode moment"}”`;
    });
    const clinicalInputs = (input.clinicalEvidenceIds ?? []).map((evidenceId) => {
      const evidence = brief.clinicalContext.evidence.find(
        (candidate) => candidate.id === evidenceId,
      );
      return evidence ? `${evidence.label}: ${evidence.title}` : evidenceId;
    });
    return {
      claimId: input.id,
      claimText: input.text,
      section: input.section,
      evidenceUse: input.evidenceUse,
      evidencePassageIds,
      clinicalEvidenceIds: input.clinicalEvidenceIds ?? [],
      relevance:
        input.section === "clinical-fact"
          ? `The local draft maps “${claimLabel}” to ${clinicalInputs.join("; ")} because those records are labeled as the clinical references for this fact. This is a candidate rationale; the reviewer must confirm exact support.`
          : `The local draft maps “${claimLabel}” to ${mappedInputs.join("; ")} because those recorded evidence topics correspond to the sentence’s decision point. This is a candidate rationale; the reviewer status records whether the passages actually support it.`,
      sourcesConsideredButExcluded: brief.sources
        .filter((source) => !usedSourceIds.has(source.id))
        .map((source) => ({
          sourceLabel: source.citationLabel,
          reason:
            `Not selected for “${claimLabel}.” Elsewhere in this question’s evidence map, this ${source.sourceRole.toLocaleLowerCase()} is tagged for ${sourceTopics.get(source.id)?.map((topic) => `“${topic}”`).join(", ") || "no other recorded claim topic"}; no closer claim-level connection is recorded.`,
        })),
      qualifyingEvidence:
        input.sourceRefs.length > 1
          ? [
              `This synthesis combines ${mappedInputs.join("; ")}; each input must be accepted in full-episode context.`,
              ...(new Set(mappedSources.map((source) => source.independenceCluster)).size < mappedSources.length
                ? ["At least two mapped conversations share an editorial-independence group; do not treat the source count as independent corroboration."]
                : []),
              ...(mappedSources.some(isCommerciallySupported)
                ? ["At least one mapped conversation is commercially supported; the precise support context remains visible and does not increase evidentiary weight."]
                : []),
              ...(mappedSources.some(hasUncertainCommercialSupport)
                ? ["At least one mapped conversation has no established commercial-support determination in the local record."]
                : []),
            ]
          : mappedSources.some(isCommerciallySupported)
            ? ["The mapped conversation is commercially supported; the precise support context remains visible and does not increase evidentiary weight."]
            : mappedSources.some(hasUncertainCommercialSupport)
              ? ["The mapped conversation has no established commercial-support determination in the local record."]
            : [],
      materialUncertainty:
        input.uncertainty ??
        "The evidence map shows why the sentence was drafted; it does not replace clinical judgment or independent fact verification.",
      movementRationale: brief.movement.headline,
      wordingDiff: {
        previous,
        current: input.text,
        explanation: previous
          ? previous === input.text
            ? "The sentence is unchanged from the prior immutable snapshot."
            : "The current wording differs from the prior immutable snapshot."
          : "No sentence-level prior wording is loaded for this claim; the version-level change note remains visible in History.",
      },
    };
  });

  return {
    questionId: brief.id,
    versionId: versionId(brief),
    currentVersionLabel: `Version ${brief.governance.version}`,
    question: brief.question,
    movementState: brief.movement.state,
    claims,
    passages,
    transcripts: transcriptsFor(brief, passages, transcriptAssets),
    clinicalReferences: brief.clinicalContext.evidence,
    versions,
    accountableEditorId: "local-accountable-editor",
    independentVerification: {
      required: true,
      status: "required",
      reason:
        "Independent verification by a qualified human other than the publishing editor is required for new or materially changed clinical facts; no completion is recorded in this local fixture.",
      completedBy: null,
      completedOn: null,
    },
    interpretiveReview: interpretiveReviewFor(brief, inputs),
    provenanceNote:
      "The episode or show is the public unit of evidence. Claim mappings do not attribute a position to a named clinician, count speakers, or imply prevalence.",
    aiAuditNote:
      "This audit records observable source selections, claim mappings, exclusions, uncertainty, and version changes. It does not expose or reconstruct private model chain-of-thought.",
    editorialAudit: brief.editorialAudit,
  };
}

export function buildReviewerQuestionRecords(
  transcriptAssets: LocalTranscriptAssetMap = EMPTY_TRANSCRIPT_ASSETS,
): ReviewerQuestionRecord[] {
  return LOCAL_ROUNDS_BRIEFS.map((brief) => reviewerRecord(brief, transcriptAssets));
}

export const REVIEWER_QUESTION_RECORDS: ReviewerQuestionRecord[] =
  buildReviewerQuestionRecords();

export function getReviewerQuestionRecord(
  questionId: string,
  records: readonly ReviewerQuestionRecord[] = REVIEWER_QUESTION_RECORDS,
): ReviewerQuestionRecord | undefined {
  return records.find(
    (question) => question.questionId === questionId,
  );
}
