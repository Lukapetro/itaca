import { describe, expect, test } from "bun:test"
import { parseRemote } from "../src/core/git.ts"

describe("parseRemote (finding #2 — credentials must never survive)", () => {
  test.each([
    ["https://github.com/Lukapetro/itaca.git", "github.com/Lukapetro/itaca"],
    ["git@github.com:Lukapetro/itaca.git", "github.com/Lukapetro/itaca"],
    ["ssh://git@github.com/Lukapetro/itaca.git", "github.com/Lukapetro/itaca"],
    ["https://user:ghp_SECRETTOKEN@github.com/x/y.git", "github.com/x/y"],
    ["https://oauth2:glpat-abc123@gitlab.com/g/p.git", "gitlab.com/g/p"],
  ])("%s → %s", (url, expected) => {
    const parsed = parseRemote(url)
    expect(parsed).toBe(expected)
    expect(parsed).not.toContain("SECRETTOKEN")
    expect(parsed).not.toContain("glpat")
  })
})
