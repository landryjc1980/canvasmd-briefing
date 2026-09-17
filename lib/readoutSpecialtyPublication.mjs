// Publication has its own explicit controls. Finishing a shadow observation
// never grants approval and the date alone never activates the publisher.
export const LEGACY_SPECIALTY_CRONS = Object.freeze([
  "briefing-refresh-gu", "briefing-refresh-breast", "briefing-refresh-lung",
  "briefing-refresh-gi", "briefing-refresh-heme", "briefing-refresh-gyn",
  "briefing-refresh-skin", "briefing-refresh-retry", "briefing-morning-recovery",
]);

export function specialtyPublicationCycle(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = key => parts.find(part => part.type === key)?.value;
  const hour = Number(get("hour")), minute = Number(get("minute"));
  // Preserve the existing morning and evening source cycles. Bounded cron
  // delivery skew is allowed; an operator cannot publish later in the day.
  if (![4, 20].includes(hour) || minute > 5) return null;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, hour, sourceRunId: `scheduled-${date.replaceAll("-", "")}${hour === 4 ? "06" : "20"}` };
}

export function assertSpecialtyPublicationControl(control, engineInfo) {
  if (control?.enabled !== true) throw new Error("Specialty publication is not enabled.");
  if (engineInfo?.dirty !== false || !/^[a-f0-9]{40}$/.test(engineInfo?.backendSha ?? "")
    || !/^[a-f0-9]{64}$/.test(engineInfo?.engineSha256 ?? "")
    || control.approved_engine_sha !== engineInfo.backendSha
    || control.approved_engine_input_sha256 !== engineInfo.engineSha256) throw new Error("Specialty publication engine does not match the approved baseline.");
  if (!Array.isArray(control.review_evidence) || !control.review_evidence.length
    || control.review_evidence.some(item => !item || ["kind", "artifact", "acceptedBy"].some(key => typeof item[key] !== "string" || !item[key].trim())
      || !/^[a-f0-9]{64}$/.test(item.sha256 ?? "") || !Number.isFinite(Date.parse(item.acceptedAt ?? "")))) {
    throw new Error("Specialty publication requires explicit accepted review evidence.");
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function confirmedSpecialtyPublication(receipts, runId) {
  const result = await receipts.from("readout_specialty_source_runs")
    .select("id,status,summary").eq("id", runId).eq("mode", "publish").maybeSingle();
  if (!result.error && result.data?.status === "succeeded" && result.data.summary?.published === true) {
    return result.data.summary;
  }
  return null;
}

export async function finishSpecialtyPublication(receipts, runId, summary, { readbackReceipts = receipts, readbackDeadlineAt = Date.now(), readbackBudgetMs = undefined, readbackIntervalMs = 250 } = {}) {
  let failure;
  try {
    const result = await receipts.rpc("finish_readout_specialty_publish", { p_run_id: runId, p_summary: summary });
    if (result.error) throw new Error(result.error.message);
    if (result.data?.published !== true) throw new Error("Publication RPC returned no committed receipt.");
    return result.data;
  } catch (error) { failure = error; }
  // Start the bounded readback window only after the uncertain RPC returns.
  // A slow commit must not consume the time reserved to establish durability.
  const effectiveReadbackDeadlineAt = readbackBudgetMs === undefined
    ? readbackDeadlineAt
    : Math.min(readbackDeadlineAt, Date.now() + readbackBudgetMs);
  // A lost response may follow a committed transaction. Reconcile only this
  // exact publish run until the reserved finalization window closes; never
  // repeat the provider work or mistake another run's receipt for success.
  do {
    try {
      const confirmed = await confirmedSpecialtyPublication(readbackReceipts, runId);
      if (confirmed) return { ...confirmed, publicationReceiptRecovered: true };
    } catch {
      // A transport response can be lost in either direction. The bounded
      // readback loop below is the last safe way to establish durability.
    }
    const remaining = effectiveReadbackDeadlineAt - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(readbackIntervalMs, remaining));
  } while (Date.now() <= effectiveReadbackDeadlineAt);
  throw new Error(`Specialty publication did not return a confirmed commit: ${String(failure?.message ?? failure)}`);
}
