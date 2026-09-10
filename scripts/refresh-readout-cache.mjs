// Refresh production projections through the normal cache builder, without
// merging insertions or rebuilding saved editions. Run after `npm run build`:
// node --env-file=.env.local scripts/refresh-readout-cache.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

assert.ok(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY, "Supabase service environment is required");
const configuredTimeout = process.env.READOUT_CACHE_REFRESH_TIMEOUT_MS ?? "300000";
const requestTimeoutMs = Number(configuredTimeout);
assert.ok(
  Number.isSafeInteger(requestTimeoutMs) && requestTimeoutMs > 0 && requestTimeoutMs <= 900_000,
  "READOUT_CACHE_REFRESH_TIMEOUT_MS must be a positive integer no greater than 900000",
);
const root = fileURLToPath(new URL("../", import.meta.url));
const reservation = createServer();
await new Promise((resolve, reject) => reservation.once("error", reject).listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const secret = randomUUID();
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: { ...process.env, CRON_SECRET: secret },
  stdio: ["ignore", "ignore", "inherit"],
});
let spawnError;
server.once("error", (error) => { spawnError = error; });
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (spawnError) throw spawnError;
    assert.equal(server.exitCode, null, "The loopback server exited before refresh");
    try {
      const response = await fetch(`${base}/welcome`, { signal: AbortSignal.timeout(2_000) });
      ready = response.ok;
      await response.body?.cancel();
      if (ready) break;
    } catch { /* The local production server may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "The loopback server did not start");
  const response = await fetch(`${base}/api/readout-cache?refreshOnly=1`, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const result = await response.json();
  assert.equal(response.status, 200, `Cache refresh failed: ${result.error ?? response.status}`);
  assert.equal(result.ok, true);
  assert.equal(result.edition?.skipped, "cache-refresh-only", "Refuse an older build that merges the saved selection");
  assert.equal(result.edition.changed, false);
  assert.equal(result.warmed?.length, 16, "Every supported area/window must be refreshed");
  console.log(JSON.stringify(result, null, 2));
  assert.ok(result.warmed.every((row) => !row.error && !row.stale), "Some windows retained stale data; review before accepting the repair");
} finally {
  server.kill("SIGTERM");
}
