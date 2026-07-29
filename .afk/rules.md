<!-- bragbit → .afk/rules.md -->
<!-- Copy this to `.afk/rules.md` in hamed-farag/bragbit. Advisory only — fed to
     the model, enforces nothing. Anything that MUST hold belongs in config.yml,
     where code checks it. See PLAN.md §5. -->

# AFK rules for bragbit

Read **`AGENTS.md`** and **`CLAUDE.md`** in the repo root first — they hold this
project's conventions. Follow them. This file only adds what those don't cover.

## Verification available under v0

The only checks that run without secrets are:

- `pnpm test` (plain vitest)
- `pnpm lint`
- `pnpm typecheck`

`test:db` and the Playwright e2e suite need a seeded database, `DATABASE_URL`, and
`BETTER_AUTH_SECRET`. Those are **off-limits** in v0 — do not attempt to run them or
write changes whose correctness can only be shown by them. If a task genuinely needs
that kind of verification, abstain and say so.

## Scope

- Prefer the smallest change that satisfies the request. Bias toward abstaining over
  guessing — every weak PR is a review chore.
- Do not edit generated files, lockfiles, or anything under `marketing/`.
