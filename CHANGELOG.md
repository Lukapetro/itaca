# @itacajs/cli

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
