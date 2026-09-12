# The Readout contract

Status: implementation contract, 11 September 2026. This document supersedes conflicting selection rules in older Readout design notes. The same contract is checked into the web and Native/backend repositories.

## The product

The Readout is one frozen morning edition of the oncology developments clinicians shared in the preceding 24 hours. Ordinary papers earn admission at three distinct clinicians; preprints retain their explicitly approved stronger five-clinician bar and disclosure. The 5 AM New York preparation establishes the preceding-day 5 AM count anchor; the edition publishes at 6 AM. It saves story identity, explicit specialty membership, order, attention anchor and insertion IDs. Hourly refreshes update evidence/counts and may append newly qualified developments, but do not reorder or reselect the morning. Prior morning stories do not repeat; yesterday's midday addition may receive its first morning placement. Seven days is the deduplicated union of saved daily editions, not a second ranking. Specialty views, Regulatory Watch, labels, Native and audio all use this canonical edition. Audio requires the final source-grounded written description and its matching selection version.

## One publication object

- Only `edition:v2:<date>:All` is the current canonical daily publication.
- Each story has `areas: SpecialtyArea[]`. An explicit empty list means general oncology/All only. It is not missing metadata.
- Routing is computed in selection from source/candidate routing, then persisted. A valid legacy scalar is a compatibility fallback only until historical repair.
- Reader labels use the first stored area, or Oncology. Within-specialty focus may use explicitly stored subAreas; title/site inference is prohibited.
- Today filters the canonical object. Seven days filters the saved canonical daily union. Neither fills a thin specialty from current raw supply.
- Regulatory Watch and designation cards are lists stored in the same publication, projected with the same membership resolver.
- The morning order and audio content revision are immutable during hourly refresh. Midday additions append to the remainder and are identified in `middayInsertions`.
- Title, URL, classification and excerpt repair may hydrate exact-source display fields. Such hydration cannot add a story, change its areas, reorder it, or silently regenerate its saved narration.
- Counts, faces and evidence posts use the same fixed saved anchor. Seven-day cards share the approved start at 5 AM seven New York calendar days before the active edition. A missing historical anchor is unavailable, not an invented lifetime or rolling-window count.
- No edition means not-yet-published, not permission to manufacture another slate. A raw-evidence outage may serve the saved publication with a stale-evidence indication.

## Rules audit and retained justifications

| Rule / implementation location | Decision and reason |
| --- | --- |
| backend `briefing/index.ts`, `frontPageCandidates.ts`, `readoutWindow.ts` | Retain as raw source/admission machinery. Their candidate output is not a second published edition. |
| web `readoutEditionArchive.ts` | Sole publication writer: prepare one canonical All object; hourly insertion writer uses a separately named raw admission path. |
| web `editionSnapshot.ts`, `editionHistory.ts` | Retain deterministic canonical assembly, no-repeat and identity dedup; rendering projects stored membership. |
| backend `readoutMembership.ts`, web `storyMembership.js` | Same explicit-list semantics across runtime boundaries; no source-text specialty inference at read time. |
| web `readoutWindowServer.ts` | Finished payloads require the dated canonical All record and saved All history. Raw specialty snapshots and independent 72-hour lead fallback are retired from publication. |
| backend `readoutSourceRepair.ts` | Retain identity-compatible source repair and source-safety checks; no title completion by a language model. |
| web `EditorialReadout.tsx`, Native `readout-edition.ts` | Presentation only: stored routing and typed disclosures, no admission or ranking. |
| `readoutAttention*` in both repositories | Fixed count boundaries prevent hourly/lifetime counters from being mislabeled as edition attention. No retroactive anchors. |
| Distinct-clinician identity grouping | Retain to prevent mirrors, repost duplication and conflicting DOI/PMID records from manufacturing attention. |
| Ordinary paper floor of three, preprint floor of five | Retain the previously approved attention thresholds; specialty thinness never lowers them. |
| Event weighting and official regulatory exception | Retain deterministic attention/event policy; an exact official approval/label/safety notice is not an ordinary-paper floor exemption for press releases. |
| Primary vs supporting sources | Retain regulator-first receipts and separate trial/podcast/coverage links to avoid asserting that supporting material is the announcement. |
| Publisher/identity/source-quality gates | Retain source integrity, non-promotional evidence and safe URL rules. Safety withholding is not a competing editorial ranking. |
| 72-hour Listen eligibility | Retain only as an explicitly bounded morning selection input for approved podcasts; it cannot introduce a new finished specialty story outside canonical membership. |
| Transcript-supported podcast development | Retain only when selected into the canonical object; descriptions and source attribution must remain honest about their evidence source. |
| Static editorial fixtures in `edition.ts` | Retain for local previews/tests only; never fill a finished production edition from fixture arrays. |
| Five lead positions and remainder | Retain as layout, not an admission cap. Specialty projection preserves relative canonical order. |
| Morning publisher preparation | After attention admission and before lead selection, a service-only pass attempts at most ten missing-abstract DOI groups in rank order, with three concurrent fetches and a 25-second scheduling budget. Exact publisher/Crossref identity is required; no reader request triggers enrichment. Each candidate receives a recovery/readiness receipt in the private selection audit. |
| Source-ready morning leads | All oncology fills up to five source-ready leads in global rank order after excluding prior morning coverage, with no per-specialty cap. Specialty selection stays unchanged. Missing, boilerplate or visibly clipped source text cannot fill a lead position; those otherwise eligible papers remain in Also Relevant. Fewer than five leads is valid when fewer sources are ready. Ordinary publisher preparation cannot rebuild a saved edition; an explicit service-authorized repair is required. |
| PRECLINICAL | Disclosure only from formal publisher/PubMed animal/lab metadata. Human/clinical metadata vetoes ambiguous mixed records. No title inference, no ranking penalty. Sparse metadata leaves the label absent. |
| Intake truncation guard | Prefer exact registry/citation/source-page H1; reject visibly clipped metadata instead of synthesizing its missing words. |
| Readout audio selection version | Retain fail-closed written-to-spoken parity. Membership-only repair must not enqueue paid narration or rewrite today's selected content. |
| Legacy hero/weekly/preview paths | Outside the production Readout publication contract. They must not be consulted as fallback by the root Readout or Native finished-window client. |

## Historical repair and release acceptance

Repair saved All editions from the breaking lane launch (27 August) through 11 September using retained candidate membership or exact source identifiers/URLs. The repair is metadata-only: back up every row, use concurrency guards, verify every updated row, and prove unchanged story order/content/selection version. General oncology stays an explicit empty list. Do not infer from the word kidney or any other title word.

Required acceptance: NECTIN4 is visible under GU wherever its canonical edition appears; camizestrant appears under Breast wherever its canonical edition appears; the Cell mouse paper stays in its earned position without a manufactured kidney specialty. Re-measure Gyn/Skin only after this routing repair. Verify the complete sevabertinib title from its primary FDA page (this notice has no DOI; Crossref is not its authority). Test explicit empty and multi-area lists, raw-supply decoys, saved seven-day union, stale evidence and fixed attention boundaries. Build and verify the actual deployed UI before claiming production completion.
