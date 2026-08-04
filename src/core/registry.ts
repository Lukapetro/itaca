import type { Project, Registry } from "../types.ts"
import { registryPath } from "./paths.ts"

export async function readRegistry(): Promise<Registry | undefined> {
  const file = Bun.file(registryPath())
  if (!(await file.exists())) return undefined
  try {
    return (await file.json()) as Registry
  } catch {
    return undefined
  }
}

export async function writeRegistry(registry: Registry): Promise<void> {
  await Bun.write(registryPath(), `${JSON.stringify(registry, null, 2)}\n`)
}

export function findProject(registry: Registry, name: string): Project | undefined {
  const lower = name.toLowerCase()
  return registry.projects.find((p) => p.name.toLowerCase() === lower)
}

/** Find the registered project containing the given directory. */
export function projectForCwd(registry: Registry, cwd: string): Project | undefined {
  return registry.projects.find((p) => cwd === p.path || cwd.startsWith(`${p.path}/`))
}
