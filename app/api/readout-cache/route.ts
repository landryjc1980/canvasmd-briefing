import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { mergeCurrentReadoutEditionInsertions } from "@/lib/readoutEditionArchive";
import { READOUT_WINDOW_CACHE_TAG, warmReadoutWindowCache } from "@/lib/readoutWindowServer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    revalidateTag(READOUT_WINDOW_CACHE_TAG);
    let warmed = await warmReadoutWindowCache();
    const edition = await mergeCurrentReadoutEditionInsertions();
    if (edition.changed) {
      revalidateTag(READOUT_WINDOW_CACHE_TAG);
      warmed = await warmReadoutWindowCache();
    }
    return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString(), warmed, edition });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout cache refresh failed." }, { status: 500 });
  }
}
