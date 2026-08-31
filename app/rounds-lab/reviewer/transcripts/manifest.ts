import { resolve } from "node:path";

import type {
  LocalTranscriptAssetId,
  LocalTranscriptManifestEntry,
} from "./types";

const INVENTORY_CHECKED_ON = "2026-08-30";
const LOCAL_ASSET_ROOT = resolve(
  process.cwd(),
  "app/rounds-lab/reviewer/transcripts/local-assets",
);

function localAssetPath(filename: string): string {
  return resolve(LOCAL_ASSET_ROOT, filename);
}

const LOCAL_WHISPER_PROVENANCE = {
  origin: "machine",
  transcriptionMethod: "whisper.cpp · ggml-base.en.bin",
  methodLabel:
    "Local machine transcript generated from the full public episode audio with whisper.cpp and the base.en model.",
  humanAccuracyReviewed: false,
  wholeConversationAttested: false,
  inventoryCheckedOn: INVENTORY_CHECKED_ON,
  note:
    "Full-episode audio was processed locally. Temporal span can be checked mechanically; word accuracy and whole-conversation completeness have not been attested by a human reviewer.",
} as const;

const UNATTESTED_LOCAL_CACHE_PROVENANCE = {
  origin: "machine",
  transcriptionMethod: "unknown",
  methodLabel:
    "Machine transcript found in the local review cache; the generating model, settings, and operator are not recorded in this fixture.",
  humanAccuracyReviewed: false,
  wholeConversationAttested: false,
  inventoryCheckedOn: INVENTORY_CHECKED_ON,
  note:
    "Full-duration timing coverage can be checked mechanically. Accuracy and whole-conversation completeness have not been attested by a human reviewer.",
} as const;

const PUBLISHER_TRANSCRIPT_PROVENANCE = {
  origin: "publisher",
  transcriptionMethod: "publisher-provided SRT",
  methodLabel:
    "Publisher-provided SRT declared in the episode RSS feed; the captioning method is not stated.",
  humanAccuracyReviewed: false,
  wholeConversationAttested: false,
  inventoryCheckedOn: INVENTORY_CHECKED_ON,
  note:
    "The publisher transcript spans the substantive conversation but omits several opening and closing seconds. CanvasMD has not independently reviewed its word accuracy.",
} as const;

export const LOCAL_TRANSCRIPT_MANIFEST = {
  "uromigos-508": {
    assetId: "uromigos-508",
    sourceIds: ["uromigos-508"],
    show: "The Uromigos",
    episodeTitle:
      "Episode 508: ASCO 2026 Plenary — PROTEUS: ADT ± Apalutamide in High-Risk Localized Prostate Cancer",
    srtPath: localAssetPath("uromigos-508.srt"),
    sourceFileSha256: "sha256:71074ada2aceb09142cbd6ae43e24e18117895a5b1e0b01615742d26ee6b5a4d",
    sourceDurationMs: 2_380_000,
    durationBasis: "Episode RSS duration: 00:39:40.",
    transcriptUrl:
      "https://transcript-files.spotifycdn.com/76FisfhWQzfDM6Etx0vJkL/1mELPrug5OjxKiHfC91YtL/transcript.srt",
    completeness: "partial",
    searchScope: "full-conversation",
    assetKind: "publisher-transcript",
    provenance: PUBLISHER_TRANSCRIPT_PROVENANCE,
  },
  "uromigos-515": {
    assetId: "uromigos-515",
    sourceIds: ["uromigos-515"],
    show: "The Uromigos",
    episodeTitle: "Episode 515: PROTEUS — A Reflection on the Data and Controversies",
    srtPath: localAssetPath("uromigos-515.machine.srt"),
    audioPath: localAssetPath("uromigos-515.m4a"),
    sourceFileSha256: "sha256:19205be84bb1d9c4021887625fe7edda4f53916b5cefb60fb86b93b82fa719c3",
    sourceDurationMs: 2_586_000,
    durationBasis:
      "Episode fixture/RSS duration: 00:43:06 (local audio probes at 2,586,417 ms).",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: UNATTESTED_LOCAL_CACHE_PROVENANCE,
  },
  "eau-proteus": {
    assetId: "eau-proteus",
    sourceIds: ["eau-proteus"],
    show: "EAU Podcasts",
    episodeTitle: "PROTEUS Trial and High-Risk Prostate Cancer",
    srtPath: localAssetPath("eau-proteus.machine.srt"),
    audioPath: localAssetPath("eau-proteus.mp3"),
    sourceFileSha256: "sha256:d3cb881c43d1f9727d0a50585fc51a468a88e48f0a56c9ac9fc71d9ea4276800",
    sourceDurationMs: 1_538_000,
    durationBasis: "Episode fixture duration: 00:25:38.",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: LOCAL_WHISPER_PROVENANCE,
  },
  "gu-cast-proteus": {
    assetId: "gu-cast-proteus",
    sourceIds: ["gu-cast-proteus"],
    show: "GU Cast | Urology Podcast",
    episodeTitle: "Did PROTEUS Just Change Urology?",
    srtPath: localAssetPath("gu-cast-proteus.machine.srt"),
    audioPath: localAssetPath("gu-cast-proteus.mp3"),
    sourceFileSha256: "sha256:a14abb5e663b7cdd25d3e1bf4b041ae0ed520b83130383c3cea16ca268b7a88b",
    sourceDurationMs: 2_360_000,
    durationBasis:
      "Episode fixture/RSS duration: 00:39:20 (local audio probes at 2,360,514 ms).",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: UNATTESTED_LOCAL_CACHE_PROVENANCE,
  },
  "gu-cast-mibc": {
    assetId: "gu-cast-mibc",
    sourceIds: ["gu-cast-mibc", "gu-cast-ev-302"],
    show: "GU Cast | Urology Podcast",
    episodeTitle: "EV-pembro in localised and advanced bladder cancer — a superb summary!",
    srtPath: localAssetPath("gu-cast-mibc.machine.srt"),
    audioPath: localAssetPath("gu-cast-mibc.mp3"),
    sourceFileSha256: "sha256:95b88b8cee56f7837c0842dd875421bfa212b2ba2a8651ec4963138521e234c7",
    sourceDurationMs: 1_964_000,
    durationBasis: "Episode fixture/RSS duration: 00:32:44.",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: LOCAL_WHISPER_PROVENANCE,
  },
  "poc-mibc": {
    assetId: "poc-mibc",
    sourceIds: ["poc-mibc"],
    show: "Hematology / Oncology @Point of Care Podcasts",
    episodeTitle: "S32:E2 — Perioperative MIBC: Treatment Selection in Practice",
    srtPath: localAssetPath("poc-mibc.machine.srt"),
    audioPath: localAssetPath("poc-mibc.mp3"),
    sourceFileSha256: "sha256:55ad43be6ac64f2906405dca53578708855661980608be702487203ac0f60fcc",
    sourceDurationMs: 1_208_000,
    durationBasis: "Episode fixture/RSS duration: 00:20:08.",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: LOCAL_WHISPER_PROVENANCE,
  },
  "nrg-archer": {
    assetId: "nrg-archer",
    sourceIds: ["nrg-archer"],
    show: "The NRG Oncology Podcast",
    episodeTitle: "NRG-GU015, the ‘ARCHER’ Study for Muscle Invasive Bladder Cancer",
    srtPath: localAssetPath("nrg-archer.machine.srt"),
    audioPath: localAssetPath("nrg-archer.mp3"),
    sourceFileSha256: "sha256:9b1be466713dddf9430c9e8c8cc0d7065d1b5119d213bff70d0168050bdc2a29",
    sourceDurationMs: 1_690_000,
    durationBasis: "Episode fixture/RSS duration: 00:28:10.",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: LOCAL_WHISPER_PROVENANCE,
  },
  "cme-keynote-564": {
    assetId: "cme-keynote-564",
    sourceIds: ["cme-keynote-564"],
    show: "CME in Minutes: Education in Oncology & Hematology",
    episodeTitle:
      "Navigating Urologic Cancer Care Across the Map: Getting up to Speed on the Latest Systemic Therapies for Renal Cell Carcinoma and Advanced Urothelial Carcinoma",
    srtPath: localAssetPath("cme-keynote-564.machine.srt"),
    audioPath: localAssetPath("cme-keynote-564.mp3"),
    sourceFileSha256: "sha256:c9b1edb27c1d02c12cc0a3657700ab26adc62e48185bddf5a64cf45dce08ca43",
    sourceDurationMs: 4_226_000,
    durationBasis: "Episode fixture/RSS duration: 01:10:26.",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: LOCAL_WHISPER_PROVENANCE,
  },
  "oncology-today-tar-210": {
    assetId: "oncology-today-tar-210",
    sourceIds: ["oncology-today-tar-210"],
    show: "Oncology Today with Dr Neil Love",
    episodeTitle:
      "Non-Muscle-Invasive and Muscle-Invasive Bladder Cancer — Microlearning Activity 3",
    srtPath: localAssetPath("oncology-today-tar-210.machine.srt"),
    audioPath: localAssetPath("oncology-today-tar-210.mp3"),
    sourceFileSha256: "sha256:0fad57279388e5067622fcdbd58df8d8224498f529405ad0e374f56354178933",
    sourceDurationMs: 1_217_000,
    durationBasis: "Episode fixture duration: 00:20:17.",
    completeness: "complete",
    searchScope: "full-conversation",
    assetKind: "local-machine-transcript",
    provenance: LOCAL_WHISPER_PROVENANCE,
  },
  "uromigos-504": {
    assetId: "uromigos-504",
    sourceIds: ["uromigos-504"],
    show: "The Uromigos",
    episodeTitle: "Episode 504: ASCO 2026 — ADC Drug Development in Urothelial Cancer",
    srtPath: localAssetPath("uromigos-504.srt"),
    sourceFileSha256: "sha256:ca0ce368965656678758fbb20769b66890ab371848059b79cf356c8aa24d7187",
    sourceDurationMs: 2_432_000,
    durationBasis: "Episode RSS duration: 00:40:32.",
    transcriptUrl:
      "https://transcript-files.spotifycdn.com/76FisfhWQzfDM6Etx0vJkL/3UGDxMVTCuDLGEiySFiLDB/transcript.srt",
    completeness: "partial",
    searchScope: "full-conversation",
    assetKind: "publisher-transcript",
    provenance: PUBLISHER_TRANSCRIPT_PROVENANCE,
  },
} as const satisfies Record<LocalTranscriptAssetId, LocalTranscriptManifestEntry>;
