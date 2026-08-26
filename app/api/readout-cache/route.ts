import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { READOUT_WINDOW_CACHE_TAG, warmReadoutWindowCache } from "@/lib/readoutWindowServer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function refreshReadoutCache(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const acceptedTokens = [process.env.CRON_SECRET, process.env.READOUT_CACHE_TOKEN]
    .filter((value): value is string => !!value);
  if (!acceptedTokens.some((token) => authorization === `Bearer ${token}`)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    revalidateTag(READOUT_WINDOW_CACHE_TAG);
    const warmed = await warmReadoutWindowCache();
    return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString(), warmed });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout cache refresh failed." }, { status: 500 });
  }
}

export const GET = refreshReadoutCache;
export const POST = refreshReadoutCache;
