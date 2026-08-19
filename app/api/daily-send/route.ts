// POST /api/daily-send  (admin)        { test?: "email@x.com" } — send one test edition
// GET  /api/daily-send  (Vercel cron)  Authorization: Bearer CRON_SECRET — the morning run
//
// Sends The Daily to opted-in active contacts. Edition per contact: default_area when set
// (strict — only that area's paragraphs/stories/items; if the area earned nothing today the
// contact is SKIPPED, not sent filler), else the all-oncology edition. Only fires when
// today's daily_readout row exists with show=true (the deterministic worth-showing gate),
// so a quiet day means an empty inbox — that's the contract that keeps opens high.
// brief_daily_sends makes re-runs idempotent per (contact, date).

import { NextRequest, NextResponse } from "next/server";
import { isAdmin, siteUrl } from "@/lib/gateServer";
import { mintMagicToken, mintUnsubToken } from "@/lib/gate";
import { listDailyOptIns, findContactByEmail, dailySendsFor, recordDailySend, logEvent, type Contact } from "@/lib/db";
import { fetchTopStories, renderDailyEmail, sendDailyEmail } from "@/lib/dailyMail";
import type { DailyReadout } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_AREAS = new Set(["GU", "Lung", "GI", "Breast", "Heme", "Gyn", "Skin"]);

async function latestDaily(maxAgeDays: number): Promise<DailyReadout | null> {
  const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) return null;
  const since = new Date(Date.now() - maxAgeDays * 86400_000).toISOString().slice(0, 10);
  const res = await fetch(
    `${URL_}/rest/v1/daily_readout?select=date,lead,payload,generated_at&show=eq.true&date=gte.${since}&order=date.desc&limit=1`,
    { headers: { apikey: KEY, authorization: `Bearer ${KEY}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function run(req: NextRequest, testEmail: string | null): Promise<NextResponse> {
  const base = siteUrl(req);
  // Cron sends today's edition only; a test can reach back a day so it works any time.
  const daily = await latestDaily(testEmail ? 2 : 0);
  if (!daily) return NextResponse.json({ ok: true, sent: 0, reason: "no edition today (gate or generator)" });

  const tops = await fetchTopStories();

  let recipients: Contact[];
  if (testEmail) {
    const c = await findContactByEmail(testEmail);
    if (!c) return NextResponse.json({ ok: false, error: "Test address not found in contacts. Upload it first." }, { status: 404 });
    recipients = [c];
  } else {
    recipients = await listDailyOptIns();
  }

  const already = testEmail ? new Set<string>() : await dailySendsFor(daily.date);

  let sent = 0, skippedEmpty = 0, skippedDup = 0;
  const errors: string[] = [];
  for (const c of recipients) {
    if (already.has(c.id)) { skippedDup++; continue; }
    const area = c.default_area && VALID_AREAS.has(c.default_area) ? c.default_area : null;
    const token = await mintMagicToken(c.id);
    const linkForArea = (a: string) => `${base}/api/brief-auth?t=${token}&area=${encodeURIComponent(a)}`;
    const siteLink = area ? linkForArea(area) : `${base}/api/brief-auth?t=${token}`;
    const unsubUrl = `${base}/api/brief-unsub?c=${await mintUnsubToken(c.id)}`;
    const allLink = `${base}/api/brief-auth?t=${token}`; // the cross-link must open All oncology
    const rendered = renderDailyEmail({ daily, tops, area, siteLink, allLink, linkForArea, unsubUrl });
    if (!rendered) { skippedEmpty++; continue; } // area earned nothing today — no filler
    const r = await sendDailyEmail({ email: c.email, subject: rendered.subject, html: rendered.html, unsubUrl }).catch((e) => ({ ok: false, error: String(e) }));
    if (r.ok) {
      sent++;
      if (!testEmail) await recordDailySend(c.id, daily.date, area).catch(() => {});
      await logEvent({ contactId: c.id, kind: "daily_email_sent", area }).catch(() => {});
    } else {
      errors.push(`${c.email}: ${(r as { error?: string }).error}`);
    }
  }
  return NextResponse.json({ ok: true, date: daily.date, sent, skippedEmpty, skippedDup, errors: errors.slice(0, 10) });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({} as { test?: string }));
  return run(req, body?.test ? String(body.test) : null);
}

// Vercel cron entry — GET with the CRON_SECRET bearer Vercel attaches when the env var is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return run(req, null);
}
