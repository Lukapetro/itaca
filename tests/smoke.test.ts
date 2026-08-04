import { describe, expect, test } from "bun:test"
import { $ } from "bun"

describe("cli smoke", () => {
  test("--version prints a semver and exits 0", async () => {
    const out = await $`bun run src/index.ts --version`.text()
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
