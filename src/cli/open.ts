import { findProject, readRegistry } from "../core/registry.ts"
import { EXIT } from "../types.ts"
import { cyan, dim, fail } from "../ui.ts"

async function openUrl(url: string): Promise<void> {
  const browser = process.env.BROWSER
  const cmd = browser
    ? [browser, url]
    : process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url]
  Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }).unref()
}

export async function run(args: string[], json: boolean): Promise<number> {
  const [name, linkFilter] = args.filter((a) => !a.startsWith("-"))
  if (!name) {
    fail(
      { code: "missing_argument", message: "which project? usage: itaca open <project> [link]" },
      json,
    )
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

  const links = [
    ...project.services.flatMap((s) => s.links.map((l) => ({ ...l, service: s.service }))),
    ...(project.manifest?.links ?? []).map((l) => ({ ...l, service: "manual" })),
  ]
  const filtered = linkFilter
    ? links.filter(
        (l) =>
          l.service.toLowerCase().includes(linkFilter.toLowerCase()) ||
          l.title.toLowerCase().includes(linkFilter.toLowerCase()),
      )
    : links

  if (!filtered.length) {
    fail(
      {
        code: "no_links",
        message: `no links${linkFilter ? ` matching "${linkFilter}"` : ""} for ${name}`,
      },
      json,
    )
    return EXIT.NOT_FOUND
  }
  for (const link of filtered) await openUrl(link.url)
  if (json) {
    console.log(JSON.stringify({ opened: filtered.map((l) => l.url) }))
  } else {
    for (const link of filtered) console.log(`${cyan(link.service)} ${link.title} ${dim(link.url)}`)
  }
  return EXIT.OK
}
