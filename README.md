# itaca

> Every project is an Ithaca. Come home in seconds.

**A local-first registry of every project on your machine, exposed to your coding agents via MCP.**

Your agent starts a session already knowing what each project is, what stack and
services it uses, how to run it, and where you left off — across all your repos,
not just the current one. No cloud, no accounts, no telemetry.

**Status: alpha.** The full design lives in [SPEC.md](./SPEC.md).

```sh
bunx @itacajs/cli scan ~/dev    # detect every project and its services
bunx @itacajs/cli list          # what's on this machine
bunx @itacajs/cli context       # "where was I?" — run inside a project
bunx @itacajs/cli open <name>   # open its dashboards in the browser
```

Detection is declarative: each service is a small YAML rule in [rules/](./rules)
(Neon, Convex, Cloudflare, Stripe, Polar, Vercel, Supabase, Expo, PostHog,
Sentry, GitHub). Adding one is a 10-line PR.

## Why

Switching projects costs you 10–15 minutes of agent context rebuilding, every time.
The information already exists — scattered across package.json, config files and
your own head. itaca aggregates it per-machine and serves it to any MCP client
in a briefing capped at ~600 tokens. Fresh by construction, small by principle.

## License

[MIT](./LICENSE)
