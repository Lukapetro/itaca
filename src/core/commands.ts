import { join } from "node:path"
import type { ProjectCommand, ProjectStack } from "../types.ts"

/** Curated display order; anything else keeps script order after these. */
export const COMMAND_ORDER = [
  "dev",
  "start",
  "build",
  "test",
  "check",
  "typecheck",
  "lint",
  "format",
  "deploy",
]

export async function extractCommands(
  root: string,
  stack: ProjectStack,
): Promise<ProjectCommand[]> {
  const file = Bun.file(join(root, "package.json"))
  if (!(await file.exists())) return []
  let scripts: Record<string, string>
  try {
    const pkg = (await file.json()) as { scripts?: Record<string, string> }
    scripts = pkg.scripts ?? {}
  } catch {
    return []
  }
  const runner =
    stack.packageManager === "bun" ? "bun run" : (stack.packageManager ?? "npm") + " run"
  const names = Object.keys(scripts)
  names.sort((a, b) => {
    const ia = COMMAND_ORDER.indexOf(a)
    const ib = COMMAND_ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return 0
  })
  return names.map((name) => ({ name, run: `${runner} ${name}` }))
}
