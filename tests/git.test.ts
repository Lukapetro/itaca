import { describe, expect, test } from "bun:test"
import { parseRemote } from "../src/core/git.ts"
import { codeHostService } from "../src/core/scan.ts"

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

describe("codeHostService (dogfooding: two real repos live on Azure Repos)", () => {
  test("GitHub remotes keep their repo/PR/actions links", () => {
    const svc = codeHostService("github.com/Lukapetro/itaca")
    expect(svc?.id).toBe("github")
    expect(svc?.links.map((l) => l.url)).toEqual([
      "https://github.com/Lukapetro/itaca",
      "https://github.com/Lukapetro/itaca/pulls",
      "https://github.com/Lukapetro/itaca/actions",
    ])
  })

  test.each([
    "https://ivsrl@dev.azure.com/ivsrl/my-takeoff-fe/_git/my-takeoff-fe",
    "https://dev.azure.com/ivsrl/my-takeoff-fe/_git/my-takeoff-fe",
    "git@ssh.dev.azure.com:v3/ivsrl/my-takeoff-fe/my-takeoff-fe",
  ])("Azure DevOps remote %s resolves to the web UI", (url) => {
    const svc = codeHostService(parseRemote(url))
    expect(svc?.id).toBe("azure-devops")
    expect(svc?.category).toBe("code")
    expect(svc?.links.map((l) => l.url)).toEqual([
      "https://dev.azure.com/ivsrl/my-takeoff-fe/_git/my-takeoff-fe",
      "https://dev.azure.com/ivsrl/my-takeoff-fe/_git/my-takeoff-fe/pullrequests",
      "https://dev.azure.com/ivsrl/my-takeoff-fe/_build",
    ])
  })

  test("the userinfo in an Azure remote never reaches the links", () => {
    const svc = codeHostService(parseRemote("https://user:PAT_SECRET@dev.azure.com/o/p/_git/r"))
    expect(JSON.stringify(svc)).not.toContain("PAT_SECRET")
  })

  test("unknown hosts and missing remotes yield no code service", () => {
    expect(codeHostService(undefined)).toBeUndefined()
    expect(codeHostService("gitlab.com/g/p")).toBeUndefined()
    // an Azure org page is not a repo
    expect(codeHostService("dev.azure.com/ivsrl")).toBeUndefined()
  })
})
