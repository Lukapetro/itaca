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

/** Workspace globs if the repo root is a monorepo. */
export async function detectWorkspaces(root: string, ev: Evidence): Promise<string[] | undefined> {
  if (ev.hasFile("pnpm-workspace.yaml")) {
    try {
      const { parse } = await import("yaml")
      const raw = parse(await Bun.file(join(root, "pnpm-workspace.yaml")).text()) as {
        packages?: string[]
      }
      if (raw?.packages?.length) return raw.packages
    } catch {
      return undefined
    }
  }
  if (!ev.hasFile("package.json")) return undefined
  try {
    const pkg = (await Bun.file(join(root, "package.json")).json()) as {
      workspaces?: string[] | { packages?: string[] }
    }
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages
    return ws?.length ? ws : undefined
  } catch {
    return undefined
  }
}
