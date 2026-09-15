# Node specialty publication preparation — September 15, 2026

The existing Node endpoint only captured shadow outputs. This change adds a separate, disabled production publisher that uses the same pinned engine and commits all seven specialty sources and their deferred effects through one database transaction.

## Publication contract

- `/api/readout-specialty-publish` requires the existing cron secret, production environment, `READOUT_SPECIALTY_PUBLISH_ENABLED=1`, a scheduled invocation, and the database's enabled publication control with the exact approved engine SHA and input hash. Accepted review evidence is required; a calendar date or successful shadow job never supplies it.
- Start windows are 04:00–04:05 and 20:00–20:05 America/New_York, preserving the existing morning and evening source cycles. The UTC cron plus local-hour check handles daylight saving time. Late delivery and manual publication are refused.
- A shared batch lease prevents overlapping Node builds. A recorded attempt consumes the cycle even if it failed, preventing cron redelivery from silently repeating paid recaps. Failed attempts require operator review.
- The builder remains read-only and collects deferred effects. The publication RPC validates seven distinct matching sources, clean engine identity, common timestamp and cycle, valid window lengths, complete recap/transport diagnostics, current deadlines, and scoped effects. Capture-only diagnostics cannot publish.
- The transaction publishes all seven `briefing_snapshots`, their weekly editions, trial-ledger and hero-pool effects, and the successful source/pipeline receipts together. Only that successful transaction retires the exact seven Edge refresh jobs, hourly retry, and morning recovery. An unsuccessful first handover leaves Edge schedules active. Active Edge leases or newer source snapshots block the handover.
- A lost RPC response is reconciled against the exact durable run. Neither the runner nor the route overwrites a committed success with a later adapter/logging failure.
- Existing 05:00 prepublication and 06:00 public rollover/readiness gates remain unchanged. This route does not publish the canonical Readout edition directly, change ranking, or restart audio.

Backend implementation and rollback fixture live in the companion CanvasMD worktree under `20260915141505_finish_readout_specialty_publish.sql` and `supabase/tests/database/readout_specialty_publish_test.sql`.

## Validation

- Current Node adapter, both shadow and publication modes: seven complete outputs and deferred effects exactly match the retained September 12 full-recap fixture; zero missing fixture inputs, network requests, actual database writes, or provider calls.
- Pre-extraction Edge builder `6764a86afc758e0e4d8d83d43fb94819bbe61d24`: separately replayed the same retained database and actual provider responses, again matching all seven outputs and deferred effects.
- September 15 provider-free capture: 462 frozen input fixtures replay identically in the current Node adapter and pre-extraction Edge engine across all seven outputs and deferred effects. Recap calls were intercepted, so this verifies current selection/effect behavior without claiming newly generated prose. The retained fixture above supplies actual full-prose response coverage.
- The replay checker now identifies ledger inserts by URL pathname, including PostgREST array inserts with a `columns` query parameter; this fixed a false mismatch in Lung and Heme.
- Current engine baseline remains `5839dca9c376b958c96fd14a171bf0d91ad9e51f`; engine input hash `63816feab18611a5b6ae19d47e39d08283a9ca6e93578780f228032a1adbd4a8`. All 17 manifest sources and generated bundle remain unchanged.
- Focused Node tests cover authorization, production-only and disabled behavior, approved engine/review checks, daylight saving time, duplicate attempts, overlap, partial/provenance mismatches, provider completeness, and lost commit responses. The production Next.js build passes.
- Reports for the retained full-prose replay: `/private/tmp/readout-node-cutover-validation-20260915/node-replay-report.json` and `parity-report.json`. Source evidence remains private; only hashes and validation conclusions belong in the release record.

The compact replay reports and their SHA-256 values are preserved in [the evidence record](evidence/readout-node-cutover-2026-09-15.json). The migration and rollback fixture pass in isolated PostgreSQL and PGlite. The PostgreSQL integration also accepts all seven retained real outputs and their actual 119-event diagnostic trace, with only the fixture cycle and timestamps rebased. These are isolated tests; production activation has not occurred.

## Acceptance and activation

The September 13–14 live-input comparisons remain unresolved. Their missing historical input capture cannot be recovered by replaying today's data. This change does not edit either dated review or assert that they passed. The controlled parity evidence needs explicit acceptance as the replacement migration gate before production activation.

1. The transaction fixture and replay validation are complete. Production migration `20260915141505` is applied with the database singleton disabled, no Node publication runs, all nine Edge jobs active, and no public-role access. Release the web adapter with the activation flag absent/off.
2. Verify the deployed web commit and disabled endpoint, database function permissions, singleton state, and unchanged Edge/audio schedules. Do not manually invoke a paid batch to probe readiness.
3. After the replacement evidence is accepted, record its actual reviewer, acceptance timestamp, artifact identifier and SHA-256 alongside the exact engine SHA/input hash in the database control. Enable the web publication flag for the intended scheduled source cycle. Keep Edge schedules armed until the first complete Node publication transaction retires them.
4. Verify that exact scheduled production run: seven source snapshots with one clean engine stamp/time/cycle, complete recap responses, no unresolved transport errors, atomic publication receipt, preserved effects and source readiness, and the recorded Edge schedule retirement. Verify the subsequent canonical edition and public reader caches before calling the morning cutover complete.
5. Only after the verified cutover implement the six approved ranking changes. Audio remains paused until John explicitly restarts it.

## Rollback

Disable the Node web flag and database control to stop future Node attempts. Restore only the Edge jobs recorded in the successful publication receipt, using their recorded job IDs/names/schedules and prior active states; preserve unrelated cron jobs and the audio pause. Check for an in-flight Node lease before resuming Edge. Existing published snapshots remain readable, and normal readiness gates continue to reject incomplete or mixed source cycles. Do not repeat a paid failed Node build merely to inspect its receipts.
