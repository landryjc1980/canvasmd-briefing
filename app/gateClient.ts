"use client";

// Client-side hooks into the gate: log a signal, and run the colleague-share flow. Both are
// safe to call unconditionally — the API no-ops when there's no session.

export function logSignal(kind: "view" | "story_view" | "dwell", area?: string | null, storyId?: string | null, meta?: Record<string, unknown>) {
  try {
    fetch("/api/brief-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, area, storyId, meta }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

// Story impression — the reader actually saw this story (screen shown on mobile / scrolled
// into view on desktop). Carries the story's CURRENT evidence fingerprint so the next visit
// can tell "seen this exact version" from "seen an older version" (→ UPDATED chip). De-duped
// per page load so swiping back and forth doesn't spam events.
const seenLogged = new Set<string>();
export function logStorySeen(area: string, storyId: string, fp?: string) {
  const key = `${area}:${storyId}`;
  if (seenLogged.has(key)) return;
  seenLogged.add(key);
  logSignal("story_view", area, storyId, fp ? { fp } : undefined);
}

/** Mint a share link and hand it off via the native share sheet, falling back to clipboard. */
export async function shareBrief(): Promise<"shared" | "copied" | "error"> {
  try {
    const r = await fetch("/api/brief-share", { method: "POST" });
    const j = await r.json();
    if (!r.ok || !j.ok || !j.url) return "error";
    const data = { title: "ReadoutMD — The Weekly Brief", text: "This week's oncology brief:", url: j.url };
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share(data); return "shared"; } catch { /* user cancelled → fall through to copy */ }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(j.url);
      return "copied";
    }
    return "error";
  } catch {
    return "error";
  }
}
