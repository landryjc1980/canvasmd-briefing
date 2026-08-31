// CORRECTION_TEST_ONLY: This deliberately erroneous historical statement exists
// solely to exercise the Rounds reviewer correction workflow. It is prohibited
// from current-question, reader, search, production, and non-Rounds surfaces.

export const CORRECTION_ALLOWED_SURFACE =
  "reviewer-correction-history-only" as const;

export type CorrectionTestFixture = {
  fixtureId: string;
  questionId: string;
  correctionTestOnly: true;
  eligibleAsCurrent: false;
  allowedSurface: typeof CORRECTION_ALLOWED_SURFACE;
  supersededVersion: {
    versionId: string;
    label: "Previous version — corrected";
    deliberatelyErroneousFixtureValue: string;
  };
  correction: {
    recordedOn: string;
    reason: string;
    currentSafeSummary: string;
    independentHumanVerification: "required-not-recorded";
  };
};

export const CORRECTION_TEST_FIXTURE: CorrectionTestFixture = {
  fixtureId: "rounds-correction-safeguard-mibc-2026-08",
  questionId: "mibc-perioperative-systemic",
  correctionTestOnly: true,
  eligibleAsCurrent: false,
  allowedSurface: CORRECTION_ALLOWED_SURFACE,
  supersededVersion: {
    versionId: "mibc-perioperative-systemic-v0-correction-test",
    label: "Previous version — corrected",
    deliberatelyErroneousFixtureValue:
      "DELIBERATELY ERRONEOUS TEST VALUE — The July 2026 perioperative enfortumab vedotin plus pembrolizumab indication was limited to cisplatin-ineligible patients.",
  },
  correction: {
    recordedOn: "Aug 28, 2026",
    reason:
      "The prior test-only version misstated the eligible population and could alter clinical interpretation.",
    currentSafeSummary:
      "The reader-safe current version does not repeat the superseded statement and requires re-checking against the cited regulatory source.",
    independentHumanVerification: "required-not-recorded",
  },
};

export function assertCorrectionFixtureSafe(
  fixture: CorrectionTestFixture = CORRECTION_TEST_FIXTURE,
): true {
  if (
    fixture.correctionTestOnly !== true ||
    fixture.eligibleAsCurrent !== false ||
    fixture.allowedSurface !== CORRECTION_ALLOWED_SURFACE ||
    fixture.correction.independentHumanVerification !== "required-not-recorded"
  ) {
    throw new Error("Unsafe Rounds correction fixture configuration.");
  }
  return true;
}

export function canRenderCorrectionOnSurface(
  fixture: CorrectionTestFixture,
  surface: string,
): boolean {
  return (
    fixture.correctionTestOnly &&
    !fixture.eligibleAsCurrent &&
    fixture.allowedSurface === CORRECTION_ALLOWED_SURFACE &&
    surface === CORRECTION_ALLOWED_SURFACE
  );
}

assertCorrectionFixtureSafe();
