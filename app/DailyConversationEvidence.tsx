"use client";

import type { DailyConversationStory } from "@/lib/types";

export default function DailyConversationEvidence({
  stories,
  storyIds,
  area,
  accent,
  ink,
  muted,
  line,
}: {
  stories?: DailyConversationStory[];
  storyIds?: string[];
  area?: string;
  accent: string;
  ink: string;
  muted: string;
  line: string;
}) {
  const wanted = new Set(storyIds ?? []);
  const matched = (stories ?? []).filter((story) => wanted.has(story.id)).map((story) => {
    const relevant = area ? story.reactions.filter((reaction) => reaction.areas.includes(area)) : story.reactions;
    const reactions = area
      ? relevant.filter((reaction) => !reaction.sourceAreas?.length || reaction.sourceAreas.includes(area))
      : relevant;
    const across = area
      ? relevant.filter((reaction) => reaction.sourceAreas?.length && !reaction.sourceAreas.includes(area))
      : [];
    return { story, reactions, across };
  }).filter(({ reactions }) => reactions.length);
  if (!matched.length) return null;

  const reactionCard = (reaction: DailyConversationStory["reactions"][number], lead = false) => (
    <blockquote key={reaction.postId} style={{ margin: lead ? "7px 0 0" : 0, padding: lead ? "7px 0 7px 10px" : "9px 0", border: 0, borderLeft: lead ? `2px solid ${accent}` : 0, borderTop: lead ? 0 : `1px solid ${line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <a href={reaction.url} target="_blank" rel="noopener noreferrer" style={{ color: ink, textDecoration: "none", font: "650 12px system-ui" }}>{reaction.name}</a>
        <span style={{ color: muted, font: "500 10.5px system-ui" }}>@{reaction.handle} · ♥ {reaction.likes}</span>
      </div>
      <div style={{ color: muted, font: "400 12.5px/1.55 'Newsreader',Georgia,serif", marginTop: 4 }}>{reaction.text}</div>
    </blockquote>
  );

  return <div style={{ marginTop: 8 }}>
    <div style={{ borderTop: `1px solid ${line}`, padding: "8px 0 2px", color: accent, font: "700 10.5px system-ui", letterSpacing: ".1em", textTransform: "uppercase" }}>Physician conversation</div>
    {matched.map(({ story, reactions, across }) => (
      <div key={story.id}>
        {reactionCard(reactions[0], true)}
        {(reactions.length > 1 || across.length > 0) && <details style={{ padding: "2px 0" }}>
          <summary style={{ cursor: "pointer", listStyle: "none", color: accent, font: "600 11.5px system-ui" }}>
            See all {reactions.length} {area ? `${area} ` : ""}physician post{reactions.length === 1 ? "" : "s"} ↓
          </summary>
          <div style={{ paddingTop: 5 }}>
            <a href={story.anchor.url} target="_blank" rel="noopener noreferrer" style={{ color: muted, textDecoration: "none", font: "500 10.5px/1.4 system-ui" }}>
              Anchored by {story.anchor.label} ↗
            </a>
            {reactions.slice(1).map((reaction) => reactionCard(reaction))}
            {across.length > 0 && <div style={{ color: muted, font: "700 10px system-ui", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Across oncology</div>}
            {across.map((reaction) => reactionCard(reaction))}
          </div>
        </details>}
      </div>
    ))}
  </div>;
}
