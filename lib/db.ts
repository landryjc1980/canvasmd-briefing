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
  daily_opt_in?: boolean;
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
  dailyOptIn?: boolean;
}): Promise<Contact> {
  const row: Record<string, unknown> = { email: norm(c.email) };
  if (c.name !== undefined) row.name = c.name;
  if (c.orgId !== undefined) row.org_id = c.orgId;
  if (c.role !== undefined) row.role = c.role;
  if (c.defaultArea !== undefined) row.default_area = c.defaultArea;
  if (c.source !== undefined) row.source = c.source;
  if (c.invitedBy !== undefined) row.invited_by = c.invitedBy;
  if (c.status !== undefined) row.status = c.status;
  if (c.dailyOptIn !== undefined) row.daily_opt_in = c.dailyOptIn;
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
// The Daily email — opted-in active contacts, and the per-(contact, date) send ledger that
// makes cron re-runs and manual invokes idempotent.
export async function listDailyOptIns(): Promise<Contact[]> {
  return pg<Contact[]>(`brief_contacts?status=eq.active&daily_opt_in=is.true&order=created_at.asc`, { method: "GET", headers: headers() });
}
export async function setDailyOptIn(id: string, optIn: boolean): Promise<void> {
  await pg(`brief_contacts?id=eq.${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ daily_opt_in: optIn }) });
}
export async function dailySendsFor(date: string): Promise<Set<string>> {
  const rows = await pg<{ contact_id: string }[]>(`brief_daily_sends?date=eq.${date}&select=contact_id`, { method: "GET", headers: headers() });
  return new Set(rows.map((r) => r.contact_id));
}
export async function recordDailySend(contactId: string, date: string, area: string | null): Promise<void> {
  await pg(`brief_daily_sends`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates" }),
    body: JSON.stringify([{ contact_id: contactId, date, area }]),
  });
}

// Pending access requests (people who hit the public wall but weren't added/shared) — the admin
// review queue. Newest first.
export async function listRequests(): Promise<(Contact & { created_at?: string })[]> {
  return pg(`brief_contacts?select=id,email,name,source,status,default_area,created_at&status=eq.pending&order=created_at.desc`, { method: "GET", headers: headers() });
}
export async function setContactStatus(id: string, status: string): Promise<void> {
  await pg(`brief_contacts?id=eq.${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ status }) });
}
// The reader's chosen primary specialty (default landing area) — stored on the contact so it
// FOLLOWS THEM across devices, not just the browser it was set in.
export async function setDefaultArea(id: string, area: string): Promise<void> {
  await pg(`brief_contacts?id=eq.${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ default_area: area }) });
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

export type DesignLabArticleMedia = {
  url: string;
  imageUrl: string | null;
  publisher: string | null;
  journal: string | null;
  domain: string | null;
};

// The live Brief payload is intentionally lean. The Design Lab can opt into the richer visual
// layer already stored for CanvasMD articles without changing reader-facing payload contracts.
export async function designLabArticleMedia(urls: string[]): Promise<DesignLabArticleMedia[]> {
  const unique = [...new Set(urls.filter((url) => /^https?:\/\//.test(url)))].slice(0, 24);
  const rows = await Promise.all(unique.map(async (url) => {
    const found = await pg<Array<{ canonical_url: string; image_url: string | null; publisher: string | null; journal: string | null; domain: string | null }>>(
      `x_shared_articles?canonical_url=eq.${encodeURIComponent(url)}&select=canonical_url,image_url,publisher,journal,domain&limit=1`,
      { method: "GET", headers: headers() },
    );
    const row = found[0];
    return row ? { url: row.canonical_url, imageUrl: row.image_url, publisher: row.publisher, journal: row.journal, domain: row.domain } : null;
  }));
  return rows.filter((row): row is DesignLabArticleMedia => row !== null);
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

const READOUT_EVENT_KINDS = ["story_view", "source_open", "podcast_play", "section_jump", "show_more"] as const;
export type ReadoutEventKind = typeof READOUT_EVENT_KINDS[number];
export type ReadoutEngagement = {
  capturedAt: string;
  firstEventAt: string | null;
  uniqueReaders30: number;
  totals: Record<ReadoutEventKind, { last7: number; last30: number; readers30: number }>;
  byArea: Array<{ area: string; counts: Record<ReadoutEventKind, number> }>;
  topContent: Array<{ storyId: string; label: string; area: string; views: number; sourceOpens: number; podcastPlays: number; total: number }>;
  sectionJumps: Array<{ section: string; count: number }>;
};

type ReadoutEventRow = {
  contact_id: string | null;
  kind: ReadoutEventKind;
  area: string | null;
  story_id: string | null;
  meta: unknown;
  ts: string;
};

const emptyEventCounts = (): Record<ReadoutEventKind, number> => Object.fromEntries(
  READOUT_EVENT_KINDS.map((kind) => [kind, 0]),
) as Record<ReadoutEventKind, number>;

// Compact product-usage summary for /admin. We intentionally aggregate server-side so the
// admin browser never receives contact-level event rows. PostgREST caps responses, so page
// rather than quietly treating the first 1,000 events as the whole month.
export async function readoutEngagement(): Promise<ReadoutEngagement> {
  const now = Date.now();
  const since30 = new Date(now - 30 * 86400_000).toISOString();
  const since7 = now - 7 * 86400_000;
  const rows: ReadoutEventRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await pg<ReadoutEventRow[]>(
      `brief_events?select=contact_id,kind,area,story_id,meta,ts&kind=in.(${READOUT_EVENT_KINDS.join(",")})&ts=gte.${encodeURIComponent(since30)}&order=ts.desc&limit=${pageSize}&offset=${offset}`,
      { method: "GET", headers: headers() },
    );
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const totals = Object.fromEntries(READOUT_EVENT_KINDS.map((kind) => [kind, { last7: 0, last30: 0, readers30: 0 }])) as ReadoutEngagement["totals"];
  const readersByKind = Object.fromEntries(READOUT_EVENT_KINDS.map((kind) => [kind, new Set<string>()])) as Record<ReadoutEventKind, Set<string>>;
  const allReaders = new Set<string>();
  const areas = new Map<string, Record<ReadoutEventKind, number>>();
  const content = new Map<string, ReadoutEngagement["topContent"][number]>();
  const sections = new Map<string, number>();

  for (const row of rows) {
    if (!READOUT_EVENT_KINDS.includes(row.kind)) continue;
    totals[row.kind].last30 += 1;
    if (Date.parse(row.ts) >= since7) totals[row.kind].last7 += 1;
    if (row.contact_id) {
      allReaders.add(row.contact_id);
      readersByKind[row.kind].add(row.contact_id);
    }

    const area = row.area || "All";
    const areaCounts = areas.get(area) ?? emptyEventCounts();
    areaCounts[row.kind] += 1;
    areas.set(area, areaCounts);

    const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? row.meta as Record<string, unknown>
      : {};
    if (row.kind === "section_jump") {
      const section = typeof meta.section === "string" ? meta.section : "unknown";
      sections.set(section, (sections.get(section) ?? 0) + 1);
    }
    if (row.story_id && (row.kind === "story_view" || row.kind === "source_open" || row.kind === "podcast_play")) {
      const key = `${area}:${row.story_id}`;
      const item = content.get(key) ?? {
        storyId: row.story_id,
        label: typeof meta.label === "string" && meta.label.trim() ? meta.label : row.story_id,
        area,
        views: 0,
        sourceOpens: 0,
        podcastPlays: 0,
        total: 0,
      };
      if (item.label === item.storyId && typeof meta.label === "string" && meta.label.trim()) item.label = meta.label;
      if (row.kind === "story_view") item.views += 1;
      if (row.kind === "source_open") item.sourceOpens += 1;
      if (row.kind === "podcast_play") item.podcastPlays += 1;
      item.total += 1;
      content.set(key, item);
    }
  }
  for (const kind of READOUT_EVENT_KINDS) totals[kind].readers30 = readersByKind[kind].size;

  const areaOrder = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin", "All"];
  return {
    capturedAt: new Date(now).toISOString(),
    firstEventAt: rows.at(-1)?.ts ?? null,
    uniqueReaders30: allReaders.size,
    totals,
    byArea: [...areas.entries()]
      .map(([area, counts]) => ({ area, counts }))
      .sort((a, b) => (areaOrder.indexOf(a.area) < 0 ? 99 : areaOrder.indexOf(a.area)) - (areaOrder.indexOf(b.area) < 0 ? 99 : areaOrder.indexOf(b.area)) || a.area.localeCompare(b.area)),
    topContent: [...content.values()].sort((a, b) => b.total - a.total || b.views - a.views).slice(0, 12),
    sectionJumps: [...sections.entries()].map(([section, count]) => ({ section, count })).sort((a, b) => b.count - a.count),
  };
}

// ---- pipeline health (admin "data health") -----------------------------------------------
// Reads the SAME probes the daily pipeline-health email uses, so the admin page and the
// alert can never disagree. Two halves, because they catch different failures:
//   freshness — "did each stage produce output recently?"
//   backlog   — "is unprocessed work piling up?"  Freshness alone is blind to a stage that
//               still writes rows but writes them unfinished (the 2026-07-20 embedding
//               outage stayed green for days while 13% of the corpus sat unembedded).
export type Freshness = {
  name: string; table: string; ts_column: string; latest: string | null;
  max_staleness_hours: number; hours_stale: number | null; stale: boolean;
};
export type Backlog = {
  name: string; table: string; backlog: number | null;
  max_backlog: number; note: string | null; over: boolean;
};
export type CronFailure = { jobname: string; message: string; start_time: string };

async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return pg<T>(`rpc/${fn}`, { method: "POST", headers: headers(), body: JSON.stringify(args) });
}
export async function freshnessSnapshot(): Promise<{ checks: Freshness[]; cron_failures: CronFailure[] }> {
  const d = await rpc<any>("pipeline_health_snapshot", { cron_lookback_hours: 26 });
  return { checks: d?.checks ?? [], cron_failures: d?.cron_failures ?? [] };
}
export async function backlogSnapshot(): Promise<Backlog[]> {
  const d = await rpc<any>("pipeline_backlog_snapshot");
  return d?.backlogs ?? [];
}
export async function lastHealthRun(): Promise<{ ran_at: string; ok: boolean } | null> {
  const r = await pg<any[]>("pipeline_health_runs?select=ran_at,ok&order=ran_at.desc&limit=1", { method: "GET", headers: headers() });
  return r?.[0] ?? null;
}

// ---- database stats (Dashboard tab) ------------------------------------------------------
// admin_db_stats() (migration 0203) computes the whole stats jsonb in one SQL call;
// admin_stats_daily keeps one snapshot per day (cron 07:50 UTC) for day-over-day deltas.
// We also upsert today's row on every load so the baseline exists even if the cron
// hadn't run yet — the delta always compares against the previous day's LAST capture.
export type PeopleTierBreakdown = {
  total: number; npi: number; international: number; md_no_npi: number; other: number;
  // International detail (no NPI registry exists for them): identified = clinician
  // person_type + known affiliation. Added in migration 0204 — absent on older snapshots.
  intl_identified?: number; intl_md_credential?: number; intl_x_linked?: number;
};
export type DbStats = {
  captured_at: string;
  people: {
    total: number; hosts: number; guests: number;
    guests_hosts: PeopleTierBreakdown; x_users: PeopleTierBreakdown;
    // v2 (migration 0205) — composition overlap + voice ID + NPI quality.
    // Optional: older snapshots lack them.
    guests_hosts_total?: number; x_users_total?: number;
    both?: number; guests_hosts_only?: number; x_only?: number; neither?: number;
    voice_id?: { total: number; guests_hosts: number; gold: number; silver: number; provisional: number };
    npi_verified?: number; npi_inferred?: number;
  };
  corpus: {
    shows: number; episodes: number; episodes_transcribed: number; transcript_chunks: number;
    chunks_unembedded: number; appearances: number; x_sources_active: number; x_posts: number;
    // v3 (migration 0206) — sum(duration_seconds) in hours, all vs transcribed.
    audio_hours_total?: number; audio_hours_transcribed?: number;
  };
  // v3 (migration 0206) — per Readout area; same tumor_categories containment the
  // briefing edge fn uses. Areas overlap (multi-tagged episodes) — don't sum rows.
  areas?: AreaCoverage[];
  velocity?: { new_people_7d: number; new_episodes_7d: number; new_posts_7d: number; new_appearances_7d: number };
  readout: { contacts_total: number; contacts_active: number };
};
export type AreaCoverage = { area: string; episodes: number; transcribed: number; shows: number; x_sources: number };

// Compact per-day series for sparklines, oldest→newest. Reads the snapshot table
// directly — one row per day, so 60 rows ≈ two months of trend.
export type StatsHistoryPoint = {
  day: string; guests_hosts: number; x_users: number; npi: number;
  episodes_transcribed: number; x_posts: number; people_total: number;
};
export async function statsHistory(limit = 60): Promise<StatsHistoryPoint[]> {
  const rows = await pg<{ day: string; stats: DbStats }[]>(
    `admin_stats_daily?select=day,stats&order=day.desc&limit=${limit}`,
    { method: "GET", headers: headers() },
  );
  return (rows ?? []).reverse().map((r) => ({
    day: r.day,
    guests_hosts: r.stats?.people?.guests_hosts?.total ?? 0,
    x_users: r.stats?.people?.x_users?.total ?? 0,
    npi: r.stats?.people?.guests_hosts?.npi ?? 0,
    episodes_transcribed: r.stats?.corpus?.episodes_transcribed ?? 0,
    x_posts: r.stats?.corpus?.x_posts ?? 0,
    people_total: r.stats?.people?.total ?? 0,
  }));
}

export type TrendingX = {
  name: string; handle: string; followers: number | null;
  delta_7d: number | null; delta_30d: number | null; pct_growth_7d: number | null;
  avatar_url: string | null; source_type: string | null; primary_institution: string | null;
  person_name: string | null; person_has_npi: boolean | null; account_status: string;
};
export type ActiveX = {
  name: string; handle: string; posts_7d: number;
  follower_count: number | null; avatar_url: string | null; source_type: string | null;
};

export const trendingX = (n = 15): Promise<TrendingX[]> => rpc("admin_trending_x", { n });
export const xActivity7d = (n = 15): Promise<ActiveX[]> => rpc("admin_x_activity_7d", { n });

// Who the panel amplifies (RT + quote edges, migration 0208). Ranked by DISTINCT
// panel amplifiers; in_panel=false rows are follow-gaps the discovery cron chases.
export type AmplifiedX = {
  handle: string; name: string; amplifications: number; rts: number; quotes: number;
  amplifiers: number; in_panel: boolean; feed_active?: boolean; avatar_url: string | null; followers: number | null;
};
export const amplifiedX = (days = 30, n = 15, kind: "all" | "rt" | "quote" = "all"): Promise<AmplifiedX[]> =>
  rpc("admin_amplified_x", { p_days: days, p_n: n, p_kind: kind });

export async function dbStats(): Promise<{ stats: DbStats; prevDay: string | null; prev: DbStats | null }> {
  const stats = await rpc<DbStats>("admin_db_stats");
  const today = new Date().toISOString().slice(0, 10); // UTC, matching the cron's current_date
  await pg("admin_stats_daily?on_conflict=day", {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify([{ day: today, stats }]),
  }).catch(() => {}); // snapshot write is best-effort; never block the read
  const prevRows = await pg<{ day: string; stats: DbStats }[]>(
    `admin_stats_daily?select=day,stats&day=lt.${today}&order=day.desc&limit=1`,
    { method: "GET", headers: headers() },
  );
  return { stats, prevDay: prevRows?.[0]?.day ?? null, prev: prevRows?.[0]?.stats ?? null };
}
