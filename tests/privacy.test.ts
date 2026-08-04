import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { loadRules } from "../src/core/engine.ts"
import { scanProject } from "../src/core/scan.ts"

/**
 * THE hard invariant (SPEC §6.5): values from .env* files must never appear in
 * any itaca output. The fixture's .env.local plants two sentinel values; if
 * either ever shows up in a serialized Project, detection is leaking secrets.
 */
describe("privacy invariant", () => {
  test("env values never appear in scan output", async () => {
    const dir = join(import.meta.dir, "fixtures", "next-neon-stripe")
    const { rules } = loadRules()
    const project = await scanProject(dir, rules)
    const serialized = JSON.stringify(project)
    expect(serialized).not.toContain("hunter2-not-a-real-secret")
    expect(serialized).not.toContain("sk_test_FAKEFIXTUREVALUE")
    // the detection itself must still work off those values
    expect(project.services.map((s) => s.id)).toContain("neon")
  })

  test("env values never appear in the briefing either", async () => {
    const dir = join(import.meta.dir, "fixtures", "next-neon-stripe")
    const { rules } = loadRules()
    const project = await scanProject(dir, rules)
    const { briefing } = await import("../src/core/briefing.ts")
    const text = briefing(project, { version: 1, scannedAt: "", roots: [], projects: [project] })
    expect(text).not.toContain("hunter2-not-a-real-secret")
    expect(text).not.toContain("sk_test_FAKEFIXTUREVALUE")
  })
})
