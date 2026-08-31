import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { evaluateTranscriptCoverage } from "../../reviewModel";
import type { TranscriptSegment } from "../../reviewModel";
import { LOCAL_TRANSCRIPT_MANIFEST } from "./manifest";
import { parseSrt } from "./parseSrt";
import type {
  LocalTranscriptAsset,
  LocalTranscriptAssetMap,
  LocalTranscriptLoadResult,
  LocalTranscriptManifestEntry,
} from "./types";

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function timestamp(startMs: number): string {
  const totalSeconds = Math.floor(startMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function loadEntry(
  entry: LocalTranscriptManifestEntry,
): Promise<LocalTranscriptAsset> {
  const raw = await readFile(entry.srtPath, "utf8");
  const sourceFileSha256 = sha256(raw);
  if (sourceFileSha256 !== entry.sourceFileSha256) {
    throw new Error(`${entry.assetId} failed its allowlisted transcript digest check.`);
  }
  const parsed = parseSrt(raw, entry.srtPath);
  const segments: TranscriptSegment[] = parsed.map((segment, index) => ({
    id: `${entry.assetId}:local-srt:${index + 1}`,
    sourceId: entry.sourceIds[0],
    startMs: segment.startMs,
    endMs: segment.endMs,
    timestamp: timestamp(segment.startMs),
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
  if (entry.searchScope === "full-conversation" && !spansFullConversation) {
    throw new Error(
      `${entry.assetId} failed searchable full-conversation coverage validation.`,
    );
  }

  return {
    assetId: entry.assetId,
    sourceIds: entry.sourceIds,
    show: entry.show,
    episodeTitle: entry.episodeTitle,
    sourceDurationMs: entry.sourceDurationMs,
    segments,
    coverage,
    completeness:
      entry.completeness === "complete"
      && coverage.validatedComplete
      && entry.provenance.humanAccuracyReviewed
      && entry.provenance.wholeConversationAttested
        ? "complete"
        : "partial",
    searchScope: entry.searchScope,
    assetKind: entry.assetKind,
    transcriptUrl: entry.transcriptUrl,
    sourceFileSha256,
    segmentPayloadSha256: sha256(JSON.stringify(segments)),
    provenance: entry.provenance,
  };
}

/**
 * Loads only explicitly allowlisted files from the local review cache.
 * The guard is intentionally inside the loader so a production build can type
 * check this module without gaining a production transcript data path.
 */
export async function loadLocalTranscriptAssets(): Promise<LocalTranscriptLoadResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local transcript fixtures are disabled in production.");
  }

  const manifest: Readonly<Record<string, LocalTranscriptManifestEntry>> =
    LOCAL_TRANSCRIPT_MANIFEST;
  const ids = Object.keys(manifest);
  const settled = await Promise.allSettled(
    ids.map(async (id) => [id, await loadEntry(manifest[id])] as const),
  );
  const assets: Record<string, LocalTranscriptAsset> = {};
  const issues: LocalTranscriptLoadResult["issues"][number][] = [];
  settled.forEach((result, index) => {
    const entry = manifest[ids[index]];
    if (result.status === "rejected") {
      issues.push({
        assetId: entry.assetId,
        sourceIds: entry.sourceIds,
        message: "The allowlisted local transcript could not be loaded or validated.",
      });
      return;
    }
    const [, asset] = result.value;
    for (const sourceId of asset.sourceIds) assets[sourceId] = asset;
  });
  return { assets: assets as LocalTranscriptAssetMap, issues };
}
