import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { commitsSince, headSha } from "../core/git.ts"
import { applyStatusUpdate, readManifest, writeManifest } from "../core/manifest.ts"
import { dataDir, writeAtomic } from "../core/paths.ts"
import { findProject, projectForCwd, readRegistry } from "../core/registry.ts"
import { stalenessPrompt } from "../core/staleness.ts"
import { EXIT } from "../types.ts"
import { fail, green } from "../ui.ts"

/** Claude Code Stop-hook payload — only the fields we use. */
interface HookInput {
  session_id?: string
  cwd?: string
}

const SESSIONS_FILE = "stop-sessions.json"
const SESSIONS_CAP = 50

async function readHookInput(): Promise<HookInput | undefined> {
  if (process.stdin.isTTY) return undefined
  try {
    const raw = (await Bun.stdin.text()).trim()
    return raw ? (JSON.parse(raw) as HookInput) : undefined
  } catch {
    return undefined
  }
}

/**
 * One prompt per session, at most. Without this, a session that legitimately
 * has nothing to add would be blocked from ending every time it tried.
 */
async function claimSession(id: string): Promise<boolean> {
  const path = join(dataDir(), SESSIONS_FILE)
  let seen: string[] = []
  try {
    const raw = (await Bun.file(path).json()) as { sessions?: string[] }
    seen = raw.sessions ?? []
  } catch {
    seen = []
  }
  if (seen.includes(id)) return false
  mkdirSync(dataDir(), { recursive: true })
  await writeAtomic(path, JSON.stringify({ sessions: [id, ...seen].slice(0, SESSIONS_CAP) }))
  return true
}

/**
 * `itaca status check` — the Stop hook. Emits Claude Code's decision JSON when
 * the project's status no longer describes HEAD, and nothing at all otherwise.
 * Always exits 0: a broken freshness check must never break a session.
 */
async function runCheck(): Promise<number> {
  const input = await readHookInput()
  const registry = await readRegistry()
  const project = registry ? projectForCwd(registry, input?.cwd ?? process.cwd()) : undefined
  if (!project) return EXIT.OK

  const [manifest, head] = await Promise.all([readManifest(project.path), headSha(project.path)])
  const anchor = manifest?.status?.commit
  const since = anchor ? await commitsSince(project.path, anchor) : undefined
  const prompt = stalenessPrompt(project.name, manifest?.status, head, since)
  if (!prompt) return EXIT.OK

  // Run outside a hook (no session id): report, but never block.
  if (!input?.session_id) {
    console.log(prompt)
    return EXIT.OK
  }
  if (!(await claimSession(input.session_id))) return EXIT.OK
  console.log(JSON.stringify({ decision: "block", reason: prompt }))
  return EXIT.OK
}

export async function run(args: string[], json: boolean): Promise<number> {
  const [verb, name] = args.filter((a) => !a.startsWith("-"))
  if (verb === "check") return await runCheck()
  if (verb !== "set" || !name) {
    fail(
      {
        code: "usage",
        message:
          "usage: itaca status set <project> [--phase X] [--next Y] [--note Z]\n       itaca status check",
      },
      json,
    )
    return EXIT.USAGE
  }
  const { values } = parseArgs({
    args,
    options: { phase: { type: "string" }, next: { type: "string" }, note: { type: "string" } },
    allowPositionals: true,
    strict: false,
  })
  const update = {
    ...(typeof values.phase === "string" ? { phase: values.phase } : {}),
    ...(typeof values.next === "string" ? { next: values.next } : {}),
    ...(typeof values.note === "string" ? { note: values.note } : {}),
  }
  if (!Object.keys(update).length) {
    fail({ code: "usage", message: "nothing to set — pass --phase, --next, or --note" }, json)
    return EXIT.USAGE
  }

  const registry = await readRegistry()
  const project = registry ? findProject(registry, name) : undefined
  if (!project) {
    fail(
      { code: "project_not_found", message: `no project named "${name}"`, fix: "run: itaca list" },
      json,
    )
    return EXIT.NOT_FOUND
  }

  const today = new Date().toISOString().slice(0, 10)
  const [existing, head] = await Promise.all([readManifest(project.path), headSha(project.path)])
  const manifest = applyStatusUpdate(existing, update, today, head)
  await writeManifest(project.path, manifest)

  if (json) console.log(JSON.stringify({ project: project.name, status: manifest.status }))
  else console.log(`${green("✓")} ${project.name} status updated (itaca.yml)`)
  return EXIT.OK
}
