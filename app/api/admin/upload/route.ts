// POST /api/admin/upload   (admin)   body: { csv }  or raw text/csv
// Seed the send list. CSV columns (header row required): email, name, org, role, area
// org is upserted to brief_orgs; each row becomes a source=seed contact.

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/gateServer";
import { upsertOrg, upsertContact } from "@/lib/db";

export const dynamic = "force-dynamic";

// minimal CSV: handles quoted fields and embedded commas/quotes, one record per line
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") ?? "";
  let csv = "";
  if (ct.includes("application/json")) csv = String((await req.json().catch(() => ({})))?.csv ?? "");
  else csv = await req.text();
  const records = parseCsv(csv);
  if (!records.length) return NextResponse.json({ ok: false, error: "No rows found. Expected header: email,name,org,role,area" }, { status: 400 });

  const orgCache = new Map<string, string>();
  let contacts = 0, skipped = 0;
  const errors: string[] = [];
  for (const r of records) {
    const email = (r.email ?? "").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped++; continue; }
    try {
      let orgId: string | null = null;
      const orgName = r.org?.trim();
      if (orgName) {
        if (!orgCache.has(orgName)) orgCache.set(orgName, await upsertOrg(orgName));
        orgId = orgCache.get(orgName)!;
      }
      await upsertContact({ email, name: r.name || null, orgId, role: r.role || null, defaultArea: r.area || null, source: "seed", status: "active" });
      contacts++;
    } catch (e: any) {
      errors.push(`${email}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  return NextResponse.json({ ok: true, contacts, orgs: orgCache.size, skipped, errors: errors.slice(0, 10) });
}
