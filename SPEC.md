# itaca — Specification v0.1

> **itaca** (npm: `itaca`) — from Ithaca, the island Ulysses spent twenty years returning to.
> Tagline: *"Every project is an Ithaca. Come home in seconds."*
> Status: draft for review · Author: Luca Petrolati · Last updated: 2026-08-04

## 1. One-liner

**A local-first registry of every project on your machine, exposed to your coding agents via MCP.**

Your agent starts a session already knowing what each project is, what stack and services it uses, how to run it, and where you left off — across all repos, not just the cwd.

Brand voice uses the homecoming metaphor (the README, the site, the logbook). The CLI and MCP vocabulary stay **literal** — `projects`, `status`, `context` — because agents and skimmers parse plain terms better than nautical ones.

## 2. Problem

Developers juggling many projects lose 10–15 minutes per context switch rebuilding agent context ("what is this project, what stack, where was I"). The information exists — scattered across `package.json`, config files, `.env`, docs, and the developer's head — but no tool aggregates it per-machine and serves it to agents.

Prior attempts solved the wrong slice: human-facing dashboards for side projects (ProjectShelf, AnyPanel, your-project-dashboard) repeatedly failed because a dashboard is consulted rarely and requires manual upkeep. The demand signal that is alive in 2026 is **agent context loss**, not dashboard fatigue.

## 3. Positioning

| | They do | We do |
|---|---|---|
| Mem0, claude-mem, Recallium | Cross-session *memory* (conversational) | Cross-**project** *inventory* (structural) |
| agent-kit, ClaudeForge | Generate/sync context *files* | Serve context *live*, keep files ≤20 lines |
| Continuous-Claude, handoff tools | Session continuity in one repo | Continuity across **all** repos |
| Repomix, GitMCP, DeepWiki | Deep context on **one** repo | Shallow-but-complete context on **every** repo |
| Backstage, Port, Cortex | Team/cloud service catalogs | Single dev, single machine, no cloud |
| Glance, Homarr, homepage | Human dashboards for feeds/homelab | Agent registry first; human dashboard is a view (M3) |

**Anti-positioning (things we say we are NOT):**
- Not a CLAUDE.md/AGENTS.md generator. Auto-generated context files measurably hurt agent performance (ETH Zurich 2026: −3% success, +20% cost). We emit one ≤20-line block and serve the rest on demand.
- Not a memory system. We store facts about projects, not conversation history.
- Not a cloud product. No accounts, no telemetry, no network calls except `open`-ing links the user asked for.

## 4. Personas

1. **The agent (primary).** Claude Code, Cursor, Codex, or any MCP client. Consumes the registry via MCP tools and the `--json` CLI. Success = fewer exploration tool-calls at session start, correct commands on first try.
2. **The developer (secondary).** Solo dev / indie hacker with 5–30 repos under one or more root folders. Runs `scan` once, `open` daily, reads the dashboard occasionally (M3).

## 5. Core concepts

- **Project**: a directory detected as a codebase (git repo or manifest-bearing folder) under a configured root.
- **Registry**: the machine-wide index of projects. Derived data — always rebuildable by `scan`. Lives in `$XDG_DATA_HOME/itaca/registry.json`.
- **Manifest** (`itaca.yml` at repo root): the only durable, human/agent-edited state. Narrative status, custom links, overrides. Committed to git.
- **Detector**: a declarative rule that maps evidence in a repo (files, dependencies, env patterns) to a detected service/stack entry with links and commands.

### 5.1 Three data layers

| Layer | Examples | Freshness mechanism | Storage |
|---|---|---|---|
| Derived | stack, services, commands, repo links | Recomputed on every `scan` — stale by at most one scan | registry.json (cache) |
| Narrative | phase, "next up", decision notes | Written by agent (SessionEnd) or human (`status set`) | itaca.yml (git) |
| Live (M4) | deploy status, MRR, error counts | Service APIs, user's local keys | never stored |

## 6. Detection engine

### 6.1 Rule format

Rules are YAML, one file per service, in two locations (later wins):
1. Built-in: shipped with the package (`rules/*.yml`)
2. User: `$XDG_CONFIG_HOME/itaca/rules/*.yml`

```yaml
# rules/neon.yml
id: neon
service: Neon
category: database
match:
  any:
    - env_value: "\\.neon\\.tech"          # regex over values in .env*, not committed files only
    - dep: "@neondatabase/serverless"      # package.json dependencies (any group)
    - dep: "@neondatabase/api-client"
links:
  - title: Neon Console
    url: "https://console.neon.tech"
notes: "Postgres. Connection string in DATABASE_URL."
```

Match primitives (v1): `file` (glob exists), `dep` (JS package dep), `env_key` (regex on key names), `env_value` (regex on values), `content` (regex within a named file, e.g. `wrangler.toml`), combinators `any` / `all`.

### 6.2 Built-in detectors (v1 set)

Chosen to cover the author's real repos (dogfood-first): **Neon, Convex, Cloudflare (wrangler), Stripe, Polar, Vercel, Supabase, GitHub (remote parsing → repo/PRs/actions links), Expo/EAS, PostHog, Sentry**. Plus stack detection: runtime (node/bun/deno), framework (next/astro/expo/godot…), package manager (from lockfile).

### 6.3 Commands extraction

From `package.json` scripts (and `Makefile`/`justfile` targets in v1.1), filtered to a curated allowlist order (`dev`, `build`, `test`, `lint`, …) with the rest available under `--all`.

### 6.4 Monorepos

A root with `workspaces`/`pnpm-workspace.yaml`/`turbo.json` is **one project** with sub-packages listed. No recursion into workspace members as separate projects (v1). Nested unrelated git repos are separate projects.

### 6.5 Env file handling

`.env*` files are read **locally only** for pattern matching. Values are never written to the registry, never echoed in output, never sent anywhere. Only the derived fact ("uses Neon") is stored. This is a hard privacy invariant, tested in CI.

## 7. CLI surface

```
itaca scan   [--root <dir>]...      # detect projects, rebuild registry (idempotent)
itaca list                          # table: name · stack · services · status.phase · last activity
itaca show   <project>              # full card for one project
itaca context [--cwd <dir>]         # the agent briefing (see 9.1); ≤40 lines guaranteed
itaca open   <project> [<link>]     # open dashboard link(s) in browser; no arg = pick list
itaca status set <project> [--phase X] [--next Y] [--note Z]
itaca init                          # write itaca.yml with inferred values (2 questions max)
itaca rules  list|validate          # detector management
itaca agent  install [--target claude-code]   # install skill + hooks + MCP registration + AGENTS.md block
itaca mcp                           # run MCP server on stdio
itaca serve  [--port 5111]          # local dashboard (M3)
```

### 7.1 Global contract (every command)

- `--json` → machine output on stdout; logs on stderr. Consistent field names; ISO 8601 timestamps.
- Exit codes: `0` ok · `1` failure · `2` usage · `3` not found · `4` permission · `5` conflict. Documented in `--help`.
- `--no-input` honored; never prompt when stdin is not a TTY.
- `NO_COLOR` / `FORCE_COLOR` / non-TTY → plain output.
- Errors: human message + machine `code` + suggested fix. Typos get "did you mean".
- Help: examples first, flags second.

### 7.2 Time-to-first-wow (tracked requirement)

`npx itaca scan` in a projects folder → correct table of projects with stacks, **zero config, under 60 seconds** including npx install. This is the demo, the README GIF, and the acceptance test of M1.

## 8. Data model

### 8.1 `itaca.yml` (per repo, committed)

```yaml
version: 1
name: stockroom            # optional; defaults to directory name
description: Inventory SaaS for restaurants
status:
  phase: "beta — 12 pilot users"
  next: "ship supplier import; fix onboarding drop-off"
  updated: 2026-08-04
  log:                      # append-only, newest first, agent-written; cap 20 entries
    - { date: 2026-08-04, note: "Fixed Stripe webhook retries; deployed 1.4.2" }
links:                      # manual additions; merged with detected links
  - { title: "Pilot feedback board", url: "https://..." }
overrides:
  disable: [sentry]         # suppress a false-positive detector
```

Schema published as JSON Schema; `itaca.yml` gets a `# yaml-language-server: $schema=` header from `init` → editor autocomplete for free.

### 8.2 `registry.json` (derived cache, XDG data dir, never committed, rebuildable)

```json
{
  "version": 1,
  "scannedAt": "2026-08-04T10:30:00Z",
  "roots": ["/home/spit/dev"],
  "projects": [{
    "name": "stockroom",
    "path": "/home/spit/dev/stockroom",
    "stack": { "runtime": "bun", "framework": "next", "language": "typescript" },
    "services": [{ "id": "neon", "service": "Neon", "category": "database", "links": [...] }],
    "commands": [{ "name": "dev", "run": "bun run dev" }],
    "git": { "branch": "main", "lastCommitAt": "2026-08-03T17:13:00Z", "dirty": true,
             "remote": "github.com/Lukapetro/stockroom" },
    "manifest": { "...contents of itaca.yml if present..." }
  }]
}
```

## 9. Agent integration

### 9.1 The briefing (`itaca context`)

The core primitive. Given a cwd, returns (text or `--json`):
1. This project's card: description, stack, services, key commands, status.phase, status.next, last 3 log entries.
2. One line of cross-project awareness: "Other active projects: tomodachi (phase…), everdeep (phase…)".

**Hard cap ≤40 lines / ~600 tokens.** Anti-bloat is the product's core promise; the cap is tested in CI, and truncation prefers narrative > services > commands.

### 9.2 MCP server (`itaca mcp`, stdio)

Exactly **three tools** in v1 (small surface, token-bounded outputs — the Playwright/Sentry lesson):

| Tool | Input | Output |
|---|---|---|
| `projects_list` | `{}` | compact table of all projects (name, stack, phase, last activity) — ≤1 line per project |
| `project_get` | `{ name }` | the full briefing (9.1) for that project |
| `project_status_update` | `{ name, phase?, next?, note? }` | writes narrative into that repo's `itaca.yml`; appends to log |

Distribution: registered in the official MCP registry + Glama/PulseMCP. Local stdio only; no remote endpoint in v1.

### 9.3 Skill (SKILL.md, open Agent Skills spec)

Teaches the agent: at session start call `project_get` (or `itaca context`) instead of exploring; before ending a work session, call `project_status_update` with a 1–2 line summary of what changed and what's next; how to add manual links; never paste env values into the manifest. Portable across the 32 tools that read the spec.

### 9.4 Hooks (Claude Code)

Installed by `itaca agent install`:
- **SessionStart**: runs `itaca context --cwd .` and injects the briefing. This is the 10×/day touchpoint.
- **SessionEnd/Stop**: reminds/instructs the agent to call `project_status_update` if meaningful work happened (no-op on trivial sessions).

Concurrency: manifest writes are atomic (write-temp + rename); last-writer-wins with log append preserved (append is a merge, not overwrite).

### 9.5 AGENTS.md block

`itaca agent install` inserts a marked block, **≤20 lines**, into AGENTS.md (creating it if absent; CLAUDE.md via `@AGENTS.md` import or symlink):

```markdown
<!-- itaca:begin -->
## Project registry
This machine runs itaca. For project context, run `itaca context` (or MCP tool
`project_get`) instead of exploring. Update status at session end via
`project_status_update`. Full command list: `itaca --help`.
<!-- itaca:end -->
```

Idempotent: re-running replaces the block in place, touches nothing else.

## 10. Dashboard (`itaca serve`) — M3, deliberately deferred

- Port 5111, bind 127.0.0.1, auto-increment on conflict, Vite-style boxed URL output, `--open` flag.
- Static assets embedded; renders registry.json: overview grid + per-project page (links grouped by category, commands, status timeline from the log).
- Hot-reload on registry/manifest change; config errors as in-page overlay.
- Purpose: (a) human overview at context-switch time; (b) the screenshot that markets the tool on r/SideProject and HN.

## 11. Non-goals (v1)

- No cloud, accounts, sync, or telemetry of any kind.
- No live service API polling (deploy status, MRR) — M4 at the earliest, opt-in, keys stay local.
- No CLAUDE.md/AGENTS.md content generation beyond the 20-line block.
- No project scaffolding/provisioning (that's Stripe Projects' lane).
- No team features, no multi-machine.
- No plugin runtime for detectors (declarative YAML only — a rules PR is the contribution model).

## 12. Tech & delivery

- **Runtime**: TypeScript on Bun. Distributed via npm: `npx itaca` / `bunx itaca` works day 1 (MCP SDK, contributor pool, and the audience are all TS-centric). Single compiled binary re-evaluated post-M2 if cold-start or non-JS users demand it.
- **License**: MIT. **Repo**: single canonical repo forever (never reset stars). README is the landing page: VHS-scripted GIF above the fold (regenerated in CI), one-line install, mechanism-first tagline.
- **Tests**: fixture repos (modeled on the author's 8 real projects) with golden-file detection outputs; privacy invariant test (no env values in any output); briefing size cap test.
- **Docs**: README-first; Starlight site + llms.txt only when the surface stabilizes (post-M2).

### Milestones

| | Scope | Acceptance |
|---|---|---|
| **M1** | `scan`, `list`, `show`, `open`, `context`, `status set`, `init`, rules engine + 11 detectors, `--json` everywhere | TTFW test passes on author's `~/dev`; detection correct on all 8 repos |
| **M2** | `mcp`, SKILL.md, hooks, `agent install`, AGENTS.md block; listings (MCP registries, awesome-claude-code, plugin marketplace) | A fresh Claude Code session answers "where was I on tomodachi?" correctly with zero exploration |
| **M3** | `serve` dashboard | Screenshot-worthy; hot-reload works |
| **M4** | Live widgets (opt-in), `Makefile`/`justfile` commands, more detectors from community | — |

**Gate between M2 and launch**: author dogfoods M1+M2 for ≥3 weeks. If the SessionEnd narrative loop doesn't survive personal use (staleness test), rethink before marketing.

## 13. Resolved decisions (v0.1 review, 2026-08-04)

1. **Name: `itaca`**, published on npm as **`@itacajs/cli`** (org `itacajs`, reserved 2026-08-04 with a placeholder publish). The unscoped name `itaca` is blocked by npm's typosquat filter ("too similar to `mitata`") — discovered only at publish time; the org gives future room (`@itacajs/mcp`, `@itacajs/rules`). The installed binary is still `itaca`; brand stays "itaca" everywhere. The metaphor is the product: the tool makes returning to a project instant.
2. **Multiple roots**: `itaca scan <dir>` registers that root persistently in `$XDG_CONFIG_HOME/itaca/config.yml`; bare `itaca scan` rescans all known roots. Flags never persist anything else.
3. **`project_status_update` on a repo without `itaca.yml`**: creates a minimal manifest (`version` + `status` only). Zero-friction for the agent loop.
4. **Windows**: deferred to M3 (Bun works on Windows; hooks/paths need dedicated testing — don't block M1/M2 on it).
5. **`context` outside a registered project**: runs detection ad-hoc on the cwd, returns a briefing, persists nothing, and hints `itaca scan` once.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Platform absorption (Claude Code ships native multi-project context) | Small scope, fast to value; the durable asset is the *convention* (`itaca.yml`, rules format) and the cross-tool skill, not any one integration |
| Detector treadmill / stale rules kill the freshness promise | Declarative rules = 10-line community PRs; v1 detectors limited to services the author uses daily (self-healing dogfood); rules ship in-package so `npx` always gets latest |
| Pain-tool mismatch (revealed preference: people don't adopt project organizers) | The wedge is the SessionStart briefing (passive, 10×/day), not the dashboard (active, rare); gate at M2 dogfood before any launch effort |
| Narrative rot (agents write junk status) | Log is append-only and capped; skill prescribes 1–2 line entries; `status.updated` shown everywhere so staleness is visible, not silent |
