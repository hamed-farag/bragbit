# Frequently Asked Questions

## How do I install dependencies?

This project uses pnpm as its package manager. Run:

```bash
pnpm install
```

Requirements: **Node 22+** and **pnpm 10+**. pnpm is managed by Corepack (`corepack enable`); newer Node releases no longer bundle Corepack, so install it first (`npm install -g corepack`) if it isn't on your PATH.

## How do I run the test suite?

Run unit tests with Vitest:

```bash
pnpm test
```

For tests requiring a database, first start the dev services (`pnpm dev:up`), then run `pnpm test:db`. See [CONTRIBUTING.md](../CONTRIBUTING.md) for more details on testing.

## Where can I find the contributing guide?

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root. It covers:

- Local development setup
- Available scripts and commands
- Branch and PR workflow
- Conventional commit guidelines
- Code of conduct
