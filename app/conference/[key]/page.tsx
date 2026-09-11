import type { Metadata } from "next";
import ConferenceCoverage from "./ConferenceCoverage";
import { getConferenceWindow } from "@/lib/conferenceServer";
import "../../briefing-preview/preview.css";
import "./conference.css";

export const dynamic = "force-dynamic";

type ConferencePageProps = { params: { key: string }; searchParams: { year?: string } };

function readYear(value: string | undefined): number | undefined {
  const year = value && /^\d{4}$/.test(value) ? Number(value) : undefined;
  return year !== undefined && year >= 2000 && year <= 2100 ? year : undefined;
}

export async function generateMetadata({ params }: ConferencePageProps): Promise<Metadata> {
  return { title: `${params.key.toUpperCase()} conference coverage · The Readout` };
}

export default async function ConferencePage({ params, searchParams }: ConferencePageProps) {
  const key = /^[a-z0-9-]{1,40}$/.test(params.key) ? params.key : "";
  const payload = key ? await getConferenceWindow(key, readYear(searchParams.year)).catch(() => null) : null;
  return <ConferenceCoverage payload={payload} requestedKey={params.key} />;
}
