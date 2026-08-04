import { renameSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse, stringify } from "yaml"

/** Crash-safe write: temp file in the same directory, then atomic rename. */
export async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}`
  await Bun.write(tmp, content)
  renameSync(tmp, path)
}

export function configDir(): string {
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "itaca")
}

export function dataDir(): string {
  return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "itaca")
}

export function registryPath(): string {
  return join(dataDir(), "registry.json")
}

export function configPath(): string {
  return join(configDir(), "config.yml")
}

export interface Config {
  roots: string[]
}

export async function readConfig(): Promise<Config> {
  const file = Bun.file(configPath())
  if (!(await file.exists())) return { roots: [] }
  const raw = parse(await file.text()) as Partial<Config> | null
  return { roots: raw?.roots ?? [] }
}

export async function writeConfig(config: Config): Promise<void> {
  await writeAtomic(configPath(), stringify(config))
}

/** Add a root persistently; returns the updated config. */
export async function addRoot(root: string): Promise<Config> {
  const config = await readConfig()
  if (!config.roots.includes(root)) config.roots.push(root)
  await writeConfig(config)
  return config
}
