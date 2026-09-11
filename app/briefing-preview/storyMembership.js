export const SPECIALTY_AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"];

export function isSpecialtyArea(value) {
  return typeof value === "string" && SPECIALTY_AREAS.includes(value);
}

// Explicit `areas` is authoritative, including []. Rows without it are legacy
// snapshots and may use only a valid scalar specialty—never title/site text.
export function editorialStoryAreas(item) {
  if (Object.prototype.hasOwnProperty.call(item, "areas")) {
    return Array.isArray(item.areas)
      ? [...new Set(item.areas.filter(isSpecialtyArea))]
      : [];
  }
  return isSpecialtyArea(item.area) ? [item.area] : [];
}

export function editorialBelongsToArea(item, area) {
  return area === "All" || editorialStoryAreas(item).includes(area);
}
