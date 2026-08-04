import { findProject, readRegistry } from "../core/registry.ts"
import { EXIT } from "../types.ts"
import { cyan, dim, fail, table } from "../ui.ts"

/**
 * Links can come from a cloned repo's committed itaca.yml, so they are
 * untrusted input: only plain http(s) URLs may reach the browser command,
 * and never anything that could parse as an option flag.
 */
function safeUrl(url: string): boolean {
  return /^https?:\/\//.test(url) && !url.startsWith("-")
}

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
  const all = args.includes("--all")
  const [name, linkFilter] = args.filter((a) => !a.startsWith("-"))
  if (!name) {
    fail(
      {
        code: "missing_argument",
        message: "which project? usage: itaca open <project> [link|--all]",
      },
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
  ].filter((l) => safeUrl(l.url))

  if (!links.length) {
    fail({ code: "no_links", message: `no links for ${name}` }, json)
    return EXIT.NOT_FOUND
  }

  const filtered = linkFilter
    ? links.filter(
        (l) =>
          l.service.toLowerCase().includes(linkFilter.toLowerCase()) ||
          l.title.toLowerCase().includes(linkFilter.toLowerCase()),
      )
    : links

  if (!filtered.length) {
    fail({ code: "no_links", message: `no links matching "${linkFilter}" for ${name}` }, json)
    return EXIT.NOT_FOUND
  }

  // No filter and no --all: show the pick list, open nothing (SPEC §7).
  if (!linkFilter && !all && filtered.length > 1) {
    if (json) {
      console.log(JSON.stringify({ links: filtered, opened: [] }))
    } else {
      console.log(table(filtered.map((l) => [cyan(l.service), l.title, dim(l.url)])))
      console.log(
        dim(`\nopen one: itaca open ${name} <filter> · open all: itaca open ${name} --all`),
      )
    }
    return EXIT.OK
  }

  for (const link of filtered) await openUrl(link.url)
  if (json) {
    console.log(JSON.stringify({ opened: filtered.map((l) => l.url) }))
  } else {
    for (const link of filtered) console.log(`${cyan(link.service)} ${link.title} ${dim(link.url)}`)
  }
  return EXIT.OK
}
