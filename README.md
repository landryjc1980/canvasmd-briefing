# CanvasMD — The Readout (web)

The reader-facing web edition of CanvasMD's Readout across All Oncology and seven
specialty lenses (GU, Breast, Lung, GI, Heme, Gyn, and Skin).

## Why this exists / architecture

The Readout's evidence is assembled once by the Supabase `briefing` edge function in
the paired `canvasmd` app repo. This Next.js app owns the gated reader experience and
serves the same canonical edition through every specialty lens.

- `/` is the canonical production Readout.
- `/readout-next` permanently redirects to `/`; it is retained only as an old-link shim.
- `app/LegacyBriefingPage.tsx` preserves the retired client-rendered weekly reader as
  non-routable rollback source. It is not imported into the production page bundle.
- The root server render starts with the finished `All / Today` payload from
  `getCachedReadoutWindow`, then the client switches specialty and Today/7 days views
  through the authenticated `/api/briefing` proxy.
- Vercel warms all finished Readout windows hourly. The 6 a.m. ET archive freezes the
  dated canonical edition used by Today and the exact seven-day history.
- Finished and last-good windows are stored service-side in Supabase `readout_posts`;
  a cache miss rebuilds through the `briefing` edge function.

Ranking and evidence eligibility stay in the edge function. This repo owns presentation,
edition projection/history, server caching, and the reader gate.

## Access model

The main Readout is protected by the brief session middleware. Share pages under `/r/`
remain public teasers and enforce their own member-evidence boundary. Supabase service
credentials are server-only and must never use a `NEXT_PUBLIC_` prefix.

## Local dev

```
cp .env.local.example .env.local
npm install
npm run dev
```

## Deploy (Vercel)

Import this repo in Vercel (auto-detects Next.js). The Readout data path requires:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `CRON_SECRET`
- `BRIEF_SIGNING_SECRET`

`BRIEFING_FUNCTION_URL` is optional and overrides the default Supabase function URL.
Production is served at `briefing.canvasmd.io`.
