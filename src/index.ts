#!/usr/bin/env bun
/**
 * itaca — a local-first registry of every project on your machine,
 * exposed to your coding agents via MCP.
 */
import pkg from "../package.json"
import { EXIT } from "./types.ts"
import { fail } from "./ui.ts"

const COMMANDS: Record<
  string,
  { run: (args: string[], json: boolean) => Promise<number>; blurb: string }
> = {
  scan: {
    run: (a, j) => import("./cli/scan.ts").then((m) => m.run(a, j)),
    blurb: "detect projects under your roots and rebuild the registry",
  },
  list: {
    run: (a, j) => import("./cli/list.ts").then((m) => m.run(a, j)),
    blurb: "table of all projects",
  },
  show: {
    run: (a, j) => import("./cli/show.ts").then((m) => m.run(a, j)),
    blurb: "full card for one project",
  },
  context: {
    run: (a, j) => import("./cli/context.ts").then((m) => m.run(a, j)),
    blurb: "the agent briefing for the current directory",
  },
  open: {
    run: (a, j) => import("./cli/open.ts").then((m) => m.run(a, j)),
    blurb: "open a project's dashboards in the browser",
  },
  status: {
    run: (a, j) => import("./cli/status.ts").then((m) => m.run(a, j)),
    blurb: "set a project's narrative status",
  },
  init: {
    run: (a, j) => import("./cli/init.ts").then((m) => m.run(a, j)),
    blurb: "write itaca.yml with inferred values",
  },
  rules: {
    run: (a, j) => import("./cli/rules.ts").then((m) => m.run(a, j)),
    blurb: "list or validate detector rules",
  },
}

const HELP = `itaca ${pkg.version} — every project is an Ithaca; come home in seconds

Usage
  itaca scan [dir]            first run: itaca scan ~/dev
  itaca list                  what's on this machine
  itaca context               where was I? (run inside a project)
  itaca open <project>        open its dashboards
  itaca show <project>
  itaca status set <project> [--phase X] [--next Y] [--note Z]
  itaca init | rules list | rules validate

Flags
  --json     machine output on stdout (every command)
  --version  print version

Exit codes: 0 ok · 1 failure · 2 usage · 3 not found`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const json = argv.includes("--json")
  const args = argv.filter((a) => a !== "--json")

  if (args.includes("--version") || args.includes("-v")) {
    console.log(pkg.version)
    return EXIT.OK
  }
  const cmd = args[0]
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    console.log(HELP)
    return EXIT.OK
  }
  const entry = COMMANDS[cmd]
  if (!entry) {
    const guess = Object.keys(COMMANDS).find((c) => c.startsWith(cmd[0] ?? ""))
    fail(
      {
        code: "unknown_command",
        message: `unknown command "${cmd}"${guess ? ` — did you mean "${guess}"?` : ""}`,
        fix: "run: itaca --help",
      },
      json,
    )
    return EXIT.USAGE
  }
  try {
    return await entry.run(args.slice(1), json)
  } catch (e) {
    fail({ code: "internal_error", message: (e as Error).message }, json)
    return EXIT.FAILURE
  }
}

process.exit(await main())
