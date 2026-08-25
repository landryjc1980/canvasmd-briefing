import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";

export const dynamic = "force-dynamic";

// The Daily product surface is disabled. Keep the route shape stable for old clients,
// but never expose historical payloads.

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    // currentContactId verifies both the signature and the contact's current active status.
    if (!(await currentContactId(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.json({ daily: null, disabled: true });
}
