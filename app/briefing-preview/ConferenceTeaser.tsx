"use client";

import Link from "next/link";
import type { ConferenceMeeting } from "@/lib/conference";
import { conferenceDateRange, conferenceHref, conferenceStatusLabel, selectConference } from "@/lib/conference";
import type { EditionArea } from "./edition";

export default function ConferenceTeaser({ meetings, area }: { meetings: ConferenceMeeting[]; area: EditionArea }) {
  const meeting = selectConference(meetings, area);
  if (!meeting) return null;
  return (
    <aside className="er-conference-teaser" aria-label="Conference coverage">
      <div className="er-conference-teaser-copy">
        <p className="er-conference-kicker"><span aria-hidden="true" />{conferenceStatusLabel(meeting)}</p>
        <h3>{meeting.shortName}</h3>
        <p className="er-conference-name">{meeting.name}</p>
        <p>{conferenceDateRange(meeting)}{meeting.location ? ` · ${meeting.location}` : ""}</p>
      </div>
      <Link className="er-conference-link" href={conferenceHref(meeting)}>View coverage <span aria-hidden="true">→</span></Link>
    </aside>
  );
}
