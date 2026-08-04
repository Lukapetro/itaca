import { describe, expect, test } from "bun:test"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { loadRules } from "../src/core/engine.ts"
import { scanProject } from "../src/core/scan.ts"
import type { ProjectStack } from "../src/types.ts"

const FIXTURES = join(import.meta.dir, "fixtures")

interface Expected {
  services: string[]
  stack: Partial<ProjectStack>
  workspaces?: string[]
}

const fixtureDirs = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)

describe("detection golden files", () => {
  const { rules, issues } = loadRules()

  test("built-in rules are valid", () => {
    expect(issues).toEqual([])
    expect(rules.length).toBeGreaterThanOrEqual(10)
  })

  for (const name of fixtureDirs) {
    test(name, async () => {
      const dir = join(FIXTURES, name)
      const expected = (await Bun.file(join(dir, "expected.json")).json()) as Expected
      const project = await scanProject(dir, rules)

      // github is derived from the parent repo's git remote when fixtures are
      // scanned in place — ignore it in golden comparisons.
      const serviceIds = project.services.map((s) => s.id).filter((id) => id !== "github")
      expect(serviceIds.sort()).toEqual([...expected.services].sort())

      for (const [key, value] of Object.entries(expected.stack)) {
        expect(project.stack[key as keyof ProjectStack]).toBe(value)
      }
      if (expected.workspaces) expect(project.workspaces).toEqual(expected.workspaces)
    })
  }
})
