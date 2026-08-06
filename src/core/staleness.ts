import type { ManifestStatus } from "../types.ts"

/**
 * Whether a project's status still describes the repo, and what to tell the
 * agent if it does not (SPEC §9.4).
 *
 * Deliberately silent in every ambiguous case. This prompt interrupts a session
 * that was trying to end, so a false positive costs more than a missed one:
 * a check that cries wolf gets switched off, and then it catches nothing.
 */
export function stalenessPrompt(
  projectName: string,
  status: ManifestStatus | undefined,
  head: string | undefined,
  commitsSince: string[] | undefined,
): string | undefined {
  // No anchor: either the project never used status, or the manifest predates
  // this field. Both mean "no baseline", not "stale".
  if (!status?.commit || !head) return undefined
  if (head.startsWith(status.commit) || status.commit.startsWith(head)) return undefined
  // undefined = the anchor is unreachable (rebase, squash). We cannot tell.
  if (commitsSince === undefined || commitsSince.length === 0) return undefined

  const short = (sha: string) => sha.slice(0, 7)
  const n = commitsSince.length
  const lines = commitsSince.map((s) => `  - ${s}`).join("\n")
  return [
    `itaca: ${projectName}'s status is anchored to ${short(status.commit)}, HEAD is now ${short(head)}.`,
    `${n} commit${n === 1 ? "" : "s"} landed since it was written:`,
    lines,
    "",
    "Before ending the session, update it with `project_status_update` (or",
    "`itaca status set`): what changed, what is blocked, and any decision left",
    "open — those are the parts a fresh session cannot recover from git.",
    "If nothing meaningful changed, say so and stop; this will not ask again",
    "for this session.",
  ].join("\n")
}
