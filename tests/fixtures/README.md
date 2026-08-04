# Detection fixtures

Each directory here is a miniature fake repo (a few config files, no real code)
representing a stack we must detect correctly. Golden expected outputs live
next to each fixture as `expected.json`.

The fixture set is modeled on real-world repos (Next+Neon+Stripe, Convex+Polar,
Cloudflare Workers, Expo, Godot+Bun monorepo...) so the detection engine is
tested against reality, not against its own assumptions.

Run: `bun test`
