import { describe, expect, test } from "bun:test"
import { BRIEFING_MAX_LINES, briefing } from "../src/core/briefing.ts"
import type { Project, Registry } from "../src/types.ts"

function bigProject(): Project {
  return {
    name: "megaproject",
    path: "/tmp/megaproject",
    description: "A project with far too much of everything",
    stack: { runtime: "bun", framework: "next", language: "typescript" },
    services: Array.from({ length: 30 }, (_, i) => ({
      id: `svc${i}`,
      service: `Service ${i}`,
      category: "misc",
      links: [{ title: "Dash", url: `https://example.com/${i}` }],
    })),
    commands: Array.from({ length: 20 }, (_, i) => ({ name: `cmd${i}`, run: `bun run cmd${i}` })),
    manifest: {
      version: 1,
      status: {
        phase: "chaos",
        next: "trim everything",
        updated: "2026-08-04",
        log: Array.from({ length: 20 }, (_, i) => ({ date: "2026-08-04", note: `entry ${i}` })),
      },
    },
  }
}

describe("briefing", () => {
  test(`never exceeds ${BRIEFING_MAX_LINES} lines, even on a bloated project`, () => {
    const project = bigProject()
    const registry: Registry = {
      version: 1,
      scannedAt: "",
      roots: [],
      projects: [
        project,
        ...Array.from({ length: 10 }, (_, i) => ({
          ...project,
          name: `p${i}`,
          path: `/tmp/p${i}`,
        })),
      ],
    }
    const lines = briefing(project, registry).split("\n")
    expect(lines.length).toBeLessThanOrEqual(BRIEFING_MAX_LINES)
    // narrative must survive truncation
    expect(lines.join("\n")).toContain("Next: trim everything")
  })

  test("multiline manifest strings cannot break the physical line cap (finding #4)", () => {
    const project = bigProject()
    if (project.manifest?.status) {
      project.manifest.status.phase = Array.from({ length: 60 }, (_, i) => `phase line ${i}`).join(
        "\n",
      )
      project.manifest.status.next = "line one\nline two\nline three"
    }
    project.description = "a\nmultiline\ndescription"
    const registry: Registry = { version: 1, scannedAt: "", roots: [], projects: [project] }
    const physicalLines = briefing(project, registry).split("\n")
    expect(physicalLines.length).toBeLessThanOrEqual(BRIEFING_MAX_LINES)
  })
})
