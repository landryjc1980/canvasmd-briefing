import "server-only";

import { EDITION_AREAS, type EditionArea } from "@/app/briefing-preview/edition";
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
import { getCachedReadoutWindow, supabaseApiKeyHeaders } from "@/lib/readoutWindowServer";

function supabaseServiceEnvironment() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service environment for edition archive.");
  return { url, key };
}

async function writeEditionRow(area: string, snapshot: ReadoutEditionSnapshot) {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(`${url}/rest/v1/readout_posts?on_conflict=tok`, {
    method: "POST",
    headers: {
      ...supabaseApiKeyHeaders(key),
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify([{
      tok: `edition:v2:${snapshot.editionDate}:${area}`,
      area,
      kind: "edition",
      headline: `The Readout ${snapshot.editionDate} ${area}`,
      card: snapshot,
      evidence: {},
      last_seen: snapshot.generatedAt,
    }]),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Edition archive returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function readEditionRow(area: EditionArea, editionDate: string): Promise<ReadoutEditionSnapshot | null> {
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(`edition:v2:${editionDate}:${area}`);
  const response = await fetch(`${url}/rest/v1/readout_posts?select=card&tok=eq.${tok}&limit=1`, {
    headers: supabaseApiKeyHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Edition lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as Array<{ card?: unknown }>;
  return isReadoutEditionSnapshot(rows[0]?.card) ? rows[0].card : null;
}

async function updateEditionRow(snapshot: ReadoutEditionSnapshot) {
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(`edition:v2:${snapshot.editionDate}:${snapshot.area}`);
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

export async function archiveCurrentReadoutEdition(now = new Date()) {
  const editionDate = etEditionDate(now);
  if (etEditionHour(now) !== 6) return { editionDate, archived: [], skipped: "outside-6am-et" };

  const snapshots = await Promise.all(EDITION_AREAS.map(async (area) => {
    const [today, history] = await Promise.all([
      getCachedReadoutWindow(area, "today"),
      getCachedReadoutWindow(area, "7d"),
    ]);
    return buildReadoutEditionSnapshot(
      area,
      today,
      now,
      (history.editionHistory ?? []).filter(isReadoutEditionSnapshot),
    );
  }));
  await Promise.all(snapshots.map((snapshot) => writeEditionRow(snapshot.area, snapshot)));
  return { editionDate, archived: snapshots.map((snapshot) => snapshot.area), skipped: null };
}

export async function mergeCurrentReadoutEditionInsertions(now = new Date()) {
  const editionDate = activeReadoutEditionDate(now);
  const results = await Promise.all(EDITION_AREAS.map(async (area) => {
    const snapshot = await readEditionRow(area, editionDate);
    if (!snapshot) {
      if (etEditionHour(now) < 6) return { area, inserted: [] as string[], skipped: "no-morning-edition" as const };
      const [payload, history] = await Promise.all([
        getCachedReadoutWindow(area, "today"),
        getCachedReadoutWindow(area, "7d"),
      ]);
      const created = buildReadoutEditionSnapshot(
        area,
        payload,
        now,
        (history.editionHistory ?? []).filter(isReadoutEditionSnapshot),
      );
      await writeEditionRow(area, created);
      return { area, inserted: [] as string[], skipped: null, bootstrapped: true };
    }
    const payload = await getCachedReadoutWindow(area, "today");
    const merged = mergeReadoutEditionSnapshot(snapshot, payload, now);
    const inserted = (merged.middayInsertions ?? []).filter((id) => !(snapshot.middayInsertions ?? []).includes(id));
    const designationChanged = merged.designationCards.length !== snapshot.designationCards.length;
    const listenChanged = merged.listen.some((entry, index) =>
      (entry.episode?.episodeId || entry.item.url || entry.item.title) !==
      (snapshot.listen[index]?.episode?.episodeId || snapshot.listen[index]?.item.url || snapshot.listen[index]?.item.title));
    if (!inserted.length && !designationChanged && !listenChanged) return { area, inserted, skipped: "no-new-development" as const, bootstrapped: false };
    await updateEditionRow(merged);
    return { area, inserted, skipped: null, bootstrapped: false };
  }));
  return { editionDate, results, changed: results.some((result) => result.skipped === null) };
}
