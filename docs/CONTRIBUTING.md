# Contributing to bragbit

Looking to contribute? Start here, then head to the full guides in the repo root
for everything else:

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — the canonical guide: local setup,
  branching and PR workflow, commit message conventions, and coverage expectations.
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — the standard of behavior we expect
  from everyone taking part in issues, pull requests, and discussions.

## Getting up and running

Install dependencies and run the unit tests with:

```bash
pnpm install   # Node 22+ and pnpm 10+ (via Corepack) are required
pnpm test      # runs the Vitest unit suite; DB-backed suites skip automatically
```

That's enough to start hacking on most changes. For anything beyond that — the
Docker-based dev stack, database migrations and seeding, the rest of the `pnpm`
scripts (`lint`, `typecheck`, `test:db`, `test:e2e`, …), and how we expect PRs and
commits to be structured — see the root [`CONTRIBUTING.md`](../CONTRIBUTING.md).
