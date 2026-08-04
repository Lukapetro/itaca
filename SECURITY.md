# Security Policy

itaca is local-first by design: it reads your repos (including `.env*` files, for
pattern matching only), stores derived facts on your machine, and makes no network
calls except opening links you ask it to open. Env values must never appear in any
output, file, or error message — violations of this invariant are security bugs.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting
([Security → Report a vulnerability](https://github.com/Lukapetro/itaca/security/advisories/new))
rather than a public issue. You'll get a response within a few days.

## Supported versions

Pre-1.0: only the latest published version receives fixes.
