import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseApiKeyHeaders } from "@/lib/readoutWindowServer";
import type { ConferenceMeeting, ConferenceWindowPayload } from "@/lib/conference";

const CONFERENCE_REVALIDATE_SECONDS = 5 * 60;
const CONFERENCE_TIMEOUT_MS = 5_000;

function conferenceEnvironment() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars.");
  return { url, key };
}

async function invokeConference(body: Record<string, unknown>): Promise<unknown> {
  const { url, key } = conferenceEnvironment();
  const endpoint = process.env.BRIEFING_FUNCTION_URL ?? `${url}/functions/v1/briefing`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFERENCE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...supabaseApiKeyHeaders(key) },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Conference service returned ${response.status}.`);
  return response.json();
}

export const getCachedConferenceList = unstable_cache(async (): Promise<ConferenceMeeting[]> => {
  const payload = await invokeConference({ mode: "conference-list" }) as { meetings?: unknown };
  return Array.isArray(payload.meetings) ? payload.meetings as ConferenceMeeting[] : [];
}, ["conference-list-v1"], { revalidate: CONFERENCE_REVALIDATE_SECONDS });

export async function getConferenceWindow(seriesKey: string, year?: number): Promise<ConferenceWindowPayload> {
  const key = `conference-window-v3:${seriesKey}:${year ?? "latest"}`;
  return unstable_cache(async () => {
    const payload = await invokeConference({ mode: "conference-window", seriesKey, ...(year ? { year } : {}) });
    const window = payload as ConferenceWindowPayload;
    const meeting = window.meeting;
    if (!meeting || meeting.key !== seriesKey || (year !== undefined && meeting.year !== year)) {
      return { meeting: null, generatedAt: window.generatedAt ?? "", coverage: { cards: [], articles: [], episodes: [], reports: [] } };
    }
    return window;
  }, [key], { revalidate: CONFERENCE_REVALIDATE_SECONDS })();
}
