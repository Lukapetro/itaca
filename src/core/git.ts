import { $ } from "bun"
import type { GitInfo } from "../types.ts"

export async function gitInfo(root: string): Promise<GitInfo | undefined> {
  const head = await $`git -C ${root} rev-parse --abbrev-ref HEAD`.quiet().nothrow()
  if (head.exitCode !== 0) return undefined
  const info: GitInfo = { branch: head.text().trim() }

  const last = await $`git -C ${root} log -1 --format=%cI`.quiet().nothrow()
  if (last.exitCode === 0) info.lastCommitAt = last.text().trim()

  const status = await $`git -C ${root} status --porcelain`.quiet().nothrow()
  if (status.exitCode === 0) info.dirty = status.text().trim().length > 0

  const remote = await $`git -C ${root} remote get-url origin`.quiet().nothrow()
  if (remote.exitCode === 0) {
    const parsed = parseRemote(remote.text().trim())
    if (parsed !== undefined) info.remote = parsed
  }
  return info
}

/** Current HEAD, or undefined outside a repo / on an unborn branch. */
export async function headSha(root: string): Promise<string | undefined> {
  const r = await $`git -C ${root} rev-parse HEAD`.quiet().nothrow()
  return r.exitCode === 0 ? r.text().trim() : undefined
}

/**
 * Commit subjects between an anchor and HEAD, newest first. `exclude` drops
 * commits that touch nothing but those paths.
 *
 * `undefined` means "cannot tell" — not "nothing happened". The anchor must be
 * an **ancestor** of HEAD for the range to mean anything: after a branch switch
 * or a rebase the anchor can still exist while sitting on a divergent history,
 * and `anchor..HEAD` would then list commits that have nothing to do with the
 * status. Merely existing is not enough, so ask git for ancestry.
 */
export async function commitsSince(
  root: string,
  anchor: string,
  exclude: string[] = [],
  cap = 10,
): Promise<string[] | undefined> {
  const ancestor = await $`git -C ${root} merge-base --is-ancestor ${anchor} HEAD`.quiet().nothrow()
  if (ancestor.exitCode !== 0) return undefined
  const range = `${anchor}..HEAD`
  const paths = exclude.length ? [".", ...exclude.map((f) => `:(exclude)${f}`)] : []
  const log = paths.length
    ? await $`git -C ${root} log --format=%s ${range} -- ${paths}`.quiet().nothrow()
    : await $`git -C ${root} log --format=%s ${range}`.quiet().nothrow()
  if (log.exitCode !== 0) return undefined
  const subjects = log.text().trim()
  return subjects ? subjects.split("\n").slice(0, cap) : []
}

/**
 * "host/owner/repo" from a git remote URL. Userinfo (user:token@) is stripped
 * BEFORE parsing — credentials embedded in remotes must never reach the
 * registry (privacy invariant, SECURITY.md).
 */
export function parseRemote(url: string): string | undefined {
  const cleaned = url.replace(/\/\/[^@/]+@/, "//").replace(/^ssh:\/\//, "")
  const m = cleaned.match(/(?:git@|https:\/\/)?([^:/@]+\.[^:/@]+)[:/](.+?)(?:\.git)?\/?$/)
  if (!m?.[1] || !m[2] || m[2].includes("@")) return undefined
  return `${m[1]}/${m[2]}`
}
