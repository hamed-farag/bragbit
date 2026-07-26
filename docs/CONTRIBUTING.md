# Contributing to BragBit

Welcome! This guide covers the essentials for contributing to BragBit.

## Resources

- **Full Contributing Guide**: See the root [`CONTRIBUTING.md`](../CONTRIBUTING.md) for detailed setup instructions, development workflow, testing, and conventional commits.
- **Code of Conduct**: All contributors must abide by the [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md).

## Quick Start

Install dependencies and run the test suite:

```bash
pnpm install     # Install dependencies
pnpm test        # Run unit tests (Vitest)
```

Other common commands:

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start the development server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm build` | Build for production |

## Branching & Pull Request Etiquette

1. **Branch from `main`**: Use descriptive branch prefixes:
   - `feat/` — New features
   - `fix/` — Bug fixes
   - `docs/` — Documentation updates
   - `refactor/` — Code refactoring

2. **Keep PRs focused**: Limit each pull request to a single concern (one feature, fix, or docs update).

3. **Fill out the PR template**: Check all items in the checklist before requesting review.

4. **Ensure checks pass**: Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` locally before pushing.

5. **Update the changelog**: Add an entry under `[Unreleased]` in `CHANGELOG.md` for user-facing changes.

6. **Be responsive to feedback**: Address review comments promptly and kindly.

Thank you for contributing!
