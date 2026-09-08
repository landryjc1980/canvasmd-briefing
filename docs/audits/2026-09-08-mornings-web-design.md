# Oncology Mornings web parity

## Scope

- Replaced the legacy Daily Readout Audio presentation with Native's Dawn treatment: navy `#263B59`, peach `#F0C9A9`, terracotta bottom edge `#CE986F`, uppercase Oncology and italic Georgia Mornings.
- Kept the existing date selector, audio URLs, gated API, refresh cadence and written Readout unchanged. No schema, ingestion, generation, authentication or hosting migration.
- Matched the 53px peach play control, current-chapter label, collapsed chapter panel, source summaries, active chapter treatment and nested Listen disclosure. Web chapter buttons retain their existing seek-without-autoplay behavior.
- Mirrored Native's narrowly defined empty Regulatory Watch and Sources/Receipts display filters, preserving substantive claims and all timestamps. Corrected generic summary promises without removing written-only disclosures.
- Specialty and audio-date selectors share a 36px visible pill within a 44px native select target; custom chevrons have 14px edge clearance and reserved text padding.
- Chapter arrows are centered SVG chevrons, including the nested Listen control. Edition/recording keys reset playback presentation on a selection change.

## Verification

- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- 30 focused Mornings, Readout presentation and accessibility tests: passed. These include rendered React markup and executable pure metadata tests.
- Full suite: 226 tests, 212 passed, 10 skipped, 4 failures. Remaining failures are outside these edits: two paired-repository tests reference the former Native briefing path, one cache test expects finished-v7 while unchanged server source uses v8, and one Native listen-label assertion expects an older JSX shape. The affected source and test files were not changed for this work except the unrelated specialty-style assertion in the same preview test file.
- `git diff --check`: passed.
- Local `/briefing-preview` returned HTTP 200 after final changes and preview restart. Existing development audio requests returned 200. The user supplied a screenshot identifying the chapter-chevron baseline issue; the fix uses centered geometry. No independent interactive browser, playback or responsive visual QA was performed.

## Delivery boundary

This is the existing Next.js/Vercel Readout, not a new Sites-hosted application. No production publication or access change was performed. Local preview: `http://127.0.0.1:3011/briefing-preview`.
