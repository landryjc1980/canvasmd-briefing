# Fresh candidates before daily selection

## Scope and contract

The September 11 morning canonical had consumed the previous evening's candidate universe. Today still applied its correct 24-hour clinician-sharing floor, but newly circulating overnight articles could be absent from that universe.

The canonical constructor now performs this sequence:

1. Request a candidate build through the service-only `request_readout_candidate_refresh(uuid)` RPC.
2. Wait for that exact run ID to appear in the persisted `cross_cutting` lane, with a new timestamp and the unchanged seven-day discovery window. Enqueue acknowledgement alone is not completion.
3. Read all eight area windows fresh, bypassing source caches.
4. Verify that the candidate build did not change during selection, then save the canonical with its candidate-build provenance.

The wait is capped at two minutes; individual transport/body reads are capped at ten seconds even if the transport ignores cancellation. A lost dispatch acknowledgement is not blindly retried. A failed attempt cannot fall back to an older candidate list. Existing scheduled retries can try again. The 5 a.m. preparation, 6 a.m. fallback, and missing-edition bootstrap all use the dependency; already-prepublished retries return without starting a new build.

No extra time-based cron was added. The dependency therefore also runs on weekends and remains correctly ordered if the daily schedule moves. The existing service-only RPC uses the existing ops-token-protected candidate builder and cannot accept arbitrary targets or payloads. Anon/authenticated execution is revoked.

The user-approved rule allowing yesterday's midday insertions into today's morning edition is unchanged. Publication-age, sharing thresholds, ranking, and today's published canonical/audio are unchanged.

## Verification

- 19 focused web tests passed, including successful 5 a.m. ordering, exact-run polling, stale/failed/hung refreshes, concurrent replacement, persisted provenance, idempotent retries, and fallback construction.
- Two DB contract tests passed. Live privilege checks returned anon=false, authenticated=false, service_role=true. A null-run request was rejected before dispatch. The migration was applied before deploying its caller.
- The exact server helper was executed against production without constructing or saving an edition: run `d662d0df-b0f9-4467-9b34-982518056179`, request `132430`, persisted at `2026-09-11T12:01:31.750Z`; refresh plus receipt recheck completed in 3,583 ms.
- An earlier RPC canary (`7945be42-72e4-44d4-a9e7-e4822e85d3d5`, request `132429`) returned HTTP 200 and its fresh universe included both previously missing overnight articles: the NEJM hepatoblastoma CAR-T letter and the myeloma cereblon-modulator review.
- Today's canonical selection version remained `readout-v1-ed70361df1bb1331d219e580424d8c6654f8cda2db64a701a400e71782199f56` during verification.
- The production build passed. The broad suite retains three unrelated existing presentation/native-parity assertion failures; the involved source/test files are unchanged by this fix. The explicit next-morning midday-repeat-policy test passes.

The next automatic morning run has not yet occurred. This verifies the deployed dependency and its real production refresh, not tomorrow's complete edition or audio in advance.
