import { findProject, readRegistry } from "../core/registry.ts"
import { EXIT } from "../types.ts"
import { bold, cyan, dim, fail } from "../ui.ts"

export async function run(args: string[], json: boolean): Promise<number> {
  const name = args[0]
  if (!name) {
    fail({ code: "missing_argument", message: "which project? usage: itaca show <project>" }, json)
    return EXIT.USAGE
  }
  const registry = await readRegistry()
  const project = registry ? findProject(registry, name) : undefined
  if (!registry || !project) {
    fail(
      {
        code: "project_not_found",
        message: `no project named "${name}" in the registry`,
        fix: registry
          ? `known: ${registry.projects.map((p) => p.name).join(", ")}`
          : "run: itaca scan",
      },
      json,
    )
    return EXIT.NOT_FOUND
  }
  if (json) {
    console.log(JSON.stringify(project))
    return EXIT.OK
  }
  console.log(`${bold(project.name)}${project.description ? ` — ${project.description}` : ""}`)
  console.log(dim(project.path))
  const stackBits = [
    project.stack.runtime,
    project.stack.framework,
    project.stack.language,
    project.stack.packageManager,
  ]
    .filter(Boolean)
    .join(" · ")
  if (stackBits) console.log(`stack   ${stackBits}`)
  if (project.git) {
    console.log(
      `git     ${project.git.branch}${project.git.dirty ? " (dirty)" : ""} · last commit ${project.git.lastCommitAt?.slice(0, 10) ?? "?"}`,
    )
  }
  if (project.workspaces?.length)
    console.log(`mono    workspaces: ${project.workspaces.join(", ")}`)
  if (project.manifest?.status?.phase)
    console.log(
      `status  ${project.manifest.status.phase} (${project.manifest.status.updated ?? "?"})`,
    )
  if (project.manifest?.status?.next) console.log(`next    ${project.manifest.status.next}`)
  if (project.services.length) {
    console.log("\nservices")
    for (const s of project.services) {
      console.log(`  ${cyan(s.service)} ${dim(`(${s.category})`)}`)
      for (const link of s.links) console.log(`    ${link.title}: ${link.url}`)
    }
  }
  if (project.commands.length) {
    console.log("\ncommands")
    for (const c of project.commands.slice(0, 10)) console.log(`  ${c.run}`)
  }
  for (const entry of (project.manifest?.status?.log ?? []).slice(0, 5)) {
    console.log(dim(`  ${entry.date}: ${entry.note}`))
  }
  return EXIT.OK
}
