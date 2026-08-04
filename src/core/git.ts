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
    const url = remote.text().trim()
    const m = url.match(/(?:git@|https:\/\/)([^:/]+)[:/](.+?)(?:\.git)?$/)
    if (m?.[1] && m[2]) info.remote = `${m[1]}/${m[2]}`
  }
  return info
}
