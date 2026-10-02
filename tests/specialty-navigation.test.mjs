import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public story mastheads preserve the story specialty", () => {
  const source = read("app/r/[slug]/PublicCard.tsx");
  assert.match(source, /href=\{`\/\?area=\$\{encodeURIComponent\(v\.area\)\}`\}/);
});

test("onboarding links encode their intended specialty explicitly", () => {
  assert.match(read("app/api/admin/upload/route.ts"), /&area=\$\{encodeURIComponent\(r\.area\)\}/);
  assert.match(read("app/api/admin/requests/route.ts"), /const assignedArea = area \?\? c\.default_area/);
});
