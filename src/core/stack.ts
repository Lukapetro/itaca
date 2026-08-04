import { join } from "node:path"
import type { ProjectStack } from "../types.ts"
import type { Evidence } from "./evidence.ts"

const FRAMEWORK_DEPS: [string, string][] = [
  ["next", "next"],
  ["astro", "astro"],
  ["expo", "expo"],
  ["react-native", "react-native"],
  ["@sveltejs/kit", "sveltekit"],
  ["nuxt", "nuxt"],
  ["@remix-run/react", "remix"],
  ["hono", "hono"],
  ["express", "express"],
  ["vite", "vite"],
]

export async function detectStack(ev: Evidence): Promise<ProjectStack> {
  const stack: ProjectStack = {}

  if (ev.hasFile("bun.lock") || ev.hasFile("bun.lockb")) {
    stack.runtime = "bun"
    stack.packageManager = "bun"
  } else if (ev.hasFile("deno.json") || ev.hasFile("deno.jsonc")) {
    stack.runtime = "deno"
    stack.packageManager = "deno"
  } else if (ev.hasFile("package.json")) {
    stack.runtime = "node"
    if (ev.hasFile("pnpm-lock.yaml")) stack.packageManager = "pnpm"
    else if (ev.hasFile("yarn.lock")) stack.packageManager = "yarn"
    else if (ev.hasFile("package-lock.json")) stack.packageManager = "npm"
  }

  if (ev.hasFile("project.godot") || ev.hasFile("*/project.godot")) {
    stack.framework = "godot"
  } else {
    for (const [dep, name] of FRAMEWORK_DEPS) {
      if (await ev.hasDep(dep)) {
        stack.framework = name
        break
      }
    }
  }

  if (ev.hasFile("tsconfig.json") || (await ev.hasDep("typescript"))) stack.language = "typescript"
  else if (ev.hasFile("package.json")) stack.language = "javascript"
  else if (ev.hasFile("pyproject.toml") || ev.hasFile("requirements.txt")) stack.language = "python"
  else if (ev.hasFile("Cargo.toml")) stack.language = "rust"
  else if (ev.hasFile("go.mod")) stack.language = "go"
  else if (stack.framework === "godot") stack.language = "gdscript"

  return stack
}

/**
 * Resolve workspace globs to member directory names; raw include globs as
 * fallback. Negated patterns ("!packages/test") remove matching members, per
 * npm/pnpm workspace semantics. Exported for tests.
 */
export function resolveMembers(globs: string[], ev: Evidence): string[] {
  const includes = globs.filter((g) => !g.startsWith("!"))
  const excludes = globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1).replace(/\/$/, ""))
  const members = new Set<string>()
  for (const glob of includes) {
    const asPkg = glob.endsWith("/") ? `${glob}package.json` : `${glob}/package.json`
    const matcher = new Bun.Glob(asPkg)
    for (const f of ev.files()) {
      if (matcher.match(f)) members.add(f.slice(0, -"/package.json".length))
    }
  }
  for (const pattern of excludes) {
    const matcher = new Bun.Glob(pattern)
    for (const member of members) {
      if (member === pattern || matcher.match(member)) members.delete(member)
    }
  }
  return members.size ? [...members].sort() : includes
}

/** Workspace member names if the repo root is a monorepo (SPEC §6.4). */
export async function detectWorkspaces(root: string, ev: Evidence): Promise<string[] | undefined> {
  // turbo.json alone implies a monorepo even when workspaces are undeclared
  // or package.json is unreadable — but only at the repo ROOT: hasFile is
  // recursive, and a nested turbo.json must not reclassify an ordinary repo.
  const turboFallback = () => (ev.files().includes("turbo.json") ? [] : undefined)

  // Root-only check: a nested pnpm-workspace.yaml must not hijack this branch
  // away from the root package.json workspaces (hasFile is recursive).
  if (ev.files().includes("pnpm-workspace.yaml")) {
    try {
      const { parse } = await import("yaml")
      const raw = parse(await Bun.file(join(root, "pnpm-workspace.yaml")).text()) as {
        packages?: string[]
      }
      if (raw?.packages?.length) return resolveMembers(raw.packages, ev)
    } catch {
      return turboFallback()
    }
  }
  if (!ev.hasFile("package.json")) return turboFallback()
  try {
    const pkg = (await Bun.file(join(root, "package.json")).json()) as {
      workspaces?: string[] | { packages?: string[] }
    }
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages
    if (ws?.length) return resolveMembers(ws, ev)
    return turboFallback()
  } catch {
    return turboFallback()
  }
}
