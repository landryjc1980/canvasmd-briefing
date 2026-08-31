import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

import { LOCAL_ROUNDS_BRIEFS } from "../../fixture.ts";
import { evaluateTranscriptCoverage } from "../../reviewModel.ts";
import { LOCAL_TRANSCRIPT_MANIFEST } from "./manifest.ts";
import { parseSrt } from "./parseSrt.ts";

const fixtureSourceIds = [...new Set(
  LOCAL_ROUNDS_BRIEFS.flatMap((brief) => brief.sources.map((source) => source.id)),
)].sort();
const manifestEntries = Object.values(LOCAL_TRANSCRIPT_MANIFEST);
const manifestSourceIds = manifestEntries.flatMap((entry) => entry.sourceIds).sort();

assert.deepEqual(
  manifestSourceIds,
  fixtureSourceIds,
  "The local transcript manifest must cover every source conversation exactly once.",
);
assert.equal(
  new Set(manifestSourceIds).size,
  manifestSourceIds.length,
  "A source conversation cannot resolve to more than one local transcript asset.",
);

const inventory = [];
for (const entry of manifestEntries) {
  assert.doesNotMatch(entry.srtPath, /\/private\/tmp/u);
  assert.match(entry.srtPath, /\/transcripts\/local-assets\//u);
  if (entry.audioPath) {
    assert.doesNotMatch(entry.audioPath, /\/private\/tmp/u);
    assert.match(entry.audioPath, /\/transcripts\/local-assets\//u);
    await access(entry.audioPath);
  }
  const raw = await readFile(entry.srtPath, "utf8");
  const sourceFileSha256 = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
  assert.equal(
    sourceFileSha256,
    entry.sourceFileSha256,
    `${entry.assetId} does not match its allowlisted transcript digest.`,
  );
  const parsed = parseSrt(raw, entry.assetId);
  const sourceId = entry.sourceIds[0];
  const segments = parsed.map((segment, index) => ({
    id: `${entry.assetId}:verification:${index + 1}`,
    sourceId,
    startMs: segment.startMs,
    endMs: segment.endMs,
    timestamp: String(segment.startMs),
    text: segment.text,
  }));
  const coverage = evaluateTranscriptCoverage(entry.sourceDurationMs, segments);
  const spansFullConversation = Boolean(
    coverage.segmentCount > 0
    && coverage.startsAtMs !== null
    && coverage.startsAtMs <= 15_000
    && coverage.endsAtMs !== null
    && coverage.endsAtMs >= entry.sourceDurationMs - 15_000
    && coverage.maximumGapMs !== null
    && coverage.maximumGapMs <= 30_000
    && coverage.coverageRatio >= 0.94
    && coverage.granular
    && coverage.textDensityPlausible
    && coverage.lexicalDiversityPlausible
  );

  assert.equal(
    spansFullConversation,
    true,
    `${entry.assetId} does not satisfy searchable full-conversation coverage.`,
  );
  inventory.push({
    assetId: entry.assetId,
    sourceIds: entry.sourceIds,
    cueCount: coverage.segmentCount,
    temporalCoveragePercent: Math.round(coverage.coverageRatio * 1_000) / 10,
    sha256: sourceFileSha256,
  });
}

console.log(JSON.stringify({
  verifiedAssets: inventory.length,
  coveredSourceConversations: manifestSourceIds.length,
  inventory,
}, null, 2));
