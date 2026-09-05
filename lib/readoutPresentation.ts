/** Deterministic previews make disclosure depend on hidden content, not viewport width. */
export function articleTextPreview(text: string, maxChars = 360): string {
  if (text.length <= maxChars) return text;
  const prefix = text.slice(0, maxChars);
  return `${prefix.slice(0, prefix.lastIndexOf(" ") > maxChars / 2 ? prefix.lastIndexOf(" ") : maxChars).trimEnd()}…`;
}

export function articleExpansion(source: { preview: string; full: string }, comments: string[], availableComments = comments.length) {
  const preview = articleTextPreview(source.preview);
  const moreSource = Boolean(source.full && source.full !== preview);
  const count = Math.max(comments.length, availableComments);
  const moreComments = count > 1 || comments.some((text) => articleTextPreview(text, 220) !== text);
  const commentLabel = `Read ${count} full comment${count === 1 ? "" : "s"}`;
  return {
    preview,
    canExpand: moreSource || moreComments,
    label: moreSource
      ? `Full source excerpt${moreComments ? ` + ${count} comment${count === 1 ? "" : "s"}` : ""}`
      : commentLabel,
  };
}
