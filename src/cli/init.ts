import { basename } from "node:path"
import { manifestPath, readManifest, writeManifest } from "../core/manifest.ts"
import { EXIT } from "../types.ts"
import { fail, green } from "../ui.ts"

export async function run(_args: string[], json: boolean): Promise<number> {
  const cwd = process.cwd()
  if (await readManifest(cwd)) {
    fail({ code: "already_exists", message: `${manifestPath(cwd)} already exists` }, json)
    return EXIT.CONFLICT
  }
  let description: string | undefined
  try {
    const pkg = (await Bun.file(`${cwd}/package.json`).json()) as { description?: string }
    description = pkg.description
  } catch {
    // no package.json — fine
  }
  const manifest = {
    version: 1,
    name: basename(cwd),
    ...(description !== undefined ? { description } : {}),
    status: { phase: "", next: "", updated: new Date().toISOString().slice(0, 10) },
  }
  await writeManifest(cwd, manifest)
  if (json) console.log(JSON.stringify({ created: manifestPath(cwd) }))
  else
    console.log(`${green("✓")} wrote ${manifestPath(cwd)} — fill in status.phase and status.next`)
  return EXIT.OK
}
