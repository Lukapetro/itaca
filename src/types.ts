export interface Link {
  title: string
  url: string
}

export type MatchPrimitive =
  | { file: string }
  | { dep: string }
  | { env_key: string }
  | { env_value: string }
  | { content: { file: string; pattern: string } }

export type MatchNode = { any: MatchNode[] } | { all: MatchNode[] } | MatchPrimitive

export interface DetectorRule {
  id: string
  service: string
  category: string
  match: MatchNode
  links?: Link[]
  notes?: string
}

export interface DetectedService {
  id: string
  service: string
  category: string
  links: Link[]
  notes?: string
}

export interface ProjectStack {
  runtime?: string
  framework?: string
  language?: string
  packageManager?: string
}

export interface ProjectCommand {
  name: string
  run: string
}

export interface GitInfo {
  branch?: string
  lastCommitAt?: string
  dirty?: boolean
  remote?: string
}

export interface StatusLogEntry {
  date: string
  note: string
}

export interface ManifestStatus {
  phase?: string
  next?: string
  updated?: string
  log?: StatusLogEntry[]
}

export interface Manifest {
  version: number
  name?: string
  description?: string
  status?: ManifestStatus
  links?: Link[]
  overrides?: { disable?: string[] }
}

export interface Project {
  name: string
  path: string
  description?: string
  stack: ProjectStack
  services: DetectedService[]
  commands: ProjectCommand[]
  git?: GitInfo
  workspaces?: string[]
  manifest?: Manifest
}

export interface Registry {
  version: number
  scannedAt: string
  roots: string[]
  projects: Project[]
}

export const EXIT = {
  OK: 0,
  FAILURE: 1,
  USAGE: 2,
  NOT_FOUND: 3,
  PERMISSION: 4,
  CONFLICT: 5,
} as const
