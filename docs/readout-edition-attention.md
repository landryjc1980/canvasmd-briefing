# Edition attention

New canonical editions persist a versioned New York attention anchor. Daily selection and reader counts start at 5 AM ET on the preceding calendar day; seven-day reader counts start at 5 AM ET seven calendar days before the active edition date. Observation time advances on hourly refreshes. Calendar conversion accounts for DST. The existing 5 AM preparation and 6 AM publication schedule is unchanged.

Each paper face shows distinct qualifying clinicians within that scope. Publication date sits beside the source. The evidence disclosure separates scoped people/comments from overall recorded sharing. Detail reads retain the hourly observation's start and end. Corrections can decrease counts; no previous-count maximum is used.

Morning membership, order, and audio selection version survive count-only refreshes. Existing qualifying midday additions are appended and labeled. The existing next-morning exception for yesterday's midday additions is retained. Seven-day membership and order still come from saved daily editions; only the attention observation is shared across them.

An older active edition without saved anchor metadata remains explicitly unscoped. Deploying the reader does not backfill that metadata or rebuild its selection. Once the active edition has an anchor, the seven-day observation also covers older saved cards without requiring their own anchors.

## Verification and release

The production build passes. Deterministic tests cover time boundaries, DST, deduplication and recent reposts, scoped versus overall receipts, zero-count saved cards, daily-versus-weekly overlay collisions, missing metadata, next-morning eligibility, and preserved membership/audio revisions. Desktop and mobile were inspected with clearly labeled synthetic attention counts over saved source content.

The broad web suite has the same eight failures before and after this change: six assertions search for renderer code that moved into shared components, and two native assertions still expect prior playback implementation/label syntax. They remain tracked failures; this change does not claim a clean full suite.

These changes require coordinated backend and web integration. The backend `briefing` release must include concurrent specialty-membership and source-label work. Do not deploy this branch over those changes. Production fixed-window verification is still required after the combined release; today's canonical edition and paid jobs must not be rebuilt for verification.
