import { resolve } from "node:path"
import { addRoot, readConfig } from "../core/paths.ts"
import { writeRegistry } from "../core/registry.ts"
import { scanRoots } from "../core/scan.ts"
import { EXIT } from "../types.ts"
import { bold, cyan, dim, fail, table } from "../ui.ts"

export async function run(args: string[], json: boolean): Promise<number> {
  const dirs = args.filter((a) => !a.startsWith("-"))
  let roots: string[]
  if (dirs.length) {
    for (const dir of dirs) await addRoot(resolve(dir))
    roots = (await readConfig()).roots
  } else {
    roots = (await readConfig()).roots
    if (!roots.length) {
      fail(
        {
          code: "no_roots",
          message: "no roots configured",
          fix: "run: itaca scan <your projects folder>",
        },
        json,
      )
      return EXIT.USAGE
    }
  }

  const registry = await scanRoots(roots, new Date().toISOString())
  await writeRegistry(registry)

  if (json) {
    console.log(JSON.stringify(registry))
    return EXIT.OK
  }
  console.log(`${bold(String(registry.projects.length))} projects found in ${roots.join(", ")}\n`)
  console.log(
    table(
      registry.projects.map((p) => [
        cyan(p.name),
        [p.stack.runtime, p.stack.framework].filter(Boolean).join("/") || "—",
        p.services.map((s) => s.id).join(",") || dim("no services"),
      ]),
    ),
  )
  console.log(
    dim(`\nregistry updated · try: itaca context (inside a project) or itaca open <name>`),
  )
  return EXIT.OK
}
