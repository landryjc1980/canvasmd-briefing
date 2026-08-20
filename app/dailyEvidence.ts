export type AreaReaction = {
  areas: string[];
  sourceAreas?: string[];
  referenceAreas?: string[];
};

export function partitionDailyReactions<T extends AreaReaction>(
  reactions: T[],
  storyAreas: string[],
  area?: string,
): { local: T[]; across: T[] } {
  if (!area) return { local: reactions, across: [] };
  const storyIsLocal = storyAreas.includes(area);
  const relevant = reactions.filter((reaction) => storyIsLocal || reaction.areas.includes(area));
  const local = relevant.filter((reaction) => {
    if (reaction.referenceAreas?.includes(area)) return true;
    if (reaction.sourceAreas?.includes(area)) return true;
    return !reaction.sourceAreas?.length && reaction.areas.includes(area);
  });
  const localSet = new Set(local);
  return { local, across: relevant.filter((reaction) => !localSet.has(reaction)) };
}
