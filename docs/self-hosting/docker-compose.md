# Self-hosting with Docker Compose

The bundled [`docker-compose.yml`](../../docker-compose.yml) runs BragBit and Postgres together.
Pending migrations are applied automatically on container start, so a fresh deployment provisions its
own schema.

## Quick start

```bash
git clone https://github.com/hamed-farag/bragbit.git
cd bragbit
cp .env.example .env
# edit .env — at minimum: INSTANCE_MODE, APP_URL, BETTER_AUTH_SECRET, and the SMTP_* block
docker compose up -d
```

The app comes up on `http://localhost:${APP_PORT:-3000}`. On first run it redirects to the `/setup`
wizard — create the owner account and your workspace, and you're in.

> Generate the auth secret with `openssl rand -base64 32`, and set `APP_URL` to the public origin
> you'll serve from — it's baked into emails and share links.

## What you set, what's wired for you

Compose injects the database connection (`DATABASE_URL` → the bundled `postgres` service) and the
local-storage path (`STORAGE_DIR` → a named volume) for you, so your `.env` only needs the instance
shape, `APP_URL`, the auth secret, and SMTP. Two Compose-level knobs:

- `POSTGRES_PASSWORD` (default `bragbit`) — set a real password for any non-local instance.
- `APP_PORT` (default `3000`) — the host port mapped to the app.

See [Configuration](../configuration.md) for every variable.

## Storage: local disk vs S3

By default, attachments are stored on local disk in the `bragbit_uploads` Docker volume. To use
S3-compatible storage instead — AWS S3, Cloudflare R2, or the bundled MinIO — set `STORAGE_DRIVER=s3`
and the `S3_*` block in `.env`, then start the optional MinIO service:

```bash
docker compose --profile minio up -d
```

Inside Compose, point `S3_ENDPOINT` at `http://minio:9000` (MinIO needs `S3_FORCE_PATH_STYLE=true`).

## TLS

The app serves plain HTTP on its port; terminate TLS in front of it. The [Dokploy guide](dokploy.md)
does this automatically. Otherwise put nginx, Caddy, or Traefik in front and proxy to the app port —
BragBit already sends HSTS and the other security headers (see
[the architecture doc](../architecture.md)).

## Operations

- **Health:** `curl http://localhost:${APP_PORT:-3000}/api/health` → `{"status":"ok"}` (HTTP 200)
  when the app and Postgres are reachable, `503` if the database is down. The Compose `app`
  healthcheck uses this; point any external uptime monitor or reverse-proxy health probe at it too.
- **Logs:** `docker compose logs -f app`
- **Restart:** `docker compose restart app`
- **Stop / start:** `docker compose down` / `docker compose up -d`. Your data lives in the
  `bragbit_pgdata` and `bragbit_uploads` volumes and survives `down` (without `-v`).
- **Updates and backups:** see [Backup, restore & upgrades](backup-and-upgrades.md).

## Trying it with sample data

To explore a populated instance before committing real data, the repo ships a demo seed
(`pnpm seed:demo`) that creates a sample workspace, an owner, and a "2026" document. It's a local
development convenience — the slim production image deliberately omits its dev dependencies
(`dotenv`, `better-auth/crypto`), so it can't run via `docker compose exec`; run it from a local
checkout with `DATABASE_URL` pointed at the instance's database — see the
[User guide](../user-guide.md#trying-the-demo). On a self-hosted instance you'll normally start
empty and create your own workspace through the setup wizard.
