#!/usr/bin/env node
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = process.argv[2] && path.resolve(process.argv[2]);
if (!backend) throw new Error("Usage: node scripts/sync-specialty-builder.mjs /path/to/canvasmd [--allow-dirty]");
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "supabase/functions"], { cwd: backend, encoding: "utf8" }).trim();
if (dirty && !process.argv.includes("--allow-dirty")) throw new Error("Commit the shared builder before creating a release bundle.");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: backend, encoding: "utf8" }).trim();
const output = path.join(root, "lib/generated/specialtyBriefingBuilder.mjs");
const result = await build({
  absWorkingDir: backend,
  entryPoints: ["supabase/functions/_shared/specialtyBriefingBuilder.ts"],
  outfile: output, bundle: true, format: "esm", platform: "node", target: "node22",
  write: false, metafile: true, legalComments: "none", treeShaking: true,
  banner: { js: "// GENERATED from the authoritative CanvasMD shared builder. Run scripts/sync-specialty-builder.mjs; do not edit." },
});
const inputs = [];
for (const name of Object.keys(result.metafile.inputs).sort()) {
  inputs.push({ path: name, sha256: createHash("sha256").update(await readFile(path.resolve(backend, name))).digest("hex") });
}
const bytes = result.outputFiles[0].contents;
const manifest = {
  backendSha: sha, dirty: Boolean(dirty), engineSha256: createHash("sha256").update(JSON.stringify(inputs)).digest("hex"),
  bundleSha256: createHash("sha256").update(bytes).digest("hex"), inputs,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, bytes);
await writeFile(path.join(root, "lib/generated/specialtyBriefingBuilder.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ backendSha: sha, dirty: Boolean(dirty), files: inputs.length, bytes: bytes.length }));
