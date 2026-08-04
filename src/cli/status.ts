import { parseArgs } from "node:util"
import { applyStatusUpdate, readManifest, writeManifest } from "../core/manifest.ts"
import { findProject, readRegistry } from "../core/registry.ts"
import { EXIT } from "../types.ts"
import { fail, green } from "../ui.ts"

export async function run(args: string[], json: boolean): Promise<number> {
  const [verb, name] = args.filter((a) => !a.startsWith("-"))
  if (verb !== "set" || !name) {
    fail(
      {
        code: "usage",
        message: "usage: itaca status set <project> [--phase X] [--next Y] [--note Z]",
      },
      json,
    )
    return EXIT.USAGE
  }
  const { values } = parseArgs({
    args,
    options: { phase: { type: "string" }, next: { type: "string" }, note: { type: "string" } },
    allowPositionals: true,
    strict: false,
  })
  const update = {
    ...(typeof values.phase === "string" ? { phase: values.phase } : {}),
    ...(typeof values.next === "string" ? { next: values.next } : {}),
    ...(typeof values.note === "string" ? { note: values.note } : {}),
  }
  if (!Object.keys(update).length) {
    fail({ code: "usage", message: "nothing to set — pass --phase, --next, or --note" }, json)
    return EXIT.USAGE
  }

  const registry = await readRegistry()
  const project = registry ? findProject(registry, name) : undefined
  if (!project) {
    fail(
      { code: "project_not_found", message: `no project named "${name}"`, fix: "run: itaca list" },
      json,
    )
    return EXIT.NOT_FOUND
  }

  const today = new Date().toISOString().slice(0, 10)
  const manifest = applyStatusUpdate(await readManifest(project.path), update, today)
  await writeManifest(project.path, manifest)

  if (json) console.log(JSON.stringify({ project: project.name, status: manifest.status }))
  else console.log(`${green("✓")} ${project.name} status updated (itaca.yml)`)
  return EXIT.OK
}
