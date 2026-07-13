// GET /api/brief-seen?area=GU   (authed)  ->  { seen: { [storyId]: fpAtViewTime } }
// Powers "Since your last read": the client partitions the story deck into new/updated vs
// already-seen using this map + each story's current fp. Not signed in -> empty map (the
// feature silently disappears; the brief renders in its normal order).

import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";
import { seenStories } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const contactId = await currentContactId(req);
  if (!contactId) return NextResponse.json({ seen: {} });
  const area = req.nextUrl.searchParams.get("area") ?? "GU";
  const seen = await seenStories(contactId, area).catch(() => ({}));
  return NextResponse.json({ seen });
}
