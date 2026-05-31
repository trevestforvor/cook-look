// Builds a fully static export of the editor for GitHub Pages / any static host.
//
// Next.js refuses to statically export a project that contains a dynamic POST
// route handler, and `/api/agent` is exactly that. The agent can't run on a
// static host anyway, so we temporarily move the api directory out of the tree
// for the duration of the build, then always restore it (the route stays in
// the repo for anyone self-hosting with a server). The move is reversible even
// if the build fails.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiDir = join(webRoot, "src", "app", "api");
const stashDir = join(webRoot, ".api-stash");

function stashApi() {
  if (!existsSync(apiDir)) return false;
  rmSync(stashDir, { recursive: true, force: true });
  mkdirSync(dirname(stashDir), { recursive: true });
  renameSync(apiDir, stashDir);
  return true;
}

function restoreApi() {
  if (!existsSync(stashDir)) return;
  rmSync(apiDir, { recursive: true, force: true });
  renameSync(stashDir, apiDir);
}

const stashed = stashApi();
try {
  const result = spawnSync("next", ["build"], {
    cwd: webRoot,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      STATIC_EXPORT: "1",
      NEXT_PUBLIC_AGENT_ENABLED: "false",
    },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (stashed) restoreApi();
}
