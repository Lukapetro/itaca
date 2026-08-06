---
"@itacajs/cli": minor
---

Ask for a status update when the repo moved past it (SPEC §9.4, Stop hook).

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
