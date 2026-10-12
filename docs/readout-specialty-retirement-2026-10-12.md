# Specialty builder retirement

The dormant Node specialty publisher and shadow endpoints, generated builder,
dedicated transport/publication/comparison helpers, replay/sync scripts, and
specialty-only tests were removed on 2026-10-12. The web build no longer verifies
or regenerates that bundle, and its unused esbuild development dependency was
removed.

Vercel already had no specialty publish or shadow cron entries. The active
Readout archive, prearchive, cache, maintenance, audio, and shared pipeline-job
paths remain in place. This change does not alter production database state.

Earlier specialty cutover, shadow, reliability, and evidence documents are
retained as historical records; their specialty endpoint and script instructions
no longer describe supported runtime paths.
