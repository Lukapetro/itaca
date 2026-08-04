import { type Dirent, readdirSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import type { DetectorRule, Link, Project, Registry } from "../types.ts"
import { extractCommands } from "./commands.ts"
import { detectServices, loadRules } from "./engine.ts"
import { Evidence } from "./evidence.ts"
import { gitInfo } from "./git.ts"
import { readManifest } from "./manifest.ts"
import { detectStack, detectWorkspaces } from "./stack.ts"

const PROJECT_MARKERS = [
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "project.godot",
  "deno.json",
]

function isProjectDir(dir: string): boolean {
  try {
    const entries = new Set(readdirSync(dir))
    return entries.has(".git") || PROJECT_MARKERS.some((m) => entries.has(m))
  } catch {
    return false
  }
}

/** Direct children of a root that look like projects (the root itself counts too). */
export function discoverProjects(root: string): string[] {
  const abs = resolve(root)
  if (isProjectDir(abs)) return [abs]
  let entries: Dirent[]
  try {
    entries = readdirSync(abs, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && isProjectDir(join(abs, e.name)))
    .map((e) => join(abs, e.name))
    .sort()
}

/** GitHub links derived from the git remote — the one builtin detector. */
function githubLinks(remote: string | undefined): Link[] {
  if (!remote?.startsWith("github.com/")) return []
  const url = `https://${remote}`
  return [
    { title: "Repository", url },
    { title: "Pull requests", url: `${url}/pulls` },
    { title: "Actions", url: `${url}/actions` },
  ]
}

export async function scanProject(path: string, rules: DetectorRule[]): Promise<Project> {
  const ev = new Evidence(path)
  const manifest = await readManifest(path)
  const stack = await detectStack(ev)
  const [services, commands, git, workspaces] = await Promise.all([
    detectServices(ev, rules, manifest?.overrides?.disable ?? []),
    extractCommands(path, stack),
    gitInfo(path),
    detectWorkspaces(path, ev),
  ])

  const gh = githubLinks(git?.remote)
  if (gh.length) {
    services.unshift({ id: "github", service: "GitHub", category: "code", links: gh })
  }

  let description = manifest?.description
  if (!description) {
    try {
      const pkg = (await Bun.file(join(path, "package.json")).json()) as { description?: string }
      if (pkg.description) description = pkg.description
    } catch {
      // no package.json or unparseable
    }
  }

  return {
    name: manifest?.name ?? basename(path),
    path,
    ...(description !== undefined ? { description } : {}),
    stack,
    services,
    commands,
    ...(git !== undefined ? { git } : {}),
    ...(workspaces !== undefined ? { workspaces } : {}),
    ...(manifest !== undefined ? { manifest } : {}),
  }
}

export async function scanRoots(
  roots: string[],
  now: string,
  rules?: DetectorRule[],
): Promise<Registry> {
  const resolvedRules = rules ?? loadRules().rules
  const paths = [...new Set(roots.flatMap((r) => discoverProjects(r)))]
  const projects = await Promise.all(paths.map((p) => scanProject(p, resolvedRules)))
  projects.sort((a, b) => (b.git?.lastCommitAt ?? "").localeCompare(a.git?.lastCommitAt ?? ""))
  return { version: 1, scannedAt: now, roots: roots.map((r) => resolve(r)), projects }
}
