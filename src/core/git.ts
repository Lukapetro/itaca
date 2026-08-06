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
 * Commit subjects between an anchor and HEAD, newest first.
 *
 * `undefined` means "cannot tell" — not "nothing happened". A rebase or squash
 * can leave the anchor unreachable, and a staleness prompt built on a guess is
 * worse than no prompt at all, so callers must stay silent in that case.
 */
export async function commitsSince(
  root: string,
  anchor: string,
  cap = 10,
): Promise<string[] | undefined> {
  const reachable = await $`git -C ${root} cat-file -e ${`${anchor}^{commit}`}`.quiet().nothrow()
  if (reachable.exitCode !== 0) return undefined
  const log = await $`git -C ${root} log --format=%s ${`${anchor}..HEAD`}`.quiet().nothrow()
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
