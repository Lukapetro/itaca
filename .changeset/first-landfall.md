---
"@itacajs/cli": minor
---

M1: the registry is real. `scan` discovers every project under your roots and
detects stack + services via declarative YAML rules (11 built-in detectors).
`list`, `show`, `context` (the ≤40-line agent briefing), `open`, `status set`,
`init`, and `rules list|validate` — all with `--json`, semantic exit codes, and
a hard privacy invariant: values from `.env*` files never leave your machine.
