# itaca

> Every project is an Ithaca. Come home in seconds.

**A local-first registry of every project on your machine, exposed to your coding agents via MCP.**

Your agent starts a session already knowing what each project is, what stack and
services it uses, how to run it, and where you left off — across all your repos,
not just the current one. No cloud, no accounts, no telemetry.

**Status: pre-alpha.** The full design lives in [SPEC.md](./SPEC.md).

```sh
# soon
npx itaca scan
```

## Why

Switching projects costs you 10–15 minutes of agent context rebuilding, every time.
The information already exists — scattered across package.json, config files and
your own head. itaca aggregates it per-machine and serves it to any MCP client
in a briefing capped at ~600 tokens. Fresh by construction, small by principle.

## License

[MIT](./LICENSE)
