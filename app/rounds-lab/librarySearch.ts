import type { LocalDiscussionBrief } from "./fixture";

export type RoundsSearchField =
  | "title"
  | "disease"
  | "clinical-setting"
  | "stage-or-line"
  | "treatment"
  | "biomarker-or-procedure"
  | "common-terminology"
  | "decision-type"
  | "patient-management"
  | "clinical-role"
  | "current-read";

export type RoundsQuestionSearchResult = {
  question: LocalDiscussionBrief;
  id: string;
  slug: string;
  canonicalHref: string;
  matchedFields: readonly RoundsSearchField[];
  score: number;
};

export type RoundsSearchOptions = {
  limit?: number;
};

const SEARCH_FIELD_WEIGHTS: Record<RoundsSearchField, number> = {
  title: 10,
  disease: 7,
  "clinical-setting": 6,
  "stage-or-line": 6,
  treatment: 6,
  "biomarker-or-procedure": 6,
  "common-terminology": 5,
  "decision-type": 4,
  "patient-management": 4,
  "clinical-role": 2,
  "current-read": 3,
};

const MOVEMENT_ORDER = {
  "Newly tracked": 0,
  Updated: 1,
  Watch: 2,
  Steady: 3,
} as const;

export function normalizeRoundsSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—‑]/g, "-")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function fieldsForQuestion(question: LocalDiscussionBrief): Record<RoundsSearchField, string> {
  return {
    title: [question.shortLabel, question.question].join(" "),
    disease: question.tags.diseases.join(" "),
    "clinical-setting": question.tags.clinicalSettings.join(" "),
    "stage-or-line": question.tags.stagesOrLines.join(" "),
    treatment: question.tags.treatmentsOrModalities.join(" "),
    "biomarker-or-procedure": question.tags.drugsBiomarkersProcedures.join(" "),
    "common-terminology": question.tags.commonTerminology.join(" "),
    "decision-type": question.tags.decisionTypes.join(" "),
    "patient-management": question.tags.patientManagement.join(" "),
    "clinical-role": question.tags.clinicalRoles.join(" "),
    "current-read": [
      question.answerLabel,
      question.answerHeading,
      ...question.synthesisClaims.flatMap((claim) => [
        claim.stageLabel ?? "",
        claim.text,
        claim.sourceContext ?? "",
      ]),
    ].join(" "),
  };
}

/**
 * Searches current canonical questions only. Historical versions are
 * intentionally absent so a result always resolves to the durable question.
 */
export function searchRoundsQuestions(
  query: string,
  questions: readonly LocalDiscussionBrief[],
  options: RoundsSearchOptions = {},
): RoundsQuestionSearchResult[] {
  const normalizedQuery = normalizeRoundsSearchText(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const limit = Number.isFinite(options.limit) && (options.limit ?? 0) > 0
    ? Math.min(Math.floor(options.limit as number), questions.length)
    : questions.length;

  if (!tokens.length) {
    return questions.slice(0, limit).map((question) => ({
      question,
      id: question.id,
      slug: question.slug,
      canonicalHref: `/rounds-lab?question=${encodeURIComponent(question.slug)}`,
      matchedFields: [],
      score: 0,
    }));
  }

  return questions
    .map((question): RoundsQuestionSearchResult | null => {
      const fields = fieldsForQuestion(question);
      const normalizedFields = Object.fromEntries(
        Object.entries(fields).map(([field, value]) => [field, normalizeRoundsSearchText(value)]),
      ) as Record<RoundsSearchField, string>;
      const searchableText = Object.values(normalizedFields).join(" ");

      if (!tokens.every((token) => searchableText.includes(token))) return null;

      const matchedFields = (Object.keys(normalizedFields) as RoundsSearchField[])
        .filter((field) => tokens.some((token) => normalizedFields[field].includes(token)));
      const exactPhraseBonus = Object.values(normalizedFields).some((value) => value.includes(normalizedQuery))
        ? 8
        : 0;
      const score = matchedFields.reduce((total, field) => total + SEARCH_FIELD_WEIGHTS[field], 0)
        + exactPhraseBonus;

      return {
        question,
        id: question.id,
        slug: question.slug,
        canonicalHref: `/rounds-lab?question=${encodeURIComponent(question.slug)}`,
        matchedFields: Object.freeze(matchedFields),
        score,
      };
    })
    .filter((result): result is RoundsQuestionSearchResult => result !== null)
    .sort((left, right) => (
      right.score - left.score
      || MOVEMENT_ORDER[left.question.movement.state] - MOVEMENT_ORDER[right.question.movement.state]
      || left.question.shortLabel.localeCompare(right.question.shortLabel)
    ))
    .slice(0, limit);
}

export function findRoundsQuestion(
  idOrSlug: string,
  questions: readonly LocalDiscussionBrief[],
) {
  return questions.find((question) => question.id === idOrSlug || question.slug === idOrSlug);
}
