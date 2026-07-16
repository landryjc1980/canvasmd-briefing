// Brief Gate data layer — talks to Supabase over PostgREST with the SERVICE ROLE key.
// Server-only (never import from a client component). No @supabase/supabase-js dependency:
// this app is deliberately dependency-light and already speaks to Supabase over fetch.

const URL_ = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function rest(path: string): string {
  if (!URL_) throw new Error("SUPABASE_URL is not set");
  return `${URL_}/rest/v1/${path}`;
}
function headers(extra?: Record<string, string>): Record<string, string> {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json", ...extra };
}

async function pg<T = any>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(rest(path), { ...init, cache: "no-store" });
  if (!res.ok) throw new Error(`db ${init.method} ${path} -> ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const norm = (email: string) => email.trim().toLowerCase();

export type Contact = {
  id: string; email: string; name: string | null; org_id: string | null; role: string | null;
  default_area: string | null; source: string; invited_by: string | null; status: string;
};

// ---- orgs --------------------------------------------------------------------------------
export async function upsertOrg(name: string, tumorFocus: string[] = []): Promise<string> {
  const rows = await pg<any[]>("brief_orgs?on_conflict=name", {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify([{ name: name.trim(), tumor_focus: tumorFocus }]),
  });
  return rows[0].id;
}

// ---- contacts ----------------------------------------------------------------------------
export async function upsertContact(c: {
  email: string; name?: string | null; orgId?: string | null; role?: string | null;
  defaultArea?: string | null; source?: string; invitedBy?: string | null; status?: string;
}): Promise<Contact> {
  const row: Record<string, unknown> = { email: norm(c.email) };
  if (c.name !== undefined) row.name = c.name;
  if (c.orgId !== undefined) row.org_id = c.orgId;
  if (c.role !== undefined) row.role = c.role;
  if (c.defaultArea !== undefined) row.default_area = c.defaultArea;
  if (c.source !== undefined) row.source = c.source;
  if (c.invitedBy !== undefined) row.invited_by = c.invitedBy;
  if (c.status !== undefined) row.status = c.status;
  // merge-duplicates so a re-upload / re-capture updates rather than 409s; never downgrade an
  // existing row's source/invited_by (only set them on first insert) — so we omit them when null.
  const rows = await pg<Contact[]>("brief_contacts?on_conflict=email", {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify([row]),
  });
  return rows[0];
}

export async function getContact(id: string): Promise<Contact | null> {
  const rows = await pg<Contact[]>(`brief_contacts?id=eq.${id}&limit=1`, { method: "GET", headers: headers() });
  return rows[0] ?? null;
}
export async function findContactByEmail(email: string): Promise<Contact | null> {
  const rows = await pg<Contact[]>(`brief_contacts?email=eq.${encodeURIComponent(norm(email))}&limit=1`, { method: "GET", headers: headers() });
  return rows[0] ?? null;
}
export async function touchLastSeen(id: string): Promise<void> {
  await pg(`brief_contacts?id=eq.${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ last_seen_at: new Date().toISOString() }) });
}
export async function listContacts(orgId?: string): Promise<Contact[]> {
  const q = orgId ? `&org_id=eq.${orgId}` : "";
  return pg<Contact[]>(`brief_contacts?status=neq.unsubscribed${q}&order=created_at.desc`, { method: "GET", headers: headers() });
}
// Pending access requests (people who hit the public wall but weren't added/shared) — the admin
// review queue. Newest first.
export async function listRequests(): Promise<(Contact & { created_at?: string })[]> {
  return pg(`brief_contacts?select=id,email,name,source,status,default_area,created_at&status=eq.pending&order=created_at.desc`, { method: "GET", headers: headers() });
}
export async function setContactStatus(id: string, status: string): Promise<void> {
  await pg(`brief_contacts?id=eq.${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ status }) });
}

// ---- events (the signal spine) -----------------------------------------------------------
export async function logEvent(e: { contactId: string; kind: string; area?: string | null; storyId?: string | null; meta?: unknown }): Promise<void> {
  await pg("brief_events", {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify([{ contact_id: e.contactId, kind: e.kind, area: e.area ?? null, story_id: e.storyId ?? null, meta: e.meta ?? null }]),
  });
}

// Latest story_view fingerprint per story for one contact+area — the reader's "seen" state.
// meta.fp is the story's evidence fingerprint AT VIEW TIME, so a story whose evidence changed
// since the reader saw it shows fp-mismatch -> "UPDATED" in Since-your-last-read.
export async function seenStories(contactId: string, area: string): Promise<Record<string, string>> {
  const rows = await pg<{ story_id: string | null; meta: any; ts: string }[]>(
    `brief_events?contact_id=eq.${contactId}&kind=eq.story_view&area=eq.${encodeURIComponent(area)}&select=story_id,meta,ts&order=ts.desc&limit=500`,
    { method: "GET", headers: headers() },
  );
  const seen: Record<string, string> = {};
  for (const r of rows) {
    if (!r.story_id || seen[r.story_id] !== undefined) continue; // rows are ts-desc → first hit = latest view
    seen[r.story_id] = typeof r.meta?.fp === "string" ? r.meta.fp : "";
  }
  return seen;
}

// ---- invites (colleague share -> referral graph) -----------------------------------------
export type Invite = { id: string; code: string; inviter_id: string | null; org_id: string | null; max_uses: number; uses: number; expires_at: string | null };
export async function createInvite(inviterId: string, orgId: string | null, code: string, maxUses = 3, ttlDays = 30): Promise<Invite> {
  const expires = new Date(Date.now() + ttlDays * 86400_000).toISOString();
  const rows = await pg<Invite[]>("brief_invites", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify([{ code, inviter_id: inviterId, org_id: orgId, max_uses: maxUses, expires_at: expires }]),
  });
  return rows[0];
}
export async function getInvite(code: string): Promise<Invite | null> {
  const rows = await pg<Invite[]>(`brief_invites?code=eq.${encodeURIComponent(code)}&limit=1`, { method: "GET", headers: headers() });
  return rows[0] ?? null;
}
export async function bumpInviteUse(id: string, current: number): Promise<void> {
  await pg(`brief_invites?id=eq.${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ uses: current + 1 }) });
}

// ---- engagement rollup (admin "who's hot") -----------------------------------------------
export type Engagement = {
  contact_id: string; email: string; name: string | null; org: string | null; role: string | null;
  default_area: string | null; source: string; status: string; invited_by_email: string | null;
  opens: number; views: number; story_views: number; shares: number; active_weeks: number; last_event_at: string | null;
};
export async function engagement(): Promise<Engagement[]> {
  return pg<Engagement[]>("v_brief_engagement?order=last_event_at.desc.nullslast", { method: "GET", headers: headers() });
}
