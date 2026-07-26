# Testing

## Install dependencies

```bash
pnpm install
```

## Run the test suite

```bash
pnpm test
```

This runs all unit tests via Vitest. Tests live alongside source files as `*.test.ts` or `*.test.tsx` under `src/`.

## Run a single test file

```bash
pnpm test src/features/brag/actions.test.ts
```

Or use the watch mode for active development:

```bash
pnpm test:watch src/features/brag/actions.test.ts
```

## Other useful commands

| Command | Purpose |
|---------|---------|
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |

> **Note:** `test:db` and `test:e2e` require a seeded database and environment secrets; they are not available in the default sandbox environment.
