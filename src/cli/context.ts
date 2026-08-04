import { resolve } from "node:path"
import { briefing } from "../core/briefing.ts"
import { loadRules } from "../core/engine.ts"
import { projectForCwd, readRegistry } from "../core/registry.ts"
import { scanProject } from "../core/scan.ts"
import { EXIT } from "../types.ts"
import { dim } from "../ui.ts"

export async function run(args: string[], json: boolean): Promise<number> {
  const cwdFlag = args.indexOf("--cwd")
  const cwd = resolve(
    cwdFlag !== -1 && args[cwdFlag + 1] ? (args[cwdFlag + 1] as string) : process.cwd(),
  )

  const registry = (await readRegistry()) ?? { version: 1, scannedAt: "", roots: [], projects: [] }
  let project = projectForCwd(registry, cwd)
  let adHoc = false
  if (!project) {
    // Not registered: detect ad-hoc, persist nothing (SPEC §13.5).
    const { rules } = loadRules()
    project = await scanProject(cwd, rules)
    adHoc = true
  }

  // Freshness: re-scan the single project so the briefing never lags the repo.
  if (!adHoc) {
    const { rules } = loadRules()
    project = await scanProject(project.path, rules)
  }

  if (json) {
    console.log(
      JSON.stringify({ briefing: briefing(project, registry), project: project.name, adHoc }),
    )
    return EXIT.OK
  }
  console.log(briefing(project, registry))
  if (adHoc)
    console.log(dim("\n(unregistered project — run `itaca scan` on its parent folder to register)"))
  return EXIT.OK
}
