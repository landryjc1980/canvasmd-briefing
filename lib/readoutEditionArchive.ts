import "server-only";

import { EDITION_AREAS } from "@/app/briefing-preview/edition";
import { buildReadoutEditionSnapshot, etEditionDate, etEditionHour } from "@/app/briefing-preview/editionSnapshot";
import { getCachedReadoutWindow } from "@/lib/readoutWindowServer";

async function writeEditionRow(area: string, snapshot: ReturnType<typeof buildReadoutEditionSnapshot>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service environment for edition archive.");
  const response = await fetch(`${url}/rest/v1/readout_posts?on_conflict=tok`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify([{
      tok: `edition:${snapshot.editionDate}:${area}`,
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

export async function archiveCurrentReadoutEdition(now = new Date()) {
  const editionDate = etEditionDate(now);
  if (etEditionHour(now) !== 6) return { editionDate, archived: [], skipped: "outside-6am-et" };

  const snapshots = await Promise.all(EDITION_AREAS.map(async (area) =>
    buildReadoutEditionSnapshot(area, await getCachedReadoutWindow(area, "today"), now)));
  await Promise.all(snapshots.map((snapshot) => writeEditionRow(snapshot.area, snapshot)));
  return { editionDate, archived: snapshots.map((snapshot) => snapshot.area), skipped: null };
}
