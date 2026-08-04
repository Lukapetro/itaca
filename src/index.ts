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
  mcp: {
    run: (a, j) => import("./cli/mcp.ts").then((m) => m.run(a, j)),
    blurb: "run the MCP server on stdio",
  },
  agent: {
    run: (a, j) => import("./cli/agent.ts").then((m) => m.run(a, j)),
    blurb: "install agent integration (skill, hook, MCP)",
  },
}

const HELP = `itaca ${pkg.version} — every project is an Ithaca; come home in seconds

Usage
  itaca scan [dir]            first run: itaca scan ~/dev
  itaca list                  what's on this machine
  itaca context               where was I? (run inside a project)
  itaca open <project>        list its dashboards (add <filter> or --all to open)
  itaca show <project>
  itaca status set <project> [--phase X] [--next Y] [--note Z]
  itaca agent install         wire up Claude Code (skill + hook + MCP)
  itaca init | rules list | rules validate | mcp

Flags
  --json     machine output on stdout (every command)
  --version  print version

Exit codes: 0 ok · 1 failure · 2 usage · 3 not found · 4 permission · 5 conflict`

/** Closest command by edit distance; undefined when nothing is plausibly meant. */
function closest(input: string, commands: string[]): string | undefined {
  const distance = (a: string, b: string): number => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0] as number
      row[0] = i
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j] as number
        row[j] = Math.min(
          tmp + 1,
          (row[j - 1] as number) + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1),
        )
        prev = tmp
      }
    }
    return row[b.length] as number
  }
  const ranked = commands.map((c) => ({ c, d: distance(input, c) })).sort((x, y) => x.d - y.d)
  const best = ranked[0]
  return best && best.d <= Math.max(2, Math.floor(input.length / 2)) ? best.c : undefined
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const json = argv.includes("--json")
  const args = argv.filter((a) => a !== "--json")

  if (args.includes("--version") || args.includes("-v")) {
    console.log(json ? JSON.stringify({ version: pkg.version }) : pkg.version)
    return EXIT.OK
  }
  const cmd = args[0]
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
    console.log(json ? JSON.stringify({ help: HELP }) : HELP)
    return EXIT.OK
  }
  const entry = COMMANDS[cmd]
  if (!entry) {
    const guess = closest(cmd, Object.keys(COMMANDS))
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
