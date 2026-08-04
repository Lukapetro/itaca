---
"@itacajs/cli": patch
---

Security and correctness fixes from the M1 code review: deep rule validation
(an invalid regex is now rejected by `rules validate` and can never crash a
scan), git credentials stripped from remote URLs before they reach the
registry, ReDoS bounds on env matching, the briefing line cap now counts
physical lines, the published bin actually runs the CLI, `open` validates
URLs and shows a pick list by default, atomic registry/manifest writes,
innermost-project resolution, root validation on `scan`, and exit codes 4/5.
