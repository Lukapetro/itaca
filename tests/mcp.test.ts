import { beforeAll, describe, expect, test } from "bun:test"
import { join } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { buildServer } from "../src/cli/mcp.ts"
import { loadRules } from "../src/core/engine.ts"
import { writeRegistry } from "../src/core/registry.ts"
import { scanProject } from "../src/core/scan.ts"

async function connectedClient(): Promise<Client> {
  const client = new Client({ name: "test", version: "0.0.0" })
  const server = buildServer()
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
  return client
}

function textOf(result: unknown): string {
  const r = result as { content: { type: string; text: string }[] }
  return r.content.map((c) => c.text).join("\n")
}

describe("mcp server", () => {
  beforeAll(async () => {
    // Seed the (test-isolated, see setup.ts) registry with a real fixture scan.
    const { rules } = loadRules()
    const dir = join(import.meta.dir, "fixtures", "next-neon-stripe")
    const project = await scanProject(dir, rules)
    await writeRegistry({
      version: 1,
      scannedAt: "2026-08-04T00:00:00Z",
      roots: [],
      projects: [project],
    })
  })

  test("exposes exactly the three SPEC §9.2 tools", async () => {
    const client = await connectedClient()
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      "project_get",
      "project_status_update",
      "projects_list",
    ])
  })

  test("projects_list is one line per project", async () => {
    const client = await connectedClient()
    const result = await client.callTool({ name: "projects_list", arguments: {} })
    const lines = textOf(result).split("\n")
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain("next-neon-stripe")
    expect(lines[0]).toContain("neon")
  })

  test("project_get returns the briefing, unknown name errors with known list", async () => {
    const client = await connectedClient()
    const ok = await client.callTool({
      name: "project_get",
      arguments: { name: "next-neon-stripe" },
    })
    expect(textOf(ok)).toContain("Stack:")
    const missing = (await client.callTool({
      name: "project_get",
      arguments: { name: "nope" },
    })) as {
      isError?: boolean
    }
    expect(missing.isError).toBe(true)
    expect(textOf(missing)).toContain("next-neon-stripe")
  })

  test("project_get output never contains env values", async () => {
    const client = await connectedClient()
    const result = await client.callTool({
      name: "project_get",
      arguments: { name: "next-neon-stripe" },
    })
    expect(textOf(result)).not.toContain("hunter2-not-a-real-secret")
    expect(textOf(result)).not.toContain("sk_test_FAKEFIXTUREVALUE")
  })

  test("server lifecycle: onclose fires when the transport closes (Greptile P1)", async () => {
    const server = buildServer()
    const closed = new Promise<void>((resolve) => {
      server.server.onclose = resolve
    })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: "test", version: "0.0.0" })
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
    await client.close()
    await closed // hangs the test (5s timeout) if shutdown is broken
  })

  test("project_status_update with nothing to set errors", async () => {
    const client = await connectedClient()
    const result = (await client.callTool({
      name: "project_status_update",
      arguments: { name: "next-neon-stripe" },
    })) as { isError?: boolean }
    expect(result.isError).toBe(true)
  })
})
