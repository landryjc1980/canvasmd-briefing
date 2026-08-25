// The Daily sender is disabled. Keep the authenticated route shape stable for old admin
// clients, but do not read daily_readout, render email, or send to contacts.

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/gateServer";

export const dynamic = "force-dynamic";

async function run(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, sent: 0, disabled: true, reason: "daily_disabled" });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  await req.json().catch(() => ({}));
  return run();
}

// Vercel cron entry — GET with the CRON_SECRET bearer Vercel attaches when the env var is set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return run();
}
