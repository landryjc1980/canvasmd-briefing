import "server-only";

import { EDITION_AREAS } from "@/app/briefing-preview/edition";
import {
  buildReadoutEditionSnapshot,
  isReadoutEditionSnapshot,
  mergeReadoutEditionSnapshot,
  type ReadoutEditionSnapshot,
} from "@/app/briefing-preview/editionSnapshot";
import {
  activeReadoutEditionDate,
  etEditionDate,
  etEditionHour,
} from "@/app/briefing-preview/readoutRequest";
import {
  canonicalReadoutEditionSnapshot,
  readoutEditionForArea,
} from "@/app/briefing-preview/editionHistory";
import { getCachedReadoutWindow, supabaseApiKeyHeaders } from "@/lib/readoutWindowServer";

function supabaseServiceEnvironment() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service environment for edition archive.");
  return { url, key };
}

async function writeEditionRow(snapshot: ReadoutEditionSnapshot) {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(`${url}/rest/v1/readout_posts?on_conflict=tok`, {
    method: "POST",
    headers: {
      ...supabaseApiKeyHeaders(key),
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify([{
      tok: `edition:v2:${snapshot.editionDate}:All`,
      area: "All",
      kind: "edition",
      headline: `The Readout ${snapshot.editionDate} All`,
      card: snapshot,
      evidence: {},
      last_seen: snapshot.generatedAt,
    }]),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Edition archive returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function readEditionRow(editionDate: string): Promise<ReadoutEditionSnapshot | null> {
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(`edition:v2:${editionDate}:All`);
  const response = await fetch(`${url}/rest/v1/readout_posts?select=card&tok=eq.${tok}&limit=1`, {
    headers: supabaseApiKeyHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Edition lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as Array<{ card?: unknown }>;
  return isReadoutEditionSnapshot(rows[0]?.card) ? rows[0].card : null;
}

async function readEditionRows(): Promise<ReadoutEditionSnapshot[]> {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(
    `${url}/rest/v1/readout_posts?select=card&kind=eq.edition&area=eq.All&order=last_seen.desc`,
    { headers: supabaseApiKeyHeaders(key), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Edition history lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as Array<{ card?: unknown }>;
  return rows.map((row) => row.card).filter(isReadoutEditionSnapshot);
}

async function readAllEditionRows(): Promise<ReadoutEditionSnapshot[]> {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(
    `${url}/rest/v1/readout_posts?select=card&kind=eq.edition&order=last_seen.desc`,
    { headers: supabaseApiKeyHeaders(key), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Edition repair lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as Array<{ card?: unknown }>;
  return rows.map((row) => row.card).filter(isReadoutEditionSnapshot);
}

async function updateEditionRow(snapshot: ReadoutEditionSnapshot) {
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(`edition:v2:${snapshot.editionDate}:All`);
  const response = await fetch(`${url}/rest/v1/readout_posts?tok=eq.${tok}`, {
    method: "PATCH",
    headers: {
      ...supabaseApiKeyHeaders(key),
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({ card: snapshot, last_seen: snapshot.updatedAt ?? snapshot.generatedAt }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Edition update returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function priorEditions(
  editionDate: string,
  history: unknown[],
): Promise<ReadoutEditionSnapshot[]> {
  const stored = await readEditionRows();
  const candidates = [...stored, ...history.filter(isReadoutEditionSnapshot)]
    .filter(isReadoutEditionSnapshot)
    .filter((snapshot) => snapshot.area === "All")
    .filter((snapshot) => snapshot.editionDate < editionDate);
  const seen = new Set<string>();
  return candidates.filter((snapshot) => {
    const key = `${snapshot.editionDate}:${snapshot.generatedAt}:${snapshot.area}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildCanonicalEdition(now: Date): Promise<ReadoutEditionSnapshot> {
  const editionDate = activeReadoutEditionDate(now);
  const previousCanonical = await priorEditions(editionDate, []);
  const snapshots = await Promise.all(EDITION_AREAS.map(async (area) => {
    const payload = await getCachedReadoutWindow(area, "today");
    const previousForArea = previousCanonical
      .map((snapshot) => readoutEditionForArea(snapshot, area))
      .filter((snapshot): snapshot is ReadoutEditionSnapshot => !!snapshot);
    return buildReadoutEditionSnapshot(area, payload, now, previousForArea);
  }));
  const canonical = canonicalReadoutEditionSnapshot(snapshots);
  if (!canonical) throw new Error("The canonical All edition could not be built.");
  return canonical;
}

/** Consolidate exact rows saved by the old per-specialty archive. This repairs
 * history without synthesizing a story that was not present in a saved edition. */
async function consolidateStoredEditions(): Promise<string[]> {
  const stored = await readAllEditionRows();
  const dates = [...new Set(stored.map((snapshot) => snapshot.editionDate))];
  const consolidated: string[] = [];
  for (const editionDate of dates) {
    const canonical = canonicalReadoutEditionSnapshot(
      stored.filter((snapshot) => snapshot.editionDate === editionDate),
    );
    if (!canonical) continue;
    await updateEditionRow(canonical);
    consolidated.push(editionDate);
  }
  return consolidated;
}

/** Explicit, service-authenticated repair for a bad saved morning payload. */
export async function rebuildCurrentReadoutEdition(now = new Date()) {
  const editionDate = activeReadoutEditionDate(now);
  const consolidated = await consolidateStoredEditions();
  const snapshot = await buildCanonicalEdition(now);
  const existing = await readEditionRow(editionDate);
  if (existing) await updateEditionRow(snapshot);
  else await writeEditionRow(snapshot);
  return { editionDate, rebuilt: ["All"], consolidated };
}

export async function archiveCurrentReadoutEdition(now = new Date()) {
  const editionDate = etEditionDate(now);
  if (etEditionHour(now) !== 6) return { editionDate, archived: [], skipped: "outside-6am-et" };
  const snapshot = await buildCanonicalEdition(now);
  await writeEditionRow(snapshot);
  return { editionDate, archived: ["All"], skipped: null };
}

export async function mergeCurrentReadoutEditionInsertions(now = new Date()) {
  const editionDate = activeReadoutEditionDate(now);
  const snapshot = await readEditionRow(editionDate);
  if (!snapshot) {
    if (etEditionHour(now) < 6) return { editionDate, results: [], changed: false, skipped: "no-morning-edition" as const };
    const created = await buildCanonicalEdition(now);
    await writeEditionRow(created);
    return { editionDate, results: [{ area: "All", inserted: [], skipped: null, bootstrapped: true }], changed: true };
  }

  const previousCanonical = await priorEditions(editionDate, []);
  const mergedByArea = await Promise.all(EDITION_AREAS.map(async (area) => {
    const currentForArea = readoutEditionForArea(snapshot, area);
    if (!currentForArea) throw new Error(`Canonical edition cannot project ${area}.`);
    const payload = await getCachedReadoutWindow(area, "today");
    const previousForArea = previousCanonical
      .map((edition) => readoutEditionForArea(edition, area))
      .filter((edition): edition is ReadoutEditionSnapshot => !!edition);
    return mergeReadoutEditionSnapshot(currentForArea, payload, now, previousForArea);
  }));
  const merged = canonicalReadoutEditionSnapshot(mergedByArea);
  if (!merged) throw new Error("The merged canonical edition could not be built.");
  const inserted = (merged.middayInsertions ?? []).filter((id) => !(snapshot.middayInsertions ?? []).includes(id));
  const changed = JSON.stringify(merged) !== JSON.stringify(snapshot);
  if (changed) await updateEditionRow(merged);
  return {
    editionDate,
    results: [{ area: "All", inserted, skipped: changed ? null : "no-new-development", bootstrapped: false }],
    changed,
  };
}
