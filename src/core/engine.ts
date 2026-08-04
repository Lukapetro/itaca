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
  if (!r.match || typeof r.match !== "object") {
    issues.push({ file, message: 'missing "match"' })
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
    if (await matches(rule.match, ev)) {
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
