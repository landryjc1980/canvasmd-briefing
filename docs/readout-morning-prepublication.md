# Oncology Mornings prepublication contract

At 05:00 and 05:05 America/New_York, `/api/readout-prearchive` fresh-reads all
specialties and writes one service-only canonical row:

`readout_posts.tok = edition:v2:<YYYY-MM-DD ET>:All`

Before it reads live Readout inputs, the prepublication job requires all seven
specialty `briefing_snapshots` rows to carry `data.build.sourceRunId` equal to that ET
morning's `scheduled-YYYYMMDD06` promotion run. Missing, malformed, or mixed
source metadata fails closed. A valid existing row is returned unchanged on a
retry, so narration never races a 05:05 overwrite.

Since 2026-11-17 `activeReadoutEditionDate()` rolls over at 05:00 ET, so this
row is the public reader edition from 05:00. Prepublication itself never writes a
`readout-window:finished:*` row; `/api/readout-cache` rebuilds the finished
windows from it at 05:10 ET (09:10/10:10 UTC, one of which is 05:10 in each DST
state), and web reads rebuild on demand.

The audio publisher may use the row only when all conditions hold:

1. `card.schemaVersion === 2`, `card.area === "All"`, and `card.editionDate`
   exactly equals the requested America/New_York date.
2. `card.selectionVersion` is a nonempty `readout-v1-` revision.
3. It builds its narration input directly from that canonical card, retaining
   the same selection version on `readout_audio_editions`.

At 06:00, the archive route builds the edition only if prepublication failed and
checks the All/today reader window against the same canonical row. A valid prepublished row is
reused rather than regenerated; 06:05 is only a retry. A missing/stale
prepublication must fail closed; it must not substitute yesterday's audio as
today's edition.
