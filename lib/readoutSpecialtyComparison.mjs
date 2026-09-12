import { createHash } from "node:crypto";

export const SPECIALTY_AREAS = Object.freeze(["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"]);
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function contentHash(value) { return createHash("sha256").update(stableJson(value)).digest("hex"); }

// Runtime identity and the observation time are expected to differ in a live
// shadow. Everything else remains in the comparison, including prose/evidence.
export function comparableSpecialty(data) {
  const { build, generatedAt, ...content } = data ?? {};
  return content;
}
export function compareSpecialtyOutput(current, legacy, sourceRunId) {
  if (!legacy?.data) return { status: "legacy_missing", equal: false };
  const sameCycle = legacy.data.build?.sourceRunId === sourceRunId;
  const left = comparableSpecialty(current), right = comparableSpecialty(legacy.data);
  const changedFields = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
    .filter(key => stableJson(left[key]) !== stableJson(right[key]));
  return {
    status: sameCycle ? (changedFields.length ? "live_inputs_differ" : "equal") : "legacy_stale",
    equal: changedFields.length === 0, sameCycle, changedFields,
    nodeHash: contentHash(left), legacyHash: contentHash(right),
    legacyGeneratedAt: legacy.generated_at, legacySourceRunId: legacy.data.build?.sourceRunId ?? null,
    // A live comparison alone cannot prove engine parity: inputs can change.
    engineParity: "requires_frozen_input_replay",
  };
}

export function specialtyComparisonStatus(outputs) {
  if (outputs.length !== SPECIALTY_AREAS.length || outputs.some(row => !row.comparison?.sameCycle)) return "incomplete_legacy";
  return outputs.every(row => row.comparison?.status === "equal") ? "equal_observation" : "review_required";
}

export function assertCompleteSpecialtyBatch(outputs, { sourceRunId, engineSha, builtAt }) {
  if (outputs.length !== SPECIALTY_AREAS.length || new Set(outputs.map(row => row.area)).size !== SPECIALTY_AREAS.length) throw new Error("Specialty batch must contain seven distinct areas.");
  for (const row of outputs) {
    if (!SPECIALTY_AREAS.includes(row.area) || row.data?.area !== row.area || row.data?.generatedAt !== builtAt
      || row.data?.build?.sourceRunId !== sourceRunId || row.data?.build?.sha !== engineSha || row.data?.build?.dirty !== false) {
      throw new Error(`Specialty batch provenance mismatch for ${row.area}.`);
    }
  }
}
