import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { writeAtomic } from "../core/paths.ts"
import { projectForCwd, readRegistry } from "../core/registry.ts"
import { EXIT } from "../types.ts"
import { dim, fail, green, yellow } from "../ui.ts"

const SKILL = `---
name: itaca
description: >
  Project registry for this machine. Use when starting work in any repo (get
  context via itaca instead of exploring), when asked "where was I" or about
  other local projects, and at the end of a work session (update the status).
---

# itaca — the project registry

This machine runs itaca: a local registry of every project, its stack,
services, commands, and narrative status.

## Getting context (session start, or when switching projects)

Run \`itaca context\` (or MCP tool \`project_get\`) instead of exploring the
repo. It returns stack, services with dashboard links, commands, and where
work left off — in under 40 lines. \`projects_list\` shows everything on the
machine.

## Updating status (end of a meaningful work session)

Call \`project_status_update\` (or \`itaca status set <name> --note "..."\`)
with a 1-2 line note of what changed and, if it moved, the phase/next.
Skip it for trivial sessions. Never put secrets or env values in notes.

## Rules

- The registry is derived data: run \`itaca scan\` to refresh after adding
  projects; never edit registry.json by hand. itaca.yml in each repo is the
  durable, committable state.
`

const HOOK_COMMAND = "itaca context 2>/dev/null || true"

const AGENTS_BLOCK = `<!-- itaca:begin -->
## Project registry
This machine runs itaca. For project context, run \`itaca context\` (or MCP tool
\`project_get\`) instead of exploring. Update status at session end via
\`project_status_update\`. Full command list: \`itaca --help\`.
<!-- itaca:end -->`

/** Insert or replace the marked block; touches nothing else. Exported for tests. */
export function upsertAgentsBlock(existing: string | undefined): string {
  const blockRe = /<!-- itaca:begin -->[\s\S]*?<!-- itaca:end -->/
  if (existing === undefined || existing.trim() === "") return `${AGENTS_BLOCK}\n`
  if (blockRe.test(existing)) return existing.replace(blockRe, AGENTS_BLOCK)
  return `${existing.replace(/\n*$/, "\n\n")}${AGENTS_BLOCK}\n`
}

interface SettingsHooks {
  hooks?: Record<string, { matcher?: string; hooks: { type: string; command: string }[] }[]>
  [key: string]: unknown
}

/** Add the SessionStart hook to Claude Code settings, idempotently. */
export function upsertSessionStartHook(settings: SettingsHooks): SettingsHooks {
  const hooks = settings.hooks ?? {}
  const entries = hooks.SessionStart ?? []
  const present = entries.some((e) => e.hooks?.some((h) => h.command?.includes("itaca context")))
  if (!present) {
    entries.push({ hooks: [{ type: "command", command: HOOK_COMMAND }] })
  }
  hooks.SessionStart = entries
  settings.hooks = hooks
  return settings
}

export async function run(args: string[], json: boolean): Promise<number> {
  const verb = args.filter((a) => !a.startsWith("-"))[0]
  if (verb !== "install") {
    fail({ code: "usage", message: "usage: itaca agent install" }, json)
    return EXIT.USAGE
  }
  const claudeDir = join(homedir(), ".claude")
  const done: string[] = []
  const manual: string[] = []

  // 1. Skill (Agent Skills open spec — portable across tools that read it)
  const skillDir = join(claudeDir, "skills", "itaca")
  mkdirSync(skillDir, { recursive: true })
  await writeAtomic(join(skillDir, "SKILL.md"), SKILL)
  done.push(`skill → ${join(skillDir, "SKILL.md")}`)

  // 2. SessionStart hook (the 10×/day touchpoint)
  const settingsPath = join(claudeDir, "settings.json")
  let settings: SettingsHooks = {}
  if (existsSync(settingsPath)) {
    try {
      settings = (await Bun.file(settingsPath).json()) as SettingsHooks
    } catch {
      manual.push(
        `~/.claude/settings.json is not valid JSON — add the SessionStart hook manually: ${HOOK_COMMAND}`,
      )
      settings = {}
    }
  }
  if (!manual.length) {
    await writeAtomic(
      settingsPath,
      `${JSON.stringify(upsertSessionStartHook(settings), null, 2)}\n`,
    )
    done.push(`SessionStart hook → ${settingsPath}`)
  }

  // 3. MCP server registration via the claude CLI (user scope)
  const reg = Bun.spawnSync([
    "claude",
    "mcp",
    "add",
    "--scope",
    "user",
    "itaca",
    "--",
    "itaca",
    "mcp",
  ])
  if (reg.exitCode === 0) {
    done.push("MCP server registered (claude mcp add, user scope)")
  } else {
    manual.push("register the MCP server: claude mcp add --scope user itaca -- itaca mcp")
  }

  // 4. AGENTS.md block for the current repo, when we're inside a registered project
  const registry = await readRegistry()
  const project = registry ? projectForCwd(registry, process.cwd()) : undefined
  if (project) {
    const agentsPath = join(project.path, "AGENTS.md")
    const existing = existsSync(agentsPath) ? await Bun.file(agentsPath).text() : undefined
    await writeAtomic(agentsPath, upsertAgentsBlock(existing))
    done.push(`AGENTS.md block → ${agentsPath}`)
  }

  if (json) {
    console.log(JSON.stringify({ done, manual }))
    return manual.length ? EXIT.FAILURE : EXIT.OK
  }
  for (const d of done) console.log(`${green("✓")} ${d}`)
  for (const m of manual) console.log(`${yellow("→")} ${m}`)
  console.log(dim("\nnew Claude Code sessions now start with the project briefing preloaded"))
  return EXIT.OK
}
