import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import pkg from "../../package.json"
import { briefing } from "../core/briefing.ts"
import { applyStatusUpdate, readManifest, writeManifest } from "../core/manifest.ts"
import { findProject, readRegistry } from "../core/registry.ts"
import { EXIT } from "../types.ts"

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] }
}

function errorText(s: string) {
  return { ...text(s), isError: true }
}

const NO_REGISTRY = "No registry on this machine yet. Run `itaca scan <projects folder>` first."

/** Three tools, token-bounded outputs (SPEC §9.2). Exported for tests. */
export function buildServer(): McpServer {
  const server = new McpServer({ name: "itaca", version: pkg.version })

  server.registerTool(
    "projects_list",
    {
      description:
        "List every project on this machine: name, stack, services, status phase, last activity. One line per project.",
      inputSchema: {},
    },
    async () => {
      const registry = await readRegistry()
      if (!registry) return errorText(NO_REGISTRY)
      const lines = registry.projects.map((p) => {
        const stack = [p.stack.runtime, p.stack.framework].filter(Boolean).join("/")
        const services = p.services.map((s) => s.id).join(",")
        const phase = p.manifest?.status?.phase ?? "no status"
        const last = p.git?.lastCommitAt?.slice(0, 10) ?? "?"
        return `${p.name} · ${stack || "?"} · ${services || "no services"} · ${phase} · last commit ${last}`
      })
      return text(lines.join("\n") || "No projects found.")
    },
  )

  server.registerTool(
    "project_get",
    {
      description:
        "Full briefing for one project: description, stack, services with dashboard links, commands, narrative status and where work left off. Use this instead of exploring the repo.",
      inputSchema: { name: z.string().describe("Project name as shown by projects_list") },
    },
    async ({ name }) => {
      const registry = await readRegistry()
      if (!registry) return errorText(NO_REGISTRY)
      const project = findProject(registry, name)
      if (!project) {
        return errorText(
          `No project named "${name}". Known: ${registry.projects.map((p) => p.name).join(", ")}`,
        )
      }
      return text(briefing(project, registry))
    },
  )

  server.registerTool(
    "project_status_update",
    {
      description:
        "Update a project's narrative status in its itaca.yml (committed to git). Call at the end of a work session: 1-2 line note of what changed, optionally new phase/next. Never include secrets or env values.",
      inputSchema: {
        name: z.string().describe("Project name"),
        phase: z.string().optional().describe("Current phase, e.g. 'beta — 12 pilot users'"),
        next: z.string().optional().describe("What's next, 1 line"),
        note: z.string().optional().describe("Log entry for today, 1-2 lines"),
      },
    },
    async ({ name, phase, next, note }) => {
      const registry = await readRegistry()
      if (!registry) return errorText(NO_REGISTRY)
      const project = findProject(registry, name)
      if (!project) return errorText(`No project named "${name}".`)
      if (phase === undefined && next === undefined && note === undefined) {
        return errorText("Nothing to update — pass phase, next, or note.")
      }
      const today = new Date().toISOString().slice(0, 10)
      const manifest = applyStatusUpdate(
        await readManifest(project.path),
        {
          ...(phase !== undefined ? { phase } : {}),
          ...(next !== undefined ? { next } : {}),
          ...(note !== undefined ? { note } : {}),
        },
        today,
      )
      await writeManifest(project.path, manifest)
      return text(`Updated ${project.name} (itaca.yml). Status: ${manifest.status?.phase ?? "—"}`)
    },
  )

  return server
}

export async function run(_args: string[], _json: boolean): Promise<number> {
  const server = buildServer()
  await server.connect(new StdioServerTransport())
  // Serve until the client closes the pipe.
  await new Promise(() => {})
  return EXIT.OK
}
