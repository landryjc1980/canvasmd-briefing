import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// When this repo is checked out as a git worktree (e.g. under .claude/worktrees/<name>),
// webRoot sits two extra directories deeper than a plain checkout, so the "../canvasmd"
// sibling guess below misses the real paired repo. Resolve the *main* checkout's location
// via the shared .git dir so the sibling lookup works from any worktree too.
function mainCheckoutRoot() {
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: webRoot, encoding: "utf8",
    }).trim();
    return path.dirname(path.resolve(webRoot, commonDir));
  } catch {
    return null;
  }
}

const mainRoot = mainCheckoutRoot();
const candidates = [
  process.env.CANVASMD_REPO,
  path.resolve(webRoot, "../../canvasmd"),
  path.resolve(webRoot, "../canvasmd"),
  path.resolve(webRoot, "../anchored-development-dry-run-canvasmd"),
  mainRoot ? path.resolve(mainRoot, "../canvasmd") : null,
].filter(Boolean);

const nativeRoot = candidates.find((candidate) =>
  fs.existsSync(path.join(candidate, "components/readout/cards.tsx"))
  && fs.existsSync(path.join(candidate, "supabase/functions/briefing/index.ts"))
);

if (!nativeRoot) {
  throw new Error(`Unable to locate the paired canvasmd repository. Checked: ${candidates.join(", ")}`);
}

export const canvasmdFile = (...parts) => path.join(nativeRoot, ...parts);
