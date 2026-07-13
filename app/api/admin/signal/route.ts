// GET /api/admin/signal   (admin)  ->  engagement rollup ("who's hot")

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/gateServer";
import { engagement } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rows = await engagement().catch((e) => { throw e; });
  return NextResponse.json({ ok: true, rows });
}
