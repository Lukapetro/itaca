import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Evidence } from "../src/core/evidence.ts"
import { detectStack, detectWorkspaces, resolveMembers } from "../src/core/stack.ts"

const TURBO_FIXTURE = join(import.meta.dir, "fixtures", "turbo-monorepo")

function repoWithDeps(deps: Record<string, string>, dev: Record<string, string> = {}): string {
  const repo = mkdtempSync(join(tmpdir(), "itaca-stack-"))
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify({ name: "x", dependencies: deps, devDependencies: dev }),
  )
  return repo
}

describe("framework detection (dogfooding: toru was reported as vite)", () => {
  test("Electron wins over the renderer framework it bundles", async () => {
    const repo = repoWithDeps({ react: "19" }, { electron: "34", vite: "6" })
    expect((await detectStack(new Evidence(repo))).framework).toBe("electron")
  })

  test("Electron does not shadow frameworks in repos that lack it", async () => {
    const repo = repoWithDeps({ vite: "6" })
    expect((await detectStack(new Evidence(repo))).framework).toBe("vite")
  })
})

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

  test("a NESTED pnpm-workspace.yaml does not hijack root package.json workspaces", async () => {
    const repo = mkdtempSync(join(tmpdir(), "itaca-pnpm-nested-"))
    writeFileSync(
      join(repo, "package.json"),
      JSON.stringify({ name: "root", workspaces: ["packs/*"] }),
    )
    mkdirSync(join(repo, "packs", "a"), { recursive: true })
    writeFileSync(join(repo, "packs", "a", "package.json"), JSON.stringify({ name: "a" }))
    writeFileSync(join(repo, "packs", "a", "pnpm-workspace.yaml"), "packages: ['x/*']\n")
    expect(await detectWorkspaces(repo, new Evidence(repo))).toEqual(["packs/a"])
  })

  test("a NESTED turbo.json does not reclassify an ordinary repo as monorepo", async () => {
    const repo = mkdtempSync(join(tmpdir(), "itaca-turbo-nested-"))
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "ordinary" }))
    mkdirSync(join(repo, "vendor", "example"), { recursive: true })
    writeFileSync(join(repo, "vendor", "example", "turbo.json"), "{}")
    expect(await detectWorkspaces(repo, new Evidence(repo))).toBeUndefined()
  })
})
