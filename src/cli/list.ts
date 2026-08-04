import { readRegistry } from "../core/registry.ts"
import { EXIT } from "../types.ts"
import { bold, cyan, dim, fail, table } from "../ui.ts"

export async function run(_args: string[], json: boolean): Promise<number> {
  const registry = await readRegistry()
  if (!registry) {
    fail(
      {
        code: "no_registry",
        message: "no registry yet",
        fix: "run: itaca scan <your projects folder>",
      },
      json,
    )
    return EXIT.NOT_FOUND
  }
  if (json) {
    console.log(
      JSON.stringify(
        registry.projects.map((p) => ({
          name: p.name,
          path: p.path,
          stack: p.stack,
          services: p.services.map((s) => s.id),
          phase: p.manifest?.status?.phase ?? null,
          lastCommitAt: p.git?.lastCommitAt ?? null,
        })),
      ),
    )
    return EXIT.OK
  }
  console.log(
    bold(`${registry.projects.length} projects`) + dim(` · scanned ${registry.scannedAt}`),
  )
  console.log(
    table(
      registry.projects.map((p) => [
        cyan(p.name),
        [p.stack.runtime, p.stack.framework].filter(Boolean).join("/") || "—",
        p.services.map((s) => s.id).join(",") || "—",
        p.manifest?.status?.phase ?? dim("no status"),
        dim(p.git?.lastCommitAt?.slice(0, 10) ?? ""),
      ]),
    ),
  )
  return EXIT.OK
}
