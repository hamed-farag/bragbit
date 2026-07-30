# Self-hosting BragBit

BragBit is Docker-first. The fastest path is the bundled Docker Compose stack — one command brings
up the app and Postgres, runs migrations, and serves the first-run setup wizard.

## Guides

- **[Docker Compose](docker-compose.md)** — the bundled `app + Postgres` stack (with optional MinIO
  for S3 storage). The recommended self-host path.
- **[Dokploy](dokploy.md)** — the reference deployment: the Compose stack on a private VPS with a
  domain and automatic TLS, managed through Dokploy's UI.
- **[Dokploy for an organization](dokploy-org.md)** — the full ORG-mode (`private-org`) runbook: a
  company self-hosting for its whole team, from provisioning to inviting members, plus SMTP, storage,
  backups, upgrades, and a hardening checklist.
- **[Dokploy for yourself](dokploy-solo.md)** — the SOLO-mode (`private-solo`) runbook: a personal
  single-user instance (a workspace of one), same deploy path minus the invitation/member setup.
- **[Vercel + managed Postgres](vercel.md)** — a serverless variant (Vercel + Neon), with the
  caveats serverless brings (S3 storage, external cron, manual migrations).
- **[Backup, restore & upgrades](backup-and-upgrades.md)** — protecting your data and moving to a
  new version.
- **[Source integrations](integrations.md)** — let members import their GitHub merged PRs and Linear
  completed issues as brags they review (one-click OAuth app, or a pasted read-only token / API key
  that needs no setup).

## Before you start

You'll need:

- A host with Docker and the Docker Compose plugin
  ([install](https://docs.docker.com/engine/install/)).
- A domain and TLS for a public instance — handled for you by Dokploy, or by a reverse proxy you
  run.
- An SMTP relay — BragBit sends verification, invitation, reset, and reminder mail. Any
  transactional-email provider works.

Every setting is an environment variable; the full reference is in
[Configuration](../configuration.md), and the annotated template is
[`.env.example`](../../.env.example). Pick your deployment shape with `INSTANCE_MODE` (see
[Instance modes](../instance-modes.md)).
