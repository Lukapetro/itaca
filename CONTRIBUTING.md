# Contributing to itaca

Thanks for landing here. The most valuable contribution, by far, is a
**detector rule** — and it's deliberately a ten-minute PR.

## Contributing a detector rule

Each service itaca can recognize is one YAML file in [rules/](./rules):

```yaml
id: railway            # kebab-case, unique
service: Railway       # display name
category: hosting      # database | hosting | payments | auth | email | analytics | monitoring | mobile | backend | code
match:
  any:                 # any/all combinators, nestable
    - dep: "@railway/cli"          # package.json dependency (any group)
    - file: railway.json           # file exists (matches nested workspace members too)
    - env_key: "^RAILWAY_"         # regex over .env* keys
    - env_value: "\\.railway\\.app"  # regex over .env* values (values are never stored)
    - content: { file: "railway.toml", pattern: "^service" }
links:
  - title: Railway Dashboard
    url: "https://railway.app/dashboard"
```

Checklist for a rule PR:

1. Real evidence only — prefer `dep`/`file` over broad env regexes; a rule that
   fires on unrelated repos is worse than no rule.
2. `bun run dev -- rules validate` passes from your checkout (regexes are
   compiled and checked — this validates *your* rules/, not the published
   package's copy).
3. Add a fixture case if the match logic is non-obvious: a minimal fake repo
   under `tests/fixtures/` plus its `expected.json`.
4. One rule per PR, `feat(rules): add railway` as the title, plus a changeset
   (`bunx changeset`, patch).

## The invariant that outranks everything

Values from `.env*` files must never be written to any output, file, error
message, or registry entry. They exist only inside the `Evidence` class as
booleans. `tests/privacy.test.ts` plants sentinel secrets and fails the build
if they surface anywhere. If your change touches evidence collection, extend
that test, don't work around it.

## Dev setup

```sh
bun install
bun test              # 39 tests, fixture-based golden files
bun run typecheck     # tsc strict
bun run lint          # biome (lefthook runs both on commit)
bun run dev -- scan ~/your/projects
```

- Conventional Commits; every user-facing change needs a changeset.
- `main` only accepts PRs with green CI. Review bots (Greptile) comment on
  PRs — engage with their findings, they have a good track record here.
- Runtime is Bun, formatting is Biome. No eslint/prettier configs, please.

## Everything else

Bug reports and feature discussions are welcome in
[issues](https://github.com/Lukapetro/itaca/issues). Security reports go
through [private vulnerability reporting](./SECURITY.md) instead.
