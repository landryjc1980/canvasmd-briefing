import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Design Lab bypass is local-development only", () => {
  const middleware = fs.readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(
    middleware,
    /process\.env\.NODE_ENV !== ["']production["'][\s\S]*pathname\.startsWith\(["']\/design-lab["']\)/,
  );
  assert.doesNotMatch(
    middleware,
    /PUBLIC_PREFIXES\s*=\s*\[[^\]]*["']\/design-lab["']/,
    "Design Lab must not become a production-public route",
  );
});
