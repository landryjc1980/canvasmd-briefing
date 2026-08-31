// LOCAL_FIXTURE: hand-curated, episode-level evidence for the development-only
// Rounds Lab prototype. This module is intentionally disconnected from every
// production endpoint, cache, database, analytics path, and clinical workflow.

import type {
  EditorConfirmedQuestionCreation,
  IndependentVerification,
  LocalFrontDoorScenario,
  MovementState as CanonicalMovementState,
  RoundsQuestionEvent,
  RoundsQuestionRelation,
  RoundsQuestionTags,
  RoundsQuestionVersion,
} from "./questionModel";

export const MOVEMENT_STATES = [
  "Newly tracked",
  "Updated",
  "Watch",
  "Steady",
] as const satisfies readonly CanonicalMovementState[];
export type MovementState = CanonicalMovementState;

export type SourceReference = {
  sourceId: string;
  relevantAt: string;
  startMs: number;
};

export type SynthesisClaim = {
  id: string;
  text: string;
  sourceRefs: SourceReference[];
  stage?: "previous" | "new" | "current" | "unresolved";
  stageLabel?: string;
  sourceContext?: string;
};

export type CompleteTranscriptEditorialAudit = {
  sourceReviews: Array<{
    sourceId: string;
    status: "complete-asset-reviewed" | "partial-asset-excluded";
    note: string;
  }>;
  stateRationale: string;
  evidenceSelections: string[];
  sourceLimitations: string[];
  counterevidence: string[];
  revisedOrBlockedClaims: string[];
  unresolved: string[];
};

export type DiscussionLens = {
  label: string;
  title: string;
  detail: string;
  sourceRefs: SourceReference[];
};

export type DecisionFactor = {
  id: string;
  label: string;
  implication: string;
  detail: string;
  sourceRefs: SourceReference[];
};

export type SourceConversation = {
  id: string;
  show: string;
  citationLabel: string;
  episode: string;
  guests?: Array<{
    name: string;
    role?: string;
  }>;
  published: string;
  sourceRole: string;
  editorialFamily: string;
  independenceCluster: string;
  episodeSupport: {
    kind:
      | "unsponsored"
      | "sponsor-supported"
      | "commercial-partner-disclosed"
      | "educational-grant-supported"
      | "publisher-produced"
      | "program-context"
      | "support-not-established";
    label: string;
  };
  relevantAt: string;
  relevantAtMs: number;
  audioUrl: string;
  durationSeconds: number;
  url: string;
  localEvidenceReceipt?: {
    sourcePackSchemaVersion: "podcast-evidence-development-smoke-source-pack-v1.0.0";
    windowVersion: "podcast-evidence-window-v2.1.1";
    sourcePackId: string;
    targetStartMs: number;
    targetEndMs: number;
  };
};

export type EvidenceLink = {
  id: string;
  kind: "publication" | "regulatory" | "trial";
  role:
    | "primary-study"
    | "trial-registry"
    | "conference-report"
    | "trial-design"
    | "context-study"
    | "commentary"
    | "regulatory";
  label: string;
  title: string;
  url: string;
};

export type ClinicalFact = {
  id: string;
  text: string;
  evidenceIds: string[];
  sourceCheckedOn: string;
  independentVerification: IndependentVerification;
  jurisdiction?: string;
};

export type LocalDiscussionBrief = {
  id: string;
  slug: string;
  currentVersionId: string;
  shortLabel: string;
  area: string;
  readingTime: string;
  evidenceWindow: string;
  question: string;
  movement: {
    state: MovementState;
    date: string;
    dateLabel: string;
    headline: string;
    evidenceQualifier?: string;
    reviewedThrough: string;
    sourceRefs: SourceReference[];
  };
  answerLabel: string;
  answerHeading: string;
  synthesisClaims: SynthesisClaim[];
  editorialAudit: CompleteTranscriptEditorialAudit;
  clinicalContext: {
    status: ClinicalFact;
    keyFactsLabel: string;
    keyFacts: ClinicalFact[];
    evidence: EvidenceLink[];
  };
  governance: {
    publishingOwnerRole: string;
    factVerificationPolicy: string;
    interpretiveReviewPolicy: string;
    publicationState: "local-prototype";
    version: string;
    sourceCheckedOn: string;
    independentFactVerification: IndependentVerification;
    history: Array<{
      version: string;
      date: string;
      trigger: string;
      change: string;
    }>;
  };
  versions: readonly RoundsQuestionVersion[];
  events: readonly RoundsQuestionEvent[];
  tags: RoundsQuestionTags;
  editorConfirmed: EditorConfirmedQuestionCreation;
  relations: readonly RoundsQuestionRelation[];
  differencesHeading: string;
  differencesContext: string;
  lenses: DiscussionLens[];
  factorsLabel: string;
  factorsHeading: string;
  factorsContext: string;
  factors: DecisionFactor[];
  sources: SourceConversation[];
};

type LocalDiscussionBriefInput = Omit<LocalDiscussionBrief, "versions"> & {
  previousVersions?: readonly RoundsQuestionVersion[];
};

type LegacyLocalDiscussionBriefInput = Omit<LocalDiscussionBriefInput, "editorialAudit">;

type RegeneratedBriefUpdate = Pick<
  LocalDiscussionBriefInput,
  | "currentVersionId"
  | "movement"
  | "answerLabel"
  | "answerHeading"
  | "synthesisClaims"
  | "editorialAudit"
> & Partial<Pick<
  LocalDiscussionBriefInput,
  | "clinicalContext"
  | "differencesHeading"
  | "differencesContext"
  | "lenses"
  | "factorsLabel"
  | "factorsHeading"
  | "factorsContext"
  | "factors"
>> & {
  version: string;
  recordedOn: string;
  trigger: string;
  change: string;
  eventSummary: string;
  eventSourceIds: readonly string[];
  correction?: {
    summary: string;
    sourceIds?: readonly string[];
  };
};

function definePreviousVersion(version: RoundsQuestionVersion): RoundsQuestionVersion {
  const snapshot = Object.freeze({
    ...version.snapshot,
    synthesisClaims: Object.freeze(version.snapshot.synthesisClaims.map((claim) => Object.freeze({
      ...claim,
      sourceIds: Object.freeze([...claim.sourceIds]),
    }))),
    movement: Object.freeze({ ...version.snapshot.movement }),
    decisionBoundary: version.snapshot.decisionBoundary
      ? Object.freeze({
          ...version.snapshot.decisionBoundary,
          lenses: Object.freeze(version.snapshot.decisionBoundary.lenses.map((lens) => Object.freeze({
            ...lens,
            sourceIds: Object.freeze([...lens.sourceIds]),
          }))),
        })
      : null,
    patientFactors: version.snapshot.patientFactors
      ? Object.freeze({
          ...version.snapshot.patientFactors,
          factors: Object.freeze(version.snapshot.patientFactors.factors.map((factor) => Object.freeze({
            ...factor,
            sourceIds: Object.freeze([...factor.sourceIds]),
          }))),
        })
      : null,
    clinicalFacts: version.snapshot.clinicalFacts
      ? Object.freeze({
          status: version.snapshot.clinicalFacts.status
            ? Object.freeze({ ...version.snapshot.clinicalFacts.status })
            : null,
          keyFacts: Object.freeze(version.snapshot.clinicalFacts.keyFacts.map((fact) => Object.freeze({ ...fact }))),
        })
      : null,
    clinicalFactIds: Object.freeze([...version.snapshot.clinicalFactIds]),
    sourceIds: Object.freeze([...version.snapshot.sourceIds]),
  });

  return Object.freeze({
    ...version,
    independentVerification: Object.freeze({ ...version.independentVerification }),
    snapshot,
  });
}

function snapshotCurrentBrief(brief: LocalDiscussionBriefInput): RoundsQuestionVersion {
  const currentHistory = brief.governance.history[0];
  const synthesisClaims = brief.synthesisClaims.map((claim) => Object.freeze({
    id: claim.id,
    text: claim.text,
    ...(claim.stage ? { stage: claim.stage } : {}),
    ...(claim.stageLabel ? { stageLabel: claim.stageLabel } : {}),
    ...(claim.sourceContext ? { sourceContext: claim.sourceContext } : {}),
    sourceIds: Object.freeze(Array.from(new Set(claim.sourceRefs.map((reference) => reference.sourceId)))),
  }));
  const snapshot = Object.freeze({
    snapshotSchema: "rounds-reader-core-v1" as const,
    question: brief.question,
    answerLabel: brief.answerLabel,
    answerHeading: brief.answerHeading,
    synthesisClaims: Object.freeze(synthesisClaims),
    movement: Object.freeze({
      state: brief.movement.state,
      headline: brief.movement.headline,
    }),
    decisionBoundary: Object.freeze({
      heading: brief.differencesHeading,
      context: brief.differencesContext,
      lenses: Object.freeze(brief.lenses.map((lens) => Object.freeze({
        label: lens.label,
        title: lens.title,
        detail: lens.detail,
        sourceIds: Object.freeze(Array.from(new Set(
          lens.sourceRefs.map((reference) => reference.sourceId),
        ))),
      }))),
    }),
    patientFactors: Object.freeze({
      label: brief.factorsLabel,
      heading: brief.factorsHeading,
      context: brief.factorsContext,
      factors: Object.freeze(brief.factors.map((factor) => Object.freeze({
        id: factor.id,
        label: factor.label,
        implication: factor.implication,
        detail: factor.detail,
        sourceIds: Object.freeze(Array.from(new Set(
          factor.sourceRefs.map((reference) => reference.sourceId),
        ))),
      }))),
    }),
    clinicalFacts: Object.freeze({
      status: Object.freeze({
        id: brief.clinicalContext.status.id,
        text: brief.clinicalContext.status.text,
      }),
      keyFacts: Object.freeze(brief.clinicalContext.keyFacts.map((fact) => Object.freeze({
        id: fact.id,
        text: fact.text,
      }))),
    }),
    clinicalFactIds: Object.freeze([
      brief.clinicalContext.status.id,
      ...brief.clinicalContext.keyFacts.map((fact) => fact.id),
    ]),
    sourceIds: Object.freeze(brief.sources.map((source) => source.id)),
  });

  return Object.freeze({
    id: brief.currentVersionId,
    version: brief.governance.version,
    status: "current" as const,
    recordedOn: currentHistory.date,
    trigger: currentHistory.trigger,
    movementState: brief.movement.state,
    sourceCheckedOn: brief.governance.sourceCheckedOn,
    independentVerification: Object.freeze({ ...brief.governance.independentFactVerification }),
    snapshot,
  });
}

function assertLocalBriefIntegrity(brief: LocalDiscussionBrief): void {
  const errors: string[] = [];
  const sourceIds = new Set(brief.sources.map((source) => source.id));
  const versionIds = new Set(brief.versions.map((version) => version.id));
  const evidenceIds = new Set(brief.clinicalContext.evidence.map((item) => item.id));
  const currentVersions = brief.versions.filter((version) => version.status === "current");

  if (!brief.events.length || !brief.events.every((event, index) => (
    event.questionId === brief.id
    && event.sequence === index + 1
    && (index === 0 || event.occurredOn >= brief.events[index - 1].occurredOn)
  ))) {
    errors.push("event log order or identity is invalid");
  }
  if (!Object.values(brief.tags).every((values) => values.length > 0)) {
    errors.push("one or more tag axes are empty");
  }
  if (versionIds.size !== brief.versions.length) errors.push("version identifiers are not unique");
  if (sourceIds.size !== brief.sources.length) errors.push("source identifiers are not unique");
  if (evidenceIds.size !== brief.clinicalContext.evidence.length) {
    errors.push("evidence identifiers are not unique");
  }
  if (currentVersions.length !== 1 || currentVersions[0]?.id !== brief.currentVersionId) {
    errors.push("current-version pointer does not resolve to exactly one current version");
  }

  for (const event of brief.events) {
    if (event.versionId && !versionIds.has(event.versionId)) {
      errors.push(`event ${event.id} references missing version ${event.versionId}`);
    }
    for (const sourceId of event.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`event ${event.id} references missing source ${sourceId}`);
    }
  }

  const referenceGroups: Array<{ owner: string; references: readonly SourceReference[] }> = [
    { owner: "movement", references: brief.movement.sourceRefs },
    ...brief.synthesisClaims.map((claim) => ({ owner: `claim ${claim.id}`, references: claim.sourceRefs })),
    ...brief.lenses.map((lens) => ({ owner: `lens ${lens.title}`, references: lens.sourceRefs })),
    ...brief.factors.map((factor) => ({ owner: `factor ${factor.id}`, references: factor.sourceRefs })),
  ];
  for (const group of referenceGroups) {
    for (const reference of group.references) {
      if (!sourceIds.has(reference.sourceId)) {
        errors.push(`${group.owner} references missing source ${reference.sourceId}`);
      }
    }
  }

  for (const claim of brief.synthesisClaims) {
    if (claim.stage && !claim.stageLabel?.trim()) {
      errors.push(`claim ${claim.id} has a stage without a reader label`);
    }
  }
  for (const fact of [brief.clinicalContext.status, ...brief.clinicalContext.keyFacts]) {
    for (const evidenceId of fact.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`clinical fact ${fact.id} references missing evidence ${evidenceId}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Rounds Lab fixture integrity failed for ${brief.id}: ${errors.join("; ")}`);
  }
}

function defineLocalBrief(brief: LocalDiscussionBriefInput): LocalDiscussionBrief {
  const { previousVersions = [], ...currentBrief } = brief;
  const events = Object.freeze(currentBrief.events.map((event) => Object.freeze({
    ...event,
    sourceIds: Object.freeze([...event.sourceIds]),
  })));
  const tags = Object.freeze(Object.fromEntries(
    Object.entries(currentBrief.tags).map(([axis, values]) => [axis, Object.freeze([...values])]),
  )) as RoundsQuestionTags;
  const editorConfirmed = Object.freeze({
    ...currentBrief.editorConfirmed,
    proposedFromSourceIds: Object.freeze([...currentBrief.editorConfirmed.proposedFromSourceIds]),
    overlapReviewedAgainstQuestionIds: Object.freeze([
      ...currentBrief.editorConfirmed.overlapReviewedAgainstQuestionIds,
    ]),
  });
  const relations = Object.freeze(currentBrief.relations.map((relation) => Object.freeze({ ...relation })));

  const definedBrief: LocalDiscussionBrief = {
    ...currentBrief,
    events,
    tags,
    editorConfirmed,
    relations,
    versions: Object.freeze([
      ...previousVersions.map(definePreviousVersion),
      snapshotCurrentBrief(currentBrief),
    ]),
  };
  assertLocalBriefIntegrity(definedBrief);
  return definedBrief;
}

function regenerateLocalBrief(
  prior: LegacyLocalDiscussionBriefInput,
  update: RegeneratedBriefUpdate,
): LocalDiscussionBrief {
  const {
    version,
    recordedOn,
    trigger,
    change,
    eventSummary,
    eventSourceIds,
    correction,
    ...contentUpdate
  } = update;
  const priorVersion = Object.freeze({
    ...snapshotCurrentBrief(prior as LocalDiscussionBriefInput),
    status: "superseded" as const,
  });
  const nextEventSequence = prior.events.length + 1;
  const nextGovernance = {
    ...prior.governance,
    version,
    sourceCheckedOn: recordedOn,
    independentFactVerification: { status: "required" as const },
    history: [
      {
        version,
        date: recordedOn,
        trigger,
        change,
      },
      ...prior.governance.history,
    ],
  };

  const regeneratedEvents: RoundsQuestionEvent[] = [
    ...prior.events,
    {
      id: `${prior.id}-event-${nextEventSequence}`,
      sequence: nextEventSequence,
      questionId: prior.id,
      occurredOn: "2026-08-30",
      type: "brief-recorded",
      readerLabel: "Brief regenerated",
      summary: eventSummary,
      material: false,
      versionId: update.currentVersionId,
      sourceIds: eventSourceIds,
    },
  ];
  if (correction) {
    regeneratedEvents.push({
      id: `${prior.id}-event-${nextEventSequence + 1}`,
      sequence: nextEventSequence + 1,
      questionId: prior.id,
      occurredOn: "2026-08-30",
      type: "correction-issued",
      readerLabel: "Correction",
      summary: correction.summary,
      material: false,
      versionId: update.currentVersionId,
      sourceIds: correction.sourceIds ?? [],
    });
  }

  return defineLocalBrief({
    ...prior,
    ...contentUpdate,
    governance: nextGovernance,
    events: regeneratedEvents,
    previousVersions: [...(prior.previousVersions ?? []), priorVersion],
  });
}

const uromigos508: SourceConversation = {
  id: "uromigos-508",
  show: "The Uromigos",
  citationLabel: "Uromigos · Ep 508",
  episode: "Episode 508: ASCO 2026 Plenary — PROTEUS: ADT ± Apalutamide in High-Risk Localized Prostate Cancer",
  guests: [{ name: "Mary-Ellen Taplin", role: "PROTEUS principal investigator" }],
  published: "May 31, 2026",
  sourceRole: "Initial trial-results discussion",
  editorialFamily: "The Uromigos",
  independenceCluster: "PROTEUS trial discussion circuit",
  episodeSupport: { kind: "unsponsored", label: "Unsponsored" },
  relevantAt: "08:10 · Population and control arm",
  relevantAtMs: 490_000,
  audioUrl: "https://anchor.fm/s/13347ea8/podcast/play/120219309/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-4-19%2F424459091-44100-2-9da0f181e09c.m4a",
  durationSeconds: 2_380,
  url: "https://www.guoncologynow.com/podcast/episode-508-asco-2026-plenary-proteus-adt-apalutamide-in-high-risk-localized-prostate-cancer",
};

const uromigos515: SourceConversation = {
  id: "uromigos-515",
  show: "The Uromigos",
  citationLabel: "Uromigos · Ep 515",
  episode: "Episode 515: PROTEUS — A Reflection on the Data and Controversies",
  guests: [{ name: "Neha Vapiwala", role: "Radiation oncologist" }],
  published: "Aug 3, 2026",
  sourceRole: "Later editorial reflection",
  editorialFamily: "The Uromigos",
  independenceCluster: "PROTEUS later reflection",
  episodeSupport: { kind: "unsponsored", label: "Unsponsored" },
  relevantAt: "28:41 · Limits of routine escalation",
  relevantAtMs: 1_721_000,
  audioUrl: "https://anchor.fm/s/13347ea8/podcast/play/122820002/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-6-14%2F427936652-44100-2-c9b5b114a6349.m4a",
  durationSeconds: 2_586,
  url: "https://www.guoncologynow.com/podcast/episode-515-proteus-a-reflection-on-the-data-and-controversies-with-neha-vapiwala",
};

const eauProteus: SourceConversation = {
  id: "eau-proteus",
  show: "EAU Podcast",
  citationLabel: "EAU Podcast · PROTEUS",
  episode: "PROTEUS Trial and High-Risk Prostate Cancer",
  guests: [{ name: "Mary-Ellen Taplin", role: "PROTEUS principal investigator" }],
  published: "Aug 2, 2026",
  sourceRole: "Society trial interview",
  editorialFamily: "EAU Podcast",
  independenceCluster: "PROTEUS trial discussion circuit",
  episodeSupport: {
    kind: "publisher-produced",
    label: "EAU-produced · commercial support not established",
  },
  relevantAt: "03:52 · Patient selection",
  relevantAtMs: 232_000,
  audioUrl: "https://www.buzzsprout.com/1555850/episodes/19492437-proteus-trial-and-high-risk-pca-prof-taplin-discusses-the-results-with-dr-marra.mp3",
  durationSeconds: 1_538,
  url: "https://eaupodcasts.buzzsprout.com/1555850/episodes/19492437-proteus-trial-and-high-risk-pca-prof-taplin-discusses-the-results-with-dr-marra",
};

const guCastProteus: SourceConversation = {
  id: "gu-cast-proteus",
  show: "GU Cast | Urology Podcast",
  citationLabel: "GU Cast · PROTEUS",
  episode: "Did PROTEUS Just Change Urology?",
  guests: [{ name: "Mary-Ellen Taplin", role: "PROTEUS principal investigator" }],
  published: "Jun 1, 2026",
  sourceRole: "Themed trial discussion",
  editorialFamily: "GU Cast",
  independenceCluster: "PROTEUS trial discussion circuit",
  episodeSupport: { kind: "sponsor-supported", label: "Sponsor-supported episode · Johnson & Johnson" },
  relevantAt: "27:02 · Adoption in higher-risk disease",
  relevantAtMs: 1_622_000,
  audioUrl: "https://www.buzzsprout.com/904063/episodes/19253325-did-proteus-just-change-urology.mp3",
  durationSeconds: 2_360,
  url: "https://www.buzzsprout.com/904063/episodes/19253325-did-proteus-just-change-urology",
};

const pointOfCareMibc: SourceConversation = {
  id: "poc-mibc",
  show: "Hematology / Oncology @Point of Care Podcasts",
  citationLabel: "Point of Care · S32 E2",
  episode: "S32:E2 — Perioperative MIBC: Treatment Selection in Practice",
  published: "Aug 15, 2026",
  sourceRole: "Continuing-education program",
  editorialFamily: "Point of Care",
  independenceCluster: "MIBC educational program",
  episodeSupport: {
    kind: "educational-grant-supported",
    label: "Independent CME/CE activity · educational grant from Merck & Co.",
  },
  relevantAt: "07:17 · Regimen selection",
  relevantAtMs: 437_000,
  audioUrl: "https://pinecast.com/listen/d400a77e-b0d8-4ec3-9b5c-9669663ea704.mp3?source=rss&ext=asset.mp3",
  durationSeconds: 1_208,
  url: "https://suitehome.atpointofcare.com/library/2744.02/page/0",
};

const guCastMibc: SourceConversation = {
  id: "gu-cast-mibc",
  show: "GU Cast | Urology Podcast",
  citationLabel: "GU Cast · EV-pembro",
  episode: "EV-pembro in localised and advanced bladder cancer — a superb summary!",
  published: "Jun 24, 2026",
  sourceRole: "Themed treatment discussion",
  editorialFamily: "GU Cast",
  independenceCluster: "MIBC themed treatment discussion",
  episodeSupport: {
    kind: "commercial-partner-disclosed",
    label: "Astellas · GU Cast Platinum Partner disclosed in episode",
  },
  relevantAt: "03:19 · Perioperative EV–pembrolizumab route",
  relevantAtMs: 199_320,
  audioUrl: "https://www.buzzsprout.com/904063/episodes/19395025-ev-pembro-in-localised-and-advanced-bladder-cancer-a-superb-summary.mp3",
  durationSeconds: 1_964,
  url: "https://www.buzzsprout.com/904063/episodes/19395025-ev-pembro-in-localised-and-advanced-bladder-cancer-a-superb-summary",
};

const nrgArcher: SourceConversation = {
  id: "nrg-archer",
  show: "The NRG Oncology Podcast",
  citationLabel: "NRG Oncology · ARCHER",
  episode: "NRG-GU015, the ‘ARCHER’ Study for Muscle Invasive Bladder Cancer",
  published: "Jul 30, 2026",
  sourceRole: "Cooperative-group trial explainer",
  editorialFamily: "NRG Oncology",
  independenceCluster: "ARCHER study-network source",
  episodeSupport: {
    kind: "publisher-produced",
    label: "NRG Oncology-produced · commercial support not established",
  },
  relevantAt: "12:40 · 20- versus five-fraction trial comparison",
  relevantAtMs: 760_460,
  audioUrl: "https://anchor.fm/s/f73db3e4/podcast/play/123511939/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-6-30%2F5e8eda57-356d-4786-cf93-adea11896bf5.mp3",
  durationSeconds: 1_690,
  url: "https://podcasters.spotify.com/pod/show/nrg-oncology/episodes/NRG-GU015--the-ARCHER-Study-for-Muscle-Invasive-Bladder-Cancer-e3mnpm3",
};

const cmeKeynote564: SourceConversation = {
  id: "cme-keynote-564",
  show: "CME in Minutes: Education in Oncology & Hematology",
  citationLabel: "CME in Minutes · KEYNOTE-564",
  episode: "Navigating Urologic Cancer Care Across the Map: Getting up to Speed on the Latest Systemic Therapies for Renal Cell Carcinoma and Advanced Urothelial Carcinoma",
  published: "Apr 23, 2026",
  sourceRole: "Practice-selection discussion",
  editorialFamily: "CME in Minutes",
  independenceCluster: "Single CME program source",
  episodeSupport: {
    kind: "educational-grant-supported",
    label: "Educational activity · educational grant or in-kind support from Merck Canada",
  },
  relevantAt: "51:15 · Eligibility and selective referral",
  relevantAtMs: 3_075_280,
  audioUrl: "https://answersincme.com/240201307-4240201307-replay3.mp3?ProjectNumber=240201307-4&Promocode=861&AudienceID=AICME",
  durationSeconds: 4_226,
  url: "https://answersincme.com/860/240201307-replay3",
  localEvidenceReceipt: {
    sourcePackSchemaVersion: "podcast-evidence-development-smoke-source-pack-v1.0.0",
    windowVersion: "podcast-evidence-window-v2.1.1",
    sourcePackId: "gu-canary-08-keynote-564",
    targetStartMs: 3_025_290,
    targetEndMs: 3_107_010,
  },
};

const oncologyTodayTar210: SourceConversation = {
  id: "oncology-today-tar-210",
  show: "Oncology Today with Dr Neil Love",
  citationLabel: "Oncology Today · TAR-210",
  episode: "Non-Muscle-Invasive and Muscle-Invasive Bladder Cancer — Microlearning Activity 3: Proceedings from a Session Held Adjunct to the 2026 ASCO GU Cancers Symposium",
  published: "Aug 26, 2026",
  sourceRole: "Biomarker and delivery-system discussion",
  editorialFamily: "Oncology Today",
  independenceCluster: "Single educational program source",
  episodeSupport: {
    kind: "educational-grant-supported",
    label: "CME activity · educational grants from Genentech (Roche), Johnson & Johnson, and Natera",
  },
  relevantAt: "15:12 · FGFR-directed intravesical therapy",
  relevantAtMs: 912_280,
  audioUrl: "https://dts.podtrac.com/redirect.mp3/episodes.captivate.fm/episode/abd95e23-dfaa-4184-bec9-a4adfbd880b3.mp3",
  durationSeconds: 1_217,
  url: "https://oncologytoday.captivate.fm/episode/5953-ascogu2026-nmbladder-micro3",
  localEvidenceReceipt: {
    sourcePackSchemaVersion: "podcast-evidence-development-smoke-source-pack-v1.0.0",
    windowVersion: "podcast-evidence-window-v2.1.1",
    sourcePackId: "gu-canary-01-tar-210",
    targetStartMs: 912_280,
    targetEndMs: 1_010_730,
  },
};

const uromigos504: SourceConversation = {
  id: "uromigos-504",
  show: "The Uromigos",
  citationLabel: "Uromigos · Ep 504",
  episode: "Episode 504: ASCO 2026 — ADC Drug Development in Urothelial Cancer",
  published: "May 29, 2026",
  sourceRole: "Trial-update discussion",
  editorialFamily: "The Uromigos",
  independenceCluster: "EV-302 discussion circuit",
  episodeSupport: { kind: "unsponsored", label: "Unsponsored" },
  relevantAt: "01:01 · EV-302 combination and 3½-year update",
  relevantAtMs: 61_760,
  audioUrl: "https://anchor.fm/s/13347ea8/podcast/play/120514136/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2026-4-25%2F424851413-44100-2-cf14be68f94d8.m4a",
  durationSeconds: 2_432,
  url: "https://podcasters.spotify.com/pod/show/the-uromigos/episodes/Episode-504-ASCO-2026---ADC-Drug-Development-in-Urothelial-Cancer-e3jsa4o",
  localEvidenceReceipt: {
    sourcePackSchemaVersion: "podcast-evidence-development-smoke-source-pack-v1.0.0",
    windowVersion: "podcast-evidence-window-v2.1.1",
    sourcePackId: "gu-canary-07-ev-302-uromigos",
    targetStartMs: 8_609,
    targetEndMs: 69_980,
  },
};

const guCastEv302: SourceConversation = {
  ...guCastMibc,
  id: "gu-cast-ev-302",
  citationLabel: "GU Cast · EV-302",
  sourceRole: "Access and trial-update discussion",
  independenceCluster: "EV-302 discussion circuit",
  relevantAt: "20:24 · First-line access in Australia",
  relevantAtMs: 1_223_810,
  localEvidenceReceipt: {
    sourcePackSchemaVersion: "podcast-evidence-development-smoke-source-pack-v1.0.0",
    windowVersion: "podcast-evidence-window-v2.1.1",
    sourcePackId: "gu-canary-05-ev-302-gucast",
    targetStartMs: 1_223_810,
    targetEndMs: 1_283_130,
  },
};

export const LOCAL_ROUNDS_BRIEFS: LocalDiscussionBrief[] = [
  regenerateLocalBrief({
    id: "proteus-perioperative",
    slug: "proteus-perioperative",
    currentVersionId: "proteus-perioperative-v0.2",
    previousVersions: [
      {
        id: "proteus-perioperative-v0.1",
        version: "0.1",
        status: "superseded",
        recordedOn: "Jun 5, 2026",
        trigger: "Initial PROTEUS results discussion",
        movementState: "Newly tracked",
        sourceCheckedOn: "Jun 5, 2026",
        independentVerification: { status: "required" },
        snapshot: {
          snapshotSchema: "rounds-reader-core-v1",
          question: "After PROTEUS, should perioperative apalutamide become routine for high‑risk localized prostate cancer treated with prostatectomy?",
          answerLabel: "Initial answer from selected conversations",
          answerHeading: "A positive result with an unresolved adoption boundary.",
          synthesisClaims: [
            {
              id: "proteus-v0.1-trial-frame",
              text: "The initial selected discussions focused on trial population, control arm, endpoint, and whether to adopt the result.",
              sourceIds: ["uromigos-508", "gu-cast-proteus"],
            },
            {
              id: "proteus-v0.1-routine-use-open",
              text: "The first local read did not resolve routine perioperative use.",
              sourceIds: ["uromigos-508"],
            },
          ],
          movement: {
            state: "Newly tracked",
            headline: "Initial PROTEUS results discussions raised an adoption question worth following.",
          },
          decisionBoundary: null,
          patientFactors: null,
          clinicalFacts: {
            status: null,
            keyFacts: [
              {
                id: "proteus-five-year-mfs",
                text: "Five-year metastasis-free survival (MFS): 78.2% vs 73.5% (HR 0.80).",
              },
              {
                id: "proteus-grade-three-four-ae",
                text: "Grade 3–4 adverse events: 39.6% vs 31.0%.",
              },
            ],
          },
          clinicalFactIds: ["proteus-five-year-mfs", "proteus-grade-three-four-ae"],
          sourceIds: ["uromigos-508", "gu-cast-proteus"],
        },
      },
    ],
    shortLabel: "PROTEUS after prostatectomy",
    area: "GU oncology",
    readingTime: "1-minute brief",
    evidenceWindow: "Selected conversations · May–Aug 2026",
    question: "After PROTEUS, should perioperative apalutamide become routine for high‑risk localized prostate cancer treated with prostatectomy?",
    movement: {
      state: "Updated",
      date: "Aug 3",
      dateLabel: "Conversation published Aug 3",
      headline: "An Aug 3 Uromigos episode revisited how broadly PROTEUS should change practice.",
      reviewedThrough: "Aug 27, 2026",
      sourceRefs: [
        { sourceId: "uromigos-515", relevantAt: "28:41 · Limits of routine escalation", startMs: 1_721_000 },
      ],
    },
    answerLabel: "Answer from selected conversations",
    answerHeading: "Selective consideration—not routine use.",
    synthesisClaims: [
      {
        id: "proteus-movement-read",
        text: "Across selected May and August Uromigos episodes, attention moved from trial design to how broadly the positive result should change practice.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "08:10 · Population and control arm", startMs: 490_000 },
          { sourceId: "uromigos-515", relevantAt: "28:41 · Limits of routine escalation", startMs: 1_721_000 },
        ],
      },
      {
        id: "proteus-selective-use-boundary",
        text: "The answer at that time was selective consideration for trial-like, surgery-bound patients—not routine use around every prostatectomy.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "08:10 · Population and control arm", startMs: 490_000 },
          { sourceId: "uromigos-515", relevantAt: "28:41 · Limits of routine escalation", startMs: 1_721_000 },
          { sourceId: "eau-proteus", relevantAt: "03:52 · Patient selection", startMs: 232_000 },
          { sourceId: "gu-cast-proteus", relevantAt: "27:02 · Adoption in higher-risk disease", startMs: 1_622_000 },
        ],
      },
      {
        id: "proteus-burden-uncertainty",
        text: "It remains uncertain whether potential benefit justifies a year of added therapy.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "31:02 · Toxicity and recovery", startMs: 1_862_000 },
          { sourceId: "uromigos-515", relevantAt: "19:14 · Hormone burden and salvage options", startMs: 1_154_000 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "proteus-us-status",
        text: "Positive phase 3 result; perioperative apalutamide around prostatectomy remains off-label in the U.S. as of Aug 28, 2026.",
        evidenceIds: ["erleada-us-label"],
        sourceCheckedOn: "Aug 28, 2026",
        independentVerification: { status: "required" },
        jurisdiction: "United States",
      },
      keyFactsLabel: "Key benefit and added burden",
      keyFacts: [
        {
          id: "proteus-five-year-mfs",
          text: "Five-year metastasis-free survival (MFS): 78.2% vs 73.5% (HR 0.80).",
          evidenceIds: ["proteus-nejm"],
          sourceCheckedOn: "Aug 28, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "proteus-grade-three-four-ae",
          text: "Grade 3–4 adverse events: 39.6% vs 31.0%.",
          evidenceIds: ["proteus-nejm"],
          sourceCheckedOn: "Aug 28, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "proteus-nejm",
          kind: "publication",
          role: "primary-study",
          label: "Primary study",
          title: "PROTEUS phase 3 trial · NEJM",
          url: "https://www.nejm.org/doi/abs/10.1056/NEJMoa2603878",
        },
        {
          id: "erleada-us-label",
          kind: "regulatory",
          role: "regulatory",
          label: "Regulatory verification",
          title: "Current U.S. ERLEADA label · FDA",
          url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/210951s024lbl.pdf",
        },
      ],
    },
    governance: {
      publishingOwnerRole: "CanvasMD editor",
      factVerificationPolicy: "New or materially changed clinical facts require independent verification before external use",
      interpretiveReviewPolicy: "Additional interpretive review is risk-based, not automatic",
      publicationState: "local-prototype",
      version: "0.2",
      sourceCheckedOn: "Aug 28, 2026",
      independentFactVerification: { status: "required" },
      history: [
        {
          version: "0.2",
          date: "Aug 28, 2026",
          trigger: "August PROTEUS reflection",
          change: "Separated the adoption synthesis into claim-level source groups and added source-checked regulatory context.",
        },
      ],
    },
    events: [
      {
        id: "proteus-perioperative-event-1",
        sequence: 1,
        questionId: "proteus-perioperative",
        occurredOn: "2026-06-04",
        type: "question-created",
        summary: "An editor confirmed this as a consequential clinical question after the initial PROTEUS discussion.",
        material: true,
        sourceIds: ["uromigos-508"],
      },
      {
        id: "proteus-perioperative-event-2",
        sequence: 2,
        questionId: "proteus-perioperative",
        occurredOn: "2026-08-03",
        type: "materially-updated",
        summary: "A later episode changed the read from trial result to the boundary for selective adoption.",
        material: true,
        versionId: "proteus-perioperative-v0.2",
        sourceIds: ["uromigos-515"],
      },
      {
        id: "proteus-perioperative-event-3",
        sequence: 3,
        questionId: "proteus-perioperative",
        occurredOn: "2026-08-27",
        type: "sources-reviewed",
        summary: "Selected source conversations were reviewed again through Aug 27 without another recorded change.",
        material: false,
        sourceIds: ["uromigos-508", "uromigos-515", "eau-proteus", "gu-cast-proteus"],
      },
    ],
    tags: {
      diseases: ["Prostate cancer"],
      clinicalSettings: ["Localized high-risk disease", "Perioperative care"],
      stagesOrLines: ["High-risk localized", "Before and after prostatectomy"],
      decisionTypes: ["Treatment selection", "Treatment intensification", "Shared decision-making"],
      treatmentsOrModalities: ["Prostatectomy", "Androgen-deprivation therapy", "Androgen-receptor pathway inhibition"],
      drugsBiomarkersProcedures: ["Apalutamide", "ADT", "PSMA PET", "PROTEUS"],
      patientManagement: ["Treatment burden", "Adherence", "Toxicity", "Imaging interpretation"],
      clinicalRoles: ["Urologic oncologist", "Medical oncologist", "Radiation oncologist"],
      commonTerminology: ["perioperative apalutamide", "hormone intensification", "MFS", "metastasis-free survival", "side effects"],
    },
    editorConfirmed: {
      status: "editor-confirmed",
      confirmedOn: "Aug 28, 2026",
      decision: "new-canonical-question",
      proposedFromSourceIds: ["uromigos-508"],
      overlapReviewedAgainstQuestionIds: [],
    },
    relations: [],
    differencesHeading: "Act selectively now—or wait.",
    differencesContext: "Both stop short of routine use; they differ on when selective use is reasonable.",
    lenses: [
      {
        label: "Consider now, selectively",
        title: "Raise it with patients who most closely match PROTEUS.",
        detail: "Best fit: surgery chosen, trial-like risk, and added burden accepted.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "33:52 · Whether this becomes standard of care", startMs: 2_031_600 },
          { sourceId: "gu-cast-proteus", relevantAt: "27:02 · Adoption in higher-risk disease", startMs: 1_622_000 },
        ],
      },
      {
        label: "Wait before routine use",
        title: "Do not make it a broad surgical default.",
        detail: "Comparator, endpoint, alternatives, and toxicity limit extrapolation.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "12:47 · Control-arm compromise", startMs: 767_000 },
          { sourceId: "uromigos-515", relevantAt: "28:41 · Limits of routine escalation", startMs: 1_721_000 },
        ],
      },
    ],
    factorsLabel: "Patient factors",
    factorsHeading: "Four checks shape whether selective use is reasonable.",
    factorsContext: "They connect trial fit and treatment burden to the patient.",
    factors: [
      {
        id: "risk",
        label: "Metastatic risk",
        implication: "Does the patient match PROTEUS’s highest-risk population?",
        detail: "Grade group, clinical stage, PSA, biopsy burden, nodal findings, and expected postoperative treatment determine how closely the patient resembles the trial population.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "08:10 · Trial population", startMs: 490_000 },
          { sourceId: "eau-proteus", relevantAt: "03:52 · Patient selection", startMs: 232_000 },
        ],
      },
      {
        id: "local-path",
        label: "Local pathway",
        implication: "Is surgery preferred after comparing other local paths?",
        detail: "PROTEUS did not directly compare perioperative intensification with prostatectomy plus early salvage or with definitive radiation plus long-term ADT.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "38:39 · Competing local pathways", startMs: 2_319_000 },
        ],
      },
      {
        id: "endpoint",
        label: "Imaging & endpoint",
        implication: "How meaningful is imaging-informed MFS for this patient?",
        detail: "Baseline staging, scan availability, and the meaning of a PET-detected event matter when translating the study endpoint into everyday benefit.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "21:25 · MFS and PSMA PET", startMs: 1_285_000 },
          { sourceId: "uromigos-515", relevantAt: "34:11 · MFS and PSMA lead time", startMs: 2_051_000 },
        ],
      },
      {
        id: "burden",
        label: "Treatment burden",
        implication: "Is a year of hormone intensification acceptable?",
        detail: "Rash, fatigue, falls, metabolic and cardiovascular health, sexual function, testosterone recovery, and adherence shape acceptability.",
        sourceRefs: [
          { sourceId: "uromigos-508", relevantAt: "31:02 · Toxicity and recovery", startMs: 1_862_000 },
          { sourceId: "uromigos-515", relevantAt: "19:14 · Hormone burden and salvage options", startMs: 1_154_000 },
        ],
      },
    ],
    sources: [uromigos508, uromigos515, eauProteus, guCastProteus],
  }, {
    currentVersionId: "proteus-perioperative-v0.3",
    version: "0.3",
    recordedOn: "Aug 30, 2026",
    trigger: "Complete-transcript editorial regeneration",
    change: "Preserved version 0.2 and rebuilt the reader narrative from complete episode transcripts, including the later skeptical turn and a separate counterevidence pass.",
    eventSummary: "A complete-transcript regeneration was recorded without treating the editorial re-analysis as a new source event.",
    eventSourceIds: ["uromigos-515", "eau-proteus", "gu-cast-proteus"],
    movement: {
      state: "Updated",
      date: "Aug 3",
      dateLabel: "Material conversation published Aug 3",
      headline: "Favorable discussions support offering PROTEUS selectively; a later critical review argues against routine use.",
      evidenceQualifier: "Three complete conversations reviewed · the two favorable conversations share the same trial investigator · Ep 508 partial and excluded",
      reviewedThrough: "Aug 30, 2026",
      sourceRefs: [
        { sourceId: "uromigos-515", relevantAt: "28:41 · Uniform escalation judged unconvincing", startMs: 1_721_000 },
        { sourceId: "uromigos-515", relevantAt: "34:14 · PSMA-PET MFS and overall-survival uncertainty", startMs: 2_054_000 },
      ],
    },
    answerLabel: "Evidence: positive phase 3 result · 3 complete conversations · 1 partial source excluded",
    answerHeading: "Not routinely. PROTEUS supports discussing perioperative apalutamide with selected very-high-risk patients choosing surgery, but overall-survival benefit and the best comparison with radiation or early salvage remain unresolved.",
    synthesisClaims: [
      {
        id: "proteus-previous-read",
        stage: "previous",
        stageLabel: "Evidence supporting selective use",
        text: "PROTEUS was positive for metastasis-free survival, and two conversations interpret it as an added option for selected higher-risk patients choosing surgery.",
        sourceContext: "Shared-source context: both favorable conversations feature PROTEUS principal investigator Mary-Ellen Taplin and belong to the same trial-discussion circuit; they are not independent confirmations.",
        sourceRefs: [
          { sourceId: "gu-cast-proteus", relevantAt: "27:06 · Favorable adoption discussion in higher-risk disease", startMs: 1_626_000 },
          { sourceId: "eau-proteus", relevantAt: "11:57 · Adds an option rather than replacing standard care", startMs: 717_000 },
        ],
      },
      {
        id: "proteus-new-conversation",
        stage: "new",
        stageLabel: "Evidence against routine use",
        text: "A later critical discussion argues against routine use: overall survival has not been proven, the comparator and salvage path remain debatable, treatment adds a year of hormone intensification, and no predictive biomarker identifies who benefits most.",
        sourceRefs: [
          { sourceId: "uromigos-515", relevantAt: "18:33 · Early-salvage pathway implications", startMs: 1_113_000 },
          { sourceId: "uromigos-515", relevantAt: "23:19 · Toxicity and testosterone recovery", startMs: 1_399_000 },
          { sourceId: "uromigos-515", relevantAt: "27:28 · No predictive selection biomarker", startMs: 1_648_000 },
          { sourceId: "uromigos-515", relevantAt: "34:14 · PSMA-PET MFS and overall-survival uncertainty", startMs: 2_054_000 },
        ],
      },
      {
        id: "proteus-current-read",
        stage: "current",
        stageLabel: "Who might consider it",
        text: "Consider it selectively for a very-high-risk, surgery-committed patient only after comparing radiation and early-salvage paths and accepting a year of hormone intensification.",
        sourceRefs: [
          { sourceId: "eau-proteus", relevantAt: "12:42 · Not a one-size-fits-all option", startMs: 762_000 },
          { sourceId: "uromigos-515", relevantAt: "18:33 · Early-salvage pathway implications", startMs: 1_113_000 },
          { sourceId: "uromigos-515", relevantAt: "28:41 · Uniform escalation judged unconvincing", startMs: 1_721_000 },
        ],
      },
      {
        id: "proteus-unresolved",
        stage: "unresolved",
        stageLabel: "What remains unknown",
        text: "Overall-survival benefit, a surgery-alone comparison, biomarker selection, testosterone recovery, and the best salvage pathway remain unresolved.",
        sourceRefs: [
          { sourceId: "uromigos-515", relevantAt: "23:27 · Testosterone non-recovery", startMs: 1_407_000 },
          { sourceId: "uromigos-515", relevantAt: "27:28 · No predictive selection biomarker", startMs: 1_648_000 },
          { sourceId: "uromigos-515", relevantAt: "40:58 · Overall-survival benefit cannot yet be claimed", startMs: 2_458_000 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "proteus-us-status",
        text: "Positive phase 3 result; perioperative apalutamide around prostatectomy remains off-label in the U.S. as of Aug 30, 2026.",
        evidenceIds: ["erleada-us-label"],
        sourceCheckedOn: "Aug 30, 2026",
        independentVerification: { status: "required" },
        jurisdiction: "United States",
      },
      keyFactsLabel: "Key benefit and added burden",
      keyFacts: [
        {
          id: "proteus-five-year-mfs",
          text: "Five-year metastasis-free survival (MFS): 78.2% vs 73.5% (HR 0.80).",
          evidenceIds: ["proteus-nejm"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "proteus-grade-three-four-ae",
          text: "Grade 3–4 adverse events: 39.6% vs 31.0%.",
          evidenceIds: ["proteus-nejm"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "proteus-nejm",
          kind: "publication",
          role: "primary-study",
          label: "Primary study",
          title: "PROTEUS phase 3 trial · NEJM",
          url: "https://www.nejm.org/doi/full/10.1056/NEJMoa2603878",
        },
        {
          id: "proteus-registry",
          kind: "trial",
          role: "trial-registry",
          label: "Trial registry",
          title: "PROTEUS · NCT03767244 · ClinicalTrials.gov",
          url: "https://clinicaltrials.gov/study/NCT03767244",
        },
        {
          id: "proteus-asco-final",
          kind: "publication",
          role: "conference-report",
          label: "Conference report · same trial dataset",
          title: "PROTEUS final analysis · ASCO 2026",
          url: "https://ascopubs.org/doi/10.1200/JCO.2026.44.17_suppl.LBA1",
        },
        {
          id: "proteus-design-paper",
          kind: "publication",
          role: "trial-design",
          label: "Trial design report",
          title: "PROTEUS phase 3 study design · Journal of Clinical Oncology",
          url: "https://ascopubs.org/doi/10.1200/JCO.2022.40.6_suppl.TPS285",
        },
        {
          id: "proteus-natural-history",
          kind: "publication",
          role: "context-study",
          label: "Context study · not a randomized PROTEUS result",
          title: "Natural history of PROTEUS-eligible surgical patients · European Urology Focus",
          url: "https://pubmed.ncbi.nlm.nih.gov/42425812/",
        },
        {
          id: "proteus-critical-editorial",
          kind: "publication",
          role: "commentary",
          label: "Critical commentary · interpretation",
          title: "Are we ready to embrace perioperative apalutamide for all high-risk patients?",
          url: "https://pubmed.ncbi.nlm.nih.gov/42379900/",
        },
        {
          id: "erleada-us-label",
          kind: "regulatory",
          role: "regulatory",
          label: "Regulatory verification",
          title: "Current U.S. ERLEADA label · FDA",
          url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/210951s024lbl.pdf",
        },
      ],
    },
    differencesHeading: "Option-oriented early read; narrower later boundary.",
    differencesContext: "The complete episodes differ in emphasis, and the later skeptical episode changes the weight without creating consensus.",
    lenses: [
      {
        label: "Initial option-oriented frame",
        title: "Use the result to open a selective discussion.",
        detail: "The favorable complete conversations describe an added option for higher-risk, surgery-oriented patients, not a universal standard.",
        sourceRefs: [
          { sourceId: "gu-cast-proteus", relevantAt: "27:06 · Favorable adoption discussion in higher-risk disease", startMs: 1_626_000 },
          { sourceId: "eau-proteus", relevantAt: "11:57 · Adds an option rather than replacing standard care", startMs: 717_000 },
        ],
      },
      {
        label: "Later skeptical frame",
        title: "Do not make uniform perioperative escalation routine.",
        detail: "The later episode presses on control-arm relevance, endpoint meaning, salvage, toxicity, and the absence of a selector.",
        sourceRefs: [
          { sourceId: "uromigos-515", relevantAt: "27:28 · No predictive selection biomarker", startMs: 1_648_000 },
          { sourceId: "uromigos-515", relevantAt: "28:41 · Uniform escalation judged unconvincing", startMs: 1_721_000 },
          { sourceId: "uromigos-515", relevantAt: "34:14 · PSMA-PET MFS and overall-survival uncertainty", startMs: 2_054_000 },
        ],
      },
    ],
    factorsHeading: "Four checks bound selective consideration.",
    factorsContext: "They connect the complete-transcript disagreements to the individual surgical decision.",
    factors: [
      {
        id: "risk",
        label: "Metastatic risk",
        implication: "Is the patient at sufficiently high risk to consider added burden?",
        detail: "Risk concentration matters because the conversations do not support uniform escalation across every prostatectomy candidate.",
        sourceRefs: [
          { sourceId: "eau-proteus", relevantAt: "12:58 · Higher-volume, aggressive disease as a selective case", startMs: 778_000 },
          { sourceId: "uromigos-515", relevantAt: "28:41 · Uniform escalation judged unconvincing", startMs: 1_721_000 },
        ],
      },
      {
        id: "local-path",
        label: "Local pathway",
        implication: "Were radiation and early salvage compared before choosing surgery?",
        detail: "The later episode treats the alternatives and salvage consequences as part of the perioperative decision, not an afterthought.",
        sourceRefs: [
          { sourceId: "uromigos-515", relevantAt: "13:49 · Early-salvage discussion", startMs: 829_000 },
          { sourceId: "uromigos-515", relevantAt: "18:33 · Early-salvage pathway implications", startMs: 1_113_000 },
        ],
      },
      {
        id: "endpoint",
        label: "Endpoint meaning",
        implication: "How should PET-detected MFS be weighed without proven OS benefit?",
        detail: "The challenge pass retained MFS as the positive trial endpoint but blocked wording that treated it as established overall-survival benefit.",
        sourceRefs: [
          { sourceId: "uromigos-515", relevantAt: "34:14 · PSMA-PET MFS and overall-survival uncertainty", startMs: 2_054_000 },
          { sourceId: "uromigos-515", relevantAt: "40:58 · Overall-survival benefit cannot yet be claimed", startMs: 2_458_000 },
        ],
      },
      {
        id: "burden",
        label: "Treatment burden",
        implication: "Is a year of intensification and uncertain recovery acceptable?",
        detail: "Adverse effects, testosterone recovery, and downstream salvage exposure belong in the tradeoff.",
        sourceRefs: [
          { sourceId: "uromigos-515", relevantAt: "23:19 · Toxicity and testosterone recovery", startMs: 1_399_000 },
          { sourceId: "uromigos-515", relevantAt: "23:27 · Testosterone non-recovery", startMs: 1_407_000 },
        ],
      },
    ],
    editorialAudit: {
      sourceReviews: [
        { sourceId: "uromigos-508", status: "partial-asset-excluded", note: "Publisher SRT was read, but its publication-level completeness is partial; it does not carry a material regenerated claim." },
        { sourceId: "uromigos-515", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
        { sourceId: "eau-proteus", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
        { sourceId: "gu-cast-proteus", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
      ],
      stateRationale: "Updated survives because the later complete conversation materially narrows the earlier option-oriented read; the regeneration itself is not counted as new movement.",
      evidenceSelections: ["Initial option-oriented framing", "Later comparator and endpoint skepticism", "Salvage implications", "Toxicity and testosterone recovery", "Absence of a predictive selector"],
      sourceLimitations: ["The two Uromigos episodes are one editorial family, not independent corroboration.", "The favorable EAU and GU Cast conversations both feature PROTEUS principal investigator Mary-Ellen Taplin and belong to the same trial-discussion circuit; they are not independent confirmations.", "GU Cast discloses J&J support; EAU commercial support is not established in the local record."],
      counterevidence: ["EAU and GU Cast remain more favorable than the later Uromigos reflection.", "The phase 3 MFS result is positive even though the later conversation disputes how broadly it should drive practice."],
      revisedOrBlockedClaims: ["Revised “revisited” to a material skeptical turn.", "Blocked routine-use, consensus, proven-OS-benefit, and biomarker-selected-benefit claims."],
      unresolved: ["Overall survival", "Comparator relevance", "Selection biomarkers", "Quality of life and testosterone recovery", "Optimal salvage pathway"],
    },
  }),
  regenerateLocalBrief({
    id: "mibc-perioperative-systemic",
    slug: "mibc-perioperative-systemic",
    currentVersionId: "mibc-perioperative-systemic-v0.2",
    previousVersions: [
      {
        id: "mibc-perioperative-systemic-v0.1",
        version: "0.1",
        status: "superseded",
        recordedOn: "Jun 26, 2026",
        trigger: "Initial perioperative EV–pembrolizumab discussion",
        movementState: "Newly tracked",
        sourceCheckedOn: "Jun 26, 2026",
        independentVerification: { status: "required" },
        snapshot: {
          snapshotSchema: "rounds-reader-core-v1",
          question: "After KEYNOTE-B15/EV-304, how should perioperative systemic therapy be chosen for patients proceeding to cystectomy?",
          answerLabel: "Initial answer from this conversation",
          answerHeading: "A consequential new route with implementation still unsettled.",
          synthesisClaims: [
            {
              id: "mibc-v0.1-route-selection",
              text: "The initial selected conversation raised perioperative EV–pembrolizumab as another route to weigh against cisplatin-based treatment.",
              sourceIds: ["gu-cast-mibc"],
            },
            {
              id: "mibc-v0.1-implementation-open",
              text: "The first local read kept routine implementation and jurisdictional access open.",
              sourceIds: ["gu-cast-mibc"],
            },
          ],
          movement: {
            state: "Newly tracked",
            headline: "An initial perioperative EV–pembrolizumab discussion opened an implementation question.",
          },
          decisionBoundary: null,
          patientFactors: null,
          clinicalFacts: null,
          clinicalFactIds: [],
          sourceIds: ["gu-cast-mibc"],
        },
      },
    ],
    shortLabel: "Systemic therapy before cystectomy",
    area: "GU oncology",
    readingTime: "1-minute brief",
    evidenceWindow: "Selected conversations · Jun–Aug 2026",
    question: "After KEYNOTE-B15/EV-304, how should perioperative systemic therapy be chosen for patients proceeding to cystectomy?",
    movement: {
      state: "Updated",
      date: "Jul 10",
      dateLabel: "U.S. approval dated Jul 10",
      headline: "After the U.S. approval, a Point of Care episode focused on regimen selection and contraindications.",
      reviewedThrough: "Aug 27, 2026",
      sourceRefs: [
        { sourceId: "poc-mibc", relevantAt: "07:17 · Regimen selection", startMs: 437_000 },
        { sourceId: "poc-mibc", relevantAt: "10:56 · Immune and EV contraindications", startMs: 656_080 },
      ],
    },
    answerLabel: "Answer from selected conversations",
    answerHeading: "A new approved route—not one new default.",
    synthesisClaims: [
      {
        id: "mibc-approval-movement",
        text: "The Jul 10 U.S. approval moved the practical question beyond cisplatin eligibility.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "07:17 · Regimen selection", startMs: 437_000 },
        ],
      },
      {
        id: "mibc-route-boundary",
        text: "Across these selected conversations, EV–pembrolizumab adds an approved perioperative route rather than a universal replacement for cisplatin-based therapy.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "03:19 · Perioperative EV–pembrolizumab route", startMs: 199_320 },
          { sourceId: "poc-mibc", relevantAt: "07:17 · Regimen selection", startMs: 437_000 },
          { sourceId: "gu-cast-mibc", relevantAt: "06:32 · Cisplatin comparison", startMs: 392_000 },
        ],
      },
      {
        id: "mibc-patient-decision-boundary",
        text: "Toxicity, disease features, and coordination with cystectomy timing still define the decision boundary.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "10:56 · Immune and EV contraindications", startMs: 656_080 },
          { sourceId: "gu-cast-mibc", relevantAt: "07:28 · Cisplatin eligibility and variant histology", startMs: 448_360 },
          { sourceId: "poc-mibc", relevantAt: "13:19 · Surgical and perioperative timing", startMs: 799_520 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "mibc-ev-pembro-us-status",
        text: "FDA-approved July 10, 2026 for adults with MIBC who are candidates for cystectomy; labels and access can differ by jurisdiction.",
        evidenceIds: ["mibc-fda-approval"],
        sourceCheckedOn: "Aug 28, 2026",
        independentVerification: { status: "required" },
        jurisdiction: "United States",
      },
      keyFactsLabel: "Key trial results",
      keyFacts: [
        {
          id: "mibc-efs",
          text: "Event-free survival: HR 0.53 versus neoadjuvant gemcitabine–cisplatin.",
          evidenceIds: ["mibc-fda-approval"],
          sourceCheckedOn: "Aug 28, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "mibc-os",
          text: "Overall survival: HR 0.65 versus neoadjuvant gemcitabine–cisplatin.",
          evidenceIds: ["mibc-fda-approval"],
          sourceCheckedOn: "Aug 28, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "mibc-fda-approval",
          kind: "regulatory",
          role: "regulatory",
          label: "Regulatory context",
          title: "FDA perioperative MIBC approval",
          url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-pembrolizumab-or-pembrolizumab-and-berahyaluronidase-alfa-pmph-each-enfortumab-vedotin",
        },
      ],
    },
    governance: {
      publishingOwnerRole: "CanvasMD editor",
      factVerificationPolicy: "New or materially changed clinical facts require independent verification before external use",
      interpretiveReviewPolicy: "Additional interpretive review is risk-based, not automatic",
      publicationState: "local-prototype",
      version: "0.2",
      sourceCheckedOn: "Aug 28, 2026",
      independentFactVerification: { status: "required" },
      history: [
        {
          version: "0.2",
          date: "Aug 28, 2026",
          trigger: "U.S. label expansion",
          change: "Reframed the brief around implementation and bound each clinical fact to the FDA approval source.",
        },
      ],
    },
    events: [
      {
        id: "mibc-perioperative-systemic-event-1",
        sequence: 1,
        questionId: "mibc-perioperative-systemic",
        occurredOn: "2026-06-24",
        type: "question-created",
        summary: "An editor confirmed a consequential perioperative treatment-selection question.",
        material: true,
        sourceIds: ["gu-cast-mibc"],
      },
      {
        id: "mibc-perioperative-systemic-event-2",
        sequence: 2,
        questionId: "mibc-perioperative-systemic",
        occurredOn: "2026-07-10",
        type: "materially-updated",
        summary: "The U.S. approval changed the available treatment routes and the answer.",
        material: true,
        versionId: "mibc-perioperative-systemic-v0.2",
        sourceIds: ["gu-cast-mibc", "poc-mibc"],
      },
      {
        id: "mibc-perioperative-systemic-event-3",
        sequence: 3,
        questionId: "mibc-perioperative-systemic",
        occurredOn: "2026-08-27",
        type: "sources-reviewed",
        summary: "Selected conversations were reviewed through Aug 27.",
        material: false,
        sourceIds: ["gu-cast-mibc", "poc-mibc"],
      },
    ],
    tags: {
      diseases: ["Bladder cancer", "Urothelial carcinoma"],
      clinicalSettings: ["Muscle-invasive disease", "Perioperative care"],
      stagesOrLines: ["Localized muscle-invasive", "Before and after cystectomy"],
      decisionTypes: ["Treatment selection", "Sequencing", "Shared decision-making"],
      treatmentsOrModalities: ["Systemic therapy", "Cystectomy", "Perioperative therapy"],
      drugsBiomarkersProcedures: ["Enfortumab vedotin", "Pembrolizumab", "Gemcitabine", "Cisplatin", "KEYNOTE-B15", "EV-304"],
      patientManagement: ["Toxicity", "Access", "Surgical timing", "Treatment fitness"],
      clinicalRoles: ["Urologic oncologist", "Medical oncologist", "Multidisciplinary team"],
      commonTerminology: ["EV-pembro", "EV–pembrolizumab", "MIBC", "perioperative systemic therapy", "side effects"],
    },
    editorConfirmed: {
      status: "editor-confirmed",
      confirmedOn: "Aug 28, 2026",
      decision: "related-to-existing",
      proposedFromSourceIds: ["gu-cast-mibc", "poc-mibc"],
      overlapReviewedAgainstQuestionIds: ["mibc-bladder-preservation"],
    },
    relations: [
      {
        questionId: "mibc-bladder-preservation",
        kind: "related",
        reason: "Both questions affect local-treatment planning in MIBC, but one addresses perioperative systemic therapy and the other bladder-preserving chemoradiation.",
        editorConfirmedOn: "Aug 28, 2026",
      },
    ],
    differencesHeading: "Approval adds a route; patient fit still decides.",
    differencesContext: "The same approval does not create the same choice for every patient.",
    lenses: [
      {
        label: "What approval changes",
        title: "Consider EV–pembrolizumab alongside cisplatin-based treatment.",
        detail: "Cisplatin fitness is no longer the only opening branch.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "03:19 · Perioperative EV–pembrolizumab route", startMs: 199_320 },
          { sourceId: "poc-mibc", relevantAt: "07:17 · Regimen selection", startMs: 437_000 },
        ],
      },
      {
        label: "What still decides the route",
        title: "Match toxicity and treatment course to the patient.",
        detail: "Neuropathy, immune suitability, renal function, and coordination with surgery can redirect the plan.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "10:01 · Comparing side-effect profiles", startMs: 601_640 },
          { sourceId: "poc-mibc", relevantAt: "10:56 · Immune and EV contraindications", startMs: 656_080 },
          { sourceId: "poc-mibc", relevantAt: "12:07 · Renal function and hearing", startMs: 727_920 },
          { sourceId: "poc-mibc", relevantAt: "13:19 · Surgical and perioperative timing", startMs: 799_520 },
        ],
      },
    ],
    factorsLabel: "Patient factors",
    factorsHeading: "Four checks narrow the routes before surgery.",
    factorsContext: "They rule options in or out before any regimen becomes the default.",
    factors: [
      {
        id: "fitness",
        label: "Treatment fitness",
        implication: "What toxicities or contraindications narrow each option?",
        detail: "Renal function, hearing, heart failure, neuropathy, glycemic control, relative immune contraindications, and transplant history all matter.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "10:56 · Immune and EV contraindications", startMs: 656_080 },
          { sourceId: "poc-mibc", relevantAt: "12:07 · Renal function and hearing", startMs: 727_920 },
        ],
      },
      {
        id: "disease",
        label: "Disease features",
        implication: "Do disease features change the treatment need?",
        detail: "Cisplatin eligibility, variant histology, and node-positive disease can narrow whether the comparison is relevant.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "07:28 · Cisplatin eligibility and variant histology", startMs: 448_360 },
        ],
      },
      {
        id: "burden",
        label: "Toxicity burden",
        implication: "Which adverse-effect profile is more acceptable?",
        detail: "Neuropathy, glycemic risk, and immune suitability need explicit comparison.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "10:01 · Comparing side-effect profiles", startMs: 601_640 },
          { sourceId: "poc-mibc", relevantAt: "10:56 · Immune and EV contraindications", startMs: 656_080 },
        ],
      },
      {
        id: "priorities",
        label: "Care coordination",
        implication: "Can planning keep surgery and systemic therapy on schedule?",
        detail: "The episode emphasizes diagnosis-to-treatment handoffs, perioperative coordination, and avoiding care gaps.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "13:19 · Surgical and perioperative timing", startMs: 799_520 },
        ],
      },
    ],
    sources: [guCastMibc, pointOfCareMibc],
  }, {
    currentVersionId: "mibc-perioperative-systemic-v0.3",
    version: "0.3",
    recordedOn: "Aug 30, 2026",
    trigger: "Complete-transcript editorial regeneration",
    change: "Preserved version 0.2 and rebuilt the brief from both complete conversations, strengthening the regimen-selection shift while retaining explicit exceptions and support limits.",
    eventSummary: "A complete-transcript regeneration was recorded; the existing Updated state was retained without counting repetition as new movement.",
    eventSourceIds: ["gu-cast-mibc", "poc-mibc"],
    movement: {
      state: "Updated",
      date: "Jul 10",
      dateLabel: "U.S. approval dated Jul 10",
      headline: "The discussion has moved from cisplatin eligibility as the central gate to regimen selection for nearly every appropriate cystectomy patient.",
      evidenceQualifier: "Two complete conversations reviewed · both carry commercial-support context",
      reviewedThrough: "Aug 30, 2026",
      sourceRefs: [
        { sourceId: "gu-cast-mibc", relevantAt: "03:19 · Every cystectomy candidate considered for EV–pembrolizumab", startMs: 199_000 },
        { sourceId: "poc-mibc", relevantAt: "05:04 · Nearly every patient enters a systemic-treatment discussion", startMs: 304_000 },
      ],
    },
    answerLabel: "Evidence: two complete source conversations · both carry commercial-support context",
    answerHeading: "EV–pembrolizumab leads for many—not for all.",
    synthesisClaims: [
      {
        id: "mibc-previous-read",
        stage: "previous",
        stageLabel: "What the earlier brief said",
        text: "The prior brief treated EV–pembrolizumab as one added perioperative route alongside cisplatin-based therapy.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "06:32 · Comparison with cisplatin-based therapy", startMs: 392_000 },
        ],
      },
      {
        id: "mibc-new-conversation",
        stage: "new",
        stageLabel: "What the complete conversations add",
        text: "The complete conversations move the opening question beyond cisplatin fitness: nearly every appropriate cystectomy patient enters a systemic-treatment discussion, with EV–pembrolizumab leading for many.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "03:19 · Every cystectomy candidate considered for EV–pembrolizumab", startMs: 199_000 },
          { sourceId: "poc-mibc", relevantAt: "05:04 · Nearly every patient enters a systemic-treatment discussion", startMs: 304_000 },
          { sourceId: "poc-mibc", relevantAt: "08:01 · EV–pembrolizumab positioned as the choice for many", startMs: 481_000 },
        ],
      },
      {
        id: "mibc-current-read",
        stage: "current",
        stageLabel: "Who may lead with this route",
        text: "For many appropriate patients, lead with EV–pembrolizumab; variant histology, immune suitability, neuropathy, diabetes, frailty, access, and surgical timing can redirect the choice.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "07:47 · Variant histology and trial applicability", startMs: 467_000 },
          { sourceId: "poc-mibc", relevantAt: "08:09 · Variant-histology qualification", startMs: 489_000 },
          { sourceId: "poc-mibc", relevantAt: "10:56 · Immune contraindications", startMs: 656_000 },
          { sourceId: "poc-mibc", relevantAt: "11:41 · Neuropathy and poorly controlled diabetes", startMs: 701_000 },
          { sourceId: "poc-mibc", relevantAt: "16:48 · Surgical coordination", startMs: 1_008_000 },
        ],
      },
      {
        id: "mibc-unresolved",
        stage: "unresolved",
        stageLabel: "What remains unresolved",
        text: "It is not universal: completion of the full perioperative course and the value and duration of adjuvant EV remain unresolved.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "09:35 · About half completed the full perioperative regimen", startMs: 575_000 },
          { sourceId: "gu-cast-mibc", relevantAt: "11:54 · Uncertain adjuvant EV duration", startMs: 714_000 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "mibc-ev-pembro-us-status",
        text: "FDA-approved July 10, 2026 for adults with MIBC who are candidates for cystectomy; labels and access can differ by jurisdiction.",
        evidenceIds: ["mibc-fda-approval"],
        sourceCheckedOn: "Aug 30, 2026",
        independentVerification: { status: "required" },
        jurisdiction: "United States",
      },
      keyFactsLabel: "Key trial results",
      keyFacts: [
        {
          id: "mibc-efs",
          text: "Event-free survival: HR 0.53 versus neoadjuvant gemcitabine–cisplatin.",
          evidenceIds: ["mibc-fda-approval"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "mibc-os",
          text: "Overall survival: HR 0.65 versus neoadjuvant gemcitabine–cisplatin.",
          evidenceIds: ["mibc-fda-approval"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "mibc-fda-approval",
          kind: "regulatory",
          role: "regulatory",
          label: "Regulatory context",
          title: "FDA perioperative MIBC approval",
          url: "https://www.fda.gov/drugs/resources-information-approved-drugs/fda-approves-pembrolizumab-or-pembrolizumab-and-berahyaluronidase-alfa-pmph-each-enfortumab-vedotin",
        },
      ],
    },
    differencesHeading: "A leading route for many; explicit redirects remain.",
    differencesContext: "The complete conversations strengthen EV–pembrolizumab’s place without making it universal.",
    lenses: [
      {
        label: "What changed",
        title: "Start with systemic regimen selection, not cisplatin eligibility alone.",
        detail: "Both conversations frame systemic therapy as relevant to nearly every appropriate cystectomy patient.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "03:19 · Every cystectomy candidate considered for EV–pembrolizumab", startMs: 199_000 },
          { sourceId: "poc-mibc", relevantAt: "05:04 · Nearly every patient enters a systemic-treatment discussion", startMs: 304_000 },
        ],
      },
      {
        label: "What redirects",
        title: "Histology, toxicity, access, and coordination still change the route.",
        detail: "The leading option for many can become a poor fit when immune, neurologic, metabolic, frailty, access, or surgical factors intervene.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "07:47 · Variant histology and trial applicability", startMs: 467_000 },
          { sourceId: "poc-mibc", relevantAt: "10:56 · Immune contraindications", startMs: 656_000 },
          { sourceId: "poc-mibc", relevantAt: "11:41 · Neuropathy and poorly controlled diabetes", startMs: 701_000 },
          { sourceId: "poc-mibc", relevantAt: "16:48 · Surgical coordination", startMs: 1_008_000 },
        ],
      },
    ],
    factorsHeading: "Four checks redirect the leading route when needed.",
    factorsContext: "They prevent a strong regimen-level signal from becoming universal advice.",
    factors: [
      {
        id: "fitness",
        label: "Immune and frailty context",
        implication: "Is checkpoint therapy appropriate, and is the patient robust enough for the course?",
        detail: "Transplant, serious immune contraindications, frailty, and competing illness can redirect or narrow perioperative therapy.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "10:56 · Immune contraindications", startMs: 656_000 },
          { sourceId: "poc-mibc", relevantAt: "11:01 · Transplant as an absolute contraindication", startMs: 661_000 },
        ],
      },
      {
        id: "disease",
        label: "Disease features",
        implication: "Does histology match the evidence base?",
        detail: "Variant histology is a recurring reason to slow down and examine trial applicability rather than assume one route.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "07:47 · Variant histology and trial applicability", startMs: 467_000 },
          { sourceId: "poc-mibc", relevantAt: "08:09 · Variant-histology qualification", startMs: 489_000 },
        ],
      },
      {
        id: "burden",
        label: "Toxicity burden",
        implication: "Do neuropathy, diabetes, or cumulative exposure change the choice?",
        detail: "Severe neuropathy and poorly controlled diabetes are explicit EV concerns; adjuvant EV duration and cumulative neuropathy remain unsettled.",
        sourceRefs: [
          { sourceId: "poc-mibc", relevantAt: "11:41 · Neuropathy and poorly controlled diabetes", startMs: 701_000 },
          { sourceId: "gu-cast-mibc", relevantAt: "11:54 · Uncertain adjuvant EV duration", startMs: 714_000 },
        ],
      },
      {
        id: "priorities",
        label: "Access and coordination",
        implication: "Can the regimen be accessed and delivered without compromising surgery?",
        detail: "Jurisdictional access, diagnosis-to-treatment handoffs, and a protected cystectomy window remain practical treatment-selection factors.",
        sourceRefs: [
          { sourceId: "gu-cast-mibc", relevantAt: "20:23 · Perioperative access remains unavailable in Australia", startMs: 1_223_000 },
          { sourceId: "poc-mibc", relevantAt: "16:48 · Surgical coordination", startMs: 1_008_000 },
        ],
      },
    ],
    editorialAudit: {
      sourceReviews: [
        { sourceId: "gu-cast-mibc", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
        { sourceId: "poc-mibc", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
      ],
      stateRationale: "Updated survives because the approval and complete conversations shift the practical gate from cisplatin eligibility to regimen selection; the Aug 30 regeneration adds no new movement event.",
      evidenceSelections: ["Systemic therapy for nearly every appropriate cystectomy patient", "EV–pembrolizumab as the leading route for many", "Histology and contraindication redirects", "Treatment completion and duration uncertainty", "Surgical coordination"],
      sourceLimitations: ["GU Cast discloses Astellas Platinum Partner support.", "Point of Care was supported by a Merck educational grant.", "Commercial support is disclosed as a limitation and does not add evidentiary weight."],
      counterevidence: ["Variant histology can favor a cisplatin-based path.", "Immune contraindications, severe neuropathy, poorly controlled diabetes, frailty, and access can make EV–pembrolizumab unsuitable.", "Only about half completed the full perioperative regimen in the GU Cast discussion."],
      revisedOrBlockedClaims: ["Revised “an added route” to “leading for many.”", "Blocked universal replacement, cisplatin-obsolete, and every-patient claims."],
      unresolved: ["Optimal adjuvant EV duration", "Long-term cumulative neuropathy", "Implementation across jurisdictions", "Best route for underrepresented histologies"],
    },
  }),
  regenerateLocalBrief({
    id: "mibc-bladder-preservation",
    slug: "mibc-bladder-preservation",
    currentVersionId: "mibc-bladder-preservation-v0.2",
    shortLabel: "Bladder-preserving chemoradiation",
    area: "GU oncology",
    readingTime: "1-minute brief",
    evidenceWindow: "One dedicated conversation · Jul 2026",
    question: "Could ARCHER’s shorter chemoradiation schedule expand bladder preservation—and for whom?",
    movement: {
      state: "Watch",
      date: "Jul 30",
      dateLabel: "Conversation published Jul 30",
      headline: "A dedicated NRG Oncology episode raised whether five fractions could reduce the burden of bladder-preserving chemoradiation.",
      reviewedThrough: "Aug 27, 2026",
      sourceRefs: [
        { sourceId: "nrg-archer", relevantAt: "13:49 · Treatment-burden rationale", startMs: 829_020 },
      ],
    },
    answerLabel: "Answer from this conversation",
    answerHeading: "A potential access benefit—not a result yet.",
    synthesisClaims: [
      {
        id: "archer-access-signal",
        text: "This conversation raises five-fraction chemoradiation as a possible access improvement for selected bladder-preservation candidates.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "13:49 · Treatment-burden rationale", startMs: 829_020 },
        ],
      },
      {
        id: "archer-watch-boundary",
        text: "Because ARCHER has not reported comparative results, the question remains at Watch, not movement.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "12:40 · 20- versus five-fraction trial comparison", startMs: 760_460 },
        ],
      },
      {
        id: "archer-evidence-boundary",
        text: "Efficacy and safety are unresolved, and ARCHER does not compare chemoradiation with cystectomy.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "12:40 · 20- versus five-fraction trial comparison", startMs: 760_460 },
          { sourceId: "nrg-archer", relevantAt: "07:57 · No randomized surgery comparison", startMs: 477_500 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "archer-trial-status",
        text: "ARCHER is a phase 3 comparison of 5-fraction and 20-fraction bladder-preserving chemoradiation in cT2–T3 N0M0 muscle-invasive bladder cancer.",
        evidenceIds: ["archer-protocol"],
        sourceCheckedOn: "Aug 28, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "What the trial compares",
      keyFacts: [
        {
          id: "archer-comparator",
          text: "The study compares schedules within a bladder-preserving pathway; it does not compare chemoradiation with cystectomy.",
          evidenceIds: ["archer-protocol"],
          sourceCheckedOn: "Aug 28, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "archer-protocol",
          kind: "trial",
          role: "trial-registry",
          label: "Trial protocol",
          title: "NRG-GU015 · ARCHER",
          url: "https://www.nrgoncology.org/Clinical-Trials/Protocol/nrg-gu015/",
        },
      ],
    },
    governance: {
      publishingOwnerRole: "CanvasMD editor",
      factVerificationPolicy: "New or materially changed clinical facts require independent verification before external use",
      interpretiveReviewPolicy: "Additional interpretive review is risk-based, not automatic",
      publicationState: "local-prototype",
      version: "0.2",
      sourceCheckedOn: "Aug 28, 2026",
      independentFactVerification: { status: "required" },
      history: [
        {
          version: "0.2",
          date: "Aug 28, 2026",
          trigger: "Dedicated ARCHER source conversation",
          change: "Kept the question at Watch and distinguished the schedule comparison from cystectomy selection.",
        },
      ],
    },
    events: [
      {
        id: "mibc-bladder-preservation-event-1",
        sequence: 1,
        questionId: "mibc-bladder-preservation",
        occurredOn: "2026-07-30",
        type: "question-created",
        summary: "An editor confirmed a consequential question about treatment feasibility within bladder preservation.",
        material: true,
        versionId: "mibc-bladder-preservation-v0.2",
        sourceIds: ["nrg-archer"],
      },
      {
        id: "mibc-bladder-preservation-event-2",
        sequence: 2,
        questionId: "mibc-bladder-preservation",
        occurredOn: "2026-08-27",
        type: "watch-signal",
        summary: "The source raised a feasibility signal, but no comparative result changed the answer.",
        material: false,
        sourceIds: ["nrg-archer"],
      },
      {
        id: "mibc-bladder-preservation-event-3",
        sequence: 3,
        questionId: "mibc-bladder-preservation",
        occurredOn: "2026-08-27",
        type: "sources-reviewed",
        summary: "The selected source conversation was reviewed through Aug 27.",
        material: false,
        sourceIds: ["nrg-archer"],
      },
    ],
    tags: {
      diseases: ["Bladder cancer", "Urothelial carcinoma"],
      clinicalSettings: ["Muscle-invasive disease", "Bladder preservation"],
      stagesOrLines: ["cT2–T3 N0M0", "Definitive local treatment"],
      decisionTypes: ["Treatment selection", "Feasibility", "Access"],
      treatmentsOrModalities: ["Chemoradiation", "Radiation therapy", "TURBT", "Cystectomy"],
      drugsBiomarkersProcedures: ["ARCHER", "NRG-GU015", "five-fraction chemoradiation"],
      patientManagement: ["Travel burden", "Surveillance", "Salvage planning", "Bladder function"],
      clinicalRoles: ["Radiation oncologist", "Urologic oncologist", "Medical oncologist"],
      commonTerminology: ["trimodality therapy", "TMT", "bladder preservation", "hypofractionation"],
    },
    editorConfirmed: {
      status: "editor-confirmed",
      confirmedOn: "Aug 28, 2026",
      decision: "related-to-existing",
      proposedFromSourceIds: ["nrg-archer"],
      overlapReviewedAgainstQuestionIds: ["mibc-perioperative-systemic"],
    },
    relations: [
      {
        questionId: "mibc-perioperative-systemic",
        kind: "related",
        reason: "Both questions affect definitive MIBC planning while asking distinct treatment-path questions.",
        editorConfirmedOn: "Aug 28, 2026",
      },
    ],
    differencesHeading: "Potential access benefit; efficacy and safety still unproven.",
    differencesContext: "Fewer visits may improve feasibility, but efficacy, safety, and candidacy still have to hold.",
    lenses: [
      {
        label: "Possible access benefit",
        title: "Five fractions could make treatment more feasible.",
        detail: "Fewer visits may reduce treatment burden if outcomes remain acceptable.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "13:49 · Treatment-burden rationale", startMs: 829_020 },
        ],
      },
      {
        label: "Evidence boundary",
        title: "Comparative efficacy and safety are not established.",
        detail: "Selection, surveillance, and readiness for salvage surgery still define the pathway.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "12:40 · 20- versus five-fraction trial comparison", startMs: 760_460 },
          { sourceId: "nrg-archer", relevantAt: "02:54 · Chemoradiation candidacy and functional bladder", startMs: 174_700 },
          { sourceId: "nrg-archer", relevantAt: "08:36 · Lifelong surveillance", startMs: 516_860 },
          { sourceId: "nrg-archer", relevantAt: "10:14 · Salvage cystectomy", startMs: 614_780 },
        ],
      },
    ],
    factorsLabel: "Patient factors",
    factorsHeading: "A shorter schedule only matters when bladder preservation fits.",
    factorsContext: "First establish pathway fit; then ask whether fewer visits improve feasibility.",
    factors: [
      {
        id: "tumor",
        label: "Tumor selection",
        implication: "Do stage and local features support preservation?",
        detail: "Tumor size and volume, prior pelvic radiation, nodal status, and whether TURBT leaves a functional bladder affect candidacy.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "02:54 · Chemoradiation candidacy and functional bladder", startMs: 174_700 },
        ],
      },
      {
        id: "function",
        label: "Bladder function",
        implication: "Is useful bladder function likely after treatment?",
        detail: "Baseline bladder function and expected urinary, bowel, and sexual effects after therapy belong in the decision.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "05:18 · Functional bladder and treatment effects", startMs: 318_580 },
        ],
      },
      {
        id: "fitness",
        label: "Treatment fitness",
        implication: "Can the patient receive the bladder-preserving pathway being studied?",
        detail: "Candidacy requires multidisciplinary assessment and a bladder worth preserving; both study schedules use the same radiosensitizing chemotherapy.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "02:54 · Chemoradiation candidacy and functional bladder", startMs: 174_700 },
          { sourceId: "nrg-archer", relevantAt: "12:40 · 20- versus five-fraction trial comparison", startMs: 760_460 },
        ],
      },
      {
        id: "surveillance",
        label: "Surveillance & salvage",
        implication: "Can the patient commit to surveillance and possible salvage surgery?",
        detail: "Cystoscopic surveillance, rapid evaluation of recurrence, and access to salvage surgery are part of bladder preservation—not backup details.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "08:36 · Lifelong surveillance", startMs: 516_860 },
          { sourceId: "nrg-archer", relevantAt: "10:14 · Salvage cystectomy", startMs: 614_780 },
        ],
      },
    ],
    sources: [nrgArcher],
  }, {
    currentVersionId: "mibc-bladder-preservation-v0.3",
    version: "0.3",
    recordedOn: "Aug 30, 2026",
    trigger: "Complete-transcript editorial regeneration",
    change: "Preserved version 0.2 and rebuilt the Watch brief from the complete NRG episode, separating fractionation feasibility from treatment-path selection.",
    eventSummary: "A complete-transcript Watch version was recorded without implying trial-result movement.",
    eventSourceIds: ["nrg-archer"],
    movement: {
      state: "Watch",
      date: "Jul 30",
      dateLabel: "Conversation published Jul 30",
      headline: "ARCHER tests whether five treatments can reduce burden within bladder preservation; it has not reported a comparative result.",
      evidenceQualifier: "One complete NRG-produced conversation reviewed · commercial support not established",
      reviewedThrough: "Aug 30, 2026",
      sourceRefs: [
        { sourceId: "nrg-archer", relevantAt: "12:40 · Twenty- versus five-fraction schedules", startMs: 760_000 },
        { sourceId: "nrg-archer", relevantAt: "22:12 · Noninferiority is being tested, not established", startMs: 1_332_000 },
      ],
    },
    answerLabel: "Evidence: one complete NRG-produced conversation · no trial results available",
    answerHeading: "A feasibility question inside bladder preservation—not a result.",
    synthesisClaims: [
      {
        id: "archer-previous-read",
        stage: "previous",
        stageLabel: "Why this question matters",
        text: "The question came from one NRG episode: could five treatments over four weeks reduce travel burden for bladder-preservation candidates?",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "26:00 · Travel and treatment burden", startMs: 1_560_000 },
        ],
      },
      {
        id: "archer-new-conversation",
        stage: "new",
        stageLabel: "What the trial actually tests",
        text: "The complete episode clarifies a pure fractionation trial—five versus 20 treatments with the same radiosensitizer—not a comparison with cystectomy.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "12:40 · Twenty- versus five-fraction schedules", startMs: 760_000 },
          { sourceId: "nrg-archer", relevantAt: "15:08 · Pure fractionation question with the same radiosensitizer", startMs: 908_000 },
          { sourceId: "nrg-archer", relevantAt: "07:57 · No randomized surgery comparison", startMs: 477_000 },
        ],
      },
      {
        id: "archer-current-read",
        stage: "current",
        stageLabel: "What to watch",
        text: "Watch for bladder-intact efficacy and toxicity; the shorter schedule matters only for a patient who already fits bladder preservation.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "03:24 · Functional bladder and prior-radiation candidacy", startMs: 204_000 },
          { sourceId: "nrg-archer", relevantAt: "22:12 · Noninferiority is being tested, not established", startMs: 1_332_000 },
        ],
      },
      {
        id: "archer-unresolved",
        stage: "unresolved",
        stageLabel: "What remains unknown",
        text: "Comparative results are unavailable; functional bladder, prior pelvic radiation, lifelong surveillance, recurrence, and salvage readiness still bound candidacy.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "03:24 · Functional bladder and prior-radiation candidacy", startMs: 204_000 },
          { sourceId: "nrg-archer", relevantAt: "08:57 · Lifelong cystoscopic surveillance", startMs: 537_000 },
          { sourceId: "nrg-archer", relevantAt: "10:27 · Salvage cystectomy", startMs: 627_000 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "archer-trial-status",
        text: "ARCHER is an open phase 3 comparison of five- and 20-fraction bladder-preserving chemoradiation in cT2–T3 N0M0 muscle-invasive bladder cancer.",
        evidenceIds: ["archer-protocol"],
        sourceCheckedOn: "Aug 30, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "What the trial compares",
      keyFacts: [
        {
          id: "archer-comparator",
          text: "The study compares radiation schedules within a bladder-preserving pathway; it does not compare chemoradiation with cystectomy.",
          evidenceIds: ["archer-protocol"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "archer-protocol",
          kind: "trial",
          role: "trial-registry",
          label: "Trial protocol",
          title: "NRG-GU015 · ARCHER",
          url: "https://www.nrgoncology.org/Clinical-Trials/Protocol/nrg-gu015/",
        },
      ],
    },
    differencesHeading: "Shorter schedule; unchanged pathway obligations.",
    differencesContext: "Fewer visits may improve feasibility only if efficacy, safety, candidacy, surveillance, and salvage readiness hold.",
    lenses: [
      {
        label: "Feasibility signal",
        title: "Five treatments could reduce travel burden.",
        detail: "The episode’s access rationale concerns fewer radiation visits within an otherwise comparable chemoradiation plan.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "15:08 · Pure fractionation question with the same radiosensitizer", startMs: 908_000 },
          { sourceId: "nrg-archer", relevantAt: "26:00 · Travel and treatment burden", startMs: 1_560_000 },
        ],
      },
      {
        label: "Evidence boundary",
        title: "Noninferiority and safety are not established.",
        detail: "ARCHER does not answer whether a patient should choose bladder preservation instead of cystectomy.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "22:12 · Noninferiority is being tested, not established", startMs: 1_332_000 },
          { sourceId: "nrg-archer", relevantAt: "07:57 · No randomized surgery comparison", startMs: 477_000 },
        ],
      },
    ],
    factorsHeading: "Four checks come before schedule convenience.",
    factorsContext: "They keep a burden-reduction hypothesis inside the bladder-preservation population actually being studied.",
    factors: [
      {
        id: "tumor",
        label: "Pathway candidacy",
        implication: "Does the disease and prior treatment fit bladder preservation?",
        detail: "Tumor characteristics, nodal status, prior pelvic radiation, and the result of maximal TURBT shape eligibility before fractionation is considered.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "03:24 · Functional bladder and prior-radiation candidacy", startMs: 204_000 },
        ],
      },
      {
        id: "function",
        label: "Bladder function",
        implication: "Is there a functional bladder worth preserving?",
        detail: "The episode makes baseline and expected bladder function part of candidacy, not merely a quality-of-life footnote.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "03:24 · Functional bladder and prior-radiation candidacy", startMs: 204_000 },
        ],
      },
      {
        id: "fitness",
        label: "Regimen fitness",
        implication: "Can the patient receive chemoradiation with the study radiosensitizer?",
        detail: "The trial changes fractionation, not the need for concurrent radiosensitizing therapy and multidisciplinary pathway fit.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "15:08 · Pure fractionation question with the same radiosensitizer", startMs: 908_000 },
        ],
      },
      {
        id: "surveillance",
        label: "Surveillance and salvage",
        implication: "Can the patient commit to lifelong cystoscopy and possible salvage surgery?",
        detail: "Surveillance and rapid access to salvage cystectomy remain part of bladder preservation regardless of radiation schedule.",
        sourceRefs: [
          { sourceId: "nrg-archer", relevantAt: "08:57 · Lifelong cystoscopic surveillance", startMs: 537_000 },
          { sourceId: "nrg-archer", relevantAt: "10:27 · Salvage cystectomy", startMs: 627_000 },
        ],
      },
    ],
    editorialAudit: {
      sourceReviews: [
        { sourceId: "nrg-archer", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
      ],
      stateRationale: "Watch survives because the complete episode describes an unanswered phase 3 noninferiority question; no result supports movement.",
      evidenceSelections: ["Five- versus 20-fraction design", "Same radiosensitizer", "Travel-burden rationale", "Bladder-preservation candidacy", "Surveillance and salvage obligations"],
      sourceLimitations: ["Only one NRG-produced conversation supports the synthesis.", "Commercial support is not established in the local record.", "One conversation can support a bounded Watch record but not independent corroboration."],
      counterevidence: ["The episode itself emphasizes that the shorter schedule remains investigational.", "Schedule convenience cannot establish bladder-preservation candidacy or equivalence to cystectomy."],
      revisedOrBlockedClaims: ["Revised the broad “expand bladder preservation” framing to a within-pathway fractionation question.", "Blocked efficacy, safety, access-expansion, and surgery-comparison claims."],
      unresolved: ["Noninferiority", "Comparative toxicity", "Bladder-intact outcomes", "Who completes surveillance and salvage when needed"],
    },
  }),
  regenerateLocalBrief({
    id: "rcc-adjuvant-selection",
    slug: "rcc-adjuvant-selection",
    currentVersionId: "rcc-adjuvant-selection-v0.2",
    previousVersions: [
      {
        id: "rcc-adjuvant-selection-v0.1",
        version: "0.1",
        status: "superseded",
        recordedOn: "Apr 24, 2026",
        trigger: "Initial adjuvant RCC selection discussion",
        movementState: "Newly tracked",
        sourceCheckedOn: "Apr 24, 2026",
        independentVerification: { status: "required" },
        snapshot: {
          snapshotSchema: "rounds-reader-core-v1",
          question: "After nephrectomy, which KEYNOTE-564-eligible patients are most likely to accept a year of adjuvant pembrolizumab?",
          answerLabel: "Initial answer from this conversation",
          answerHeading: "Eligibility opens the discussion; patient fit closes it.",
          synthesisClaims: [
            {
              id: "rcc-adjuvant-eligibility-boundary",
              text: "The selected conversation treats KEYNOTE-564 eligibility as the start of the discussion, not an automatic treatment decision.",
              sourceIds: ["cme-keynote-564"],
            },
            {
              id: "rcc-adjuvant-patient-fit",
              text: "Pathologic risk, health, competing risks, and goals shape whether an adjuvant treatment course is acceptable.",
              sourceIds: ["cme-keynote-564"],
            },
          ],
          movement: {
            state: "Newly tracked",
            headline: "An April conversation opened a consequential question about selective adjuvant treatment after nephrectomy.",
          },
          decisionBoundary: {
            heading: "Discuss eligibility broadly; individualize treatment.",
            context: "The divide is how much pathology versus health and goals should drive treatment.",
            lenses: [
              {
                label: "Start with risk",
                title: "Higher pathologic risk makes the discussion more consequential.",
                detail: "The source describes a range of eligible referrals.",
                sourceIds: ["cme-keynote-564"],
              },
              {
                label: "Finish with patient fit",
                title: "Health and goals can change the choice.",
                detail: "Eligibility does not erase the treatment burden.",
                sourceIds: ["cme-keynote-564"],
              },
            ],
          },
          patientFactors: {
            label: "Patient factors",
            heading: "Three checks define the decision boundary after nephrectomy.",
            context: "They connect trial eligibility with the person being asked to take an adjuvant treatment course.",
            factors: [
              {
                id: "pathologic-risk",
                label: "Pathologic risk",
                implication: "Where does the patient sit within the eligible risk range?",
                detail: "Risk group and burden of resected disease frame how much potential recurrence risk is being addressed.",
                sourceIds: ["cme-keynote-564"],
              },
              {
                id: "health-context",
                label: "Health context",
                implication: "Do comorbidities or competing risks change the balance?",
                detail: "Functional status, age, comorbidities, and competing health risks shape treatment fit.",
                sourceIds: ["cme-keynote-564"],
              },
              {
                id: "goals",
                label: "Goals and burden",
                implication: "Is the treatment course acceptable to this patient?",
                detail: "The decision includes the patient’s goals, preferences, and willingness to take on an adjuvant treatment course.",
                sourceIds: ["cme-keynote-564"],
              },
            ],
          },
          clinicalFacts: {
            status: {
              id: "keynote-564-trial-status",
              text: "ClinicalTrials.gov lists KEYNOTE-564 (NCT03142334) as a completed phase 3 post-nephrectomy RCC study.",
            },
            keyFacts: [
              {
                id: "keynote-564-risk-groups",
                text: "The registry includes intermediate-high-risk, high-risk, and M1 NED disease with a clear-cell component.",
              },
              {
                id: "keynote-564-treatment-course",
                text: "The pembrolizumab arm used up to 17 three-week cycles—about one year.",
              },
            ],
          },
          clinicalFactIds: [
            "keynote-564-trial-status",
            "keynote-564-risk-groups",
            "keynote-564-treatment-course",
          ],
          sourceIds: ["cme-keynote-564"],
        },
      },
    ],
    shortLabel: "Adjuvant pembrolizumab after nephrectomy",
    area: "GU oncology",
    readingTime: "1-minute brief",
    evidenceWindow: "One selected conversation · Apr 2026",
    question: "After nephrectomy, which KEYNOTE-564-eligible patients are most likely to accept a year of adjuvant pembrolizumab?",
    movement: {
      state: "Steady",
      date: "Aug 27",
      dateLabel: "Sources reviewed through Aug 27",
      headline: "The selected discussion keeps eligibility as the start of a patient-specific decision.",
      reviewedThrough: "Aug 27, 2026",
      sourceRefs: [
        { sourceId: "cme-keynote-564", relevantAt: "51:15 · Eligibility and selective referral", startMs: 3_075_280 },
      ],
    },
    answerLabel: "Answer from this conversation",
    answerHeading: "Eligibility opens the discussion; patient fit closes it.",
    synthesisClaims: [
      {
        id: "rcc-adjuvant-eligibility-boundary",
        text: "The selected conversation treats KEYNOTE-564 eligibility as the start of the discussion, not an automatic treatment decision.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "51:15 · Eligibility and selective referral", startMs: 3_075_280 },
        ],
      },
      {
        id: "rcc-adjuvant-patient-fit",
        text: "Pathologic risk, health, competing risks, and goals shape whether an adjuvant treatment course is acceptable.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, and preference", startMs: 3_175_280 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "keynote-564-trial-status",
        text: "ClinicalTrials.gov lists KEYNOTE-564 (NCT03142334) as a completed phase 3 post-nephrectomy RCC study.",
        evidenceIds: ["keynote-564-registry"],
        sourceCheckedOn: "Aug 29, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "Trial population and treatment course",
      keyFacts: [
        {
          id: "keynote-564-risk-groups",
          text: "The registry includes intermediate-high-risk, high-risk, and M1 NED disease with a clear-cell component.",
          evidenceIds: ["keynote-564-registry"],
          sourceCheckedOn: "Aug 29, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "keynote-564-treatment-course",
          text: "The pembrolizumab arm used up to 17 three-week cycles—about one year.",
          evidenceIds: ["keynote-564-registry"],
          sourceCheckedOn: "Aug 29, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "keynote-564-registry",
          kind: "trial",
          role: "trial-registry",
          label: "Trial registry",
          title: "KEYNOTE-564 · NCT03142334",
          url: "https://clinicaltrials.gov/study/NCT03142334",
        },
      ],
    },
    governance: {
      publishingOwnerRole: "CanvasMD editor",
      factVerificationPolicy: "New or materially changed clinical facts require independent verification before external use",
      interpretiveReviewPolicy: "Additional interpretive review is risk-based, not automatic",
      publicationState: "local-prototype",
      version: "0.2",
      sourceCheckedOn: "Aug 29, 2026",
      independentFactVerification: { status: "required" },
      history: [
        {
          version: "0.2",
          date: "Aug 29, 2026",
          trigger: "Scheduled source review",
          change: "Recorded a Steady review without changing the patient-selection boundary.",
        },
      ],
    },
    events: [
      {
        id: "rcc-adjuvant-selection-event-1",
        sequence: 1,
        questionId: "rcc-adjuvant-selection",
        occurredOn: "2026-04-24",
        type: "question-created",
        summary: "An editor confirmed adjuvant RCC selection as a consequential clinical question.",
        material: true,
        sourceIds: ["cme-keynote-564"],
      },
      {
        id: "rcc-adjuvant-selection-event-2",
        sequence: 2,
        questionId: "rcc-adjuvant-selection",
        occurredOn: "2026-04-24",
        type: "brief-recorded",
        summary: "The initial brief was recorded.",
        material: true,
        versionId: "rcc-adjuvant-selection-v0.1",
        sourceIds: ["cme-keynote-564"],
      },
      {
        id: "rcc-adjuvant-selection-event-3",
        sequence: 3,
        questionId: "rcc-adjuvant-selection",
        occurredOn: "2026-08-27",
        type: "sources-reviewed",
        summary: "The selected conversation was reviewed again without meaningful movement.",
        material: false,
        sourceIds: ["cme-keynote-564"],
      },
      {
        id: "rcc-adjuvant-selection-event-4",
        sequence: 4,
        questionId: "rcc-adjuvant-selection",
        occurredOn: "2026-08-29",
        type: "brief-recorded",
        summary: "The Steady brief was recorded after a no-change review.",
        material: false,
        versionId: "rcc-adjuvant-selection-v0.2",
        sourceIds: ["cme-keynote-564"],
      },
    ],
    tags: {
      diseases: ["Kidney cancer", "Renal cell carcinoma"],
      clinicalSettings: ["Resected disease", "Adjuvant care"],
      stagesOrLines: ["Post-nephrectomy", "Intermediate-high risk", "High risk", "M1 NED"],
      decisionTypes: ["Treatment selection", "Risk–benefit discussion", "Shared decision-making"],
      treatmentsOrModalities: ["Adjuvant immunotherapy", "Nephrectomy"],
      drugsBiomarkersProcedures: ["Pembrolizumab", "KEYNOTE-564", "PD-1 inhibition"],
      patientManagement: ["Comorbidity", "Functional status", "Competing risk", "Treatment burden"],
      clinicalRoles: ["Medical oncologist", "Urologic oncologist"],
      commonTerminology: ["adjuvant pembro", "RCC", "clear-cell RCC", "M1 NED"],
    },
    editorConfirmed: {
      status: "editor-confirmed",
      confirmedOn: "Apr 24, 2026",
      decision: "new-canonical-question",
      proposedFromSourceIds: ["cme-keynote-564"],
      overlapReviewedAgainstQuestionIds: [],
    },
    relations: [],
    differencesHeading: "Discuss eligibility broadly; individualize treatment.",
    differencesContext: "The divide is how much pathology versus health and goals should drive treatment.",
    lenses: [
      {
        label: "Start with risk",
        title: "Higher pathologic risk makes the discussion more consequential.",
        detail: "The source describes a range of eligible referrals.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "51:15 · Eligibility and selective referral", startMs: 3_075_280 },
        ],
      },
      {
        label: "Finish with patient fit",
        title: "Health and goals can change the choice.",
        detail: "Eligibility does not erase the treatment burden.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, and preference", startMs: 3_175_280 },
        ],
      },
    ],
    factorsLabel: "Patient factors",
    factorsHeading: "Three checks define the decision boundary after nephrectomy.",
    factorsContext: "They connect trial eligibility with the person being asked to take an adjuvant treatment course.",
    factors: [
      {
        id: "pathologic-risk",
        label: "Pathologic risk",
        implication: "Where does the patient sit within the eligible risk range?",
        detail: "Risk group and burden of resected disease frame how much potential recurrence risk is being addressed.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "51:15 · Eligibility and selective referral", startMs: 3_075_280 },
        ],
      },
      {
        id: "health-context",
        label: "Health context",
        implication: "Do comorbidities or competing risks change the balance?",
        detail: "Functional status, age, comorbidities, and competing health risks shape treatment fit.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, and preference", startMs: 3_175_280 },
        ],
      },
      {
        id: "goals",
        label: "Goals and burden",
        implication: "Is the treatment course acceptable to this patient?",
        detail: "The decision includes the patient’s goals, preferences, and willingness to take on an adjuvant treatment course.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, and preference", startMs: 3_175_280 },
        ],
      },
    ],
    sources: [cmeKeynote564],
  }, {
    currentVersionId: "rcc-adjuvant-selection-v0.3",
    version: "0.3",
    recordedOn: "Aug 30, 2026",
    trigger: "Complete-transcript editorial regeneration",
    change: "Preserved version 0.2 and rebuilt the Steady brief from the full educational program, adding timing and referral-denominator limits without manufacturing movement.",
    eventSummary: "A complete-transcript Steady version was recorded; repeated selection themes were not counted as movement.",
    eventSourceIds: ["cme-keynote-564"],
    movement: {
      state: "Steady",
      date: "Aug 30",
      dateLabel: "Complete transcript reviewed Aug 30",
      headline: "The full program reinforces that eligibility opens a discussion but does not identify who will accept or benefit enough from treatment.",
      evidenceQualifier: "One complete Merck Canada grant-supported program reviewed",
      reviewedThrough: "Aug 30, 2026",
      sourceRefs: [
        { sourceId: "cme-keynote-564", relevantAt: "51:40 · Referral denominator is unknown", startMs: 3_100_000 },
        { sourceId: "cme-keynote-564", relevantAt: "55:39 · Treatment remains an individual decision", startMs: 3_339_000 },
      ],
    },
    answerLabel: "Evidence: one complete grant-supported educational program",
    answerHeading: "Discuss eligibility broadly; individualize the decision.",
    synthesisClaims: [
      {
        id: "rcc-previous-read",
        stage: "previous",
        stageLabel: "What the earlier brief said",
        text: "The prior read said KEYNOTE-564 eligibility should open a discussion, not settle treatment.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "25:03 · Individual risk–benefit decision", startMs: 1_503_000 },
        ],
      },
      {
        id: "rcc-new-conversation",
        stage: "new",
        stageLabel: "What the complete program adds",
        text: "The complete program reinforces that boundary and adds pathology-risk heterogeneity, a 12–16-week treatment window, repeat imaging, and an explicitly unknown referral denominator.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "14:47 · Pathology-risk heterogeneity", startMs: 887_000 },
          { sourceId: "cme-keynote-564", relevantAt: "17:03 · Twelve- to 16-week treatment window", startMs: 1_023_000 },
          { sourceId: "cme-keynote-564", relevantAt: "17:18 · Repeat imaging before treatment", startMs: 1_038_000 },
          { sourceId: "cme-keynote-564", relevantAt: "51:40 · Referral denominator is unknown", startMs: 3_100_000 },
        ],
      },
      {
        id: "rcc-current-read",
        stage: "current",
        stageLabel: "How to use it now",
        text: "Discuss adjuvant pembrolizumab with eligible patients, then individualize by pathologic burden, functional status, comorbidity, competing risk, and goals.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "16:47 · Referral and eligibility discussion", startMs: 1_007_000 },
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, competing risk, and preferences", startMs: 3_175_000 },
          { sourceId: "cme-keynote-564", relevantAt: "55:39 · Treatment remains an individual decision", startMs: 3_339_000 },
        ],
      },
      {
        id: "rcc-unresolved",
        stage: "unresolved",
        stageLabel: "What remains unknown",
        text: "No validated selector identifies who gains enough net benefit, and this single program cannot establish referral, uptake, or acceptance patterns.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "25:24 · Need for better patient identification", startMs: 1_524_000 },
          { sourceId: "cme-keynote-564", relevantAt: "51:40 · Referral denominator is unknown", startMs: 3_100_000 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "keynote-564-trial-status",
        text: "ClinicalTrials.gov lists KEYNOTE-564 (NCT03142334) as a completed phase 3 post-nephrectomy RCC study.",
        evidenceIds: ["keynote-564-registry"],
        sourceCheckedOn: "Aug 30, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "Trial population and treatment course",
      keyFacts: [
        {
          id: "keynote-564-risk-groups",
          text: "The registry includes intermediate-high-risk, high-risk, and M1 NED disease with a clear-cell component.",
          evidenceIds: ["keynote-564-registry"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "keynote-564-treatment-course",
          text: "The pembrolizumab arm used up to 17 three-week cycles—about one year.",
          evidenceIds: ["keynote-564-registry"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "keynote-564-registry",
          kind: "trial",
          role: "trial-registry",
          label: "Trial registry",
          title: "KEYNOTE-564 · NCT03142334",
          url: "https://clinicaltrials.gov/study/NCT03142334",
        },
      ],
    },
    differencesHeading: "Broad discussion; individual acceptance.",
    differencesContext: "Pathologic eligibility defines who should hear the option, while health, timing, and goals determine the individual choice.",
    lenses: [
      {
        label: "Open the discussion",
        title: "Refer and discuss across the eligible risk range.",
        detail: "The program supports offering an informed discussion without claiming that every eligible patient should start therapy.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "16:47 · Referral and eligibility discussion", startMs: 1_007_000 },
          { sourceId: "cme-keynote-564", relevantAt: "25:03 · Individual risk–benefit decision", startMs: 1_503_000 },
        ],
      },
      {
        label: "Close individually",
        title: "Risk, function, comorbidity, and goals can change acceptance.",
        detail: "The source repeatedly returns to patient-specific net benefit and preference rather than a pathology-only rule.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, competing risk, and preferences", startMs: 3_175_000 },
          { sourceId: "cme-keynote-564", relevantAt: "55:39 · Treatment remains an individual decision", startMs: 3_339_000 },
        ],
      },
    ],
    factorsHeading: "Four checks define the post-nephrectomy decision.",
    factorsContext: "They connect trial eligibility to the timing and net benefit of a year of therapy.",
    factors: [
      {
        id: "pathologic-risk",
        label: "Pathologic risk",
        implication: "Where does the patient sit within a heterogeneous eligible range?",
        detail: "Stage, grade, nodal status, sarcomatoid features, and M1 NED history change the recurrence-risk discussion within eligibility.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "14:47 · Pathology-risk heterogeneity", startMs: 887_000 },
          { sourceId: "cme-keynote-564", relevantAt: "58:38 · Pathologic risk varies within eligibility", startMs: 3_518_000 },
        ],
      },
      {
        id: "timing",
        label: "Timing and restaging",
        implication: "Can treatment begin in the protocol-aligned window after repeat imaging?",
        detail: "The program describes a 12-week target, up to 16 weeks in many jurisdictions, with repeat imaging before adjuvant treatment.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "17:03 · Twelve- to 16-week treatment window", startMs: 1_023_000 },
          { sourceId: "cme-keynote-564", relevantAt: "17:18 · Repeat imaging before treatment", startMs: 1_038_000 },
        ],
      },
      {
        id: "health-context",
        label: "Health context",
        implication: "Do function, comorbidity, or competing risks narrow net benefit?",
        detail: "Age alone is not the rule; functional status, comorbidities, and competing health risks shape treatment fit.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, competing risk, and preferences", startMs: 3_175_000 },
        ],
      },
      {
        id: "goals",
        label: "Goals and burden",
        implication: "Is a year of adjuvant therapy acceptable to this patient?",
        detail: "Preferences, goals, travel, monitoring, and willingness to accept toxicity complete the decision after risk is explained.",
        sourceRefs: [
          { sourceId: "cme-keynote-564", relevantAt: "52:55 · Fitness, comorbidity, competing risk, and preferences", startMs: 3_175_000 },
          { sourceId: "cme-keynote-564", relevantAt: "55:39 · Treatment remains an individual decision", startMs: 3_339_000 },
        ],
      },
    ],
    editorialAudit: {
      sourceReviews: [
        { sourceId: "cme-keynote-564", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
      ],
      stateRationale: "Steady survives because the complete program repeats and sharpens the same eligibility-versus-fit boundary without a new source event or contradictory result.",
      evidenceSelections: ["Pathologic-risk heterogeneity", "Referral and timing workflow", "Repeat imaging", "Comorbidity and competing risk", "Patient goals", "Unknown referral denominator"],
      sourceLimitations: ["The question is supported by one Merck Canada educational-grant-supported program.", "A single program cannot establish how commonly eligible patients are referred, offered treatment, or accept it."],
      counterevidence: ["The Q&A explicitly says the referral denominator is unknown and the observed group is skewed toward higher risk.", "Eligibility spans materially different pathologic-risk groups."],
      revisedOrBlockedClaims: ["Blocked “most likely,” uptake, referral-rate, and acceptance-rate claims.", "Added timing and repeat-imaging qualifications omitted from the prior reader brief."],
      unresolved: ["Validated net-benefit selection", "Real-world denominator", "Individual acceptance", "Tradeoffs as adjuvant options evolve"],
    },
  }),
  regenerateLocalBrief({
    id: "nmibc-fgfr-intravesical",
    slug: "nmibc-fgfr-intravesical",
    currentVersionId: "nmibc-fgfr-intravesical-v0.1",
    shortLabel: "Intravesical FGFR therapy",
    area: "GU oncology",
    readingTime: "1-minute brief",
    evidenceWindow: "One selected conversation · Aug 2026",
    question: "Could intravesical erdafitinib reduce systemic exposure for selected FGFR-altered recurrent non–muscle-invasive bladder cancer?",
    movement: {
      state: "Newly tracked",
      date: "Aug 26",
      dateLabel: "Conversation published Aug 26",
      headline: "An Aug 26 episode raised a new biomarker-and-delivery question around TAR-210.",
      evidenceQualifier: "Initial read · one educational-grant-supported conversation",
      reviewedThrough: "Aug 27, 2026",
      sourceRefs: [
        { sourceId: "oncology-today-tar-210", relevantAt: "15:12 · FGFR-directed intravesical therapy", startMs: 912_280 },
      ],
    },
    answerLabel: "Initial answer from this conversation",
    answerHeading: "A plausible delivery strategy—not a treatment choice yet.",
    synthesisClaims: [
      {
        id: "tar-210-delivery-rationale",
        text: "This conversation frames intravesical FGFR inhibition as a way to pursue biomarker-directed activity while limiting systemic exposure.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:55 · Delivery and systemic exposure", startMs: 955_276 },
        ],
      },
      {
        id: "tar-210-comparative-uncertainty",
        text: "The episode leaves unresolved which FGFR-altered patients benefit and how TAR-210 compares with other intravesical options.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:12 · FGFR-directed intravesical therapy", startMs: 912_280 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:51 · Unresolved comparison with other intravesical therapy", startMs: 1_011_127 },
        ],
      },
      {
        id: "tar-210-new-question-boundary",
        text: "Newly tracked reflects a distinct question, not evidence for routine use.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:51 · Unresolved comparison with other intravesical therapy", startMs: 1_011_127 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "tar-210-trial-status",
        text: "ClinicalTrials.gov lists NCT05567185 as an active, not-recruiting Japanese phase 1 study of intravesical erdafitinib.",
        evidenceIds: ["tar-210-registry"],
        sourceCheckedOn: "Aug 29, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "Registered study",
      keyFacts: [
        {
          id: "tar-210-fgfr-selection",
          text: "The arm requires protocol-defined FGFR mutations or fusions.",
          evidenceIds: ["tar-210-registry"],
          sourceCheckedOn: "Aug 29, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "tar-210-study-purpose",
          text: "The phase 1 registry evaluates tolerability, not comparative benefit.",
          evidenceIds: ["tar-210-registry"],
          sourceCheckedOn: "Aug 29, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "tar-210-registry",
          kind: "trial",
          role: "trial-registry",
          label: "Trial registry",
          title: "TAR-210 · NCT05567185",
          url: "https://clinicaltrials.gov/study/NCT05567185",
        },
      ],
    },
    governance: {
      publishingOwnerRole: "CanvasMD editor",
      factVerificationPolicy: "New or materially changed clinical facts require independent verification before external use",
      interpretiveReviewPolicy: "Additional interpretive review is risk-based, not automatic",
      publicationState: "local-prototype",
      version: "0.1",
      sourceCheckedOn: "Aug 29, 2026",
      independentFactVerification: { status: "required" },
      history: [
        {
          version: "0.1",
          date: "Aug 29, 2026",
          trigger: "New question confirmed from an Aug 26 source conversation",
          change: "Created a distinct clinical question with a narrow evidence boundary around delivery, toxicity, and patient selection.",
        },
      ],
    },
    events: [
      {
        id: "nmibc-fgfr-intravesical-event-1",
        sequence: 1,
        questionId: "nmibc-fgfr-intravesical",
        occurredOn: "2026-08-28",
        type: "question-created",
        summary: "An editor confirmed that the source proposed a distinct clinical question rather than a duplicate of the MIBC library.",
        material: true,
        sourceIds: ["oncology-today-tar-210"],
      },
      {
        id: "nmibc-fgfr-intravesical-event-2",
        sequence: 2,
        questionId: "nmibc-fgfr-intravesical",
        occurredOn: "2026-08-29",
        type: "brief-recorded",
        summary: "The first brief was recorded.",
        material: true,
        versionId: "nmibc-fgfr-intravesical-v0.1",
        sourceIds: ["oncology-today-tar-210"],
      },
    ],
    tags: {
      diseases: ["Bladder cancer", "Non–muscle-invasive bladder cancer"],
      clinicalSettings: ["Recurrent NMIBC", "Biomarker-directed therapy"],
      stagesOrLines: ["Protocol-defined recurrent NMIBC cohorts", "After prior intravesical therapy"],
      decisionTypes: ["Biomarker testing", "Treatment selection", "Toxicity management"],
      treatmentsOrModalities: ["Intravesical therapy", "FGFR inhibition"],
      drugsBiomarkersProcedures: ["TAR-210", "Erdafitinib", "FGFR mutation", "FGFR fusion", "NCT06319820"],
      patientManagement: ["Systemic exposure", "Tolerability", "Comparative uncertainty"],
      clinicalRoles: ["Urologic oncologist", "Medical oncologist", "Pathologist"],
      commonTerminology: ["FGFR-altered NMIBC", "intravesical erdafitinib", "bladder delivery system", "side effects"],
    },
    editorConfirmed: {
      status: "editor-confirmed",
      confirmedOn: "Aug 28, 2026",
      decision: "new-canonical-question",
      proposedFromSourceIds: ["oncology-today-tar-210"],
      overlapReviewedAgainstQuestionIds: ["mibc-perioperative-systemic", "mibc-bladder-preservation"],
    },
    relations: [],
    differencesHeading: "Delivery rationale is clearer than comparative place.",
    differencesContext: "The episode separates lower systemic exposure from unanswered treatment selection.",
    lenses: [
      {
        label: "Delivery rationale",
        title: "Intravesical delivery may reduce systemic exposure.",
        detail: "That matters when systemic toxicity is difficult to accept.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:55 · Delivery and systemic exposure", startMs: 955_276 },
        ],
      },
      {
        label: "What remains unresolved",
        title: "Its comparative place remains unsettled.",
        detail: "The episode leaves TAR-210, TAR-200, and FGFR selection open.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:51 · Unresolved comparison with other intravesical therapy", startMs: 1_011_127 },
        ],
      },
    ],
    factorsLabel: "Patient factors",
    factorsHeading: "Three checks determine whether this becomes a practical question.",
    factorsContext: "They keep biomarker rationale separate from proven comparative benefit.",
    factors: [
      {
        id: "fgfr-alteration",
        label: "FGFR alteration",
        implication: "Is an FGFR alteration present?",
        detail: "The episode makes biomarker status central to the TAR-210 question.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:12 · FGFR-directed intravesical therapy", startMs: 912_280 },
        ],
      },
      {
        id: "prior-path",
        label: "Comparative uncertainty",
        implication: "Is there enough evidence to choose among intravesical options?",
        detail: "The episode says it remains unclear how TAR-210 compares with TAR-200 or how FGFR alteration should guide selection.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:51 · Unresolved comparison with other intravesical therapy", startMs: 1_011_127 },
        ],
      },
      {
        id: "delivery-fit",
        label: "Exposure and tolerability",
        implication: "Would lower systemic exposure meaningfully change treatment fit?",
        detail: "Intravesical delivery is discussed as a way to limit systemic exposure; its clinical value still needs evidence.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:55 · Delivery and systemic exposure", startMs: 955_276 },
        ],
      },
    ],
    sources: [oncologyTodayTar210],
  }, {
    currentVersionId: "nmibc-fgfr-intravesical-v0.2",
    version: "0.2",
    recordedOn: "Aug 30, 2026",
    trigger: "Complete-transcript editorial regeneration",
    change: "Preserved version 0.1, corrected the authoritative trial record, and rebuilt the Newly tracked brief around the full episode’s explicit comparative uncertainties.",
    eventSummary: "A complete-transcript Newly tracked version was recorded; the source remained a single bounded signal.",
    eventSourceIds: ["oncology-today-tar-210"],
    correction: {
      summary: "A prior version linked this question to the wrong trial registry. MoonRISe-1 (NCT06319820) replaced it on Aug 30, and the earlier version is preserved.",
    },
    movement: {
      state: "Newly tracked",
      date: "Aug 26",
      dateLabel: "Conversation published Aug 26",
      headline: "The conversation makes intravesical FGFR delivery a question worth testing while highlighting the lack of comparative evidence.",
      evidenceQualifier: "One complete grant-supported conversation reviewed",
      reviewedThrough: "Aug 30, 2026",
      sourceRefs: [
        { sourceId: "oncology-today-tar-210", relevantAt: "16:02 · TAR-210 delivery rationale after oral toxicity", startMs: 962_000 },
        { sourceId: "oncology-today-tar-210", relevantAt: "16:37 · Comparative uncertainty versus TAR-200", startMs: 997_000 },
      ],
    },
    answerLabel: "Evidence: one complete grant-supported conversation",
    answerHeading: "Possibly. Intravesical delivery may lower systemic exposure, but this conversation cannot show that TAR-210 works better than other bladder treatments.",
    synthesisClaims: [
      {
        id: "tar-210-previous-read",
        stage: "previous",
        stageLabel: "Why this question is worth tracking",
        text: "This question came up because intravesical delivery might preserve FGFR-directed activity with less systemic exposure.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:02 · TAR-210 delivery rationale after oral toxicity", startMs: 962_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:33 · Lower systemic absorption discussed", startMs: 993_000 },
        ],
      },
      {
        id: "tar-210-new-conversation",
        stage: "new",
        stageLabel: "Why the evidence is not enough",
        text: "The complete episode also says it does not know whether TAR-210 outperforms TAR-200 in FGFR-altered disease or how much prior TAR-200 evidence included that subgroup.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:37 · Comparative uncertainty versus TAR-200", startMs: 997_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:51 · FGFR subgroup prevalence in TAR-200 studies unknown", startMs: 1_011_000 },
        ],
      },
      {
        id: "tar-210-current-read",
        stage: "current",
        stageLabel: "What it means now",
        text: "Track TAR-210 as a biomarker-and-delivery hypothesis, not as a current choice among intravesical treatments.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:41 · Too early for a TAR-210 versus TAR-200 choice", startMs: 941_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:37 · Comparative uncertainty versus TAR-200", startMs: 997_000 },
        ],
      },
      {
        id: "tar-210-unresolved",
        stage: "unresolved",
        stageLabel: "What remains unknown",
        text: "Comparative benefit, durability, toxicity, testing strategy, and the right intravesical comparator remain unresolved.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:41 · Too early for a TAR-210 versus TAR-200 choice", startMs: 941_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:37 · Comparative uncertainty versus TAR-200", startMs: 997_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:51 · FGFR subgroup prevalence in TAR-200 studies unknown", startMs: 1_011_000 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "tar-210-trial-status",
        text: "ClinicalTrials.gov lists MoonRISe-1 (NCT06319820) as a recruiting phase 3 TAR-210 study in intermediate-risk NMIBC with susceptible FGFR alterations.",
        evidenceIds: ["tar-210-registry"],
        sourceCheckedOn: "Aug 30, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "Registered comparison",
      keyFacts: [
        {
          id: "tar-210-fgfr-selection",
          text: "The phase 3 study requires susceptible FGFR alterations.",
          evidenceIds: ["tar-210-registry"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "tar-210-study-purpose",
          text: "MoonRISe-1 compares TAR-210 with investigator-choice intravesical gemcitabine or mitomycin; results are not posted.",
          evidenceIds: ["tar-210-registry"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "tar-210-registry",
          kind: "trial",
          role: "trial-registry",
          label: "Trial registry",
          title: "MoonRISe-1 · NCT06319820",
          url: "https://clinicaltrials.gov/study/NCT06319820",
        },
      ],
    },
    differencesHeading: "Delivery rationale is clearer than comparative value.",
    differencesContext: "Lower systemic exposure is a mechanistic attraction; it does not establish superiority, durability, or treatment fit.",
    lenses: [
      {
        label: "Why track it",
        title: "Intravesical delivery may reduce systemic exposure.",
        detail: "The episode contrasts the delivery system with toxicity seen in an earlier oral erdafitinib study and describes markedly lower systemic absorption.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:02 · TAR-210 delivery rationale after oral toxicity", startMs: 962_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:33 · Lower systemic absorption discussed", startMs: 993_000 },
        ],
      },
      {
        label: "Why stay bounded",
        title: "The episode cannot place TAR-210 above TAR-200 or other intravesical therapy.",
        detail: "Its own counterevidence is uncertainty about comparative performance and the FGFR composition of prior TAR-200 studies.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:37 · Comparative uncertainty versus TAR-200", startMs: 997_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:51 · FGFR subgroup prevalence in TAR-200 studies unknown", startMs: 1_011_000 },
        ],
      },
    ],
    factorsHeading: "Three checks keep the hypothesis clinically bounded.",
    factorsContext: "They separate biomarker and delivery rationale from comparative evidence.",
    factors: [
      {
        id: "fgfr-alteration",
        label: "FGFR alteration",
        implication: "Is a susceptible FGFR alteration confirmed?",
        detail: "Biomarker selection is central to both the episode’s hypothesis and the current phase 3 comparison.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:23 · FGFR-directed intravesical discussion begins", startMs: 923_000 },
        ],
      },
      {
        id: "prior-path",
        label: "Comparative evidence",
        implication: "Is there evidence for choosing TAR-210 over another intravesical option?",
        detail: "The complete episode explicitly answers that comparison with uncertainty, so no treatment hierarchy is inferred.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "15:41 · Too early for a TAR-210 versus TAR-200 choice", startMs: 941_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:37 · Comparative uncertainty versus TAR-200", startMs: 997_000 },
        ],
      },
      {
        id: "delivery-fit",
        label: "Exposure and tolerability",
        implication: "Would lower systemic exposure translate into meaningful net benefit?",
        detail: "Reduced absorption is a delivery claim from the conversation; durable efficacy and comparative toxicity still require trial evidence.",
        sourceRefs: [
          { sourceId: "oncology-today-tar-210", relevantAt: "16:02 · TAR-210 delivery rationale after oral toxicity", startMs: 962_000 },
          { sourceId: "oncology-today-tar-210", relevantAt: "16:33 · Lower systemic absorption discussed", startMs: 993_000 },
        ],
      },
    ],
    editorialAudit: {
      sourceReviews: [
        { sourceId: "oncology-today-tar-210", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
      ],
      stateRationale: "Newly tracked survives because one complete episode raises a distinct durable biomarker-and-delivery question; it does not support adoption or corroboration.",
      evidenceSelections: ["Oral erdafitinib toxicity context", "Intravesical delivery rationale", "Lower systemic exposure discussion", "Explicit TAR-210/TAR-200 uncertainty", "Unknown FGFR representation in TAR-200 studies"],
      sourceLimitations: ["Only one educational program supports the synthesis.", "The activity discloses educational grants from Genentech (Roche), Johnson & Johnson, and Natera.", "The single supported conversation is kept carefully bounded and carries no added evidentiary weight."],
      counterevidence: ["The episode says it is too early to compare TAR-210 with TAR-200.", "It does not know whether TAR-200 is inferior in FGFR-altered disease or how many FGFR-altered patients were included in prior TAR-200 evidence."],
      revisedOrBlockedClaims: ["Corrected the prior mismatched registry from NCT05567185 to MoonRISe-1 NCT06319820.", "Blocked treatment-choice, superiority, established-toxicity-advantage, and routine-testing claims."],
      unresolved: ["Comparative benefit", "Durability", "Comparative toxicity", "Testing workflow", "Best intravesical comparator"],
    },
  }),
  regenerateLocalBrief({
    id: "metastatic-uc-ev-pembro-access",
    slug: "metastatic-uc-ev-pembro-access",
    currentVersionId: "metastatic-uc-ev-pembro-access-v0.2",
    previousVersions: [
      {
        id: "metastatic-uc-ev-pembro-access-v0.1",
        version: "0.1",
        status: "superseded",
        recordedOn: "May 30, 2026",
        trigger: "Initial EV-302 update discussion",
        movementState: "Newly tracked",
        sourceCheckedOn: "May 30, 2026",
        independentVerification: { status: "required" },
        snapshot: {
          snapshotSchema: "rounds-reader-core-v1",
          question: "When access to EV–pembrolizumab expands, what actually changes for first-line metastatic urothelial cancer decisions?",
          answerLabel: "Initial answer from this conversation",
          answerHeading: "Strong first-line trial context; local access remained the practical unknown.",
          synthesisClaims: [
            {
              id: "ev-pembro-access-v0.1-trial-frame",
              text: "The initial selected conversation revisited the EV-302 first-line trial context and treatment exposure.",
              sourceIds: ["uromigos-504"],
            },
            {
              id: "ev-pembro-access-v0.1-access-open",
              text: "The first local read left jurisdiction-specific access as an open implementation question.",
              sourceIds: ["uromigos-504"],
            },
          ],
          movement: {
            state: "Newly tracked",
            headline: "An initial EV-302 update raised an access-and-implementation question worth following.",
          },
          decisionBoundary: null,
          patientFactors: null,
          clinicalFacts: {
            status: {
              id: "ev-302-trial-status",
              text: "ClinicalTrials.gov lists EV-302 (NCT04223856) as an active, not-recruiting phase 3 first-line advanced urothelial cancer study.",
            },
            keyFacts: [],
          },
          clinicalFactIds: ["ev-302-trial-status"],
          sourceIds: ["uromigos-504"],
        },
      },
    ],
    shortLabel: "First-line EV–pembro access",
    area: "GU oncology",
    readingTime: "1-minute brief",
    evidenceWindow: "Selected conversations · May–Jun 2026",
    question: "When access to EV–pembrolizumab expands, what actually changes for first-line metastatic urothelial cancer decisions?",
    movement: {
      state: "Updated",
      date: "Jun 24",
      dateLabel: "Conversation published Jun 24",
      headline: "A Jun 24 GU Cast episode described new Australian access after an earlier Uromigos update.",
      reviewedThrough: "Aug 27, 2026",
      sourceRefs: [
        { sourceId: "uromigos-504", relevantAt: "01:01 · EV-302 combination and 3½-year update", startMs: 61_760 },
        { sourceId: "gu-cast-ev-302", relevantAt: "20:24 · First-line access in Australia", startMs: 1_223_810 },
      ],
    },
    answerLabel: "Answer from selected conversations",
    answerHeading: "Access opens the route; it does not erase patient fit.",
    synthesisClaims: [
      {
        id: "ev-pembro-access-movement",
        text: "The selected conversations connect EV-302 with an Australian access change.",
        sourceRefs: [
          { sourceId: "uromigos-504", relevantAt: "01:01 · EV-302 combination and 3½-year update", startMs: 61_760 },
          { sourceId: "gu-cast-ev-302", relevantAt: "20:24 · First-line access in Australia", startMs: 1_223_810 },
        ],
      },
      {
        id: "ev-pembro-access-jurisdiction-boundary",
        text: "That change enables a first-line discussion in one jurisdiction; it does not settle access elsewhere or individual treatment fit.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:24 · First-line access in Australia", startMs: 1_223_810 },
        ],
      },
      {
        id: "ev-pembro-access-durable-question",
        text: "The question worth following is access plus implementation, not access alone.",
        sourceRefs: [
          { sourceId: "uromigos-504", relevantAt: "09:07 · Treatment exposure and duration", startMs: 547_600 },
          { sourceId: "gu-cast-ev-302", relevantAt: "20:24 · First-line access in Australia", startMs: 1_223_810 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "ev-302-trial-status",
        text: "ClinicalTrials.gov lists EV-302 (NCT04223856) as an active, not-recruiting phase 3 first-line advanced urothelial cancer study.",
        evidenceIds: ["ev-302-registry"],
        sourceCheckedOn: "Aug 29, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "Registry arms",
      keyFacts: [
        {
          id: "ev-302-experimental-arm",
          text: "The experimental arm combines enfortumab vedotin with pembrolizumab.",
          evidenceIds: ["ev-302-registry"],
          sourceCheckedOn: "Aug 29, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "ev-302-comparator-arm",
          text: "The active comparator uses gemcitabine with cisplatin or carboplatin.",
          evidenceIds: ["ev-302-registry"],
          sourceCheckedOn: "Aug 29, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "ev-302-registry",
          kind: "trial",
          role: "trial-registry",
          label: "Trial registry",
          title: "EV-302 · NCT04223856",
          url: "https://clinicaltrials.gov/study/NCT04223856",
        },
      ],
    },
    governance: {
      publishingOwnerRole: "CanvasMD editor",
      factVerificationPolicy: "New or materially changed clinical facts require independent verification before external use",
      interpretiveReviewPolicy: "Additional interpretive review is risk-based, not automatic",
      publicationState: "local-prototype",
      version: "0.2",
      sourceCheckedOn: "Aug 29, 2026",
      independentFactVerification: { status: "required" },
      history: [
        {
          version: "0.2",
          date: "Aug 29, 2026",
          trigger: "Jurisdiction-specific access discussion",
          change: "Separated the Australian access movement from universal treatment-selection claims.",
        },
      ],
    },
    events: [
      {
        id: "metastatic-uc-ev-pembro-access-event-1",
        sequence: 1,
        questionId: "metastatic-uc-ev-pembro-access",
        occurredOn: "2026-05-30",
        type: "question-created",
        summary: "An editor confirmed first-line EV–pembrolizumab implementation as a consequential question.",
        material: true,
        sourceIds: ["uromigos-504"],
      },
      {
        id: "metastatic-uc-ev-pembro-access-event-2",
        sequence: 2,
        questionId: "metastatic-uc-ev-pembro-access",
        occurredOn: "2026-06-24",
        type: "materially-updated",
        summary: "A source conversation documented a practical access change in Australia.",
        material: true,
        versionId: "metastatic-uc-ev-pembro-access-v0.2",
        sourceIds: ["gu-cast-ev-302"],
      },
      {
        id: "metastatic-uc-ev-pembro-access-event-3",
        sequence: 3,
        questionId: "metastatic-uc-ev-pembro-access",
        occurredOn: "2026-08-27",
        type: "sources-reviewed",
        summary: "The selected source conversations were reviewed through Aug 27.",
        material: false,
        sourceIds: ["uromigos-504", "gu-cast-ev-302"],
      },
    ],
    tags: {
      diseases: ["Bladder cancer", "Urothelial carcinoma"],
      clinicalSettings: ["Locally advanced or metastatic disease", "First-line care"],
      stagesOrLines: ["Untreated advanced disease", "First line"],
      decisionTypes: ["Access", "Treatment selection", "Implementation"],
      treatmentsOrModalities: ["Systemic therapy", "Antibody–drug conjugate", "Immunotherapy"],
      drugsBiomarkersProcedures: ["Enfortumab vedotin", "Pembrolizumab", "EV-302", "NCT04223856"],
      patientManagement: ["Jurisdictional access", "Treatment exposure", "Eligibility"],
      clinicalRoles: ["Medical oncologist", "Oncology pharmacist", "Access coordinator"],
      commonTerminology: ["EV-pembro", "EV–pembrolizumab", "metastatic urothelial cancer", "first-line bladder cancer"],
    },
    editorConfirmed: {
      status: "editor-confirmed",
      confirmedOn: "Aug 29, 2026",
      decision: "related-to-existing",
      proposedFromSourceIds: ["uromigos-504", "gu-cast-ev-302"],
      overlapReviewedAgainstQuestionIds: ["mibc-perioperative-systemic"],
    },
    relations: [
      {
        questionId: "mibc-perioperative-systemic",
        kind: "related",
        reason: "Both questions involve EV–pembrolizumab, but they are separated by disease setting and decision type.",
        editorConfirmedOn: "Aug 29, 2026",
      },
    ],
    differencesHeading: "Evidence and access answer different questions.",
    differencesContext: "The trial explains why treatment matters; access determines whether it is available.",
    lenses: [
      {
        label: "Trial context",
        title: "EV-302 frames first-line evidence.",
        detail: "Uromigos revisits the combination and treatment exposure.",
        sourceRefs: [
          { sourceId: "uromigos-504", relevantAt: "01:01 · EV-302 combination and 3½-year update", startMs: 61_760 },
          { sourceId: "uromigos-504", relevantAt: "09:07 · Treatment exposure and duration", startMs: 547_600 },
        ],
      },
      {
        label: "Access context",
        title: "The reported access change is Australian.",
        detail: "GU Cast separates metastatic from perioperative access.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:24 · First-line access in Australia", startMs: 1_223_810 },
        ],
      },
    ],
    factorsLabel: "Patient and system factors",
    factorsHeading: "Three checks bound an access update.",
    factorsContext: "They prevent a local change becoming universal advice.",
    factors: [
      {
        id: "jurisdiction",
        label: "Jurisdiction",
        implication: "Is it available where the patient is treated?",
        detail: "The cited access movement is Australian and should not be generalized to another health system.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:24 · First-line access in Australia", startMs: 1_223_810 },
        ],
      },
      {
        id: "treatment-setting",
        label: "Treatment setting",
        implication: "Is this first-line advanced disease?",
        detail: "The source explicitly separates metastatic access from perioperative availability.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:24 · First-line access in Australia", startMs: 1_223_810 },
        ],
      },
      {
        id: "course-fit",
        label: "Treatment course",
        implication: "Is the treatment course acceptable?",
        detail: "Access makes the route possible; the treatment course still belongs in the individual decision.",
        sourceRefs: [
          { sourceId: "uromigos-504", relevantAt: "11:27 · Practice discussion of treatment duration", startMs: 687_720 },
        ],
      },
    ],
    sources: [uromigos504, guCastEv302],
  }, {
    currentVersionId: "metastatic-uc-ev-pembro-access-v0.3",
    version: "0.3",
    recordedOn: "Aug 30, 2026",
    trigger: "Complete-transcript editorial regeneration",
    change: "Preserved version 0.2 and rebuilt the access brief from the one complete conversation, excluding the partial Uromigos transcript from material claims.",
    eventSummary: "A complete-transcript regeneration was recorded; the existing jurisdiction-specific Updated state was retained.",
    eventSourceIds: ["gu-cast-ev-302"],
    movement: {
      state: "Updated",
      date: "Jun 24",
      dateLabel: "Conversation published Jun 24",
      headline: "The complete GU Cast episode reports a new Australian metastatic access program while perioperative access remained unavailable.",
      evidenceQualifier: "One complete commercially supported conversation · Uromigos Ep 504 partial and excluded from material claims",
      reviewedThrough: "Aug 30, 2026",
      sourceRefs: [
        { sourceId: "gu-cast-ev-302", relevantAt: "20:23 · No Australian perioperative access", startMs: 1_223_000 },
        { sourceId: "gu-cast-ev-302", relevantAt: "20:38 · Australian metastatic access program reported", startMs: 1_238_000 },
      ],
    },
    answerLabel: "Evidence: one complete commercially supported conversation · one partial source excluded",
    answerHeading: "Access opens a local route; fit still determines use.",
    synthesisClaims: [
      {
        id: "ev-pembro-previous-read",
        stage: "previous",
        stageLabel: "What the earlier brief said",
        text: "The prior brief paired strong EV-302 trial context with an unresolved local-access question.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:23 · No Australian perioperative access", startMs: 1_223_000 },
        ],
      },
      {
        id: "ev-pembro-new-conversation",
        stage: "new",
        stageLabel: "What changed in Australia",
        text: "The complete GU Cast episode reports an Australian access program for first-line metastatic EV–pembrolizumab while perioperative access remained unavailable.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:23 · No Australian perioperative access", startMs: 1_223_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "20:38 · Australian metastatic access program reported", startMs: 1_238_000 },
        ],
      },
      {
        id: "ev-pembro-current-read",
        stage: "current",
        stageLabel: "How to use the update",
        text: "Treat that as an Australian implementation update; jurisdiction, response, rash, neuropathy, and the tolerable treatment course still determine individual fit.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:38 · Australian metastatic access program reported", startMs: 1_238_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "25:29 · Withhold or stop treatment for toxicity", startMs: 1_529_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "25:56 · Rash monitoring", startMs: 1_556_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "26:31 · Cumulative neuropathy", startMs: 1_591_000 },
        ],
      },
      {
        id: "ev-pembro-unresolved",
        stage: "unresolved",
        stageLabel: "What remains unknown",
        text: "The reported access program is not independently confirmed here, access elsewhere is unknown, and treatment duration remains an individual management question.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:38 · Australian metastatic access program reported", startMs: 1_238_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "25:29 · Withhold or stop treatment for toxicity", startMs: 1_529_000 },
        ],
      },
    ],
    clinicalContext: {
      status: {
        id: "ev-302-trial-status",
        text: "ClinicalTrials.gov lists EV-302 (NCT04223856) as an active, not-recruiting phase 3 first-line advanced urothelial cancer study.",
        evidenceIds: ["ev-302-registry"],
        sourceCheckedOn: "Aug 30, 2026",
        independentVerification: { status: "required" },
      },
      keyFactsLabel: "Registry arms",
      keyFacts: [
        {
          id: "ev-302-experimental-arm",
          text: "The experimental arm combines enfortumab vedotin with pembrolizumab.",
          evidenceIds: ["ev-302-registry"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
        {
          id: "ev-302-comparator-arm",
          text: "The active comparator uses gemcitabine with cisplatin or carboplatin.",
          evidenceIds: ["ev-302-registry"],
          sourceCheckedOn: "Aug 30, 2026",
          independentVerification: { status: "required" },
        },
      ],
      evidence: [
        {
          id: "ev-302-registry",
          kind: "trial",
          role: "trial-registry",
          label: "Trial registry",
          title: "EV-302 · NCT04223856",
          url: "https://clinicaltrials.gov/study/NCT04223856",
        },
      ],
    },
    differencesHeading: "Access and treatment fit answer different questions.",
    differencesContext: "A local access program makes the route discussable; it does not settle jurisdiction, toxicity management, or duration.",
    lenses: [
      {
        label: "Implementation change",
        title: "The reported access change is metastatic and Australian.",
        detail: "The episode explicitly separates a new first-line metastatic program from unavailable perioperative access.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:23 · No Australian perioperative access", startMs: 1_223_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "20:38 · Australian metastatic access program reported", startMs: 1_238_000 },
        ],
      },
      {
        label: "Clinical boundary",
        title: "Availability does not erase cumulative toxicity or stopping decisions.",
        detail: "The same complete episode emphasizes early rash, accumulating neuropathy, and withholding or stopping EV when toxicity emerges.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "25:29 · Withhold or stop treatment for toxicity", startMs: 1_529_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "25:56 · Rash monitoring", startMs: 1_556_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "26:31 · Cumulative neuropathy", startMs: 1_591_000 },
        ],
      },
    ],
    factorsHeading: "Three checks bound the reported access change.",
    factorsContext: "They prevent one supported local conversation from becoming universal implementation advice.",
    factors: [
      {
        id: "jurisdiction",
        label: "Jurisdiction",
        implication: "Is the reported program available where the patient is treated?",
        detail: "The conversation reports an Australian program; access in another health system requires separate confirmation.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:38 · Australian metastatic access program reported", startMs: 1_238_000 },
        ],
      },
      {
        id: "treatment-setting",
        label: "Treatment setting",
        implication: "Is this untreated locally advanced or metastatic disease?",
        detail: "The access statement is confined to first-line metastatic care and should not be carried into the perioperative setting.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "20:23 · No Australian perioperative access", startMs: 1_223_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "20:38 · Australian metastatic access program reported", startMs: 1_238_000 },
        ],
      },
      {
        id: "course-fit",
        label: "Toxicity and course",
        implication: "Can treatment be monitored, modified, or stopped before toxicity becomes disabling?",
        detail: "Rash requires early recognition, neuropathy accumulates, and response may persist after dose reduction or discontinuation.",
        sourceRefs: [
          { sourceId: "gu-cast-ev-302", relevantAt: "25:29 · Withhold or stop treatment for toxicity", startMs: 1_529_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "25:56 · Rash monitoring", startMs: 1_556_000 },
          { sourceId: "gu-cast-ev-302", relevantAt: "26:31 · Cumulative neuropathy", startMs: 1_591_000 },
        ],
      },
    ],
    editorialAudit: {
      sourceReviews: [
        { sourceId: "uromigos-504", status: "partial-asset-excluded", note: "Publisher SRT was read, but its publication-level completeness is partial; it does not carry a material regenerated claim." },
        { sourceId: "gu-cast-ev-302", status: "complete-asset-reviewed", note: "Complete local transcript read from beginning to end and searched again during the challenge pass." },
      ],
      stateRationale: "Updated survives because the complete episode reports a concrete Australian access change; the Aug 30 regeneration does not add another movement event.",
      evidenceSelections: ["Australian metastatic access program", "Explicit perioperative-access contrast", "Rash monitoring", "Cumulative neuropathy", "Withholding and discontinuation decisions"],
      sourceLimitations: ["The only complete supporting episode discloses Astellas as a GU Cast Platinum Partner.", "The access-program statement remains conversation evidence, not independently verified clinical fact.", "Uromigos 504 is partial and excluded from material claims."],
      counterevidence: ["The same episode reports no perioperative access in Australia.", "Access does not resolve rash, neuropathy, response assessment, or how long an individual remains on treatment."],
      revisedOrBlockedClaims: ["Removed partial Uromigos 504 from material claim support.", "Blocked worldwide-access, independent-confirmation, universal-fit, and fixed-duration claims."],
      unresolved: ["Independent confirmation of the Australian program", "Other jurisdictions", "Individual treatment duration", "Long-term neuropathy management"],
    },
  }),
];

// Canonical-library aliases keep the durable question model explicit while the
// reader continues to consume the longstanding LOCAL_ROUNDS_BRIEFS export.
export const LOCAL_ROUNDS_QUESTIONS: readonly LocalDiscussionBrief[] = Object.freeze(LOCAL_ROUNDS_BRIEFS);

export const LOCAL_ROUNDS_QUESTION_BY_ID: Readonly<Record<string, LocalDiscussionBrief>> = Object.freeze(
  Object.fromEntries(LOCAL_ROUNDS_QUESTIONS.map((question) => [question.id, question])),
);

export const LOCAL_ROUNDS_QUESTION_BY_SLUG: Readonly<Record<string, LocalDiscussionBrief>> = Object.freeze(
  Object.fromEntries(LOCAL_ROUNDS_QUESTIONS.map((question) => [question.slug, question])),
);

export const QUIET_FRONT_DOOR_SCENARIO: LocalFrontDoorScenario = Object.freeze({
  id: "quiet-after-aug-29-visit",
  label: "Caught up after a recent visit",
  simulated: true,
  lastVisitOn: "Aug 29, 2026, 12:00 PM",
  lastMaterialChangeOn: "Aug 29, 2026, 9:00 AM",
  sourceConversationsReviewedThrough: "Aug 29, 2026, 4:00 PM",
  hasMovementSinceLastVisit: false,
  prioritizedQuestionIds: [],
  exploreQuestionIds: [
    "rcc-adjuvant-selection",
    "mibc-bladder-preservation",
    "proteus-perioperative",
  ],
});

export const LOCAL_ROUNDS_FRONT_DOOR_SCENARIOS: readonly LocalFrontDoorScenario[] = Object.freeze([
  QUIET_FRONT_DOOR_SCENARIO,
]);
