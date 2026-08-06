import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { $ } from "bun"
import { commitsSince, headSha } from "../src/core/git.ts"
import { applyStatusUpdate, MANIFEST_FILE } from "../src/core/manifest.ts"
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

/** Both reported by Greptile on PR #14, both reproduced before being fixed. */
describe("the check does not fire on its own footprint or on a divergent history", () => {
  async function repoWithStatus(): Promise<{ repo: string; anchor: string }> {
    const repo = mkdtempSync(join(tmpdir(), "itaca-p1-"))
    await $`git -C ${repo} init -q`.quiet()
    await $`git -C ${repo} config user.email t@t`.quiet()
    await $`git -C ${repo} config user.name t`.quiet()
    writeFileSync(join(repo, "a.txt"), "1")
    await $`git -C ${repo} add -A`.quiet()
    await $`git -C ${repo} commit -qm "feat: first"`.quiet()
    const anchor = (await headSha(repo)) as string
    writeFileSync(join(repo, MANIFEST_FILE), "version: 1\n")
    return { repo, anchor }
  }

  test("committing itaca.yml after a status update does not become the next prompt", async () => {
    const { repo, anchor } = await repoWithStatus()
    await $`git -C ${repo} add -A`.quiet()
    await $`git -C ${repo} commit -qm "chore: itaca status"`.quiet()

    // the manifest commit alone is not news…
    expect(await commitsSince(repo, anchor, [MANIFEST_FILE])).toEqual([])
    // …but it must not mask real work landing alongside it
    writeFileSync(join(repo, "a.txt"), "2")
    writeFileSync(join(repo, MANIFEST_FILE), "version: 1\n# touched\n")
    await $`git -C ${repo} commit -qam "feat: real work"`.quiet()
    expect(await commitsSince(repo, anchor, [MANIFEST_FILE])).toEqual(["feat: real work"])
  })

  test("an anchor that exists but is not an ancestor of HEAD yields undefined", async () => {
    const { repo, anchor } = await repoWithStatus()
    await $`git -C ${repo} add -A`.quiet()
    await $`git -C ${repo} commit -qm "chore: manifest"`.quiet()
    writeFileSync(join(repo, "a.txt"), "2")
    await $`git -C ${repo} commit -qam "feat: on the anchor's branch"`.quiet()
    const anchorOnBranch = (await headSha(repo)) as string

    // start a divergent branch from the root commit: the anchor still exists as
    // an object, but nothing about it describes this history
    await $`git -C ${repo} checkout -q -b other ${anchor}`.quiet()
    writeFileSync(join(repo, "b.txt"), "x")
    await $`git -C ${repo} add -A`.quiet()
    await $`git -C ${repo} commit -qm "feat: unrelated"`.quiet()

    await $`git -C ${repo} cat-file -e ${anchorOnBranch}`.quiet() // the object is reachable…
    expect(await commitsSince(repo, anchorOnBranch, [MANIFEST_FILE])).toBeUndefined() // …but silent
  })
})
