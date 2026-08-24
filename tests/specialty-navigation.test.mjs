import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a successful empty account preference clears stale browser-only area state", () => {
  const source = read("app/page.tsx");
  assert.match(source, /else if \(!urlArea\) \{[\s\S]*localStorage\.removeItem\("readout_area"\)[\s\S]*setArea\("GU"\)/);
});

test("public story mastheads preserve the story specialty", () => {
  const source = read("app/r/[slug]/PublicCard.tsx");
  assert.match(source, /href=\{`\/\?area=\$\{encodeURIComponent\(v\.area\)\}`\}/);
});

test("Daily and onboarding links encode their intended specialty explicitly", () => {
  assert.match(read("app/api/daily-send/route.ts"), /const allLink = linkForArea\("All"\)/);
  assert.match(read("app/api/admin/upload/route.ts"), /&area=\$\{encodeURIComponent\(r\.area\)\}/);
  assert.match(read("app/api/admin/requests/route.ts"), /const assignedArea = area \?\? c\.default_area/);
});
