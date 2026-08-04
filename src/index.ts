#!/usr/bin/env bun
/**
 * itaca — a local-first registry of every project on your machine,
 * exposed to your coding agents via MCP.
 *
 * Every project is an Ithaca. Come home in seconds.
 */

const VERSION = "0.0.1"

const args = process.argv.slice(2)

if (args.includes("--version") || args.includes("-v")) {
  console.log(VERSION)
  process.exit(0)
}

console.log(`itaca ${VERSION} — pre-alpha. See SPEC.md for what's coming.`)
process.exit(0)
