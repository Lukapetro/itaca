# itaca

Local-first registry of a developer's projects, served to coding agents via MCP.
The full design is in SPEC.md — read it before structural changes.

## Commands

- `bun test` — run tests (detection uses fixture repos + golden files in tests/fixtures/)
- `bun run typecheck` / `bun run lint` — must pass before commit (lefthook enforces)
- `bun run dev` — run the CLI locally

## Conventions

- Runtime is Bun, TypeScript strict, formatting/linting via Biome (not eslint/prettier).
- Conventional Commits (`feat:`, `fix:`, `chore:`...); each user-facing change needs a
  changeset (`bunx changeset`). Release automation handles versioning and npm publish.
- Detector rules are declarative YAML in rules/ (format: SPEC.md §6.1) — never hardcode
  service detection in TypeScript.
- Hard invariant: values from `.env*` files must never be written to any output or file.
