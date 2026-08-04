#!/usr/bin/env node
// Node shim: the real CLI runs on Bun. This makes `npx @itacajs/cli` work
// from any Node environment, with a clear message when Bun is missing.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url))
const result = spawnSync("bun", [entry, ...process.argv.slice(2)], { stdio: "inherit" })

if (result.error && result.error.code === "ENOENT") {
  console.error("itaca requires Bun. Install it (https://bun.sh) and retry:")
  console.error("  curl -fsSL https://bun.sh/install | bash")
  process.exit(1)
}
process.exit(result.status ?? 1)
