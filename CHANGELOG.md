# @itacajs/cli

## 0.4.0

### Minor Changes

- 905d624: Ask for a status update when the repo moved past it (SPEC §9.4, Stop hook).

  Session entry was enforced by a hook while session exit was left to the agent
  remembering on its own, so `itaca.yml` drifted behind the repo without anyone
  noticing. Two changes close that:

  - `itaca status set` and `project_status_update` now record `status.commit`, the
    HEAD the status describes. `itaca agent install` adds a **Stop** hook running
    the new `itaca status check`, which asks for an update — listing the commits
    that landed since the anchor — when the two diverge. It stays silent whenever
    it cannot be sure (no anchor, no HEAD, anchor lost to a rebase) and prompts at
    most once per session, so a session with nothing to add is never trapped.
  - The installed skill now asks for **what is blocked** and **what decision is
    still open**, not just what changed. Git records the third; nothing in the
    repo records the first two, and they are what a fresh session cannot recover.

  Existing manifests are unaffected until their next status update writes an
  anchor; `status.commit` is optional in the schema.

- 905d624: Detect Azure DevOps remotes and Electron apps.

  Two misreads found by running itaca over 11 real repos:

  - Repos hosted on Azure Repos had no `code` service at all — only GitHub remotes
    were understood. `codeHostService` now also resolves Azure DevOps remotes (both
    the HTTPS `dev.azure.com/{org}/{project}/_git/{repo}` form and the SSH
    `ssh.dev.azure.com/v3/…` form) to repository, pull request and pipeline links.
  - Electron apps were reported by whichever bundler they happened to use (Vite,
    Next). `electron` now takes precedence in framework detection: the shell is what
    decides how the project runs and ships.

## 0.3.0

### Minor Changes

- 3ccb439: Detection quality: non-glob file/content patterns now match inside monorepo
  workspace members (a nested wrangler.toml or vercel.json is no longer
  invisible), workspace globs resolve to actual member names, turbo.json
  implies a monorepo, symlinked project directories are discovered, and six
  new detectors land (Clerk, Resend, Upstash, Turso, Drizzle, Better Auth —
  16 total). Plus: the itaca.yml JSON Schema referenced by `init` now exists
  (editor autocomplete works), `--version`/help honor `--json`, and
  "did you mean" suggestions use edit distance.

## 0.2.0

### Minor Changes

- cd23267: M2: itaca is agent-native. `itaca mcp` serves the registry over MCP (stdio)
  with exactly three tools — `projects_list`, `project_get`,
  `project_status_update` — and `itaca agent install` wires up Claude Code in
  one command: SKILL.md (Agent Skills open spec), a SessionStart hook that
  preloads the project briefing, user-scope MCP registration, and an
  idempotent ≤20-line AGENTS.md block in the current repo.

## 0.1.1

### Patch Changes

- 4b6c161: Security and correctness fixes from the M1 code review: deep rule validation
  (an invalid regex is now rejected by `rules validate` and can never crash a
  scan), git credentials stripped from remote URLs before they reach the
  registry, ReDoS bounds on env matching, the briefing line cap now counts
  physical lines, the published bin actually runs the CLI, `open` validates
  URLs and shows a pick list by default, atomic registry/manifest writes,
  innermost-project resolution, root validation on `scan`, and exit codes 4/5.

## 0.1.0

### Minor Changes

- 1950295: M1: the registry is real. `scan` discovers every project under your roots and
  detects stack + services via declarative YAML rules (11 built-in detectors).
  `list`, `show`, `context` (the ≤40-line agent briefing), `open`, `status set`,
  `init`, and `rules list|validate` — all with `--json`, semantic exit codes, and
  a hard privacy invariant: values from `.env*` files never leave your machine.

## 0.0.2

### Patch Changes

- 992a8e8: Verify the release pipeline end-to-end: Changesets version PR, OIDC trusted publishing, provenance.
