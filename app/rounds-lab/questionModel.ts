// LOCAL_FIXTURE_MODEL: data-only contracts for the development Rounds library.
// These structures deliberately contain no reader identity, analytics, or
// production persistence hooks.

export const MOVEMENT_STATES = ["Newly tracked", "Updated", "Watch", "Steady"] as const;

export type MovementState = (typeof MOVEMENT_STATES)[number];

export type IndependentVerification =
  | {
      status: "required";
      completedOn?: never;
      completedByRole?: never;
    }
  | {
      status: "complete";
      completedOn: string;
      completedByRole: string;
    }
  | {
      status: "not-required";
      completedOn?: never;
      completedByRole?: never;
    };

export type RoundsQuestionTags = {
  diseases: readonly string[];
  clinicalSettings: readonly string[];
  stagesOrLines: readonly string[];
  decisionTypes: readonly string[];
  treatmentsOrModalities: readonly string[];
  drugsBiomarkersProcedures: readonly string[];
  patientManagement: readonly string[];
  clinicalRoles: readonly string[];
  commonTerminology: readonly string[];
};

export type RoundsQuestionRelation = {
  questionId: string;
  kind: "related" | "broader" | "narrower";
  reason: string;
  editorConfirmedOn: string;
};

export type EditorConfirmedQuestionCreation = {
  status: "editor-confirmed";
  confirmedOn: string;
  decision: "new-canonical-question" | "merged-with-existing" | "related-to-existing";
  proposedFromSourceIds: readonly string[];
  overlapReviewedAgainstQuestionIds: readonly string[];
};

export type RoundsBriefContentSnapshot = {
  snapshotSchema: "rounds-reader-core-v1";
  question: string;
  answerLabel: string;
  answerHeading: string;
  synthesisClaims: readonly {
    id: string;
    text: string;
    sourceIds: readonly string[];
    stage?: "previous" | "new" | "current" | "unresolved";
    stageLabel?: string;
    sourceContext?: string;
  }[];
  movement: {
    state: MovementState;
    headline: string;
  };
  decisionBoundary: {
    heading: string;
    context: string;
    lenses: readonly {
      label: string;
      title: string;
      detail: string;
      sourceIds: readonly string[];
    }[];
  } | null;
  patientFactors: {
    label: string;
    heading: string;
    context: string;
    factors: readonly {
      id: string;
      label: string;
      implication: string;
      detail: string;
      sourceIds: readonly string[];
    }[];
  } | null;
  clinicalFacts: {
    status: { id: string; text: string } | null;
    keyFacts: readonly { id: string; text: string }[];
  } | null;
  clinicalFactIds: readonly string[];
  sourceIds: readonly string[];
};

export type RoundsQuestionVersion = {
  id: string;
  version: string;
  status: "current" | "superseded" | "corrected";
  recordedOn: string;
  trigger: string;
  movementState: MovementState;
  sourceCheckedOn: string;
  independentVerification: IndependentVerification;
  snapshot: RoundsBriefContentSnapshot;
};

export type RoundsQuestionEventType =
  | "question-created"
  | "brief-recorded"
  | "materially-updated"
  | "watch-signal"
  | "sources-reviewed"
  | "correction-issued";

export type RoundsQuestionEvent = {
  id: string;
  sequence: number;
  questionId: string;
  occurredOn: string;
  type: RoundsQuestionEventType;
  readerLabel?: string;
  summary: string;
  material: boolean;
  versionId?: string;
  sourceIds: readonly string[];
};

export type LocalFrontDoorScenario = {
  id: string;
  label: string;
  simulated: true;
  lastVisitOn: string;
  lastMaterialChangeOn: string;
  sourceConversationsReviewedThrough: string;
  hasMovementSinceLastVisit: boolean;
  prioritizedQuestionIds: readonly string[];
  exploreQuestionIds: readonly string[];
};

export type SnapshotInput = {
  id: string;
  version: string;
  movementState: MovementState;
  recordedOn: string;
  trigger: string;
  sourceCheckedOn: string;
  independentVerification: IndependentVerification;
  question: string;
  answerLabel: string;
  answerHeading: string;
  movement: RoundsBriefContentSnapshot["movement"];
  decisionBoundary: RoundsBriefContentSnapshot["decisionBoundary"];
  patientFactors: RoundsBriefContentSnapshot["patientFactors"];
  clinicalFacts: RoundsBriefContentSnapshot["clinicalFacts"];
  synthesisClaims: readonly {
    id: string;
    text: string;
    sourceRefs: readonly { sourceId: string }[];
    stage?: "previous" | "new" | "current" | "unresolved";
    stageLabel?: string;
    sourceContext?: string;
  }[];
  clinicalFactIds: readonly string[];
  sourceIds: readonly string[];
};

/**
 * Captures the complete reader-facing core used for a recorded version. The
 * returned object is frozen so fixture consumers cannot silently rewrite a
 * historical snapshot in memory.
 */
export function createCurrentVersionSnapshot(input: SnapshotInput): RoundsQuestionVersion {
  const snapshot: RoundsBriefContentSnapshot = {
    snapshotSchema: "rounds-reader-core-v1",
    question: input.question,
    answerLabel: input.answerLabel,
    answerHeading: input.answerHeading,
    synthesisClaims: input.synthesisClaims.map((claim) => Object.freeze({
      id: claim.id,
      text: claim.text,
      ...(claim.stage ? { stage: claim.stage } : {}),
      ...(claim.stageLabel ? { stageLabel: claim.stageLabel } : {}),
      ...(claim.sourceContext ? { sourceContext: claim.sourceContext } : {}),
      sourceIds: Object.freeze(Array.from(new Set(claim.sourceRefs.map((reference) => reference.sourceId)))),
    })),
    movement: Object.freeze({ ...input.movement }),
    decisionBoundary: input.decisionBoundary
      ? Object.freeze({
          ...input.decisionBoundary,
          lenses: Object.freeze(input.decisionBoundary.lenses.map((lens) => Object.freeze({
            ...lens,
            sourceIds: Object.freeze([...lens.sourceIds]),
          }))),
        })
      : null,
    patientFactors: input.patientFactors
      ? Object.freeze({
          ...input.patientFactors,
          factors: Object.freeze(input.patientFactors.factors.map((factor) => Object.freeze({
            ...factor,
            sourceIds: Object.freeze([...factor.sourceIds]),
          }))),
        })
      : null,
    clinicalFacts: input.clinicalFacts
      ? Object.freeze({
          status: input.clinicalFacts.status
            ? Object.freeze({ ...input.clinicalFacts.status })
            : null,
          keyFacts: Object.freeze(input.clinicalFacts.keyFacts.map((fact) => Object.freeze({ ...fact }))),
        })
      : null,
    clinicalFactIds: Object.freeze([...input.clinicalFactIds]),
    sourceIds: Object.freeze([...input.sourceIds]),
  };

  Object.freeze(snapshot.synthesisClaims);
  Object.freeze(snapshot);

  return Object.freeze({
    id: input.id,
    version: input.version,
    status: "current" as const,
    recordedOn: input.recordedOn,
    trigger: input.trigger,
    movementState: input.movementState,
    sourceCheckedOn: input.sourceCheckedOn,
    independentVerification: Object.freeze({ ...input.independentVerification }),
    snapshot,
  });
}

export function validateQuestionEventLog(questionId: string, events: readonly RoundsQuestionEvent[]) {
  if (!events.length) return false;

  return events.every((event, index) => (
    event.questionId === questionId
    && event.sequence === index + 1
    && (index === 0 || event.occurredOn >= events[index - 1].occurredOn)
  ));
}

export function validateQuestionTags(tags: RoundsQuestionTags) {
  return Object.values(tags).every((values) => values.length > 0);
}
