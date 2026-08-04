import { describe, expect, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { detectServices, loadRules } from "../src/core/engine.ts"
import { Evidence } from "../src/core/evidence.ts"
import type { DetectorRule } from "../src/types.ts"

const FIXTURE = join(import.meta.dir, "fixtures", "next-neon-stripe")

describe("rule validation (finding #1)", () => {
  test("a rule with an invalid regex is rejected by loadRules, not loaded", () => {
    const userRules = join(process.env.XDG_CONFIG_HOME as string, "itaca", "rules")
    mkdirSync(userRules, { recursive: true })
    writeFileSync(
      join(userRules, "bad.yml"),
      'id: bad\nservice: Bad\ncategory: broken\nmatch:\n  env_key: "["\n',
    )
    const { rules, issues } = loadRules()
    expect(rules.find((r) => r.id === "bad")).toBeUndefined()
    expect(issues.some((i) => i.file.endsWith("bad.yml") && i.message.includes("regex"))).toBe(true)
  })

  test("a rule that throws at match time is skipped, scan survives", async () => {
    // Bypass validation to simulate a rule that breaks only at runtime.
    const rules: DetectorRule[] = [
      { id: "boom", service: "Boom", category: "x", match: { env_key: "[" } },
      {
        id: "neon",
        service: "Neon",
        category: "database",
        match: { env_value: "\\.neon\\.tech" },
        links: [],
      },
    ]
    const services = await detectServices(new Evidence(FIXTURE), rules)
    expect(services.map((s) => s.id)).toEqual(["neon"])
  })
})
