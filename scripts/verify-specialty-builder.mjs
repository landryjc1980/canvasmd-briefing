import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const directory = new URL("../lib/generated/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("specialtyBriefingBuilder.manifest.json", directory), "utf8"));
const bundle = await readFile(new URL("specialtyBriefingBuilder.mjs", directory));
if (manifest.dirty || !/^[a-f0-9]{40}$/.test(manifest.backendSha)) throw new Error("Specialty builder release bundle is not from a clean commit.");
if (createHash("sha256").update(bundle).digest("hex") !== manifest.bundleSha256) throw new Error("Generated specialty builder differs from its source manifest. Regenerate it.");
if (createHash("sha256").update(JSON.stringify(manifest.inputs)).digest("hex") !== manifest.engineSha256) throw new Error("Specialty builder input manifest is inconsistent.");
console.log(`Specialty builder verified: ${manifest.backendSha} (${manifest.inputs.length} source files).`);
