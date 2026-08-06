import { type Dirent, readdirSync, statSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import type { DetectedService, DetectorRule, Project, Registry } from "../types.ts"
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
    .filter((e) => {
      if (e.name.startsWith(".")) return false
      // stat-follow so symlinked project dirs are discovered (top level only —
      // the depth-capped walk keeps symlink loops bounded)
      if (!e.isDirectory() && !e.isSymbolicLink()) return false
      const path = join(abs, e.name)
      try {
        if (!statSync(path).isDirectory()) return false
      } catch {
        return false
      }
      return isProjectDir(path)
    })
    .map((e) => join(abs, e.name))
    .sort()
}

/**
 * Azure DevOps remotes reach parseRemote in two shapes, normalized differently:
 *   HTTPS → dev.azure.com/{org}/{project}/_git/{repo}
 *   SSH   → ssh.dev.azure.com/v3/{org}/{project}/{repo}
 * Both describe the same repo; the web UI only ever uses the HTTPS form.
 */
function parseAzureRemote(remote: string): AzureRepo | undefined {
  const m =
    remote.match(/^dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)$/) ??
    remote.match(/^ssh\.dev\.azure\.com\/v3\/([^/]+)\/([^/]+)\/([^/]+)$/)
  if (!m?.[1] || !m[2] || !m[3]) return undefined
  return { org: m[1], project: m[2], repo: m[3] }
}

interface AzureRepo {
  org: string
  project: string
  repo: string
}

/**
 * The code-host service derived from the git remote — the builtin detectors.
 * Rules in rules/ cannot express this: they match files and deps, not remotes.
 */
export function codeHostService(remote: string | undefined): DetectedService | undefined {
  if (!remote) return undefined

  if (remote.startsWith("github.com/")) {
    const url = `https://${remote}`
    return {
      id: "github",
      service: "GitHub",
      category: "code",
      links: [
        { title: "Repository", url },
        { title: "Pull requests", url: `${url}/pulls` },
        { title: "Actions", url: `${url}/actions` },
      ],
    }
  }

  const azure = parseAzureRemote(remote)
  if (azure) {
    const project = `https://dev.azure.com/${azure.org}/${azure.project}`
    const url = `${project}/_git/${azure.repo}`
    return {
      id: "azure-devops",
      service: "Azure DevOps",
      category: "code",
      links: [
        { title: "Repository", url },
        { title: "Pull requests", url: `${url}/pullrequests` },
        { title: "Pipelines", url: `${project}/_build` },
      ],
    }
  }

  return undefined
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

  const host = codeHostService(git?.remote)
  if (host) services.unshift(host)

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
