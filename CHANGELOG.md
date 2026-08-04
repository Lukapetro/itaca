# @itacajs/cli

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
