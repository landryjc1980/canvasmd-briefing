import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  process.env.CANVASMD_REPO,
  path.resolve(webRoot, "../canvasmd"),
  path.resolve(webRoot, "../anchored-development-dry-run-canvasmd"),
  path.resolve(webRoot, "../../canvasmd"),
].filter(Boolean);

const nativeRoot = candidates.find((candidate) =>
  fs.existsSync(path.join(candidate, "components/readout/cards.tsx"))
  && fs.existsSync(path.join(candidate, "supabase/functions/briefing/index.ts"))
);

if (!nativeRoot) {
  throw new Error(`Unable to locate the paired canvasmd repository. Checked: ${candidates.join(", ")}`);
}

export const canvasmdFile = (...parts) => path.join(nativeRoot, ...parts);
