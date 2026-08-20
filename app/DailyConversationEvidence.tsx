"use client";

import type { DailyConversationStory } from "@/lib/types";

export default function DailyConversationEvidence({
  stories,
  storyIds,
  accent,
  ink,
  muted,
  line,
}: {
  stories?: DailyConversationStory[];
  storyIds?: string[];
  accent: string;
  ink: string;
  muted: string;
  line: string;
}) {
  const wanted = new Set(storyIds ?? []);
  const matched = (stories ?? []).filter((story) => wanted.has(story.id) && story.reactions.length);
  if (!matched.length) return null;

  return <div style={{ marginTop: 8 }}>
    {matched.map((story) => (
      <details key={story.id} style={{ borderTop: `1px solid ${line}`, padding: "8px 0 2px" }}>
        <summary style={{ cursor: "pointer", listStyle: "none", color: accent, font: "600 11.5px system-ui" }}>
          Physician conversation · {story.reactions.length}
        </summary>
        <div style={{ paddingTop: 5 }}>
          <a href={story.anchor.url} target="_blank" rel="noopener noreferrer" style={{ color: muted, textDecoration: "none", font: "500 10.5px/1.4 system-ui" }}>
            Anchored by {story.anchor.label} ↗
          </a>
          {story.reactions.map((reaction) => (
            <div key={reaction.postId} style={{ padding: "9px 0", borderTop: `1px solid ${line}` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <a href={reaction.url} target="_blank" rel="noopener noreferrer" style={{ color: ink, textDecoration: "none", font: "650 12px system-ui" }}>{reaction.name}</a>
                <span style={{ color: muted, font: "500 10.5px system-ui" }}>@{reaction.handle} · ♥ {reaction.likes}</span>
              </div>
              <div style={{ color: muted, font: "400 12px/1.5 system-ui", marginTop: 4 }}>{reaction.text}</div>
            </div>
          ))}
        </div>
      </details>
    ))}
  </div>;
}
