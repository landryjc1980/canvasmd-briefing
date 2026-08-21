import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";

export const dynamic = "force-dynamic";

// Thin proxy to the `briefing` Supabase edge function — the SINGLE source of the
// Weekly Briefing. The edge function computes the digest server-side and caches it
// in briefing_snapshots; the native app and this web app both just read it, so the
// intelligence is authored exactly once and can never drift between platforms.
//
// We proxy (rather than calling the edge fn from the browser) so the Supabase URL
// and publishable key stay server-side and the page keeps its existing
// fetch("/api/briefing?area=…") contract unchanged.

const AREAS = new Set(["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"]);

// Every page load warms all six areas, for every reader, on every visit. Uncached that is six
// edge invocations each (eighteen with retries) — and because the edge fn rebuilds on demand
// whenever a snapshot ages out, a missed cron turned each arriving reader into six concurrent
// full rebuilds, which is precisely the WORKER_RESOURCE_LIMIT condition. So: memoize per
// instance, and single-flight so N readers asking for the same area at once cost ONE call.
//
// Deliberately in-process, not a Cache-Control header: the route verifies the reader session,
// and a shared/CDN cache could otherwise serve one reader's response outside that boundary.
const TTL_MS = 5 * 60_000;
const memo = new Map<string, { at: number; briefing: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    // currentContactId verifies both the signature and the contact's current active status.
    if (!(await currentContactId(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars." },
      { status: 500 }
    );
  }

  const raw = req.nextUrl.searchParams.get("area") ?? "GU";
  const area = AREAS.has(raw) ? raw : "GU";
  // Congress rehearsal: forward a `congressPreview` series_key (e.g. esmo-gi) so the edge fn
  // force-builds Congress Mode for a meeting regardless of its window. The edge fn NEVER persists
  // a preview build, so this can't corrupt the live snapshot. Slug-shaped only, for safety.
  const previewRaw = req.nextUrl.searchParams.get("congressPreview");
  const congressPreview = previewRaw && /^[a-z0-9-]{2,40}$/.test(previewRaw) ? previewRaw : undefined;

  // Congress rehearsal is never memoized — a preview must always reflect the current build.
  const cacheKey = congressPreview ? null : area;
  if (cacheKey) {
    const hit = memo.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json({ briefing: hit.briefing });
  }

  try {
    const fetchOnce = async () => {
      const res = await fetch(`${url}/functions/v1/briefing`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({ area, ...(congressPreview ? { congressPreview } : {}) }),
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Briefing service returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
      }
      // The edge function returns the BriefingData object directly; the page expects
      // it under `briefing`.
      return res.json();
    };

    // Single-flight: concurrent callers for the same area share one upstream request. Only a
    // SUCCESS is memoized — a failed build must be retryable immediately, not cached for 5min.
    let p = cacheKey ? inflight.get(cacheKey) : undefined;
    if (!p) {
      p = fetchOnce();
      if (cacheKey) {
        inflight.set(cacheKey, p);
        p.then((b) => memo.set(cacheKey, { at: Date.now(), briefing: b }))
          .catch(() => {})
          .finally(() => inflight.delete(cacheKey));
      }
    }
    const briefing = await p;
    return NextResponse.json({ briefing });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to reach the briefing service." },
      { status: 502 }
    );
  }
}
