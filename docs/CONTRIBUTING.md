# Contributing

BragBit's full contributing guide lives in the repo root: **[CONTRIBUTING.md](../CONTRIBUTING.md)**.
This page is a short pointer + summary for anyone browsing `/docs`. By participating you also agree
to the **[Code of Conduct](../CODE_OF_CONDUCT.md)**.

## Quick start

```bash
pnpm install       # install dependencies (Node 22+, pnpm 10+ via Corepack)
cp .env.example .env
pnpm test          # run the unit test suite (Vitest; DB-gated suites skip)
```

See the root [CONTRIBUTING.md](../CONTRIBUTING.md) for the full local-dev setup (Docker services,
migrations, seeding), the complete list of scripts (`pnpm lint`, `pnpm typecheck`, `pnpm test:db`,
`pnpm test:e2e`, …), and the coverage gate.

## Branching & pull requests

- Branch off `main` with a prefix that matches the change: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Keep pull requests small and focused on one change; fill in the PR template checklist.
- Update `CHANGELOG.md` under `[Unreleased]` and any relevant docs for user-facing changes.
- Before opening/marking a PR ready, make sure `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and the PR
  title (e.g. `fix(share): 404 revoked share tokens`) — this is enforced by commitlint.
- Be responsive to review feedback and prefer a short back-and-forth over a large single revision.

For the manual/QA test plan referenced from PRs touching user-facing behavior, see
[testing.md](testing.md).
