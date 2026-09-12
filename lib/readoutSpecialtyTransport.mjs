// One bounded input cache per run. Only identical reads and the builder's
// read-only RPCs are cached; provider requests and writes never enter the cache.
const READ_RPCS = new Set(["x_posts_needing_features"]);
function recapObservation(body, response, text) {
  let input, output;
  try { input = JSON.parse(body); output = JSON.parse(text); } catch { return { status: "invalid_json", complete: false }; }
  const area = input?.area ?? "unknown";
  if (!response.ok) return { area, status: response.status, complete: false };
  if (output?.captureOnly === true) return { area, status: "capture_only", complete: false };
  if (output?.error) return { area, status: "provider_error", complete: false };
  const hasText = value => typeof value === "string" && value.trim().length > 0;
  const needsMain = Array.isArray(input?.movers) && input.movers.length > 0;
  const stories = Array.isArray(input?.stories) ? input.stories : [];
  const missingStoryIds = stories.filter(story => !hasText(output?.storyWhys?.[story.id])).map(story => story.id);
  const complete = (!needsMain || hasText(output?.recap) && hasText(output?.headline)) && missingStoryIds.length === 0;
  return { area, status: complete ? "complete" : "incomplete_prose", complete, missingStoryIds };
}
export function createSpecialtyTransport({ baseUrl, signal, fetchImpl = fetch, record, allowCapturedRecap = false, maxCacheBytes = 96 * 1024 * 1024 }) {
  const origin = new URL(baseUrl).origin, cache = new Map();
  const failures = new Map();
  const recaps = new Map();
  let bytes = 0, requests = 0, cacheHits = 0, transientFailures = 0;
  const perform = async (input, init = {}) => {
    signal?.throwIfAborted();
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.origin !== origin) { failures.set("origin", { path: "outside-configured-database", status: "blocked" }); throw new Error("Specialty transport destination is outside the configured database."); }
    const method = String(init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const body = typeof init.body === "string" ? init.body : "";
    const readRpc = method === "POST" && url.pathname.startsWith("/rest/v1/rpc/") && READ_RPCS.has(url.pathname.split("/").pop());
    const recap = method === "POST" && url.pathname === "/functions/v1/briefing-recap";
    if (!["GET", "HEAD"].includes(method) && !readRpc && !recap) { failures.set(`blocked:${method}:${url.pathname}`, { path: url.pathname, status: "mutation_blocked" }); throw new Error(`Specialty shadow database mutation blocked: ${method} ${url.pathname}`); }
    const key = JSON.stringify([method, url.pathname + url.search, body, headers.get("range"), headers.get("prefer"), headers.get("accept")]);
    const cacheable = ["GET", "HEAD"].includes(method) && url.pathname.startsWith("/rest/v1/") || readRpc;
    if (cacheable && cache.has(key)) { cacheHits++; const stored = cache.get(key); return new Response(stored.body, stored); }
    requests++;
    const timeout = AbortSignal.timeout(55_000);
    const combined = AbortSignal.any([timeout, ...(signal ? [signal] : []), ...(init.signal ? [init.signal] : [])]);
    let response, text;
    try {
      response = await fetchImpl(input, { ...init, signal: combined, cache: "no-store" });
      text = await response.text();
      combined.throwIfAborted();
    } catch (error) {
      if (recap) recaps.set(key, { status: "transport_error", complete: false });
      else { transientFailures++; failures.set(key, { path: url.pathname, status: "transport_error", method, urlLength: url.href.length, cause: String(error?.cause?.code ?? error?.cause?.message ?? error?.message).slice(0, 250) }); }
      throw error;
    }
    const stored = { body: text, status: response.status, statusText: response.statusText, headers: [...response.headers] };
    if (!recap) { if (response.ok) failures.delete(key); else { transientFailures++; failures.set(key, { path: url.pathname, status: response.status }); } }
    else recaps.set(key, recapObservation(body, response, text));
    await record?.({ key, request: { method, path: url.pathname + url.search, body, range: headers.get("range"), prefer: headers.get("prefer"), accept: headers.get("accept") }, response: stored });
    if (cacheable && response.ok && bytes + text.length * 2 <= maxCacheBytes) { cache.set(key, stored); bytes += text.length * 2; }
    return new Response(response.status === 204 ? null : text, stored);
  };
  return {
    fetch: perform,
    stats: () => ({ requests, cacheHits, cacheBytes: bytes, transientFailures, failures: [...failures.values()], recaps: [...recaps.values()] }),
    assertHealthy: () => {
      if (failures.size) throw new Error(`Specialty source database requests failed: ${JSON.stringify([...failures.values()])}`);
      const incomplete = [...recaps.values()].filter(item => !item.complete && !(allowCapturedRecap && item.status === "capture_only"));
      if (incomplete.length) throw new Error(`Specialty recap responses were incomplete: ${JSON.stringify(incomplete)}`);
    },
  };
}
