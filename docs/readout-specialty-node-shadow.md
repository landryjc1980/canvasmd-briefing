# Specialty Node shadow

The private `/api/readout-specialty-shadow` endpoint runs the same specialty engine as Supabase Edge in one sequential, seven-area Node job. It has a 300-second route limit and an earlier abort deadline. It records private comparison outputs and deferred effects; it cannot publish source snapshots, canonical editions, trial ledgers, hero pools, or audio.

The source of truth is `supabase/functions/_shared/specialtyBriefingBuilder.ts` in the CanvasMD backend. To update the generated bundle from a clean backend checkout:

```sh
npm run sync:specialty-builder -- /absolute/path/to/canvasmd
npm run build
```

The manifest pins the backend commit, all 17 imported source hashes, and the bundle hash. Build verification rejects dirty source metadata and a modified bundle. Do not hand-edit generated code.

## Activation and rollout

As of September 12, 2026, execution is disabled. An authenticated request returns `shadow-not-activated` with the deployed web commit, engine commit, and Node version, without reading source data or calling a provider. Production execution additionally requires `READOUT_SPECIALTY_SHADOW_ENABLED=1`.

Activation awaits explicit approval of the existing Anthropic recap calls and charges, followed by a complete timed canary. The intended scheduled comparisons are September 13 and 14 at 04:20 ET. September 15 is the earliest first Node-led morning, conditional on both comparisons passing and implementing/verifying the atomic source publication cutover. No code in this release automatically switches publication. Audio remains paused.

When activation is approved and the canary passes, enable both the Vercel variable and `pipeline_job_definitions.enabled_at` for `readout-specialty-shadow`. Verify the exact deployment, authenticated endpoint, and scheduled receipt. Two UTC cron entries plus the New York hour guard produce one daily 04:20 ET run. A database lease excludes concurrent batches; a unique source-run constraint excludes duplicate completed cycles.

Each output retains the exact prior Edge snapshot observed at batch start. A live output difference may reflect changed inputs. Build success is separate from `comparisonStatus`: `incomplete_legacy`, `review_required`, or `equal_observation`. None proves frozen-input engine parity. Every summary remains `qualifiedForCutover=false` until an explicit review of the dated comparisons and their evidence.

## Verification and replay

The model-free canary completed seven areas in 105.2 seconds. Each output and deferred effect matched the pre-extraction backend engine at `6764a86afc758e0e4d8d83d43fb94819bbe61d24` using captured inputs and a fixed clock. This does not prove runtime with live recap calls.

The diagnostic below requires a private absolute output directory and a loaded service environment. It intercepts recap requests, saves their public-source input payloads locally, and returns explicit empty fixtures; it does not call the recap provider:

```sh
node scripts/run-specialty-shadow.mjs /private/absolute/output --capture-recap
node scripts/replay-specialty-baseline.mjs /private/absolute/output /absolute/path/to/canvasmd 6764a86afc758e0e4d8d83d43fb94819bbe61d24
```

Capture-only is the CLI default. A full canary requires both `--live-recap` and `READOUT_SPECIALTY_LIVE_RECAP_APPROVED=1`; those must wait for the pending approval. The normal replay uses captured responses only and has no network fallback. The optional `--diagnose=AREA` mode may issue missing read-only database requests and is not parity evidence.

The shadow transport rejects database mutations, caches exact reads under a 96 MiB cap, and fails on unresolved database errors. Full runs also fail on recap HTTP errors, provider errors returned as HTTP 200, invalid JSON, or missing requested prose. Explicit capture-only diagnostics bypass only the fixture check and remain unqualified. Private summaries retain recap status without raw payloads.

Run the focused checks after changes:

```sh
node --test tests/readout-specialty-shadow.test.mjs tests/readout-pipeline-job.test.mjs
npm run build
```
