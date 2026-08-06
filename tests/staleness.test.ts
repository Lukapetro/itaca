import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { $ } from "bun"
import { commitsSince, headSha } from "../src/core/git.ts"
import { applyStatusUpdate } from "../src/core/manifest.ts"
import { stalenessPrompt } from "../src/core/staleness.ts"

const ANCHOR = "a".repeat(40)
const HEAD = "b".repeat(40)

describe("stalenessPrompt (silence in every ambiguous case)", () => {
  test("stays silent when there is no anchor to compare against", () => {
    expect(stalenessPrompt("p", undefined, HEAD, ["x"])).toBeUndefined()
    expect(stalenessPrompt("p", { phase: "beta" }, HEAD, ["x"])).toBeUndefined()
  })

  test("stays silent outside a repo (no HEAD)", () => {
    expect(stalenessPrompt("p", { commit: ANCHOR }, undefined, ["x"])).toBeUndefined()
  })

  test("stays silent when the status still describes HEAD", () => {
    expect(stalenessPrompt("p", { commit: ANCHOR }, ANCHOR, [])).toBeUndefined()
    // a short anchor still matches the full sha it was taken from
    expect(stalenessPrompt("p", { commit: ANCHOR.slice(0, 7) }, ANCHOR, [])).toBeUndefined()
  })

  test("stays silent when the anchor is unreachable — a rebase is not evidence", () => {
    expect(stalenessPrompt("p", { commit: ANCHOR }, HEAD, undefined)).toBeUndefined()
  })

  test("prompts with the commits, and leaves the agent an explicit out", () => {
    const out = stalenessPrompt("dropsonar", { commit: ANCHOR }, HEAD, ["feat: x", "fix: y"])
    expect(out).toContain("dropsonar")
    expect(out).toContain("2 commits landed")
    expect(out).toContain("feat: x")
    expect(out).toContain("what is blocked")
    expect(out).toContain("If nothing meaningful changed, say so and stop")
    // short shas only — no 40-char noise in the agent's context
    expect(out).not.toContain(ANCHOR)
  })
})

describe("the anchor round-trips through a real repo", () => {
  test("status written now matches HEAD; a later commit makes it stale", async () => {
    const repo = mkdtempSync(join(tmpdir(), "itaca-anchor-"))
    await $`git -C ${repo} init -q`.quiet()
    await $`git -C ${repo} config user.email t@t`.quiet()
    await $`git -C ${repo} config user.name t`.quiet()
    writeFileSync(join(repo, "a.txt"), "1")
    await $`git -C ${repo} add -A`.quiet()
    await $`git -C ${repo} commit -qm "feat: first"`.quiet()

    const at = await headSha(repo)
    const manifest = applyStatusUpdate(undefined, { note: "done" }, "2026-08-06", at)
    expect(manifest.status?.commit).toBe(at as string)

    // nothing has happened yet
    expect(await commitsSince(repo, at as string)).toEqual([])
    expect(stalenessPrompt("r", manifest.status, await headSha(repo), [])).toBeUndefined()

    writeFileSync(join(repo, "a.txt"), "2")
    await $`git -C ${repo} commit -qam "fix: second"`.quiet()

    const since = await commitsSince(repo, at as string)
    expect(since).toEqual(["fix: second"])
    expect(stalenessPrompt("r", manifest.status, await headSha(repo), since)).toContain(
      "fix: second",
    )
  })

  test("an unknown anchor yields undefined, not an empty list", async () => {
    const repo = mkdtempSync(join(tmpdir(), "itaca-anchor-gone-"))
    await $`git -C ${repo} init -q`.quiet()
    await $`git -C ${repo} config user.email t@t`.quiet()
    await $`git -C ${repo} config user.name t`.quiet()
    writeFileSync(join(repo, "a.txt"), "1")
    await $`git -C ${repo} add -A`.quiet()
    await $`git -C ${repo} commit -qm "feat: only"`.quiet()

    expect(await commitsSince(repo, ANCHOR)).toBeUndefined()
  })
})
