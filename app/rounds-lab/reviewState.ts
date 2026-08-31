import type {
  ClaimReviewStatus,
  EditorialDecision,
  ReviewSnapshot,
} from "./reviewModel";

export const REVIEW_STORE_SCHEMA_VERSION = 1 as const;
export const REVIEW_STORE_KEY = "canvasmd.rounds.reviewer.v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type ReviewRecord = ReviewSnapshot;

export type ReviewStore = {
  schemaVersion: typeof REVIEW_STORE_SCHEMA_VERSION;
  reviews: Record<string, ReviewRecord>;
};

const EMPTY_STORE: ReviewStore = {
  schemaVersion: REVIEW_STORE_SCHEMA_VERSION,
  reviews: {},
};

const CLAIM_REVIEW_STATUSES = new Set([
  "unreviewed",
  "supported",
  "unsupported",
  "needs-verification",
]);

const EDITORIAL_DECISIONS = new Set(["undecided", "approved", "returned"]);

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === "object" && Object.values(value).every(
    (entry) => typeof entry === "string",
  );
}

export function reviewKey(questionId: string, versionId: string): string {
  return `${questionId}::${versionId}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

export function createEmptyReviewRecord(
  questionId: string,
  versionId: string,
  claimIds: string[],
  now = isoNow(),
): ReviewRecord {
  return {
    questionId,
    versionId,
    claimStatuses: Object.fromEntries(
      claimIds.map((claimId) => [claimId, "unreviewed" as const]),
    ),
    claimNotes: {},
    overallNote: "",
    editorialDecision: "undecided",
    editorialDecisionNote: "",
    updatedAt: now,
  };
}

function isReviewRecord(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ReviewRecord>;
  return (
    typeof record.questionId === "string" &&
    typeof record.versionId === "string" &&
    isStringRecord(record.claimStatuses) &&
    Object.values(record.claimStatuses).every((status) => CLAIM_REVIEW_STATUSES.has(status)) &&
    isStringRecord(record.claimNotes) &&
    typeof record.overallNote === "string" &&
    typeof record.editorialDecision === "string" &&
    EDITORIAL_DECISIONS.has(record.editorialDecision) &&
    typeof record.editorialDecisionNote === "string" &&
    typeof record.updatedAt === "string"
  );
}

export function loadReviewStore(storage?: StorageLike | null): ReviewStore {
  if (!storage) return { ...EMPTY_STORE, reviews: {} };

  try {
    const raw = storage.getItem(REVIEW_STORE_KEY);
    if (!raw) return { ...EMPTY_STORE, reviews: {} };
    const parsed = JSON.parse(raw) as Partial<ReviewStore>;
    if (
      parsed.schemaVersion !== REVIEW_STORE_SCHEMA_VERSION ||
      !parsed.reviews ||
      typeof parsed.reviews !== "object"
    ) {
      return { ...EMPTY_STORE, reviews: {} };
    }

    const reviews = Object.fromEntries(
      Object.entries(parsed.reviews).filter((entry): entry is [string, ReviewRecord] =>
        isReviewRecord(entry[1]),
      ),
    );
    return { schemaVersion: REVIEW_STORE_SCHEMA_VERSION, reviews };
  } catch {
    return { ...EMPTY_STORE, reviews: {} };
  }
}

export function loadReviewRecord(
  storage: StorageLike | null | undefined,
  questionId: string,
  versionId: string,
  claimIds: string[],
  now = isoNow(),
): ReviewRecord {
  const stored = loadReviewStore(storage).reviews[reviewKey(questionId, versionId)];
  if (!stored) return createEmptyReviewRecord(questionId, versionId, claimIds, now);
  if (stored.questionId !== questionId || stored.versionId !== versionId) {
    return createEmptyReviewRecord(questionId, versionId, claimIds, now);
  }

  const claimStatuses = Object.fromEntries(
    claimIds.map((claimId) => [claimId, stored.claimStatuses[claimId] ?? "unreviewed"]),
  );
  const claimNotes = Object.fromEntries(
    Object.entries(stored.claimNotes).filter(([claimId]) => claimIds.includes(claimId)),
  );
  return { ...stored, claimStatuses, claimNotes };
}

export function persistReviewRecord(
  storage: StorageLike,
  review: ReviewRecord,
): ReviewStore {
  if (!isReviewRecord(review)) {
    throw new Error("The review record is invalid; refusing to save it.");
  }
  const raw = storage.getItem(REVIEW_STORE_KEY);
  let current: ReviewStore = { ...EMPTY_STORE, reviews: {} };
  if (raw) {
    let parsed: Partial<ReviewStore>;
    try {
      parsed = JSON.parse(raw) as Partial<ReviewStore>;
    } catch {
      throw new Error("The local review store is unreadable; refusing to overwrite existing data.");
    }
    if (
      parsed.schemaVersion !== REVIEW_STORE_SCHEMA_VERSION
      || !parsed.reviews
      || typeof parsed.reviews !== "object"
      || !Object.values(parsed.reviews).every(isReviewRecord)
    ) {
      throw new Error("The local review store is invalid; refusing to overwrite existing data.");
    }
    current = {
      schemaVersion: REVIEW_STORE_SCHEMA_VERSION,
      reviews: parsed.reviews as Record<string, ReviewRecord>,
    };
  }
  const next: ReviewStore = {
    schemaVersion: REVIEW_STORE_SCHEMA_VERSION,
    reviews: {
      ...current.reviews,
      [reviewKey(review.questionId, review.versionId)]: review,
    },
  };
  storage.setItem(REVIEW_STORE_KEY, JSON.stringify(next));
  return next;
}

export function updateClaimStatus(
  review: ReviewRecord,
  claimId: string,
  status: ClaimReviewStatus,
  now = isoNow(),
): ReviewRecord {
  return {
    ...review,
    claimStatuses: { ...review.claimStatuses, [claimId]: status },
    updatedAt: now,
  };
}

export function updateClaimNote(
  review: ReviewRecord,
  claimId: string,
  note: string,
  now = isoNow(),
): ReviewRecord {
  return {
    ...review,
    claimNotes: { ...review.claimNotes, [claimId]: note },
    updatedAt: now,
  };
}

export function updateOverallNote(
  review: ReviewRecord,
  note: string,
  now = isoNow(),
): ReviewRecord {
  return { ...review, overallNote: note, updatedAt: now };
}

export function setEditorialDecision(
  review: ReviewRecord,
  decision: EditorialDecision,
  note: string,
  now = isoNow(),
): ReviewRecord {
  return {
    ...review,
    editorialDecision: decision,
    editorialDecisionNote: note,
    updatedAt: now,
  };
}
