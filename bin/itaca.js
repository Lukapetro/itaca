#!/usr/bin/env node
// itaca — pre-alpha placeholder. Node-compatible shim so `npx @itaca/cli`
// works everywhere; the real CLI (src/) runs on Bun and lands with M1.
const VERSION = "0.0.1"

const args = process.argv.slice(2)
if (args.includes("--version") || args.includes("-v")) {
  console.log(VERSION)
  process.exit(0)
}

console.log(`itaca ${VERSION} — pre-alpha.`)
console.log("Every project is an Ithaca. Come home in seconds.")
console.log("Spec & progress: https://github.com/Lukapetro/itaca")
process.exit(0)
