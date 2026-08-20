import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

for (const route of ["daily", "briefing"]) {
  test(`${route} data route requires a reader session in production`, () => {
    const source = fs.readFileSync(new URL(`../app/api/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /import \{ currentContactId \} from ["']@\/lib\/gateServer["']/);
    assert.match(source, /process\.env\.NODE_ENV === ["']production["'][\s\S]*await currentContactId\(req\)/);
    assert.match(source, /Unauthorized[\s\S]*status: 401/);
  });
}
