# BragBit

> **Your promotion evidence, on your own Postgres.**

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![CI](https://github.com/hamed-farag/bragbit/actions/workflows/ci.yml/badge.svg)](https://github.com/hamed-farag/bragbit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hamed-farag/bragbit)](https://github.com/hamed-farag/bragbit/releases)

BragBit is an open-source (AGPL-3.0), self-hostable, white-label **brag-document tracker** for
developers. Log your wins all year (a "brag" takes under 30 seconds), organize them into documents
(one per review cycle), see them as a month-grouped timeline, and share a read-only link with your
manager before review time.

> **Early release (`0.x`).** The self-host path — a one-command Docker stack with automatic
> migrations and complete docs — is ready. Tracking the current release, `v0.2.0`; multi-tenant
> hosting (v1.1) is developed on the `phase-10/hosted-multitenant` branch. See [PLAN.md](PLAN.md).

## Why

Career evidence — promotion cases, praise, salary arguments — is sensitive. BragBit runs on
infrastructure you trust: no entry caps, no vendor that might fold, and Markdown / JSON export so you
can always leave.

## Highlights

- **Sub-30-second capture** — a title is all you need; press <kbd>N</kbd> to log from anywhere, or
  start from an action-verb template to beat the blank page.
- **A month-grouped timeline** with categories, tags, full-text search, and filtering.
- **Multiple documents** per user, each with its own revocable, optionally password-protected
  **share link** — private brags never leak into a share.
- **Attachments of any type** (screenshots, PDFs, praise emails) and labeled links.
- **Import from GitHub & Linear** — connect an account (one-click OAuth or a pasted read-only token /
  API key) and turn merged pull requests and completed issues into reviewable brags, each linked back
  to the source; nothing logs until you approve.
- **Markdown / PDF / JSON export** — your data is always portable.
- **Per-workspace white-labeling** (name, logo, accent) and **weekly email reminders**.
- **A dashboard activity heatmap** — a year of your logging cadence at a glance, with a week streak.
- **Accessible & keyboard-navigable** — skip-to-content link, focus-visible rings, and WCAG AA contrast.
- **Light & dark themes** — a designed warm dark mode (not a mechanical invert), following your OS by default.
- **Self-host with one `docker compose up`** — Postgres-backed, migrations run on start.

A static preview of the interface (the "engineering logbook" design language) is in
[`design-mockup.html`](design-mockup.html).

## Deployment modes

| Mode           | Who runs it               | Accounts                   | Ships |
| -------------- | ------------------------- | -------------------------- | ----- |
| `private-org`  | a company self-hosting    | setup wizard + invitations | v1    |
| `private-solo` | a freelancer self-hosting | setup wizard               | v1    |

See [Instance modes](docs/instance-modes.md) for the tenancy model.

## Quick start (self-host)

With Docker and the Compose plugin installed:

```bash
git clone https://github.com/hamed-farag/bragbit.git
cd bragbit
cp .env.example .env
# edit .env — at minimum: INSTANCE_MODE, APP_URL, BETTER_AUTH_SECRET, and the SMTP_* block
docker compose up -d
```

Open `http://localhost:3000` — on first run you'll land on the `/setup` wizard to create the owner
account and your workspace. Migrations run automatically on container start. Full guides (Docker
Compose, the Dokploy reference, Vercel/Neon, backup & upgrades) are in
[`docs/self-hosting/`](docs/self-hosting/).

## Try it locally

```bash
pnpm install
cp .env.example .env
pnpm dev:up          # Postgres + Mailpit + MinIO (docker-compose.dev.yml)
pnpm db:migrate
pnpm seed:demo       # optional — a sample workspace + a populated "2026" document
pnpm dev             # http://localhost:3000
```

With the demo seed, sign in as `demo@bragbit.local` / `demobragbit`. See the
[User guide](docs/user-guide.md) and [Contributing](CONTRIBUTING.md).

## Tech

Next.js 16 (App Router) · TypeScript · PostgreSQL · Drizzle ORM · Better Auth · Tailwind v4 +
shadcn/ui · Zod. The architecture and the data-access security model are in
[`docs/architecture.md`](docs/architecture.md).

## Documentation

- [Self-hosting](docs/self-hosting/) — Docker Compose, Dokploy, Vercel/Neon, backup & upgrades
- [Configuration](docs/configuration.md) — every environment variable
- [Instance modes](docs/instance-modes.md) — `private-org` vs `private-solo`
- [User guide](docs/user-guide.md) · [Admin guide](docs/admin-guide.md)
- [Architecture](docs/architecture.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This project follows
[Conventional Commits](https://www.conventionalcommits.org/) and
[Keep a Changelog](https://keepachangelog.com/). By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md). For security issues, see [SECURITY.md](SECURITY.md).

## Team

- **AFKGNT** — a core contributor to bragbit, working on feature development, code review, and documentation improvements across the project.

## License

[AGPL-3.0](LICENSE) — network copyleft keeps hosted forks open-source.
