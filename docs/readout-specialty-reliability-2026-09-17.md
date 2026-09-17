# Specialty publication reliability — September 17

The September 16 evening build exhausted its sequential build window. The
September 17 morning completed all seven areas but its atomic publication RPC
hit the generic eight-second receipt timeout. These are separate failure modes.

Seven areas now build with concurrency two, isolated builder instances and one
frozen clock/prior/window snapshot. Results and traces retain canonical area
order. Concurrent identical reads and in-flight recap requests are coalesced;
completed recap responses are not cached for a later paid invocation. Any area
failure aborts the shared build, stops queued work and drains active workers.

The original 270-second source and 275-second job deadlines remain. Builds get
240 seconds, reserving 30 seconds for finalization. Ordinary receipt calls retain
an eight-second bound. Publication has a dedicated call capped at 25 seconds,
with at least five seconds preserved for exact-run readback. Each readback has
a three-second cap, and the five-second readback window starts after an uncertain
commit returns. No failed publication causes another set of paid builds.

Stages are now `build-specialty-areas` and `finalize-publication`, with per-area
timing and traces in the retained summary. Failure logging has an independent
client. An already committed success cannot be overwritten by an adapter or
stage-log failure. The seven-area write remains one atomic database transaction.

Generated engine source and approved engine identity are unchanged. Edge fallback
schedules and the morning-only atomic retirement rule remain. A successful
deployment is not evidence of a successful scheduled cutover; the next eligible
morning must supply that production receipt.

Validation: focused specialty suite 30/30; full web suite previously passed
372 tests with ten expected optional-private skips, followed by focused tests
for the final transport/readback changes. Final production build and generated
engine manifest verification passed. No monitoring or email policy changes.
