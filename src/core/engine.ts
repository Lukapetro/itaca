import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "yaml"
import type { DetectedService, DetectorRule, MatchNode } from "../types.ts"
import type { Evidence } from "./evidence.ts"
import { configDir } from "./paths.ts"

const BUILTIN_RULES_DIR = join(import.meta.dir, "..", "..", "rules")

export interface RuleIssue {
  file: string
  message: string
}

function compilable(pattern: unknown): string | null {
  if (typeof pattern !== "string") return "pattern is not a string"
  try {
    new RegExp(pattern)
    return null
  } catch (e) {
    return (e as Error).message
  }
}

/** Walk a match tree and report every malformed node or uncompilable regex. */
function validateMatchNode(node: unknown, path: string, issues: string[]): void {
  if (!node || typeof node !== "object") {
    issues.push(`${path}: not a mapping`)
    return
  }
  const n = node as Record<string, unknown>
  if ("any" in n || "all" in n) {
    const children = n.any ?? n.all
    if (!Array.isArray(children) || children.length === 0) {
      issues.push(`${path}: any/all must be a non-empty list`)
      return
    }
    for (const [i, child] of children.entries()) {
      validateMatchNode(child, `${path}[${i}]`, issues)
    }
    return
  }
  if ("file" in n) {
    if (typeof n.file !== "string" || n.file.length === 0) issues.push(`${path}.file: not a string`)
    return
  }
  if ("dep" in n) {
    if (typeof n.dep !== "string" || n.dep.length === 0) issues.push(`${path}.dep: not a string`)
    return
  }
  if ("env_key" in n || "env_value" in n) {
    const err = compilable(n.env_key ?? n.env_value)
    if (err) issues.push(`${path}: invalid regex — ${err}`)
    return
  }
  if ("content" in n) {
    const c = n.content as { file?: unknown; pattern?: unknown } | null
    if (!c || typeof c !== "object" || typeof c.file !== "string") {
      issues.push(`${path}.content: needs "file" and "pattern"`)
      return
    }
    const err = compilable(c.pattern)
    if (err) issues.push(`${path}.content.pattern: invalid regex — ${err}`)
    return
  }
  issues.push(`${path}: unknown primitive (expected file/dep/env_key/env_value/content/any/all)`)
}

function validateRule(raw: unknown, file: string, issues: RuleIssue[]): DetectorRule | null {
  const r = raw as Partial<DetectorRule> | null
  if (!r || typeof r !== "object") {
    issues.push({ file, message: "not a YAML mapping" })
    return null
  }
  for (const field of ["id", "service", "category"] as const) {
    if (typeof r[field] !== "string" || r[field].length === 0) {
      issues.push({ file, message: `missing or invalid "${field}"` })
      return null
    }
  }
  const matchIssues: string[] = []
  validateMatchNode(r.match, "match", matchIssues)
  if (matchIssues.length) {
    for (const message of matchIssues) issues.push({ file, message })
    return null
  }
  return r as DetectorRule
}

/** Load rules from built-in dir, then user dir (user rules with the same id win). */
export function loadRules(): { rules: DetectorRule[]; issues: RuleIssue[] } {
  const issues: RuleIssue[] = []
  const byId = new Map<string, DetectorRule>()
  for (const dir of [BUILTIN_RULES_DIR, join(configDir(), "rules")]) {
    let entries: string[]
    try {
      entries = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    } catch {
      continue
    }
    for (const name of entries.sort()) {
      const file = join(dir, name)
      let raw: unknown
      try {
        raw = parse(readFileSync(file, "utf8"))
      } catch (e) {
        issues.push({ file, message: `YAML parse error: ${(e as Error).message}` })
        continue
      }
      const rule = validateRule(raw, file, issues)
      if (rule) byId.set(rule.id, rule)
    }
  }
  return { rules: [...byId.values()], issues }
}

async function matches(node: MatchNode, ev: Evidence): Promise<boolean> {
  if ("any" in node) {
    for (const child of node.any) if (await matches(child, ev)) return true
    return false
  }
  if ("all" in node) {
    for (const child of node.all) if (!(await matches(child, ev))) return false
    return true
  }
  if ("file" in node) return ev.hasFile(node.file)
  if ("dep" in node) return ev.hasDep(node.dep)
  if ("env_key" in node) return ev.envKeyMatches(node.env_key)
  if ("env_value" in node) return ev.envValueMatches(node.env_value)
  if ("content" in node) return ev.contentMatches(node.content.file, node.content.pattern)
  return false
}

export async function detectServices(
  ev: Evidence,
  rules: DetectorRule[],
  disabled: string[] = [],
): Promise<DetectedService[]> {
  const out: DetectedService[] = []
  for (const rule of rules) {
    if (disabled.includes(rule.id)) continue
    let matched: boolean
    try {
      matched = await matches(rule.match, ev)
    } catch (e) {
      // One broken rule must never take down the whole scan.
      console.error(`itaca: rule "${rule.id}" failed and was skipped: ${(e as Error).message}`)
      continue
    }
    if (matched) {
      out.push({
        id: rule.id,
        service: rule.service,
        category: rule.category,
        links: rule.links ?? [],
        ...(rule.notes !== undefined ? { notes: rule.notes } : {}),
      })
    }
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id))
}
