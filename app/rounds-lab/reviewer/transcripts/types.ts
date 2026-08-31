import type {
  TranscriptAssetKind,
  TranscriptCompleteness,
  TranscriptCoverage,
  TranscriptOrigin,
  TranscriptSearchScope,
  TranscriptSegment,
} from "../../reviewModel";

export type LocalTranscriptAssetId = string;

export type LocalTranscriptManifestEntry = {
  assetId: LocalTranscriptAssetId;
  sourceIds: readonly string[];
  show: string;
  episodeTitle: string;
  srtPath: string;
  audioPath?: string;
  sourceFileSha256: `sha256:${string}`;
  sourceDurationMs: number;
  durationBasis: string;
  transcriptUrl?: string;
  completeness: TranscriptCompleteness;
  searchScope: TranscriptSearchScope;
  assetKind: TranscriptAssetKind;
  provenance: {
    origin: TranscriptOrigin;
    transcriptionMethod: string;
    methodLabel: string;
    humanAccuracyReviewed: false;
    wholeConversationAttested: false;
    inventoryCheckedOn: string;
    note: string;
  };
};

export type LocalTranscriptAsset = {
  assetId: LocalTranscriptAssetId;
  sourceIds: readonly string[];
  show: string;
  episodeTitle: string;
  sourceDurationMs: number;
  segments: TranscriptSegment[];
  coverage: TranscriptCoverage;
  completeness: TranscriptCompleteness;
  searchScope: TranscriptSearchScope;
  assetKind: TranscriptAssetKind;
  transcriptUrl?: string;
  sourceFileSha256: `sha256:${string}`;
  segmentPayloadSha256: `sha256:${string}`;
  provenance: LocalTranscriptManifestEntry["provenance"];
};

export type LocalTranscriptAssetMap = Readonly<
  Record<string, LocalTranscriptAsset>
>;

export type LocalTranscriptLoadIssue = {
  assetId: string;
  sourceIds: readonly string[];
  message: string;
};

export type LocalTranscriptLoadResult = {
  assets: LocalTranscriptAssetMap;
  issues: readonly LocalTranscriptLoadIssue[];
};
