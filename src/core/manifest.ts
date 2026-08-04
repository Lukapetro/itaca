import { join } from "node:path"
import { parse, stringify } from "yaml"
import type { Manifest } from "../types.ts"
import { writeAtomic } from "./paths.ts"

export const MANIFEST_FILE = "itaca.yml"
export const SCHEMA_HEADER =
  "# yaml-language-server: $schema=https://raw.githubusercontent.com/Lukapetro/itaca/main/schema/itaca.schema.json"

export function manifestPath(root: string): string {
  return join(root, MANIFEST_FILE)
}

export async function readManifest(root: string): Promise<Manifest | undefined> {
  const file = Bun.file(manifestPath(root))
  if (!(await file.exists())) return undefined
  try {
    const raw = parse(await file.text()) as Manifest | null
    if (!raw || typeof raw !== "object" || typeof raw.version !== "number") return undefined
    return raw
  } catch {
    return undefined
  }
}

export async function writeManifest(root: string, manifest: Manifest): Promise<void> {
  await writeAtomic(manifestPath(root), `${SCHEMA_HEADER}\n${stringify(manifest)}`)
}

const LOG_CAP = 20

/** Merge a status update into a manifest (creating a minimal one if absent). */
export function applyStatusUpdate(
  existing: Manifest | undefined,
  update: { phase?: string; next?: string; note?: string },
  today: string,
): Manifest {
  const manifest: Manifest = existing ?? { version: 1 }
  const status = manifest.status ?? {}
  if (update.phase !== undefined) status.phase = update.phase
  if (update.next !== undefined) status.next = update.next
  status.updated = today
  if (update.note !== undefined) {
    status.log = [{ date: today, note: update.note }, ...(status.log ?? [])].slice(0, LOG_CAP)
  }
  manifest.status = status
  return manifest
}
