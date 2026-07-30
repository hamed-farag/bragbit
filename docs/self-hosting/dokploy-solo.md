# Hosting BragBit for yourself (private-solo) on Dokploy

A complete, end-to-end runbook for standing up a **personal, self-hosted BragBit** — a brag document
just for you — on your own VPS using [Dokploy](https://dokploy.com), the open-source deployment
platform that runs your Docker Compose stack behind Traefik with automatic HTTPS.

This guide targets **`INSTANCE_MODE=private-solo`** ("solo mode"): one personal workspace, one user
(you), and no member/invitation machinery. If you're hosting for a whole team instead, use
[`private-org`](dokploy-org.md).

> **Which BragBit is "solo mode"?** `private-solo` is a **single personal workspace** — a workspace of
> one, with the org/member/invite UI hidden entirely. It ships on `main` / the `v0.2.x` releases.
> Deploy from a tagged release (e.g. `v0.2.0`), not a moving branch.

Solo and org share the **same stack and the same deploy path** — the only differences are the
`INSTANCE_MODE` value, that setup creates a **personal** (not organization) workspace, and that there
are no invitations or members. Wherever a step is identical to the org guide, this doc keeps it short
and links across.

---

## Contents

1. [What solo mode gives you](#1-what-solo-mode-gives-you)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [Prerequisites](#3-prerequisites)
4. [Step 1 — Provision the host and install Dokploy](#step-1--provision-the-host-and-install-dokploy)
5. [Step 2 — Point DNS at the server](#step-2--point-dns-at-the-server)
6. [Step 3 — Create the Project and Compose service](#step-3--create-the-project-and-compose-service)
7. [Step 4 — Set the environment variables](#step-4--set-the-environment-variables)
8. [Step 5 — Attach the domain and enable HTTPS](#step-5--attach-the-domain-and-enable-https)
9. [Step 6 — Deploy](#step-6--deploy)
10. [Step 7 — Run the first-run setup wizard](#step-7--run-the-first-run-setup-wizard)
11. [Optional: sign in with Google / GitHub](#optional-sign-in-with-google--github)
12. [Optional: source integrations (GitHub & Linear)](#optional-source-integrations-github--linear)
13. [Storage: local disk vs S3/R2](#storage-local-disk-vs-s3r2)
14. [Operations, backups & upgrades](#operations-backups--upgrades)
15. [Security hardening checklist](#security-hardening-checklist)
16. [Troubleshooting](#troubleshooting)
17. [Appendix — environment variable reference](#appendix--environment-variable-reference)

---

## 1. What solo mode gives you

In `private-solo`, BragBit is a workspace of one:

- The **first visit** opens a one-time `/setup` wizard that creates **your owner account** and a single
  **personal** workspace, signs you in, and then closes for good.
- There is **no member, invitation, or role UI anywhere** — no `/admin/members`, no open sign-up. It's
  just you.
- **Branding still applies.** At `/admin` you can set the workspace name, accent color, and logo —
  handy for the client-facing **share pages** a freelancer sends out.
- Everything beneath the workspace is identical to the org build: documents (one per review cycle),
  brags, the month-grouped timeline, categories/tags/search, share links (optionally
  password-protected), Markdown/PDF/JSON export, the activity heatmap, weekly reminders, and GitHub /
  Linear import.

You are marked **email-verified automatically** at setup (no link to click), and there's nothing to
invite — so the only email BragBit sends for a solo instance is **password reset**, **weekly
reminders**, and **email-change confirmation** (plus a verification email the sign-up attempts during
setup). Configure SMTP so those work.

## 2. Architecture at a glance

Identical to the org build — the bundled [`docker-compose.yml`](../../docker-compose.yml) is one stack,
already Dokploy-shaped (reads `.env`, no `container_name`, persistent named volumes):

| Service          | Image                   | Role                                                                   |
| ---------------- | ----------------------- | ---------------------------------------------------------------------- |
| `app`            | built from `Dockerfile` | Next.js 16 standalone server on port **3000**; runs migrations on boot |
| `postgres`       | `postgres:17-alpine`    | The database; data in the `bragbit_pgdata` volume                      |
| `minio` _(opt.)_ | `minio/minio`           | S3-compatible object storage, only with the `minio` profile            |

- **Migrations run on container start** (`[entrypoint] applying database migrations…` →
  `[migrate] database is up to date` → `[entrypoint] starting BragBit…`).
- **Weekly reminders are in-process** (node-cron) — no external cron. (`CRON_SECRET` is serverless-only.)
- **Health:** `GET /api/health` → `{"status":"ok"}` (200) when app + Postgres are up, `503` if the DB
  is down.
- **TLS is terminated by Traefik**, which Dokploy manages; the app serves plain HTTP on 3000 behind it.

## 3. Prerequisites

| You need                | Details                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A VPS**               | Recent Linux with Docker. 2 GB RAM runs BragBit, but the multi-stage image **build** is memory-hungry — prefer **≥ 4 GB RAM / 2 vCPU** (or add swap).      |
| **Disk**                | Postgres + attachments grow over time. Start with ≥ 20 GB; attachments default to a local volume.                                                          |
| **A domain**            | e.g. `brag.example.com`, with DNS access to add an `A`/`AAAA` record.                                                                                      |
| **An SMTP relay**       | Recommended. Powers password reset, weekly reminders, email-change, and the setup verification send. Any transactional provider (Postmark, SES, Gmail, …). |
| **OAuth apps** _(opt.)_ | Only if you want to sign in with Google/GitHub, or import from GitHub/Linear. See the optional sections.                                                   |

---

## Step 1 — Provision the host and install Dokploy

Spin up the VPS, then install Dokploy per its [installation docs](https://docs.dokploy.com). The
one-line installer brings up the Dokploy UI (default on port `3000`) and installs Traefik. Open it,
create your **Dokploy admin account**, and — recommended — put Dokploy itself on a domain with HTTPS.

> Traefik owns ports **80** and **443** on the host. Don't run anything else on them.

## Step 2 — Point DNS at the server

Add a DNS record **before** you attach the domain in Dokploy:

```
A    brag.example.com    →    <your server's public IP>
```

Verify with `dig +short brag.example.com` (should return your IP). If you add the domain in Dokploy
before DNS resolves, Let's Encrypt can't validate and the certificate won't issue.

## Step 3 — Create the Project and Compose service

In Dokploy: **Create a Project**, then add a service of type **Docker Compose** (not "Application" —
BragBit is a multi-service stack).

1. **Provider:** connect via the **GitHub App** (it wires the auto-deploy webhook), then choose the
   **Repository** and **Branch** (`main`).
2. **Compose Path:** `./docker-compose.yml`.
3. **Trigger Type:** **On Tag** so it deploys only when you push a release tag (e.g. `v0.2.0`) —
   deliberate, release-driven deploys. (Use **On Push** for a staging instance that deploys every
   commit to `main`.)

Leave the compose file as-is; you configure everything through environment variables and the Domains
tab.

## Step 4 — Set the environment variables

Open the service's **Environment** tab. Dokploy writes these to a `.env` file next to the compose file;
BragBit's compose consumes them both ways — `${POSTGRES_PASSWORD}` / `${APP_PORT}` are **interpolated**
into the compose, and the rest reach the app via `env_file: - .env`. You do **not** set `DATABASE_URL`,
`STORAGE_DIR`, or `NODE_ENV` — the compose wires those.

### Minimum for a solo instance

```bash
# ── Instance shape ──────────────────────────────────────────────
INSTANCE_MODE=private-solo
APP_URL=https://brag.example.com          # exact public origin, https

# ── Auth ────────────────────────────────────────────────────────
BETTER_AUTH_SECRET=REPLACE_ME             # openssl rand -base64 32  (≥ 32 chars, or it won't boot)

# ── Bundled Postgres password (compose interpolates this) ───────
POSTGRES_PASSWORD=REPLACE_ME              # openssl rand -hex 32 — hex/URL-safe (goes into DATABASE_URL)

# ── SMTP — password reset, weekly reminders, verification send ──
SMTP_HOST=smtp.your-relay.com
SMTP_PORT=587
SMTP_SECURE=false                         # true for implicit TLS on port 465
SMTP_USER=REPLACE_ME
SMTP_PASSWORD=REPLACE_ME
SMTP_FROM=BragBit <no-reply@example.com>  # must be a sender your relay allows

# ── Recommended while the URL is public but setup isn't done ────
SETUP_TOKEN=REPLACE_ME                    # openssl rand -base64 24; gates the /setup wizard

# ── Host port — Dokploy's own UI occupies host 3000, so remap ──
APP_PORT=3001                             # any free host port; Traefik still serves via your domain
```

Generate the secrets locally:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -hex 32      # POSTGRES_PASSWORD — hex (URL-safe): it's interpolated into DATABASE_URL,
                          # so base64's +/= (and @ : / #) would corrupt the connection string
openssl rand -base64 24   # SETUP_TOKEN
```

Notes:

- **`INSTANCE_MODE=private-solo`** is what makes setup create a **personal** workspace and hides all
  member/invite UI.
- **`APP_URL` must be `https://…` and match the domain exactly** — Better Auth derives the session
  cookie's `Secure` flag from the scheme, so an `http://` value behind Traefik ships cookies without
  `Secure` and logins won't stick.
- **`BETTER_AUTH_SECRET` must be ≥ 32 characters** or the app refuses to boot ([`src/lib/env.ts`](../../src/lib/env.ts)).
- **`SETUP_TOKEN`** keeps anyone but you out of the one-time owner-creation wizard while the URL is
  public. The wizard asks for it as a "Setup token" field (Step 7); remove the var after setup.
- **`APP_PORT` — set it on Dokploy.** The bundled compose publishes the app on host port
  `${APP_PORT:-3000}`, but **Dokploy's own UI already uses host 3000**, so the default collides and the
  app container fails to start with `Bind for :::3000 failed: port is already allocated`. Set it to any
  free port (e.g. `3001`); Traefik still reaches the container's internal 3000 via your domain.

> **Using Gmail / Google Workspace SMTP?** Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`,
> `SMTP_SECURE=false`. `SMTP_PASSWORD` must be a **Google App Password** (2-Step Verification on →
> [App Passwords](https://myaccount.google.com/apppasswords)), pasted with **spaces removed** — not
> your account password. `SMTP_USER` and `SMTP_FROM` must both be the **same Gmail address** (Gmail
> rewrites the `From` otherwise). Consumer Gmail caps ~500 emails/day — plenty for a solo instance.

Optional blocks (S3 storage, OAuth sign-in, integrations, upload cap, reminder timing) are covered
below and tabulated in the [Appendix](#appendix--environment-variable-reference).

## Step 5 — Attach the domain and enable HTTPS

In the service's **Domains** tab, **Create Domain**:

| Field              | Value              |
| ------------------ | ------------------ |
| **Host**           | `brag.example.com` |
| **Service**        | `app`              |
| **Container Port** | `3000`             |
| **HTTPS**          | On                 |
| **Certificate**    | Let's Encrypt      |

The **Host** is just the hostname (no `https://`, no trailing slash). Dokploy injects the Traefik
labels and the `dokploy-network` for you; the **Container Port** is only how Traefik reaches the
container internally (it does **not** publish 3000 to the internet). DNS must already resolve (Step 2)
for the certificate to issue.

## Step 6 — Deploy

With **Trigger Type: On Tag**, auto-deploy only fires for tags pushed **after** the webhook exists — so
the **first** deploy (and any tag created before the service existed) is **manual**: click **Deploy**.
Enable **Auto Deploy** in the **General** tab so later release tags deploy themselves.

On deploy, Dokploy builds the image and starts the stack. On boot the `app` container waits for
Postgres to be healthy, **applies migrations** (`[migrate] database is up to date`), then starts. Then:

```bash
curl https://brag.example.com/api/health
# → {"status":"ok"}
```

If the app container fails with `Bind for :::3000 failed: port is already allocated`, that's the
`APP_PORT` clash — set `APP_PORT=3001` (Step 4) and redeploy.

## Step 7 — Run the first-run setup wizard

Visit your domain — every route redirects to **`/setup`**.

- If you set `SETUP_TOKEN`, the wizard shows a **"Setup token"** field — enter your `SETUP_TOKEN` value.
- Create **your owner account** (name, email, password) and your **personal workspace** (name, accent
  color, optional logo).

Submitting signs you in and **permanently closes the wizard**. You're marked email-verified
automatically, so there's no link to click — you land straight in the app. That's it: **you're the only
user**, there's nothing to invite. You can remove `SETUP_TOKEN` from the Environment tab afterward.

Branding lives at **`/admin`** (name, accent, logo). There is no member surface in solo mode — start
logging brags (press <kbd>N</kbd> to quick-add from anywhere).

## Optional: sign in with Google / GitHub

You can sign yourself in with Google or GitHub instead of a password. This doesn't create accounts —
OAuth only signs in your **already-provisioned, email-verified** owner account (matched by email), so
your setup account has to exist first (it does, after Step 7).

Register the callback `{APP_URL}/api/auth/callback/{google|github}` with the provider, then set both
halves of a pair:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

- **Password sign-in stays available** — `emailAndPassword` is always on (you set a password at setup);
  the social button is just an additional method.
- **Callback URLs must match `APP_URL` exactly** (scheme + host, `https`, no trailing slash) or you get
  `redirect_uri_mismatch`.

## Optional: source integrations (GitHub & Linear)

Turn your shipped work into reviewable brags: **your GitHub merged PRs** and **Linear completed issues**
land in a review queue (Settings → Integrations) where you approve or dismiss — nothing logs
automatically.

The **paste-a-token** path (GitHub fine-grained PAT / Linear API key) works with no operator setup. For
the **one-click Connect (OAuth)** buttons, register a **separate** OAuth app per provider (distinct from
sign-in above) with callback `{APP_URL}/api/integrations/{github|linear}/callback`, then set:

```bash
GITHUB_IMPORT_CLIENT_ID=...
GITHUB_IMPORT_CLIENT_SECRET=...
LINEAR_IMPORT_CLIENT_ID=...
LINEAR_IMPORT_CLIENT_SECRET=...
INTEGRATIONS_TOKEN_KEY=...    # optional; openssl rand -base64 32 (else derived from BETTER_AUTH_SECRET)
```

Full walkthrough (app registration field-by-field, private repos, token encryption):
[Source integrations](integrations.md).

## Storage: local disk vs S3/R2

By default attachments live on local disk in the **`bragbit_uploads`** Docker volume — simple and
durable enough for a single-node solo instance, as long as you [back it up](#operations-backups--upgrades).
For managed durability, switch to S3-compatible storage (AWS S3, Cloudflare R2, or MinIO):

```bash
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # or your S3/MinIO endpoint
S3_REGION=auto
S3_BUCKET=bragbit
S3_ACCESS_KEY_ID=REPLACE_ME
S3_SECRET_ACCESS_KEY=REPLACE_ME
S3_FORCE_PATH_STYLE=false                                 # true for MinIO
```

Attachments are never publicly addressable regardless of driver — they stream through an authorizing
route; only your workspace logo and avatar are public. Set `MAX_UPLOAD_MB` to cap attachment size
(default 25).

## Operations, backups & upgrades

Solo runs the same stack as org, so operations are identical — the full detail is in
[Backup, restore & upgrades](backup-and-upgrades.md). In short:

- **Health / logs / redeploy:** `curl …/api/health`; the service **Logs** view; Dokploy **Redeploy**.
- **Data lives in named volumes** (`bragbit_pgdata`, `bragbit_uploads`) that **survive redeploys** —
  Dokploy may prefix them with the project name (`docker volume ls` to confirm).
- **Back up both** the database (`pg_dump`) and the uploads volume, off-box, from the same point in
  time.
- **Upgrades** are bump-the-tag-and-redeploy: back up, read the [CHANGELOG](../../CHANGELOG.md), point
  the service at the new release tag, redeploy. Migrations are **forward-only** — roll back by restoring
  the pre-upgrade backup.

## Security hardening checklist

- [ ] **Strong, unique secrets** — `BETTER_AUTH_SECRET` (≥ 32 chars) and `POSTGRES_PASSWORD` (hex).
- [ ] **Gate setup** — keep `SETUP_TOKEN` set until your owner account exists.
- [ ] **HTTPS-only `APP_URL`** so session cookies get `Secure`; let Traefik enforce HTTPS.
- [ ] **Don't expose the app or Postgres on the host.** The stock compose publishes the app on
      `${APP_PORT:-3000}`; behind Traefik that host port is unnecessary. To close it entirely, change
      the `app` service's `ports:` to `expose: ["3000"]` in a fork (don't do this on `main` — it breaks
      the local `docker compose up` quickstart). Postgres is never published — keep it that way, and
      firewall the host to 80/443 + SSH.
- [ ] **Rate limiting is on in production** for the auth endpoints. Behind Cloudflare, set
      `TRUSTED_PROXY_IP_HEADER=cf-connecting-ip`.
- [ ] **Keep the host + Dokploy patched** and take **off-box backups** on a schedule.
- [ ] **AGPL-3.0** — if you modify BragBit and offer the modified version over a network, publish your
      source. Unmodified self-hosting has no such obligation.

## Troubleshooting

| Symptom                                                  | Likely cause & fix                                                                                                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Bind for :::3000 failed: port is already allocated`** | The compose publishes host port `${APP_PORT:-3000}` and Dokploy's UI already holds host 3000. Add `APP_PORT=3001` (any free port) and redeploy — Traefik still serves via your domain. |
| **Certificate won't issue / site not secure**            | DNS wasn't pointing at the server when the domain was created. Fix the `A` record, then recreate the domain (or restart Traefik). Cloudflare-proxied? Issue with "DNS only" first.     |
| **App container won't boot; env error in logs**          | `BETTER_AUTH_SECRET` < 32 chars, or a required var missing. The error names it (fail-fast in `src/lib/env.ts`). Fix in the Environment tab and redeploy.                               |
| **`/api/health` returns 503**                            | App is up but Postgres is unreachable. Check the `postgres` service is healthy and `POSTGRES_PASSWORD` matches what the DB was first initialized with.                                 |
| **Login doesn't stick / redirect loop**                  | `APP_URL` is `http://` (cookies ship without `Secure` behind TLS) or doesn't exactly match the domain. Set the exact `https://` origin and redeploy.                                   |
| **Password-reset / reminder email never arrives**        | SMTP misconfigured. Verify `SMTP_*` and that `SMTP_FROM` is an allowed sender. (You won't need verification mail to get in — the setup owner is auto-verified.)                        |
| **Data disappeared after a redeploy**                    | Someone ran `docker compose down -v`, which deletes volumes. Never use `-v`; volumes persist across normal redeploys. Restore from backup if lost.                                     |
| **Build runs out of memory**                             | The multi-stage Next.js build needs headroom. Use ≥ 4 GB RAM (or add swap), or build elsewhere and deploy a prebuilt tag.                                                              |

---

## Appendix — environment variable reference

Solo-relevant variables. Full reference: [Configuration](../configuration.md); annotated template:
[`.env.example`](../../.env.example).

### Required

| Variable                  | Example                    | Notes                                                                         |
| ------------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| `INSTANCE_MODE`           | `private-solo`             | Personal workspace; hides all member/invite UI.                               |
| `APP_URL`                 | `https://brag.example.com` | Exact public origin, **https**. Baked into emails, share links, auth cookies. |
| `BETTER_AUTH_SECRET`      | _(32+ random chars)_       | `openssl rand -base64 32`. App won't boot if shorter.                         |
| `POSTGRES_PASSWORD`       | _(hex)_                    | `openssl rand -hex 32` — URL-safe; feeds the wired `DATABASE_URL`.            |
| `SMTP_HOST` … `SMTP_FROM` | Gmail / your relay         | Powers password reset, weekly reminders, email-change, the setup verify send. |

### Recommended / common optional

| Variable                                            | Default             | Notes                                                                           |
| --------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `APP_PORT`                                          | `3000`              | **On Dokploy set a free port (e.g. `3001`)** — 3000 collides with Dokploy.      |
| `SETUP_TOKEN`                                       | _(unset)_           | Gate the first-run wizard while the URL is public. Remove after setup.          |
| `MAX_UPLOAD_MB`                                     | `25`                | Per-attachment cap.                                                             |
| `REMINDER_HOUR`                                     | `9`                 | Local hour (0–23) your weekly reminder fires.                                   |
| `STORAGE_DRIVER` + `S3_*`                           | `local`             | Switch to `s3` for object storage — see [Storage](#storage-local-disk-vs-s3r2). |
| `GOOGLE_CLIENT_*` / `GITHUB_CLIENT_*`               | _(unset)_           | Sign yourself in with Google/GitHub (only signs in your provisioned account).   |
| `GITHUB_IMPORT_CLIENT_*` / `LINEAR_IMPORT_CLIENT_*` | _(unset)_           | One-click **import** Connect buttons.                                           |
| `TRUSTED_PROXY_IP_HEADER`                           | _(x-forwarded-for)_ | Set to your proxy's real-client-IP header (e.g. `cf-connecting-ip`).            |

### Wired by Compose — do not set

`DATABASE_URL` (→ the bundled Postgres), `STORAGE_DIR` (→ the `bragbit_uploads` volume), `NODE_ENV`
(`production`). `CRON_SECRET` isn't needed either — the Docker server runs reminders in-process.

---

### Related documentation

- [Instance modes](../instance-modes.md) — `private-solo` vs `private-org`
- [Dokploy for an organization](dokploy-org.md) — the team/org variant of this guide
- [Configuration](../configuration.md) — every environment variable
- [Backup, restore & upgrades](backup-and-upgrades.md) · [Source integrations](integrations.md)
