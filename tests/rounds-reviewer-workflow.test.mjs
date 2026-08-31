import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  evaluateTranscriptCoverage,
  getPublicationReadiness,
  serializeReviewExport,
} from "../app/rounds-lab/reviewModel.ts";
import {
  REVIEW_STORE_KEY,
  REVIEW_STORE_SCHEMA_VERSION,
  createEmptyReviewRecord,
  loadReviewRecord,
  loadReviewStore,
  persistReviewRecord,
  reviewKey,
  setEditorialDecision,
  updateClaimNote,
  updateClaimStatus,
  updateOverallNote,
} from "../app/rounds-lab/reviewState.ts";
import {
  CORRECTION_ALLOWED_SURFACE,
  CORRECTION_TEST_FIXTURE,
  assertCorrectionFixtureSafe,
  canRenderCorrectionOnSurface,
} from "../app/rounds-lab/reviewer/correctionFixture.ts";
import {
  REVIEWER_QUESTION_RECORDS,
  buildReviewerQuestionRecords,
  getReviewerQuestionRecord,
} from "../app/rounds-lab/reviewer/reviewerFixture.ts";
import {
  MAX_TRANSCRIPT_CONTEXTS,
  MAX_TRANSCRIPT_CONTEXTS_PER_SOURCE,
  buildTranscriptSearchResults,
} from "../app/rounds-lab/reviewer/transcriptSearch.ts";
import { parseSrt } from "../app/rounds-lab/reviewer/transcripts/parseSrt.ts";
import { LOCAL_TRANSCRIPT_MANIFEST } from "../app/rounds-lab/reviewer/transcripts/manifest.ts";
import { LOCAL_ROUNDS_BRIEFS } from "../app/rounds-lab/fixture.ts";
import {
  canonicalTranscriptPayload,
  transcriptContentSha256,
} from "../app/rounds-lab/transcriptIntegrity.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const reviewerPage = read("app/rounds-lab/reviewer/page.tsx");
const reviewerView = read("app/rounds-lab/reviewer/ReviewerWorkbench.tsx");
const transcriptSearchSource = read("app/rounds-lab/reviewer/transcriptSearch.ts");
const reviewerCss = read("app/rounds-lab/reviewer/reviewer.css");
const readerPage = read("app/rounds-lab/page.tsx");
const readerView = read("app/rounds-lab/RoundsLab.tsx");
const readerFixture = read("app/rounds-lab/fixture.ts");
const middleware = read("middleware.ts");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    dump(key) {
      return values.get(key);
    },
  };
}

function completeTranscriptSegments(sourceId, durationMs) {
  const segments = [];
  let tokenIndex = 0;
  for (let startMs = 0, index = 0; startMs < durationMs; startMs += 60_000, index += 1) {
    const endMs = Math.min(durationMs, startMs + 60_000);
    const wordCount = Math.max(1, Math.ceil(((endMs - startMs) / 60_000) * 90));
    segments.push({
      id: `${sourceId}:complete-${index}`,
      sourceId,
      startMs,
      endMs,
      timestamp: `${Math.floor(startMs / 60_000)}:00`,
      text: Array.from({ length: wordCount }, () => {
        let value = tokenIndex;
        let suffix = "";
        do {
          suffix = String.fromCharCode(97 + (value % 26)) + suffix;
          value = Math.floor(value / 26);
        } while (value > 0);
        tokenIndex += 1;
        return `term${suffix}`;
      }).join(" "),
    });
  }
  return segments;
}

test("transcript receipts use a canonical SHA-256 of the reviewed segments", () => {
  const segments = completeTranscriptSegments("hash-check", 120_000);
  const expected = createHash("sha256")
    .update(canonicalTranscriptPayload(segments))
    .digest("hex");
  assert.equal(transcriptContentSha256(segments), `sha256:${expected}`);
});

test("the reviewer route is noindexed, development-only, and covered by the isolated middleware prefix", () => {
  for (const page of [readerPage, reviewerPage]) {
    assert.match(page, /robots:\s*\{\s*index: false, follow: false, noarchive: true, nocache: true\s*\}/);
  }
  assert.doesNotMatch(readerPage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.match(readerPage, /hostedDraft=\{process\.env\.NODE_ENV === "production"\}/);
  assert.match(reviewerPage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.match(middleware, /pathname === "\/rounds-lab" \|\| pathname\.startsWith\("\/rounds-lab\/"\)/);
  assert.ok(
    middleware.indexOf('pathname === "/rounds-lab"') < middleware.indexOf("activeContactId(session.contactId)"),
    "Rounds Lab must bypass the contact gate before any production contact lookup",
  );
  assert.doesNotMatch(middleware, /PUBLIC_PREFIXES\s*=\s*\[[^\]]*["']\/rounds-lab["']/);
  assert.doesNotMatch(`${reviewerView}\n${readerView}`, /\/api\/|supabase|lib\/db|logSignal|analytics\./i);
  assert.doesNotMatch(`${reviewerView}\n${readerView}`, /fetch\s*\(/);
  assert.doesNotMatch(`${readerPage}\n${readerView}\n${readerFixture}`, /localStorage|sessionStorage|sendBeacon|trackEvent|readerId/i);
});

test("every tracked question has a sentence-level reviewer record with resolvable evidence", () => {
  assert.equal(REVIEWER_QUESTION_RECORDS.length, LOCAL_ROUNDS_BRIEFS.length);
  assert.deepEqual(
    new Set(REVIEWER_QUESTION_RECORDS.map((record) => record.questionId)),
    new Set(LOCAL_ROUNDS_BRIEFS.map((brief) => brief.id)),
  );

  for (const record of REVIEWER_QUESTION_RECORDS) {
    const brief = LOCAL_ROUNDS_BRIEFS.find((candidate) => candidate.id === record.questionId);
    assert.ok(brief);
    assert.equal(getReviewerQuestionRecord(record.questionId), record);
    assert.ok(record.versionId);
    assert.ok(record.accountableEditorId);
    assert.ok(record.claims.length > 0);
    assert.equal(new Set(record.claims.map((claim) => claim.claimId)).size, record.claims.length);
    assert.equal(record.versions.filter((version) => version.eligibleAsCurrent).length, 1);
    assert.ok(record.versions.filter((version) => version.snapshot).every((version) => version.exportEligible));
    assert.equal(
      record.versions.find((version) => version.eligibleAsCurrent).snapshotCoverage,
      "full-reader-core",
    );
    assert.ok(
      record.versions
        .filter((version) => version.snapshot)
        .every((version) => version.snapshotCoverage === "full-reader-core"),
    );
    assert.equal(
      record.versions.some((version) => version.snapshotCoverage === "partial-reader-core"),
      false,
    );
    for (const sourceVersion of brief.versions) {
      const reviewerVersion = record.versions.find(
        (version) => version.versionId === sourceVersion.id,
      );
      assert.ok(reviewerVersion, `missing reviewer version ${sourceVersion.id}`);
      assert.deepEqual(
        reviewerVersion.snapshot,
        sourceVersion.snapshot,
        `${sourceVersion.id} must preserve the exact immutable reader-core snapshot`,
      );
    }
    assert.match(record.interpretiveReview.status, /^(not-required|required|complete)$/);
    assert.equal(record.interpretiveReview.required, record.interpretiveReview.status !== "not-required");
    assert.match(record.provenanceNote, /episode or show is the public unit of evidence/i);
    assert.match(record.aiAuditNote, /observable source selections/i);
    assert.match(record.aiAuditNote, /does not expose or reconstruct private model chain-of-thought/i);
    assert.ok(record.editorialAudit.sourceReviews.length > 0);
    assert.ok(record.editorialAudit.counterevidence.length > 0);
    assert.ok(record.editorialAudit.revisedOrBlockedClaims.length > 0);

    const movementClaim = record.claims.find((claim) => claim.claimId === `${brief.id}:movement`);
    const answerClaim = record.claims.find((claim) => claim.claimId === `${brief.id}:answer`);
    assert.equal(
      movementClaim?.claimText,
      [brief.movement.headline, brief.movement.evidenceQualifier].filter(Boolean).join(" "),
    );
    assert.equal(answerClaim?.claimText, `${brief.answerLabel} ${brief.answerHeading}`);
    for (const synthesisClaim of brief.synthesisClaims) {
      const reviewerClaim = record.claims.find((claim) => claim.claimId === synthesisClaim.id);
      assert.equal(reviewerClaim?.claimText, synthesisClaim.text);
      if (synthesisClaim.sourceContext) {
        assert.equal(reviewerClaim?.materialUncertainty, synthesisClaim.sourceContext);
      }
    }

    const passageIds = new Set(record.passages.map((passage) => passage.id));
    const clinicalIds = new Set(record.clinicalReferences.map((reference) => reference.id));
    for (const claim of record.claims) {
      assert.match(
        claim.evidenceUse,
        /^(direct-support|paraphrase|cross-source-synthesis|clinical-fact-source-check|verified-fact|editorial-interpretation)$/,
      );
      assert.ok(claim.relevance.length > 20);
      assert.ok(claim.materialUncertainty.length > 20);
      assert.ok(claim.movementRationale.length > 20);
      assert.ok(claim.wordingDiff.current.length > 0);
      assert.ok(
        claim.evidencePassageIds.length > 0 || claim.clinicalEvidenceIds.length > 0,
        `${claim.claimId} has no observable evidence mapping`,
      );
      assert.ok(claim.evidencePassageIds.every((id) => passageIds.has(id)));
      assert.ok(claim.clinicalEvidenceIds.every((id) => clinicalIds.has(id)));
      for (const excluded of claim.sourcesConsideredButExcluded) {
        assert.ok(excluded.sourceLabel);
        assert.ok(excluded.reason.length > 20);
      }
    }

    const sourceIds = new Set(
      brief.sources.map(
        (source) => source.id,
      ),
    );
    for (const passage of record.passages) {
      assert.ok(sourceIds.has(passage.sourceId));
      assert.ok(Number.isInteger(passage.startMs) && passage.startMs >= 0);
      assert.match(passage.sourceUrl, /^https:\/\//);
      assert.match(passage.transcriptCompleteness, /^(complete|partial|unavailable|rights-restricted)$/);
      assert.equal(passage.reference.sourceId, passage.sourceId);
      assert.equal(passage.reference.startMs, passage.startMs);
      if (passage.transcriptWindowId) {
        assert.ok(Number.isInteger(passage.transcriptWindowStartMs));
        assert.ok(Number.isInteger(passage.transcriptWindowEndMs));
        assert.ok(passage.transcriptWindowEndMs > passage.transcriptWindowStartMs);
      }
    }
  }
});

test("complete transcript status requires near-continuous duration coverage", () => {
  const partial = evaluateTranscriptCoverage(120_000, [
    { id: "a", sourceId: "source", startMs: 0, endMs: 25_000, timestamp: "0:00", text: "Opening." },
    { id: "b", sourceId: "source", startMs: 85_000, endMs: 120_000, timestamp: "1:25", text: "Closing." },
  ]);
  assert.equal(partial.validatedComplete, false);
  assert.equal(partial.maximumGapMs, 60_000);
  assert.ok(partial.coverageRatio < 0.6);

  const summarySpoof = evaluateTranscriptCoverage(2_400_000, [
    {
      id: "summary",
      sourceId: "source",
      startMs: 0,
      endMs: 2_400_000,
      timestamp: "0:00",
      text: "Short summary that is not an episode transcript.",
    },
  ]);
  assert.equal(summarySpoof.coverageRatio, 1);
  assert.equal(summarySpoof.granular, false);
  assert.equal(summarySpoof.textDensityPlausible, false);
  assert.equal(summarySpoof.validatedComplete, false);

  const complete = evaluateTranscriptCoverage(
    120_000,
    completeTranscriptSegments("source", 120_000),
  );
  assert.equal(complete.validatedComplete, true);
  assert.equal(complete.coverageRatio, 1);
  assert.equal(complete.maximumGapMs, 0);
  assert.equal(complete.granular, true);
  assert.equal(complete.textDensityPlausible, true);
});

test("the local SRT parser preserves timecoded words and rejects malformed sequence", () => {
  const segments = parseSrt(`1\n00:00:01,250 --> 00:00:03,500\nFirst line\ncontinues here.\n\n2\n00:00:03,500 --> 00:00:05,000\nSecond line.`);
  assert.deepEqual(segments, [
    { startMs: 1_250, endMs: 3_500, text: "First line continues here." },
    { startMs: 3_500, endMs: 5_000, text: "Second line." },
  ]);
  assert.throws(
    () => parseSrt(`2\n00:00:00,000 --> 00:00:01,000\nWrong sequence.`),
    /unexpected sequence/i,
  );
});

test("a full-conversation local asset becomes searchable without pretending publication attestation", () => {
  const brief = LOCAL_ROUNDS_BRIEFS[0];
  const source = brief.sources.find((candidate) => candidate.id === "uromigos-515");
  assert.ok(source);
  const durationMs = source.durationSeconds * 1_000;
  const segments = completeTranscriptSegments(source.id, durationMs);
  const records = buildReviewerQuestionRecords({
    [source.id]: {
      assetId: `synthetic:${source.id}`,
      sourceIds: [source.id],
      show: source.show,
      episodeTitle: source.episode,
      sourceDurationMs: durationMs,
      segments,
      coverage: evaluateTranscriptCoverage(durationMs, segments),
      completeness: "complete",
      searchScope: "full-conversation",
      assetKind: "local-machine-transcript",
      sourceFileSha256: `sha256:${"a".repeat(64)}`,
      segmentPayloadSha256: `sha256:${"b".repeat(64)}`,
      provenance: {
        origin: "machine",
        transcriptionMethod: "test machine",
        methodLabel: "Machine transcript supplied only to exercise the local reviewer test path.",
        humanAccuracyReviewed: false,
        wholeConversationAttested: false,
        inventoryCheckedOn: "2026-08-29",
        note: "No human accuracy or whole-conversation attestation is recorded.",
      },
    },
  });
  const record = records.find((candidate) => candidate.questionId === brief.id);
  const transcript = record.transcripts.find((candidate) => candidate.sourceId === source.id);
  assert.equal(transcript.searchableTranscriptAvailable, true);
  assert.equal(transcript.searchScope, "full-conversation");
  assert.equal(transcript.completeness, "partial");
  assert.equal(transcript.completeTranscriptAvailable, false);
  assert.equal(transcript.humanAccuracyReviewed, false);
  assert.match(transcript.availabilityNote, /machine transcript is loaded and searchable/i);
  assert.ok(transcript.segments.length > 0);
  assert.ok(
    record.passages
      .filter((passage) => passage.sourceId === source.id)
      .every((passage) =>
        passage.transcriptCompleteness === "partial"
        && !/transcript evidence unavailable/i.test(passage.text),
      ),
  );

  const review = createEmptyReviewRecord(
    record.questionId,
    record.versionId,
    record.claims.map((claim) => claim.claimId),
  );
  const readiness = getPublicationReadiness(record, review);
  assert.ok(
    readiness.blockers.some((blocker) =>
      blocker.includes(`Transcript publication attestation incomplete for ${source.citationLabel}`),
    ),
  );
});

test("transcript completeness is represented honestly and incomplete coverage remains a blocker", () => {
  for (const record of REVIEWER_QUESTION_RECORDS) {
    const transcriptBySource = new Map(
      record.transcripts.map((transcript) => [transcript.sourceId, transcript]),
    );
    assert.equal(transcriptBySource.size, record.transcripts.length);

    for (const transcript of record.transcripts) {
      assert.match(transcript.origin, /^(publisher|human|machine|unknown)$/);
      assert.ok(transcript.methodLabel.length > 20);
      assert.ok(transcript.checkedOn);
      assert.match(transcript.completenessReceipt.status, /^(not-recorded|recorded)$/);
      assert.equal(transcript.completenessReceipt.scope, "entire-source-conversation");
      assert.equal(transcript.coverage.durationMs > 0, true);
      assert.equal(transcript.sourceDurationMs, transcript.coverage.durationMs);
      assert.equal(transcript.coverage.segmentCount, transcript.segments.length);
      assert.match(transcript.searchScope, /^(full-conversation|bounded-windows|none)$/);
      assert.match(transcript.assetKind, /^(publisher-transcript|local-machine-transcript|bounded-evidence|unavailable)$/);
      assert.equal(typeof transcript.searchableTranscriptAvailable, "boolean");
      assert.equal(typeof transcript.humanAccuracyReviewed, "boolean");
      if (transcript.completeTranscriptAvailable) {
        assert.equal(transcript.completeness, "complete");
        assert.ok(transcript.passageIds.length > 0);
        assert.equal(transcript.coverage.validatedComplete, true);
        assert.ok(transcript.segments.length > 0);
        assert.equal(transcript.completenessReceipt.status, "recorded");
        assert.ok(transcript.completenessReceipt.recordedBy);
        assert.ok(transcript.completenessReceipt.recordedOn);
        assert.ok(transcript.completenessReceipt.transcriptAssetId);
        assert.match(transcript.completenessReceipt.transcriptContentSha256, /^sha256:[a-f0-9]{64}$/i);
        assert.equal(transcript.completenessReceipt.recordedSegmentCount, transcript.segments.length);
        assert.equal(transcript.completenessReceipt.recordedDurationMs, transcript.coverage.durationMs);
        assert.equal(transcript.searchableTranscriptAvailable, true);
        assert.match(transcript.availabilityNote, /publication-attested complete transcript is loaded and searchable/i);
      } else if (!transcript.searchableTranscriptAvailable) {
        assert.match(transcript.completeness, /^(partial|unavailable|rights-restricted)$/);
        assert.match(transcript.availabilityNote, /not loaded|blocked|only cited|publisher transcript|bounded transcript window/i);
      }
      assert.ok(
        transcript.passageIds.every((passageId) =>
          record.passages.some((passage) => passage.id === passageId),
        ),
      );
    }

    const empty = createEmptyReviewRecord(
      record.questionId,
      record.versionId,
      record.claims.map((claim) => claim.claimId),
      "2026-08-29T12:00:00.000Z",
    );
    const readiness = getPublicationReadiness(record, empty);
    assert.equal(readiness.ready, false);
    if (record.transcripts.some((transcript) => !transcript.searchableTranscriptAvailable)) {
      assert.ok(readiness.blockers.some((blocker) => /Searchable full-conversation transcript unavailable/i.test(blocker)));
    }
  }

  assert.match(reviewerView, /Search access does not clear the publication gate/i);
  assert.match(reviewerView, /Search this question’s source transcripts/i);
  assert.match(reviewerView, /searchableTranscriptSegments/);
  assert.match(reviewerView, /Read searchable transcript/i);
  assert.match(reviewerView, /bounded evidence windows/i);
  assert.match(reviewerView, /Citation targets without local transcript text/i);
  assert.equal(reviewerView.includes("passage.transcriptWindowId ?? passage.id"), true);
  assert.match(reviewerView, /Play full episode in context/i);
  assert.match(reviewerView, /Open publisher transcript/i);
  assert.match(reviewerView, /Available surrounding context/i);
});

test("transcript review stays bounded, cross-cue aware, lazy, and source-specific", () => {
  assert.equal(MAX_TRANSCRIPT_CONTEXTS_PER_SOURCE, 8);
  assert.equal(MAX_TRANSCRIPT_CONTEXTS, 40);
  assert.match(
    transcriptSearchSource,
    /const currentSegment[\s\S]*const nextSegment[\s\S]*searchablePair[\s\S]*includes\(query\)/,
  );
  assert.match(
    transcriptSearchSource,
    /const windowStart\s*=\s*Math\.max\(0, index - 1\)[\s\S]*const windowEnd\s*=\s*Math\.min\([\s\S]*index \+ 1\)/,
  );
  assert.match(transcriptSearchSource, /windowStart <= lastAcceptedWindowEnd/);
  assert.match(reviewerView, /reviewer-transcript-result-group/);
  assert.match(
    reviewerView,
    /Showing \$\{transcriptSearchResults\.shownMatchCount\} of \$\{transcriptSearchResults\.totalMatchCount\}/,
  );
  assert.match(reviewerView, /expandedTranscriptSourceIds\.includes\(source\.id\)/);
  assert.match(
    reviewerView,
    /onToggle=\{\(event\) => setTranscriptDisclosureOpen\([\s\S]*event\.currentTarget\.open/,
  );
  assert.match(reviewerView, /\{transcriptDisclosureOpen \? \(/);
  assert.match(
    reviewerView,
    /aria-label=\{`Read searchable transcript for \$\{source\.citationLabel\}: \$\{source\.episode\}`\}/,
  );
  assert.match(
    reviewerView,
    /aria-label=\{`Play \$\{source\.citationLabel\}, \$\{source\.episode\}, from \$\{segment\.timestamp\} in the full episode`\}/,
  );
  assert.match(reviewerView, /humanAccuracyReviewLabel\(transcript\)/);
  assert.match(reviewerView, /publicationCompletenessLabel\(transcript\)/);
  assert.match(
    reviewerView,
    /Searching this question’s \{searchableTranscriptSources\.length\} source/,
  );
  const groupedSearchStart = reviewerView.indexOf("transcriptSearchResults.groups.map");
  const matchRowsStart = reviewerView.indexOf("matches.map", groupedSearchStart);
  const groupHeadingSource = reviewerView.slice(groupedSearchStart, matchRowsStart);
  const matchRowsSource = reviewerView.slice(
    matchRowsStart,
    reviewerView.indexOf("</section>", matchRowsStart),
  );
  assert.match(groupHeadingSource, /reviewer-transcript-result-trust/);
  assert.match(groupHeadingSource, /humanAccuracyReviewLabel\(transcript\)/);
  assert.match(groupHeadingSource, /publicationCompletenessLabel\(transcript\)/);
  assert.doesNotMatch(matchRowsSource, /humanAccuracyReviewLabel\(transcript\)/);
  assert.doesNotMatch(matchRowsSource, /publicationCompletenessLabel\(transcript\)/);
  assert.doesNotMatch(reviewerView, /not human-attested/i);
  assert.match(
    reviewerCss,
    /\.reviewer-complete-transcript > div\s*\{[^}]*max-height:\s*min\(58vh, 680px\);[^}]*overflow-y:\s*auto;/,
  );
  assert.match(
    reviewerCss,
    /\.reviewer-view-tabs\s*\{[^}]*overflow-x:\s*auto;[^}]*mask-image:\s*linear-gradient\(to right/,
  );
});

test("the local transcript manifest resolves only durable ignored assets with matching digests", () => {
  const entries = Object.values(LOCAL_TRANSCRIPT_MANIFEST);
  const fixtureSourceIds = [...new Set(
    LOCAL_ROUNDS_BRIEFS.flatMap((brief) => brief.sources.map((source) => source.id)),
  )].sort();
  const manifestSourceIds = entries.flatMap((entry) => entry.sourceIds).sort();

  assert.deepEqual(manifestSourceIds, fixtureSourceIds);
  assert.equal(new Set(manifestSourceIds).size, manifestSourceIds.length);
  for (const entry of entries) {
    assert.doesNotMatch(entry.srtPath, /\/private\/tmp/u);
    assert.match(entry.srtPath, /\/transcripts\/local-assets\//u);
    const raw = fs.readFileSync(entry.srtPath);
    const digest = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
    assert.equal(digest, entry.sourceFileSha256);
    if (entry.audioPath) {
      assert.doesNotMatch(entry.audioPath, /\/private\/tmp/u);
      assert.match(entry.audioPath, /\/transcripts\/local-assets\//u);
      assert.equal(fs.existsSync(entry.audioPath), true);
    }
  }
});

test("a metadata match remains additive to transcript-wording evidence", () => {
  const source = {
    id: "search-proteus",
    show: "GU evidence review",
    citationLabel: "GU evidence review · PROTEUS",
    episode: "What PROTEUS changes in practice",
    published: "Aug 29, 2026",
  };
  const transcript = {
    sourceId: source.id,
    origin: "machine",
    methodLabel: "Local machine transcript for executable search testing.",
    segments: [
      {
        id: "search-proteus:0",
        sourceId: source.id,
        startMs: 0,
        endMs: 2_000,
        timestamp: "0:00",
        text: "The PROTEUS result raises a practical question.",
      },
      {
        id: "search-proteus:1",
        sourceId: source.id,
        startMs: 2_000,
        endMs: 4_000,
        timestamp: "0:02",
        text: "How broadly should practice change?",
      },
    ],
  };

  const results = buildTranscriptSearchResults([{ source, transcript }], "PROTEUS");
  assert.equal(results.totalMatchCount, 2);
  assert.equal(results.shownMatchCount, 2);
  assert.equal(results.groups.length, 1);
  assert.deepEqual(
    results.groups[0].matches.map((match) => match.matchKind),
    ["Source metadata", "Transcript wording"],
  );
  assert.match(results.groups[0].matches[1].contextText, /PROTEUS result/i);
});

test("review reducer operations are immutable and local state survives a reload", () => {
  const record = REVIEWER_QUESTION_RECORDS[0];
  const claimId = record.claims[0].claimId;
  const created = createEmptyReviewRecord(
    record.questionId,
    record.versionId,
    record.claims.map((claim) => claim.claimId),
    "2026-08-29T12:00:00.000Z",
  );
  assert.ok(Object.values(created.claimStatuses).every((status) => status === "unreviewed"));
  assert.equal(created.editorialDecision, "undecided");

  const supported = updateClaimStatus(
    created,
    claimId,
    "supported",
    "2026-08-29T12:01:00.000Z",
  );
  const noted = updateClaimNote(
    supported,
    claimId,
    "Support checked against the cited moment.",
    "2026-08-29T12:02:00.000Z",
  );
  const overall = updateOverallNote(
    noted,
    "Return only if the remaining facts cannot be independently checked.",
    "2026-08-29T12:03:00.000Z",
  );
  const approved = setEditorialDecision(
    overall,
    "approved",
    "Editorial language approved; publication gates remain.",
    "2026-08-29T12:04:00.000Z",
  );

  assert.equal(created.claimStatuses[claimId], "unreviewed");
  assert.equal(approved.claimStatuses[claimId], "supported");
  assert.equal(approved.claimNotes[claimId], "Support checked against the cited moment.");
  assert.equal(approved.editorialDecision, "approved");
  assert.notEqual(approved, created);

  const storage = memoryStorage();
  const stored = persistReviewRecord(storage, approved);
  assert.equal(stored.schemaVersion, REVIEW_STORE_SCHEMA_VERSION);
  assert.equal(stored.reviews[reviewKey(record.questionId, record.versionId)].overallNote, overall.overallNote);
  assert.ok(storage.dump(REVIEW_STORE_KEY));

  const reloaded = loadReviewRecord(
    storage,
    record.questionId,
    record.versionId,
    record.claims.map((claim) => claim.claimId),
  );
  assert.deepEqual(reloaded, approved);

  const mismatchedIdentity = memoryStorage({
    [REVIEW_STORE_KEY]: JSON.stringify({
      schemaVersion: REVIEW_STORE_SCHEMA_VERSION,
      reviews: {
        [reviewKey(record.questionId, record.versionId)]: {
          ...approved,
          questionId: "different-question",
          versionId: "different-version",
        },
      },
    }),
  });
  const identityReset = loadReviewRecord(
    mismatchedIdentity,
    record.questionId,
    record.versionId,
    record.claims.map((claim) => claim.claimId),
    "2026-08-29T12:10:00.000Z",
  );
  assert.equal(identityReset.questionId, record.questionId);
  assert.equal(identityReset.versionId, record.versionId);
  assert.equal(identityReset.editorialDecision, "undecided");

  const corrupted = memoryStorage({ [REVIEW_STORE_KEY]: "not-json" });
  assert.deepEqual(loadReviewStore(corrupted), {
    schemaVersion: REVIEW_STORE_SCHEMA_VERSION,
    reviews: {},
  });
  assert.throws(
    () => persistReviewRecord(corrupted, approved),
    /unreadable; refusing to overwrite/i,
  );
  assert.equal(corrupted.dump(REVIEW_STORE_KEY), "not-json");
  const wrongSchema = memoryStorage({
    [REVIEW_STORE_KEY]: JSON.stringify({ schemaVersion: 999, reviews: { unsafe: approved } }),
  });
  assert.deepEqual(loadReviewStore(wrongSchema).reviews, {});
  const wrongSchemaRaw = wrongSchema.dump(REVIEW_STORE_KEY);
  assert.throws(
    () => persistReviewRecord(wrongSchema, approved),
    /invalid; refusing to overwrite/i,
  );
  assert.equal(wrongSchema.dump(REVIEW_STORE_KEY), wrongSchemaRaw);

  assert.throws(
    () => persistReviewRecord(memoryStorage(), {
      ...approved,
      editorialDecision: "published",
    }),
    /review record is invalid/i,
  );

  for (const tamperedReview of [
    {
      ...approved,
      claimStatuses: { ...approved.claimStatuses, [claimId]: "auto-approved" },
    },
    {
      ...approved,
      claimNotes: { [claimId]: { unsafe: "not a string" } },
    },
    {
      ...approved,
      editorialDecision: "published",
    },
  ]) {
    const tampered = memoryStorage({
      [REVIEW_STORE_KEY]: JSON.stringify({
        schemaVersion: REVIEW_STORE_SCHEMA_VERSION,
        reviews: { unsafe: tamperedReview },
      }),
    });
    assert.deepEqual(loadReviewStore(tampered).reviews, {});
    const tamperedRaw = tampered.dump(REVIEW_STORE_KEY);
    assert.throws(
      () => persistReviewRecord(tampered, approved),
      /invalid; refusing to overwrite/i,
    );
    assert.equal(tampered.dump(REVIEW_STORE_KEY), tamperedRaw);
  }
});

test("publication readiness cannot be cleared by language approval or self-verification", () => {
  const base = REVIEWER_QUESTION_RECORDS.find(
    (record) => record.questionId === "mibc-perioperative-systemic",
  );
  assert.ok(base);
  const allSupported = setEditorialDecision(
    base.claims.reduce(
      (review, claim) => updateClaimStatus(review, claim.claimId, "supported", "2026-08-29T12:00:00.000Z"),
      createEmptyReviewRecord(
        base.questionId,
        base.versionId,
        base.claims.map((claim) => claim.claimId),
        "2026-08-29T12:00:00.000Z",
      ),
    ),
    "approved",
    "Language approved.",
    "2026-08-29T12:00:00.000Z",
  );

  assert.equal(getPublicationReadiness(base, allSupported).ready, false);
  assert.ok(
    getPublicationReadiness(base, allSupported).blockers.some((blocker) => /independent verification/i.test(blocker)),
  );

  const completeEvidence = {
    ...base,
    transcripts: base.transcripts.map((transcript) => {
      const segments = completeTranscriptSegments(
        transcript.sourceId,
        transcript.sourceDurationMs,
      );
      return {
        ...transcript,
        completeness: "complete",
        searchableTranscriptAvailable: true,
        searchScope: "full-conversation",
        assetKind: "publisher-transcript",
        humanAccuracyReviewed: true,
        completeTranscriptAvailable: true,
        availabilityNote: "Complete transcript is loaded and searchable in this test record.",
        origin: "human",
        methodLabel: "Human-produced transcript supplied for this test record.",
        checkedOn: "2026-08-29T12:00:00.000Z",
        segments,
        coverage: evaluateTranscriptCoverage(transcript.sourceDurationMs, segments),
        completenessReceipt: {
          status: "recorded",
          scope: "entire-source-conversation",
          recordedBy: "transcript-asset-reviewer",
          recordedOn: "2026-08-29T12:00:00.000Z",
          transcriptAssetId: `local-test:${transcript.sourceId}`,
          transcriptContentSha256: transcriptContentSha256(segments),
          recordedSegmentCount: segments.length,
          recordedDurationMs: transcript.sourceDurationMs,
          note: "Whole-conversation transcript checked against the complete source audio.",
        },
      };
    }),
    versions: base.versions.map((version) => ({
      ...version,
      snapshotCoverage: version.snapshot ? "full-reader-core" : version.snapshotCoverage,
    })),
    independentVerification: {
      required: true,
      status: "complete",
      reason: "Changed facts independently checked.",
      completedBy: "different-qualified-human",
      completedOn: "2026-08-29T12:00:00.000Z",
    },
    interpretiveReview: {
      required: true,
      status: "complete",
      reasons: ["Risk-based test review."],
      completedBy: "different-qualified-human",
      completedOn: "2026-08-29T12:00:00.000Z",
    },
  };
  assert.deepEqual(getPublicationReadiness(completeEvidence, allSupported), {
    ready: true,
    blockers: [],
  });

  const selfVerified = {
    ...completeEvidence,
    independentVerification: {
      ...completeEvidence.independentVerification,
      completedBy: completeEvidence.accountableEditorId,
    },
  };
  const selfReadiness = getPublicationReadiness(selfVerified, allSupported);
  assert.equal(selfReadiness.ready, false);
  assert.ok(selfReadiness.blockers.some((blocker) => /someone other than the accountable editor/i.test(blocker)));

  const selfInterpreted = {
    ...completeEvidence,
    interpretiveReview: {
      ...completeEvidence.interpretiveReview,
      completedBy: completeEvidence.accountableEditorId,
    },
  };
  assert.ok(
    getPublicationReadiness(selfInterpreted, allSupported).blockers.some(
      (blocker) => /interpretive review must be completed by someone other/i.test(blocker),
    ),
  );

  for (const missingCompletion of [
    {
      ...completeEvidence,
      independentVerification: {
        ...completeEvidence.independentVerification,
        completedBy: null,
        completedOn: null,
      },
    },
    {
      ...completeEvidence,
      interpretiveReview: {
        ...completeEvidence.interpretiveReview,
        completedBy: " ",
        completedOn: "not-a-date",
      },
    },
  ]) {
    assert.ok(
      getPublicationReadiness(missingCompletion, allSupported).blockers.some(
        (blocker) => /requires a (?:reviewer|verifier) identity and valid completion time/i.test(blocker),
      ),
    );
  }

  const spoofedTranscript = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript, index) => index === 0
      ? {
          ...transcript,
          origin: "unknown",
          checkedOn: "",
          segments: [{
            id: "summary-spoof",
            sourceId: transcript.sourceId,
            startMs: 0,
            endMs: transcript.coverage.durationMs,
            timestamp: "0:00",
            text: "Short summary.",
          }],
          coverage: evaluateTranscriptCoverage(transcript.coverage.durationMs, [{
            id: "summary-spoof",
            sourceId: transcript.sourceId,
            startMs: 0,
            endMs: transcript.coverage.durationMs,
            timestamp: "0:00",
            text: "Short summary.",
          }]),
          completenessReceipt: {
            ...transcript.completenessReceipt,
            status: "not-recorded",
            recordedBy: null,
            recordedOn: null,
          },
        }
      : transcript),
  };
  assert.ok(
    getPublicationReadiness(spoofedTranscript, allSupported).blockers.some(
      (blocker) => /transcript|complete searchable/i.test(blocker),
    ),
  );

  const segmentedSummary = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript, index) => {
      if (index !== 0) return transcript;
      const segments = [];
      for (let startMs = 0, segmentIndex = 0; startMs < transcript.coverage.durationMs; startMs += 60_000, segmentIndex += 1) {
        const endMs = Math.min(transcript.coverage.durationMs, startMs + 60_000);
        const summaryWordCount = Math.max(1, Math.ceil(((endMs - startMs) / 60_000) * 75));
        segments.push({
          id: `segmented-summary-${segmentIndex}`,
          sourceId: transcript.sourceId,
          startMs,
          endMs,
          timestamp: `${Math.floor(startMs / 60_000)}:00`,
          text: Array.from({ length: summaryWordCount }, () => "summary").join(" "),
        });
      }
      return {
        ...transcript,
        segments,
        coverage: evaluateTranscriptCoverage(transcript.coverage.durationMs, segments),
        completenessReceipt: {
          ...transcript.completenessReceipt,
          transcriptContentSha256: transcriptContentSha256(segments),
          recordedSegmentCount: segments.length,
        },
      };
    }),
  };
  assert.equal(segmentedSummary.transcripts[0].coverage.textDensityPlausible, true);
  assert.equal(segmentedSummary.transcripts[0].coverage.lexicalDiversityPlausible, false);
  assert.ok(
    getPublicationReadiness(segmentedSummary, allSupported).blockers.some(
      (blocker) => /transcript|complete searchable/i.test(blocker),
    ),
  );

  const staleCoverageSpoof = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript, index) => {
      if (index !== 0) return transcript;
      const segments = segmentedSummary.transcripts[0].segments;
      return {
        ...transcript,
        segments,
        // Deliberately retain the previously valid coverage object.
        completenessReceipt: {
          ...transcript.completenessReceipt,
          transcriptContentSha256: transcriptContentSha256(segments),
          recordedSegmentCount: segments.length,
        },
      };
    }),
  };
  assert.equal(staleCoverageSpoof.transcripts[0].coverage.validatedComplete, true);
  assert.ok(
    getPublicationReadiness(staleCoverageSpoof, allSupported).blockers.some(
      (blocker) => /transcript|complete searchable/i.test(blocker),
    ),
  );

  const shortenedDurationSpoof = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript, index) => {
      if (index !== 0) return transcript;
      const shortenedDurationMs = 120_000;
      const segments = completeTranscriptSegments(transcript.sourceId, shortenedDurationMs);
      return {
        ...transcript,
        sourceDurationMs: shortenedDurationMs,
        segments,
        coverage: evaluateTranscriptCoverage(shortenedDurationMs, segments),
        completenessReceipt: {
          ...transcript.completenessReceipt,
          transcriptContentSha256: transcriptContentSha256(segments),
          recordedSegmentCount: segments.length,
          recordedDurationMs: shortenedDurationMs,
        },
      };
    }),
  };
  assert.equal(shortenedDurationSpoof.transcripts[0].coverage.validatedComplete, true);
  assert.ok(
    getPublicationReadiness(shortenedDurationSpoof, allSupported).blockers.some(
      (blocker) => /authoritative source duration|complete searchable transcript/i.test(blocker),
    ),
  );

  const wrongSourceSegments = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript, index) => {
      if (index !== 0) return transcript;
      const segments = transcript.segments.map((segment) => ({
        ...segment,
        sourceId: "different-episode",
      }));
      return {
        ...transcript,
        segments,
        coverage: evaluateTranscriptCoverage(transcript.sourceDurationMs, segments),
        completenessReceipt: {
          ...transcript.completenessReceipt,
          transcriptContentSha256: transcriptContentSha256(segments),
        },
      };
    }),
  };
  assert.equal(wrongSourceSegments.transcripts[0].coverage.validatedComplete, true);
  assert.ok(
    getPublicationReadiness(wrongSourceSegments, allSupported).blockers.some(
      (blocker) => /transcript|complete searchable/i.test(blocker),
    ),
  );

  const mutatedAfterReceipt = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript, index) => index === 0
      ? {
          ...transcript,
          segments: transcript.segments.map((segment, segmentIndex) => segmentIndex === 0
            ? { ...segment, text: `${segment.text} changed-after-attestation` }
            : segment),
        }
      : transcript),
  };
  assert.ok(
    getPublicationReadiness(mutatedAfterReceipt, allSupported).blockers.some(
      (blocker) => /transcript|complete searchable/i.test(blocker),
    ),
  );

  const mismatchedReceiptHash = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript, index) => index === 0
      ? {
          ...transcript,
          completenessReceipt: {
            ...transcript.completenessReceipt,
            transcriptContentSha256: `sha256:${"0".repeat(64)}`,
          },
        }
      : transcript),
  };
  assert.ok(
    getPublicationReadiness(mismatchedReceiptHash, allSupported).blockers.some(
      (blocker) => /transcript|complete searchable/i.test(blocker),
    ),
  );

  const unsupported = updateClaimStatus(
    allSupported,
    base.claims[0].claimId,
    "unsupported",
    "2026-08-29T12:05:00.000Z",
  );
  assert.ok(getPublicationReadiness(completeEvidence, unsupported).blockers.some((blocker) => /marked unsupported/i.test(blocker)));

  const danglingEvidence = {
    ...completeEvidence,
    claims: completeEvidence.claims.map((claim, index) => index === 0
      ? { ...claim, evidencePassageIds: [...claim.evidencePassageIds, "missing-passage"] }
      : claim),
  };
  assert.ok(
    getPublicationReadiness(danglingEvidence, allSupported).blockers.some(
      (blocker) => /maps to missing passage missing-passage/i.test(blocker),
    ),
  );

  const citedPassageId = completeEvidence.claims
    .flatMap((claim) => claim.evidencePassageIds)[0];
  const citedPassage = completeEvidence.passages.find(
    (passage) => passage.id === citedPassageId,
  );
  const citedTranscript = completeEvidence.transcripts.find(
    (transcript) => transcript.sourceId === citedPassage?.sourceId,
  );
  assert.ok(citedTranscript);
  const desynchronizedPassageCache = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript) =>
      transcript.sourceId === citedTranscript.sourceId
        ? { ...transcript, passageIds: [] }
        : transcript,
    ),
  };
  assert.ok(
    getPublicationReadiness(desynchronizedPassageCache, allSupported).blockers.some(
      (blocker) => /does not match the cited passage set/i.test(blocker),
    ),
  );

  const bypassAttempt = {
    ...completeEvidence,
    transcripts: completeEvidence.transcripts.map((transcript) =>
      transcript.sourceId === citedTranscript.sourceId
        ? {
            ...transcript,
            passageIds: [],
            sourceDurationMs: 1,
            searchableTranscriptAvailable: false,
            completeTranscriptAvailable: false,
            searchScope: "none",
            segments: [],
          }
        : transcript,
    ),
  };
  const bypassBlockers = getPublicationReadiness(bypassAttempt, allSupported).blockers;
  assert.ok(bypassBlockers.some((blocker) => /does not match the cited passage set/i.test(blocker)));
  assert.ok(bypassBlockers.some((blocker) => /authoritative source duration/i.test(blocker)));
  assert.ok(bypassBlockers.some((blocker) => /searchable full-conversation transcript unavailable/i.test(blocker)));

  assert.ok(
    getPublicationReadiness({ ...completeEvidence, claims: [] }, allSupported).blockers.some(
      (blocker) => /requires at least one reviewable claim/i.test(blocker),
    ),
  );

  const accessBase = REVIEWER_QUESTION_RECORDS.find(
    (record) => record.questionId === "metastatic-uc-ev-pembro-access",
  );
  assert.ok(accessBase);
  const accessMaterialPassageIds = new Set(
    accessBase.claims.flatMap((claim) => claim.evidencePassageIds),
  );
  const accessMaterialSourceIds = new Set(
    accessBase.passages
      .filter((passage) => accessMaterialPassageIds.has(passage.id))
      .map((passage) => passage.sourceId),
  );
  assert.equal(accessMaterialSourceIds.has("uromigos-504"), false);
  assert.ok(accessBase.passages.some((passage) => passage.sourceId === "uromigos-504"));
  const accessComplete = {
    ...accessBase,
    transcripts: accessBase.transcripts.map((transcript) => {
      if (!accessMaterialSourceIds.has(transcript.sourceId)) return transcript;
      const segments = completeTranscriptSegments(transcript.sourceId, transcript.sourceDurationMs);
      return {
        ...transcript,
        completeness: "complete",
        searchableTranscriptAvailable: true,
        searchScope: "full-conversation",
        assetKind: "publisher-transcript",
        humanAccuracyReviewed: true,
        completeTranscriptAvailable: true,
        origin: "human",
        methodLabel: "Human-produced transcript supplied for this test record.",
        checkedOn: "2026-08-29T12:00:00.000Z",
        segments,
        coverage: evaluateTranscriptCoverage(transcript.sourceDurationMs, segments),
        completenessReceipt: {
          status: "recorded",
          scope: "entire-source-conversation",
          recordedBy: "transcript-asset-reviewer",
          recordedOn: "2026-08-29T12:00:00.000Z",
          transcriptAssetId: `local-test:${transcript.sourceId}`,
          transcriptContentSha256: transcriptContentSha256(segments),
          recordedSegmentCount: segments.length,
          recordedDurationMs: transcript.sourceDurationMs,
          note: "Whole-conversation transcript checked against the complete source audio.",
        },
      };
    }),
    independentVerification: {
      required: true,
      status: "complete",
      reason: "Changed facts independently checked.",
      completedBy: "different-qualified-human",
      completedOn: "2026-08-29T12:00:00.000Z",
    },
    interpretiveReview: {
      required: true,
      status: "complete",
      reasons: ["Risk-based test review."],
      completedBy: "different-qualified-human",
      completedOn: "2026-08-29T12:00:00.000Z",
    },
  };
  const accessSupported = setEditorialDecision(
    accessBase.claims.reduce(
      (review, claim) => updateClaimStatus(review, claim.claimId, "supported", "2026-08-29T12:00:00.000Z"),
      createEmptyReviewRecord(
        accessBase.questionId,
        accessBase.versionId,
        accessBase.claims.map((claim) => claim.claimId),
        "2026-08-29T12:00:00.000Z",
      ),
    ),
    "approved",
    "Language approved.",
    "2026-08-29T12:00:00.000Z",
  );
  assert.deepEqual(getPublicationReadiness(accessComplete, accessSupported), {
    ready: true,
    blockers: [],
  });

  assert.ok(
    getPublicationReadiness(completeEvidence, {
      ...allSupported,
      questionId: "different-question",
    }).blockers.some((blocker) => /does not match the tracked clinical question/i.test(blocker)),
  );
  assert.ok(
    getPublicationReadiness(completeEvidence, {
      ...allSupported,
      versionId: "different-version",
    }).blockers.some((blocker) => /does not match the current question version/i.test(blocker)),
  );
});

test("review export is deterministic, observable, local, and excludes the correction-test value", () => {
  const record = REVIEWER_QUESTION_RECORDS[0];
  const review = createEmptyReviewRecord(
    record.questionId,
    record.versionId,
    record.claims.map((claim) => claim.claimId),
    "2026-08-29T12:00:00.000Z",
  );
  const first = serializeReviewExport(record, review);
  const second = serializeReviewExport(record, review);
  assert.equal(first, second);
  assert.ok(first.endsWith("\n"));

  const parsed = JSON.parse(first);
  assert.equal(parsed.schema, "canvasmd-rounds-review/v1");
  assert.equal(parsed.question.id, record.questionId);
  assert.equal(parsed.question.versionId, record.versionId);
  assert.equal(parsed.review.editorialDecision, "undecided");
  assert.equal(parsed.evidenceAudit.length, record.claims.length);
  assert.ok(parsed.sourceConversations.length > 0);
  assert.equal(parsed.transcriptInventory.length, record.transcripts.length);
  assert.ok(
    parsed.transcriptInventory.every((transcript) =>
      !("segments" in transcript)
      && transcript.segmentCount === transcript.coverage.segmentCount,
    ),
  );
  assert.equal(
    parsed.versionHistory.length,
    record.versions.filter((version) => version.exportEligible).length,
  );
  assert.deepEqual(parsed.completeTranscriptEditorialAudit, record.editorialAudit);
  assert.equal(parsed.accountableEditorId, record.accountableEditorId);
  assert.ok(parsed.evidenceAudit.some((claim) => claim.evidencePassages.length > 0));
  assert.ok(
    parsed.evidenceAudit
      .flatMap((claim) => claim.evidencePassages)
      .every((passage) => passage.sourceProvenance),
  );
  assert.equal(parsed.publicationReadiness.ready, false);
  assert.doesNotMatch(first, /privateReasoning|internalScratch|rawModelTrace/i);
  assert.doesNotMatch(
    first,
    new RegExp(
      CORRECTION_TEST_FIXTURE.supersededVersion.deliberatelyErroneousFixtureValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    ),
  );

  const mibc = REVIEWER_QUESTION_RECORDS.find(
    (candidate) => candidate.questionId === CORRECTION_TEST_FIXTURE.questionId,
  );
  assert.ok(mibc);
  const syntheticVersion = mibc.versions.find(
    (version) => version.versionId === CORRECTION_TEST_FIXTURE.supersededVersion.versionId,
  );
  assert.equal(syntheticVersion?.exportEligible, false);
  const mibcReview = createEmptyReviewRecord(
    mibc.questionId,
    mibc.versionId,
    mibc.claims.map((claim) => claim.claimId),
    "2026-08-29T12:00:00.000Z",
  );
  const mibcExport = serializeReviewExport(mibc, mibcReview);
  const parsedMibcExport = JSON.parse(mibcExport);
  assert.deepEqual(
    parsedMibcExport.versionHistory.map((version) => version.versionId),
    mibc.versions.filter((version) => version.exportEligible).map((version) => version.versionId),
  );
  assert.doesNotMatch(mibcExport, /v0-correction-test|Clinical-fact correction fixture|prior test-only version/i);
});

test("the deliberately wrong correction fixture is current-ineligible and reviewer-history-only", () => {
  assert.equal(assertCorrectionFixtureSafe(), true);
  assert.equal(CORRECTION_TEST_FIXTURE.correctionTestOnly, true);
  assert.equal(CORRECTION_TEST_FIXTURE.eligibleAsCurrent, false);
  assert.equal(CORRECTION_TEST_FIXTURE.allowedSurface, "reviewer-correction-history-only");
  assert.equal(
    CORRECTION_TEST_FIXTURE.correction.independentHumanVerification,
    "required-not-recorded",
  );
  assert.equal(
    canRenderCorrectionOnSurface(CORRECTION_TEST_FIXTURE, CORRECTION_ALLOWED_SURFACE),
    true,
  );
  for (const surface of ["reader", "search", "recommendation", "export", "production", "non-rounds"]) {
    assert.equal(canRenderCorrectionOnSurface(CORRECTION_TEST_FIXTURE, surface), false);
  }

  for (const unsafe of [
    { ...CORRECTION_TEST_FIXTURE, correctionTestOnly: false },
    { ...CORRECTION_TEST_FIXTURE, eligibleAsCurrent: true },
    { ...CORRECTION_TEST_FIXTURE, allowedSurface: "reader" },
    {
      ...CORRECTION_TEST_FIXTURE,
      correction: {
        ...CORRECTION_TEST_FIXTURE.correction,
        independentHumanVerification: "complete",
      },
    },
  ]) {
    assert.throws(() => assertCorrectionFixtureSafe(unsafe), /Unsafe Rounds correction fixture configuration/);
  }

  const wrongValue = CORRECTION_TEST_FIXTURE.supersededVersion.deliberatelyErroneousFixtureValue;
  assert.doesNotMatch(JSON.stringify(LOCAL_ROUNDS_BRIEFS), /DELIBERATELY ERRONEOUS TEST VALUE/i);
  assert.equal(readerFixture.includes(wrongValue), false);
  assert.equal(readerView.includes(wrongValue), false);
  assert.match(reviewerView, /reviewer-correction/i);
  assert.match(reviewerView, /Previous version — corrected · test-only workflow/i);
  assert.match(reviewerView, /cannot be current, searched by readers,\s*or rendered on another surface/i);
});

test("real and reviewer-only corrections both trigger interpretive review without leaking into exports", () => {
  const mibc = REVIEWER_QUESTION_RECORDS.find(
    (record) => record.questionId === "mibc-perioperative-systemic",
  );
  const fgfr = REVIEWER_QUESTION_RECORDS.find(
    (record) => record.questionId === "nmibc-fgfr-intravesical",
  );
  assert.ok(mibc);
  assert.ok(fgfr);
  assert.ok(mibc.interpretiveReview.reasons.some((reason) => /correction history/i.test(reason)));
  assert.ok(fgfr.interpretiveReview.reasons.some((reason) => /correction history/i.test(reason)));
});

test("the workbench uses the exact reader component and exposes review—not publish—controls", () => {
  assert.match(reviewerView, /import \{ RoundsBrief \} from "\.\.\/RoundsBrief(?:\.tsx)?"/);
  assert.doesNotMatch(reviewerView, /readerFacingCopy/);
  assert.match(reviewerView, /<RoundsBrief[\s\S]*brief=\{brief\}[\s\S]*onListen=\{onListen\}/);
  assert.match(reviewerView, /Clinical question/i);
  assert.match(reviewerView, /What the clinician will read/i);
  assert.match(reviewerView, /1 · Review claims/i);
  assert.match(reviewerView, /2 · Check sources/i);
  assert.match(reviewerView, /3 · Decide/i);
  assert.match(reviewerView, /Evidence used/i);
  assert.match(reviewerView, /\{claim\.claimText\}/);
  assert.match(reviewerView, /\{selectedClaim\.claimText\}/);
  assert.match(reviewerView, /Qualifiers, exclusions, and wording history/i);
  assert.match(reviewerView, /Episode support/i);
  assert.match(reviewerView, /Independence group/i);
  assert.match(reviewerView, /Completeness receipt/i);
  assert.match(reviewerView, /Your review/i);
  assert.match(reviewerView, /Reviewer note for this claim/i);
  assert.match(reviewerView, /Approve editorial language/i);
  assert.match(reviewerView, /Return for revision/i);
  assert.match(reviewerView, /Export review record · no full transcripts/i);
  assert.match(reviewerView, /Saved locally/i);
  assert.match(reviewerView, /No publish control exists here/i);
  assert.match(reviewerView, /Why additional review is required/i);
  assert.match(reviewerView, /full-reader-core/i);
  assert.doesNotMatch(reviewerView, />\s*Publish(?: now)?\s*</i);
  assert.match(reviewerView, /localStorage/);
  assert.match(reviewerView, /window\.setTimeout\(\(\) =>/);
  assert.match(reviewerView, /\}, 250\)/);
  assert.match(reviewerView, /Existing review records were left untouched/);
  assert.match(reviewerView, /className="reviewer-storage-error" role="alert"/);
  assert.match(reviewerView, /storageError[\s\S]*\? "Not saved"/);
  assert.match(reviewerCss, /\.reviewer-storage-error\s*\{[^}]*background:\s*#fff1ec;/);
  assert.match(reviewerView, /no reader tracking · no production writes/i);
});

test("reviewer deep links resolve on the server and hydrate the same question", () => {
  assert.match(reviewerPage, /searchParams\?: \{ question\?: string \| string\[\] \}/);
  assert.match(reviewerPage, /requestedQuestion && !findRoundsQuestion\(requestedQuestion, LOCAL_ROUNDS_BRIEFS\)\) notFound\(\)/);
  assert.match(reviewerPage, /initialQuestionId=\{requestedQuestion\}[\s\S]*questionRecords=\{questionRecords\}/);
  assert.match(reviewerView, /resolvedInitialQuestionId\(initialQuestionId, questionRecords\)/);
  assert.doesNotMatch(reviewerView, /window\.location\.search/);
});

test("the reviewer workbench remains keyboard-legible and responsive without dashboard chrome", () => {
  assert.match(reviewerView, /role="tablist"/);
  assert.match(reviewerView, /role="tab"/);
  assert.match(reviewerView, /aria-selected=\{view === value\}/);
  assert.match(reviewerView, /aria-controls=/);
  assert.match(reviewerView, /role="tabpanel"/);
  assert.match(reviewerView, /aria-labelledby=/);
  assert.match(reviewerView, /event\.key === "ArrowRight"/);
  assert.match(reviewerView, /event\.key === "ArrowLeft"/);
  assert.match(reviewerView, /event\.key === "Home"/);
  assert.match(reviewerView, /event\.key === "End"/);
  assert.match(reviewerView, /Skip to review workspace/i);
  assert.match(reviewerView, /data-reviewer-claim-id/);
  assert.match(reviewerView, /tabIndex=\{active \? 0 : -1\}/);
  assert.match(reviewerView, /role="tablist"/);
  assert.match(reviewerView, /role="tab"/);
  assert.match(reviewerView, /aria-selected=\{active\}/);
  assert.match(reviewerView, /claimDetail\?\.focus\(\)/);
  assert.match(reviewerView, /claimDetail\?\.scrollIntoView/);
  assert.match(reviewerView, /aria-pressed=/);
  assert.match(reviewerView, /aria-live="polite"/);
  assert.match(reviewerCss, /\.reviewer-shell button:focus-visible/);
  assert.match(reviewerCss, /@media \(max-width: 1020px\)[\s\S]*\.reviewer-layout\s*\{\s*display:\s*block;/);
  assert.match(reviewerCss, /@media \(max-width: 700px\)/);
  assert.match(reviewerCss, /\.reviewer-masthead-copy span:first-child,[\s\S]*display:\s*none;/);
  assert.match(reviewerCss, /\.reviewer-transcript-result-group-heading span\s*\{[^}]*font-size:\s*9px;/);
  assert.match(reviewerCss, /\.reviewer-transcript-results article header span\s*\{[^}]*font-size:\s*9px;/);
  assert.match(reviewerCss, /\.reviewer-question-picker select,[\s\S]*font-size:\s*16px;/);
  assert.match(reviewerCss, /\.reviewer-skip-link:focus/);
  assert.match(reviewerCss, /\.reviewer-view-tabs\s*\{[^}]*overflow-x:\s*auto;/);
  assert.match(reviewerCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(reviewerCss, /border-radius:\s*(?:8|10|12|16|20|24)px/g);
});
