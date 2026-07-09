# CanvasMD — Weekly Briefing (public web)

A public, **ungated** web rendering of the CanvasMD Weekly Briefing — "what moved
this week in {tumor area}" across all six areas (GU, Breast, Lung, GI, Heme, Gyn).

## Why this exists / architecture

The Briefing's **intelligence is authored once**, in the Supabase `briefing` edge
function (in the `canvasmd` app repo). It fuses podcast discussion + verified-clinician
X takes + shared journal papers into one ranked drug spine per area, caches the result
in `briefing_snapshots`, and returns `BriefingData` JSON.

- The **native app** reads that edge function and renders it.
- **This web app** reads the *same* edge function (via a thin `/api/briefing` proxy)
  and renders it with the polished web views ported from the pharma dashboard.

So there is exactly one place that computes the briefing. This app never recomputes —
it is a thin renderer. Tune the ranking in the edge function and both surfaces update.

## Safe to be public

It shows only already-public material: clinicians' own X posts (with links back to X),
AI glosses of published-podcast moments, journal articles, and FDA/regulatory events.
It uses **only the publishable (anon) Supabase key** — no service-role key, and none
of the pharma dashboard's private, voiceprint-derived stance intelligence.

## Local dev

```
cp .env.local.example .env.local   # fill in SUPABASE_ANON_KEY
npm install
npm run dev
```

## Deploy (Vercel)

Import this repo in Vercel (auto-detects Next.js). Set two env vars:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

No gate needed. Optionally point a subdomain (e.g. `briefing.canvasmd.io`) at it.
