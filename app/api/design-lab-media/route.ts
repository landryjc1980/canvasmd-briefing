import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";
import { designLabArticleMedia } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await currentContactId(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const urls = Array.isArray(body?.urls) ? body.urls.filter((url: unknown): url is string => typeof url === "string") : [];
  const media = await designLabArticleMedia(urls);
  return NextResponse.json({ ok: true, media });
}
