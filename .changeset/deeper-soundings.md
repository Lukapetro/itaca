---
"@itacajs/cli": minor
---

Detection quality: non-glob file/content patterns now match inside monorepo
workspace members (a nested wrangler.toml or vercel.json is no longer
invisible), workspace globs resolve to actual member names, turbo.json
implies a monorepo, symlinked project directories are discovered, and six
new detectors land (Clerk, Resend, Upstash, Turso, Drizzle, Better Auth —
16 total). Plus: the itaca.yml JSON Schema referenced by `init` now exists
(editor autocomplete works), `--version`/help honor `--json`, and
"did you mean" suggestions use edit distance.
