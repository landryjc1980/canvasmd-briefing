import type { SourceReference } from "./fixture";

const momentKey = (reference: SourceReference) => `${reference.sourceId}:${reference.startMs}`;

export function omitAdjacentRepeatedSourceRefs(
  sourceRefs: SourceReference[],
  alreadyShown: SourceReference[],
) {
  const shownMoments = new Set(alreadyShown.map(momentKey));
  const remaining = sourceRefs.filter((reference) => !shownMoments.has(momentKey(reference)));
  return remaining.length ? remaining : sourceRefs;
}
