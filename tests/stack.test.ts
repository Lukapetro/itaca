import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Evidence } from "../src/core/evidence.ts"
import { detectWorkspaces, resolveMembers } from "../src/core/stack.ts"

const TURBO_FIXTURE = join(import.meta.dir, "fixtures", "turbo-monorepo")

describe("workspace resolution (bugbot findings)", () => {
  test("negated patterns exclude members (npm/pnpm semantics)", () => {
    const ev = new Evidence(TURBO_FIXTURE)
    expect(resolveMembers(["apps/*"], ev)).toEqual(["apps/web", "apps/worker"])
    expect(resolveMembers(["apps/*", "!apps/worker"], ev)).toEqual(["apps/web"])
    expect(resolveMembers(["apps/*", "!apps/worker/"], ev)).toEqual(["apps/web"])
    // exclusions never resurface in the raw-glob fallback
    expect(resolveMembers(["nothing/*", "!nothing/x"], ev)).toEqual(["nothing/*"])
  })

  test("turbo.json fallback fires even when package.json is unreadable or absent", async () => {
    const broken = mkdtempSync(join(tmpdir(), "itaca-turbo-broken-"))
    writeFileSync(join(broken, "package.json"), "{ not json")
    writeFileSync(join(broken, "turbo.json"), "{}")
    expect(await detectWorkspaces(broken, new Evidence(broken))).toEqual([])

    const bare = mkdtempSync(join(tmpdir(), "itaca-turbo-bare-"))
    mkdirSync(join(bare, "sub"))
    writeFileSync(join(bare, "turbo.json"), "{}")
    expect(await detectWorkspaces(bare, new Evidence(bare))).toEqual([])
  })

  test("a NESTED turbo.json does not reclassify an ordinary repo as monorepo", async () => {
    const repo = mkdtempSync(join(tmpdir(), "itaca-turbo-nested-"))
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "ordinary" }))
    mkdirSync(join(repo, "vendor", "example"), { recursive: true })
    writeFileSync(join(repo, "vendor", "example", "turbo.json"), "{}")
    expect(await detectWorkspaces(repo, new Evidence(repo))).toBeUndefined()
  })
})
