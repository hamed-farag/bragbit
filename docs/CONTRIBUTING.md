# Contributing

Thanks for considering a contribution to BragBit! This is a quick, practical guide to
getting set up and sending a pull request. For the full contributor guide (local dev
stack, coverage gate, commit conventions, etc.) see [`CONTRIBUTING.md`](../CONTRIBUTING.md)
in the repo root.

## Install dependencies

BragBit uses [pnpm](https://pnpm.io/) as its package manager (managed via Corepack).

```bash
corepack enable   # once, if pnpm isn't already on your PATH
pnpm install
```

## Run the test suite

```bash
pnpm test
```

This runs the Vitest unit/integration suite. Tests that require a seeded database are
skipped automatically unless you've started the local dev stack (`pnpm dev:up`) and run
`pnpm test:db` instead. Also useful while developing:

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript
```

Make sure `pnpm test`, `pnpm lint`, and `pnpm typecheck` all pass before opening a PR.

## Open a pull request

1. Branch off `main` using a descriptive prefix, e.g. `feat/…`, `fix/…`, `docs/…`.
2. Keep the change focused and, where relevant, update `CHANGELOG.md` under
   `[Unreleased]` and any affected docs.
3. Write commit messages following [Conventional Commits](https://www.conventionalcommits.org/)
   (e.g. `fix(share): 404 revoked share tokens`).
4. Push your branch and open a pull request against `main`, filling in the PR template
   checklist.
5. Ensure CI is green — lint, typecheck, and tests must pass before review.

By contributing, you agree to abide by the [Code of Conduct](../CODE_OF_CONDUCT.md).
