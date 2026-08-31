# Local transcript loader

This directory supports the development-only Rounds reviewer. It contains no
transcript text and must not become a production transcript source. The server
reads only the files explicitly allowlisted in `manifest.ts`; missing or invalid
assets are reported in the reviewer instead of crashing the route.

## Local inventory

The manifest covers 10 distinct recordings and all 11 source rows used by the
six-question GU fixture. `gu-cast-mibc` and `gu-cast-ev-302` intentionally map
to the same GU Cast episode.

| Asset ID | Source rows | Local SRT | Provenance |
| --- | --- | --- | --- |
| `uromigos-508` | `uromigos-508` | `local-assets/uromigos-508.srt` | Publisher SRT declared in episode RSS |
| `uromigos-515` | `uromigos-515` | `local-assets/uromigos-515.machine.srt` | Prior local machine-transcript cache; method unknown |
| `eau-proteus` | `eau-proteus` | `local-assets/eau-proteus.machine.srt` | Local whisper.cpp pass |
| `gu-cast-proteus` | `gu-cast-proteus` | `local-assets/gu-cast-proteus.machine.srt` | Prior local machine-transcript cache; method unknown |
| `gu-cast-mibc` | `gu-cast-mibc`, `gu-cast-ev-302` | `local-assets/gu-cast-mibc.machine.srt` | Local whisper.cpp pass |
| `poc-mibc` | `poc-mibc` | `local-assets/poc-mibc.machine.srt` | Local whisper.cpp pass |
| `nrg-archer` | `nrg-archer` | `local-assets/nrg-archer.machine.srt` | Local whisper.cpp pass |
| `cme-keynote-564` | `cme-keynote-564` | `local-assets/cme-keynote-564.machine.srt` | Local whisper.cpp pass |
| `oncology-today-tar-210` | `oncology-today-tar-210` | `local-assets/oncology-today-tar-210.machine.srt` | Local whisper.cpp pass |
| `uromigos-504` | `uromigos-504` | `local-assets/uromigos-504.srt` | Publisher SRT declared in episode RSS |

The six new local machine assets were generated from their complete public
episode audio with:

```text
<local-whisper-install>/main \
  -m <local-whisper-install>/models/ggml-base.en.bin \
  -f <full-episode-audio.wav> -l en -t 8 -osrt -otxt -of <asset-output>
```

The source audio, SRT, TXT, and transcription logs remain outside tracked
source in `app/rounds-lab/reviewer/transcripts/local-assets/`. That durable
repo-local cache is ignored both here and by the repository root. The two
legacy root-cache transcript/audio pairs were consolidated into this directory
as `uromigos-515.*` and `gu-cast-proteus.*`.

Before reviewer QA, verify that the allowlist still covers every fixture source
and that every local SRT remains parseable with full-conversation structural
coverage:

```bash
node app/rounds-lab/reviewer/transcripts/verifyLocalAssets.mjs
```

## Provenance and trust boundary

- Searchable transcript access and publication-grade transcript approval are
  separate states. Temporal coverage never stands in for word accuracy.
- None of these assets claims CanvasMD human accuracy review or a
  whole-conversation completeness receipt. The publication gate therefore
  remains closed even when the entire conversation is searchable.
- Publisher SRTs may omit a few opening or closing seconds. Their first-to-last
  span and timed-cue coverage are reported separately and their manifest
  completeness stays `partial`.
- The two prior cache files retain `unknown` generating-method provenance; the
  fixture does not invent missing history.
- Each manifest entry allowlists the raw-file SHA-256. Loading and verification
  fail closed on a digest mismatch; loaded results also record the normalized-
  segment SHA-256, cue count, temporal coverage, and explicit provenance flags.
- `loadLocalTranscriptAssets.server.ts` imports `server-only` and throws in
  `NODE_ENV=production`.
- No Supabase client, production database, production storage, or production
  transcript service is used.

## Local use

Launch the preview on the loopback interface only:

```text
npm run dev -- --hostname 127.0.0.1
```

Keep raw transcript and audio files in `local-assets/`; never add them to Git.
Update `manifest.ts` deliberately when an asset path, content digest, duration
basis, or provenance statement changes, then rerun the verifier before starting
the local reviewer.
