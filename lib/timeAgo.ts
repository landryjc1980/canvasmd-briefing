/**
 * Compact age stamp for card footers: 13h, 3d, 2w, 4mo. Date-only values are read as
 * noon Eastern, matching the edition date labels. Empty for missing or unparseable input.
 */
export function timeAgoLabel(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return "";
  const then = new Date(value.length === 10 ? `${value}T12:00:00-04:00` : value).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(1, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}
