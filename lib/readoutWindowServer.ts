import "server-only";

import { unstable_cache } from "next/cache";
import type { ReadoutWindowPayload } from "@/lib/types";
import {
  readoutWindowDays,
  readoutWindowEvidenceTargets,
  type ReadoutWindow,
} from "@/app/briefing-preview/readoutRequest";
import { EDITION_AREAS, type EditionArea } from "@/app/briefing-preview/edition";

export const READOUT_WINDOW_CACHE_TAG = "readout-window-v1";
export const READOUT_WINDOW_REVALIDATE_SECONDS = 60 * 60;

const fetchReadoutWindow = unstable_cache(
  async (area: EditionArea, window: ReadoutWindow, cardsJson: string): Promise<ReadoutWindowPayload> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars.");
    const briefingFunctionUrl = process.env.BRIEFING_FUNCTION_URL ?? `${url}/functions/v1/briefing`;
    const response = await fetch(briefingFunctionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({
        mode: "readout-window",
        area,
        days: readoutWindowDays(window),
        cards: JSON.parse(cardsJson),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Briefing readout-window returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    return response.json() as Promise<ReadoutWindowPayload>;
  },
  [READOUT_WINDOW_CACHE_TAG],
  { revalidate: READOUT_WINDOW_REVALIDATE_SECONDS, tags: [READOUT_WINDOW_CACHE_TAG] },
);

export function getCachedReadoutWindow(
  area: EditionArea,
  window: ReadoutWindow,
): Promise<ReadoutWindowPayload> {
  return fetchReadoutWindow(area, window, JSON.stringify(readoutWindowEvidenceTargets(area, window)));
}

export async function warmReadoutWindowCache() {
  const requests = EDITION_AREAS.flatMap((area) => (["today", "7d"] as const).map((window) => ({ area, window })));
  const warmed: Array<{ area: EditionArea; window: ReadoutWindow; generatedAt: string }> = [];

  for (let index = 0; index < requests.length; index += 4) {
    const batch = requests.slice(index, index + 4);
    const results = await Promise.all(batch.map(async ({ area, window }) => {
      const payload = await getCachedReadoutWindow(area, window);
      return { area, window, generatedAt: payload.generatedAt };
    }));
    warmed.push(...results);
  }
  return warmed;
}
