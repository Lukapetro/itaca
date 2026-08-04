import type { Project, Registry } from "../types.ts"

export const BRIEFING_MAX_LINES = 40

/** Manifest strings are user/agent-written and may contain newlines; the
 * line cap counts physical lines, so flatten before assembly. */
function flat(s: string): string {
  return s.replace(/\s*\n\s*/g, " — ").trim()
}

/**
 * The agent briefing (SPEC §9.1): one project's card plus one line of
 * cross-project awareness. Hard-capped at BRIEFING_MAX_LINES; truncation
 * drops commands first, then services — narrative survives longest.
 */
export function briefing(project: Project, registry: Registry): string {
  const head: string[] = []
  const p = project
  head.push(`# ${flat(p.name)}${p.description ? ` — ${flat(p.description)}` : ""}`)

  const stackBits = [p.stack.runtime, p.stack.framework, p.stack.language]
    .filter(Boolean)
    .join(" · ")
  const gitBits = p.git ? ` (branch ${p.git.branch}${p.git.dirty ? ", dirty" : ""})` : ""
  head.push(`Path: ${p.path}${gitBits}`)
  if (stackBits) head.push(`Stack: ${stackBits}`)

  const narrative: string[] = []
  if (p.manifest?.status?.phase)
    narrative.push(
      `Status: ${flat(p.manifest.status.phase)} (updated ${p.manifest.status.updated ?? "?"})`,
    )
  if (p.manifest?.status?.next) narrative.push(`Next: ${flat(p.manifest.status.next)}`)
  for (const entry of (p.manifest?.status?.log ?? []).slice(0, 3)) {
    narrative.push(`  ${entry.date}: ${flat(entry.note)}`)
  }

  const services: string[] = []
  if (p.services.length) {
    services.push("Services:")
    for (const s of p.services) {
      const link = s.links[0] ? ` — ${s.links[0].url}` : ""
      services.push(`  ${s.service} (${s.category})${link}`)
    }
  }

  const commands: string[] = []
  if (p.commands.length) {
    commands.push(
      `Commands: ${p.commands
        .slice(0, 6)
        .map((c) => c.run)
        .join(" · ")}`,
    )
  }

  const others = registry.projects
    .filter((o) => o.path !== p.path)
    .slice(0, 4)
    .map((o) =>
      o.manifest?.status?.phase
        ? `${flat(o.name)} (${flat(o.manifest.status.phase)})`
        : flat(o.name),
    )
  const cross = others.length ? [`Other projects: ${others.join(", ")}`] : []

  // Assemble under the cap: head and narrative always fit; services then
  // commands are trimmed to whatever room remains.
  const fixed = [...head, ...narrative]
  const room = BRIEFING_MAX_LINES - fixed.length - cross.length - commands.length
  let trimmedServices: string[]
  if (services.length <= room) {
    trimmedServices = services
  } else if (room >= 2) {
    // room-1 array slots hold the "Services:" header plus room-2 entries;
    // the dropped count is over the entry count (services.length - 1).
    const kept = room - 2
    const dropped = services.length - 1 - kept
    trimmedServices = [...services.slice(0, room - 1), `  …and ${dropped} more (use project_get)`]
  } else {
    trimmedServices = []
  }

  return [...fixed, ...trimmedServices, ...commands, ...cross]
    .slice(0, BRIEFING_MAX_LINES)
    .join("\n")
}
