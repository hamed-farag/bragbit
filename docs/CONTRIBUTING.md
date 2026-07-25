# Contributing

This page is a short pointer for contributors browsing `/docs`. The full guide lives
in the repo root:

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — local setup, branch/PR workflow, commit
  conventions, and coverage requirements.
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — expected behavior for everyone
  participating in the project (issues, PRs, discussions).

## Quick start

```bash
pnpm install   # install dependencies (Node 22+, pnpm 10+ via Corepack)
pnpm test      # run the unit test suite (Vitest); DB-gated suites skip automatically
```

See the root [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full development setup
(Docker dev stack, migrations, seeding), the complete list of `pnpm` scripts
(`lint`, `typecheck`, `test:db`, `test:e2e`, …), and the PR/commit conventions.
