import { NextRequest, NextResponse } from "next/server";
import { prepublishCurrentReadoutEdition } from "@/lib/readoutEditionArchive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Service-only preparation for Oncology Mornings. It deliberately does not warm
// or write the public finished-window cache: the reader remains on yesterday's
// edition until the existing 06:00 ET archive route rolls over.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const prepublication = await prepublishCurrentReadoutEdition();
    return NextResponse.json({ ok: true, prepublication });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout prepublication failed." }, { status: 500 });
  }
}
