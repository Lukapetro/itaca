import { type Dirent, readdirSync } from "node:fs"
import { join } from "node:path"

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", "vendor"])

/**
 * Lazily collected facts about one repo, shared across detector rules.
 *
 * PRIVACY INVARIANT: values from .env* files live only inside this object for
 * the duration of a scan and are exposed solely through boolean matching
 * (envValueMatches). They must never be returned, stored, or printed.
 */
export class Evidence {
  readonly root: string
  private filesCache: string[] | undefined
  private depsCache: Set<string> | undefined
  private envCache: { keys: string[]; values: string[] } | undefined
  private contentCache = new Map<string, string | null>()

  constructor(root: string) {
    this.root = root
  }

  /** Relative paths up to depth 2, excluding heavy directories. */
  files(): string[] {
    if (this.filesCache) return this.filesCache
    const out: string[] = []
    const walk = (dir: string, prefix: string, depth: number) => {
      let entries: Dirent[]
      try {
        entries = readdirSync(join(this.root, dir), { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name
        if (e.isDirectory()) {
          if (depth < 2 && !SKIP_DIRS.has(e.name)) walk(join(dir, e.name), rel, depth + 1)
        } else {
          out.push(rel)
        }
      }
    }
    walk("", "", 0)
    this.filesCache = out
    return out
  }

  hasFile(pattern: string): boolean {
    if (!/[*?[\]{}]/.test(pattern)) return this.files().includes(pattern)
    const glob = new Bun.Glob(pattern)
    return this.files().some((f) => glob.match(f))
  }

  private async deps(): Promise<Set<string>> {
    if (this.depsCache) return this.depsCache
    const set = new Set<string>()
    const pkgFiles = this.files().filter((f) => f === "package.json" || f.endsWith("/package.json"))
    for (const rel of pkgFiles) {
      try {
        const pkg = (await Bun.file(join(this.root, rel)).json()) as Record<string, unknown>
        for (const group of [
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "optionalDependencies",
        ]) {
          const obj = pkg[group]
          if (obj && typeof obj === "object") for (const name of Object.keys(obj)) set.add(name)
        }
      } catch {
        // unparseable package.json — ignore
      }
    }
    this.depsCache = set
    return set
  }

  async hasDep(name: string): Promise<boolean> {
    return (await this.deps()).has(name)
  }

  private async env(): Promise<{ keys: string[]; values: string[] }> {
    if (this.envCache) return this.envCache
    const keys: string[] = []
    const values: string[] = []
    const envFiles = this.files().filter((f) => {
      const base = f.split("/").pop() ?? f
      return base === ".env" || base.startsWith(".env.")
    })
    for (const rel of envFiles) {
      let text: string
      try {
        text = await Bun.file(join(this.root, rel)).text()
      } catch {
        continue
      }
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (m?.[1] !== undefined && m[2] !== undefined) {
          // Length caps bound regex work on attacker-controlled values (ReDoS):
          // legitimate service-URL matching never needs more than this.
          keys.push(m[1].slice(0, 256))
          values.push(m[2].replace(/^["']|["']\s*$/g, "").slice(0, 1024))
        }
      }
    }
    this.envCache = { keys, values }
    return this.envCache
  }

  async envKeyMatches(pattern: string): Promise<boolean> {
    const re = new RegExp(pattern)
    return (await this.env()).keys.some((k) => re.test(k))
  }

  async envValueMatches(pattern: string): Promise<boolean> {
    const re = new RegExp(pattern)
    return (await this.env()).values.some((v) => re.test(v))
  }

  async contentMatches(file: string, pattern: string): Promise<boolean> {
    if (!this.contentCache.has(file)) {
      const glob = /[*?[\]{}]/.test(file) ? new Bun.Glob(file) : undefined
      const candidates = this.files().filter((f) => (glob ? glob.match(f) : f === file))
      const texts: string[] = []
      for (const rel of candidates) {
        try {
          texts.push(await Bun.file(join(this.root, rel)).text())
        } catch {
          // unreadable — skip
        }
      }
      // Joined with \n so a pattern can never straddle two files.
      this.contentCache.set(file, texts.length ? texts.join("\n") : null)
    }
    const text = this.contentCache.get(file)
    return text != null && new RegExp(pattern, "m").test(text)
  }
}
