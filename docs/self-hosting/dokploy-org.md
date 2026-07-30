# Hosting BragBit for your organization on Dokploy

A complete, end-to-end runbook for standing up a **company-wide, self-hosted BragBit** on your own
VPS using [Dokploy](https://dokploy.com) — the open-source deployment platform that runs your Docker
Compose stack behind Traefik with automatic HTTPS.

This guide targets **`INSTANCE_MODE=private-org`** ("ORG mode"): one organization, an owner + admins,
and **invitation-only** membership. If you want a single personal instance instead, use
[`private-solo`](../instance-modes.md) and the shorter [Dokploy reference](dokploy.md).

> **Which BragBit is "ORG mode"?** `private-org` is a **single self-hosted organization** — the whole
> company shares one workspace, and people join by invitation. It ships on `main` / the `v0.2.x`
> releases. It is **not** the multi-tenant shared-hosting build (open sign-up, user-created orgs, an
> instance superadmin), which lives on the separate `phase-10/hosted-multitenant` branch and is out of
> scope here. Deploy from a tagged release (e.g. `v0.2.0`), not a moving branch.

---

## Contents

1. [What ORG mode gives you](#1-what-org-mode-gives-you)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [Prerequisites](#3-prerequisites)
4. [Step 1 — Provision the host and install Dokploy](#step-1--provision-the-host-and-install-dokploy)
5. [Step 2 — Point DNS at the server](#step-2--point-dns-at-the-server)
6. [Step 3 — Create the Project and Compose service](#step-3--create-the-project-and-compose-service)
7. [Step 4 — Set the environment variables](#step-4--set-the-environment-variables)
8. [Step 5 — Attach the domain and enable HTTPS](#step-5--attach-the-domain-and-enable-https)
9. [Step 6 — Deploy](#step-6--deploy)
10. [Step 7 — Run the first-run setup wizard](#step-7--run-the-first-run-setup-wizard)
11. [Step 8 — Invite your team](#step-8--invite-your-team)
12. [Storage: local disk vs S3/R2](#storage-local-disk-vs-s3r2)
13. [Optional: social sign-in (OAuth)](#optional-social-sign-in-oauth)
14. [Optional: source integrations (GitHub & Linear)](#optional-source-integrations-github--linear)
15. [Operations](#operations)
16. [Backups & restore](#backups--restore)
17. [Upgrades](#upgrades)
18. [Security hardening checklist](#security-hardening-checklist)
19. [Troubleshooting](#troubleshooting)
20. [Appendix — environment variable reference](#appendix--environment-variable-reference)

---

## 1. What ORG mode gives you

In `private-org`, BragBit runs as one organization:

- The **first visit** opens a one-time `/setup` wizard that creates the **owner** account and a single
  **organization** workspace, then closes for good.
- Growth is **invitation-only** — there is no open sign-up. A new account exists only after someone
  accepts a tokenized email invite bound to their address.
- Three roles: **Owner** (exactly one; transferable), **Admin** (manages branding, members, and
  invitations), **Member** (uses the product).
- **Admins never read members' brag content.** Every member's brags are private to them regardless of
  role — admins manage the workspace, not its contents.
- Branding (name, accent color, logo) is per-workspace, and the org has exactly one workspace, so it
  reads as **instance-wide white-labeling** on the app, sign-in page, and shared documents.

Because membership and every email flow (invitations, address verification, password reset, weekly
reminders) run on email, a **working SMTP relay is mandatory** — without it you cannot invite anyone.

See [Instance modes](../instance-modes.md) and the [Admin guide](../admin-guide.md) for the full model.

## 2. Architecture at a glance

The bundled [`docker-compose.yml`](../../docker-compose.yml) is a single stack — and it's already
Dokploy-shaped (it reads `.env`, sets no `container_name`, and uses persistent named volumes):

| Service          | Image                   | Role                                                                   |
| ---------------- | ----------------------- | ---------------------------------------------------------------------- |
| `app`            | built from `Dockerfile` | Next.js 16 standalone server on port **3000**; runs migrations on boot |
| `postgres`       | `postgres:17-alpine`    | The database; data in the `bragbit_pgdata` volume                      |
| `minio` _(opt.)_ | `minio/minio`           | S3-compatible object storage, only with the `minio` profile            |

Key behaviors you'll rely on:

- **Migrations run on container start.** The entrypoint runs `node scripts/migrate.mjs` and then
  `exec node server.js`, so a fresh deployment provisions its own schema and upgrades apply themselves.
  You'll see `[entrypoint] applying database migrations…` → `[migrate] database is up to date` →
  `[entrypoint] starting BragBit…` in the logs.
- **Weekly reminders are in-process.** The standalone server schedules them itself (node-cron) — **no
  external cron needed**. (`CRON_SECRET` is only for the serverless/Vercel path.)
- **Health endpoint:** `GET /api/health` → `{"status":"ok"}` (HTTP 200) when the app and Postgres are
  reachable, `503` when the database is down. Dokploy/Traefik and any uptime monitor can probe it.
- **TLS is terminated by Traefik**, which Dokploy manages. The app itself serves plain HTTP on 3000;
  Traefik puts HTTPS in front.

Dokploy adds the Traefik routing (labels + the `dokploy-network`) automatically when you attach a
domain — you don't edit the compose file to get HTTPS.

## 3. Prerequisites

| You need                | Details                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A VPS**               | A recent Linux host with Docker. 2 GB RAM runs BragBit, but the multi-stage image **build** is memory-hungry — prefer **≥ 4 GB RAM / 2 vCPU** (or add swap). |
| **Disk**                | Postgres + uploaded attachments grow over time. Start with ≥ 20 GB and monitor; attachments default to a local volume.                                       |
| **A domain**            | e.g. `brag.example.com`, with access to its DNS to add an `A`/`AAAA` record.                                                                                 |
| **An SMTP relay**       | **Required.** Any transactional provider (Postmark, SES, Resend/SMTP, Mailgun, your own relay). Invitations/verification/reset/reminders all send mail.      |
| **OAuth apps** _(opt.)_ | Only if you want Google/GitHub **sign-in** buttons, or GitHub/Linear **import**. See the optional sections below.                                            |

---

## Step 1 — Provision the host and install Dokploy

Spin up the VPS, then install Dokploy following its [installation docs](https://docs.dokploy.com). The
one-line installer brings up the Dokploy UI (default on port `3000` of the server) and installs
Traefik. Open the UI, create your **Dokploy admin account**, and — recommended — put Dokploy itself on
a domain with HTTPS.

> Traefik owns ports **80** and **443** on the host. Don't run anything else on them.

## Step 2 — Point DNS at the server

Create a DNS record for your BragBit hostname **before** you attach the domain in Dokploy:

```
A    brag.example.com    →    <your server's public IP>
```

Let it propagate (`dig +short brag.example.com` should return your IP). If you add the domain in
Dokploy before DNS resolves, Let's Encrypt can't validate and the certificate won't issue — you'd have
to recreate the domain or restart Traefik.

> **Behind Cloudflare?** Either use "DNS only" (grey cloud) for the initial certificate issuance, or
> configure Cloudflare's origin/Full-Strict TLS per Dokploy's
> [Cloudflare guide](https://docs.dokploy.com/docs/core/domains/cloudflare). If you proxy through
> Cloudflare, also set `TRUSTED_PROXY_IP_HEADER=cf-connecting-ip` (see Step 4) so rate-limiting sees
> real client IPs.

## Step 3 — Create the Project and Compose service

In Dokploy:

1. **Create a Project** (e.g. `bragbit`).
2. Inside it, **create a service of type "Docker Compose"** (not "Application" — BragBit is a
   multi-service stack; and use the standard _Docker Compose_ provider unless you specifically run
   Swarm).
3. **Provider:** connect via the **GitHub App** (recommended — it wires the webhook that powers
   auto-deploy), then choose the **Repository** (`bragbit`) and **Branch** (`main`).
4. **Compose Path:** `./docker-compose.yml` (the repo-root file).
5. **Trigger Type:** choose **On Tag** so Dokploy deploys only when you push a release tag (e.g.
   `v0.2.0`) — deliberate, release-driven deploys instead of on every push to `main`. (Pick **On Push**
   if you'd rather every commit to `main` deploy — e.g. for a staging instance.)

Dokploy will build the multi-stage `Dockerfile` and run the stack on deploy. Leave the compose file
as-is — you configure everything through environment variables and the Domains tab.

## Step 4 — Set the environment variables

Open the service's **Environment** tab. Dokploy writes these to a `.env` file next to the compose
file; BragBit's compose consumes them **two ways at once**, which is why the stock file works
unchanged:

- `${POSTGRES_PASSWORD}` and `${APP_PORT}` are **interpolated** into the compose file itself.
- Everything else reaches the app container through the compose's `env_file: - .env` directive.

You do **not** set `DATABASE_URL`, `STORAGE_DIR`, or `NODE_ENV` — the compose wires those to the
bundled Postgres, the uploads volume, and `production` for you.

### Minimum required for ORG mode

Paste this into the Environment tab and fill in the values:

```bash
# ── Instance shape ──────────────────────────────────────────────
INSTANCE_MODE=private-org
APP_URL=https://brag.example.com          # exact public origin, https
BETTER_AUTH_SECRET=REPLACE_ME             # openssl rand -base64 32  (≥ 32 chars, or it won't boot)

# ── Bundled Postgres password (compose interpolates this) ───────
POSTGRES_PASSWORD=REPLACE_ME_STRONG

# ── SMTP — REQUIRED (invites/verification/reset/reminders) ──────
SMTP_HOST=smtp.your-relay.com
SMTP_PORT=587
SMTP_SECURE=false                         # true for implicit TLS on port 465
SMTP_USER=REPLACE_ME
SMTP_PASSWORD=REPLACE_ME
SMTP_FROM=BragBit <no-reply@example.com>  # must be a sender your relay allows

# ── Recommended while the URL is public but setup isn't done ────
SETUP_TOKEN=REPLACE_ME                    # openssl rand -base64 24; gates the /setup wizard

# ── Host port — Dokploy's own UI occupies host 3000, so remap to avoid a clash ──
APP_PORT=3001                             # any free host port; Traefik still serves via your domain
```

Generate the secrets on your machine:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -hex 32      # POSTGRES_PASSWORD — use hex (URL-safe): it's interpolated into DATABASE_URL,
                          # so base64's +/= (and @ : / #) would corrupt the connection string
openssl rand -base64 24   # SETUP_TOKEN
```

Notes specific to ORG mode:

- **`INSTANCE_MODE=private-org`** is what turns on the setup wizard + invitation/member surface.
- **`APP_URL` must be `https://…` and match the domain exactly.** Better Auth derives the session
  cookie's `Secure` flag from the scheme — an `http://` value behind Traefik ships cookies without
  `Secure`, and logins won't stick.
- **`SETUP_TOKEN`** is strongly recommended here: your domain is reachable the moment TLS issues, and
  this keeps anyone but you out of the one-time owner-creation wizard. The wizard requires it as a
  "Setup token" field (Step 7); you can remove the var after setup completes.
- **`BETTER_AUTH_SECRET` must be ≥ 32 characters** or the app refuses to boot (fail-fast validation in
  [`src/lib/env.ts`](../../src/lib/env.ts)).
- **`APP_PORT` — set it on Dokploy.** The bundled compose publishes the app on host port
  `${APP_PORT:-3000}`, but **Dokploy's own UI already uses host 3000**, so the default collides and the
  app container fails to start with `Bind for :::3000 failed: port is already allocated`. Set
  `APP_PORT` to any free port (e.g. `3001`) — Traefik still reaches the container's internal port 3000
  via your domain, so this host binding only exists to avoid the collision (you can firewall it off).

> **Using Gmail / Google Workspace SMTP?** Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`,
> `SMTP_SECURE=false`. `SMTP_PASSWORD` must be a **Google App Password** (2-Step Verification on →
> [App Passwords](https://myaccount.google.com/apppasswords)), pasted with **spaces removed** — not
> your account password. `SMTP_USER` and `SMTP_FROM` must both be the **same Gmail address** (Gmail
> rewrites the `From` otherwise). Consumer Gmail caps ~500 emails/day (Workspace ~2000) — fine for a
> small team, but each invite/verification/reset/reminder is one email, so move to a transactional
> relay (Postmark, SES) as you grow.

Optional blocks — storage (S3/R2), OAuth sign-in, source integrations, upload cap, reminder timing —
are covered below and fully tabulated in the [Appendix](#appendix--environment-variable-reference).

## Step 5 — Attach the domain and enable HTTPS

In the service's **Domains** tab, **Create Domain**:

| Field              | Value              |
| ------------------ | ------------------ |
| **Host**           | `brag.example.com` |
| **Service**        | `app`              |
| **Container Port** | `3000`             |
| **HTTPS**          | On                 |
| **Certificate**    | Let's Encrypt      |

Dokploy injects the Traefik labels and connects the `app` service to the `dokploy-network` at deploy
time — you don't touch the compose file. The **Container Port** here is purely how Traefik reaches the
container internally; it does **not** publish 3000 to the internet. Make sure DNS already resolves
(Step 2) so the certificate can issue.

## Step 6 — Deploy

With **Trigger Type: On Tag**, auto-deploy only fires for tags pushed **after** the webhook exists, so
the **first** deploy — and any tag created before you set the service up (including `v0.2.0` if you
tagged it earlier) — is **manual**: click **Deploy**. Enable **Auto Deploy** in the service's
**General** tab so later release tags deploy themselves, and make sure each release tag sits on the
configured branch (`main`).

On deploy, Dokploy builds the image and starts the stack. On boot the `app` container:

1. Waits for Postgres to be healthy (`pg_isready`), then
2. **Applies migrations** — watch for `[migrate] database is up to date`, then
3. Starts the server (`[entrypoint] starting BragBit…`).

Confirm health once it's up:

```bash
curl https://brag.example.com/api/health
# → {"status":"ok"}
```

Follow logs from the service's **Logs** view in Dokploy if anything looks off (see
[Troubleshooting](#troubleshooting)).

## Step 7 — Run the first-run setup wizard

Visit your domain. On first run every route redirects to **`/setup`**.

- If you set `SETUP_TOKEN`, the wizard shows a **"Setup token"** field — enter the value of your
  `SETUP_TOKEN` env var to proceed (submission is rejected without a match).
- Create the **owner account** (name, email, password) and your **organization workspace** (name,
  accent color, optional logo).

Submitting signs you in and **permanently closes the wizard** — subsequent visits go to the app. After
setup completes you can remove `SETUP_TOKEN` from the Environment tab if you like (the wizard is
already disabled).

## Step 8 — Invite your team

ORG mode is invitation-only; this is the normal way people get accounts. As owner/admin, go to
**`/admin/members`**:

- **Invite** one or several addresses at once, each as **Member** or **Admin**.
- Each invite is a **branded email with a tokenized link**, **single-use**, **bound to that address**,
  and **expires after 7 days** (re-inviting an address revokes the previous token). Tune the lifetime
  with `INVITATION_TTL_DAYS` if needed.
- Opening the link lands the invitee on an accept page to set a name and password; accepting creates
  their membership and signs them in (their email is verified by construction).
- **Resend / revoke** pending invites, **change roles** between Member and Admin, **remove** members,
  and (owner only) **transfer ownership** — you atomically step down to admin so there's always exactly
  one owner.

Branding lives at **`/admin`** (name, accent, logo). See the [Admin guide](../admin-guide.md) for the
full member-management surface and owner-protection rules.

> **Removal purges the member's data** from the workspace, and admins can't read member content to
> export it for them. Until the automatic _export-then-delete_ handoff ships, ask a departing member to
> export their own data first (Settings → Download JSON, plus per-document Markdown) before you remove
> them.
>
> **Test the invite path early.** Send yourself an invite to a second address right after setup — it's
> the fastest way to confirm SMTP actually delivers before you onboard the team.

---

## Storage: local disk vs S3/R2

By default, attachments (and avatars/logos) are stored on local disk in the **`bragbit_uploads`**
Docker volume — simple and durable enough for a single-node org instance, as long as you
[back it up](#backups--restore).

Choose **S3-compatible object storage** (AWS S3, Cloudflare R2, or MinIO) if you want managed
durability, or if you might run more than one `app` replica (a local volume isn't shared across
nodes). Set these in the Environment tab:

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
route; only workspace logos and avatars are public.

> **Using the bundled MinIO on Dokploy?** The `minio` + `minio-init` services sit behind a Compose
> profile. Activate them by adding `COMPOSE_PROFILES=minio` to the Environment tab (docker compose
> reads it from `.env`), and point `S3_ENDPOINT=http://minio:9000` with `S3_FORCE_PATH_STYLE=true`.
> For most orgs, an external bucket (R2/S3) is simpler than operating MinIO yourself.

## Optional: social sign-in (OAuth)

You can offer Google/GitHub sign-in buttons. **This does not weaken invitation-only:** OAuth only
signs in an **already-provisioned, email-verified** account (matched by email) — it never creates one.

Register the callback `{APP_URL}/api/auth/callback/{github|google}` with the provider, then set both
halves of a pair to show its button:

```bash
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Set only the pair(s) you want — e.g. `GOOGLE_CLIENT_*` alone gives a single "Continue with Google"
button. A few things to know:

- **There is no "Google-only" (password-less) mode.** `emailAndPassword` is always enabled, and the
  invitation-accept flow has each invited user set a password — so email + password sign-in stays
  available alongside the social button. Enabling only Google just makes it the sole _social_ option;
  access is still gated by **invitations**, not by the login method.
- **OAuth can't bootstrap an account.** Since it only signs in an already-provisioned, email-verified
  account, a new teammate must **accept their invite first** (setting a password), and can use Google
  only afterward.
- **Callback URLs must match `APP_URL` exactly** — same scheme + host, `https`, no trailing slash. A
  mismatch is the usual cause of a `redirect_uri_mismatch` error (applies to the integration callbacks
  below too).

## Optional: source integrations (GitHub & Linear)

Let members turn shipped work into reviewable brags: **GitHub merged PRs** and **Linear completed
issues** land in a per-member review queue (Settings → Integrations) where they approve or dismiss —
nothing logs automatically, and admins never see it.

The **paste-a-token** path (GitHub fine-grained PAT / Linear API key) works out of the box with no
operator setup. To offer the **one-click Connect (OAuth)** buttons, register a **separate** OAuth app
per provider (least privilege — distinct from the sign-in apps above) with callback
`{APP_URL}/api/integrations/{github|linear}/callback`, then set:

```bash
GITHUB_IMPORT_CLIENT_ID=...
GITHUB_IMPORT_CLIENT_SECRET=...
LINEAR_IMPORT_CLIENT_ID=...
LINEAR_IMPORT_CLIENT_SECRET=...
# Optional: dedicated key to encrypt stored provider tokens (else derived from BETTER_AUTH_SECRET)
INTEGRATIONS_TOKEN_KEY=...    # openssl rand -base64 32
```

Full walkthrough: [Source integrations](integrations.md).

## Operations

Everything is driveable from the Dokploy UI; the CLI equivalents (if you shell into the host) are:

- **Health:** `curl https://brag.example.com/api/health` → `{"status":"ok"}` (200), or `503` if the DB
  is down. Point Dokploy's monitor / any uptime check here.
- **Logs:** the service **Logs** view, or `docker compose logs -f app`.
- **Restart / redeploy:** use Dokploy's **Redeploy**. It rebuilds and restarts; migrations re-run on
  boot (a no-op when nothing's new).
- **Data persistence:** your data lives in the named volumes (`bragbit_pgdata`, `bragbit_uploads`, and
  `bragbit_minio` if used). These **survive redeploys**. Dokploy may prefix them with the project name
  — confirm exact names with `docker volume ls`.

## Backups & restore

Back up **both** the database and the uploaded files, from the **same point in time**.

**Database** (bundled Postgres):

```bash
docker compose exec -T postgres pg_dump -U bragbit bragbit > bragbit-$(date +%F).sql
```

**Uploads** (local-storage volume — confirm the exact volume name first with `docker volume ls`):

```bash
docker run --rm -v bragbit_bragbit_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/bragbit-uploads-$(date +%F).tgz -C /data .
```

Keep copies **off-box**. On S3 storage, the bucket is the source of truth — rely on the provider's
versioning/backups. Dokploy also offers scheduled database backups to S3 if you'd rather manage them
from its UI.

**Restore** into a running, empty stack:

```bash
docker compose exec -T postgres psql -U bragbit -d bragbit < bragbit-YYYY-MM-DD.sql
# then extract the uploads archive back into the bragbit_uploads volume
```

More detail (including the S3 case): [Backup, restore & upgrades](backup-and-upgrades.md).

## Upgrades

Migrations run automatically on start, so upgrading is **bump-the-tag-and-redeploy**:

1. **Back up first** (above). Migrations are **forward-only** — to roll back a bad upgrade you restore
   the pre-upgrade backup.
2. **Read the [CHANGELOG](../../CHANGELOG.md)** for anything that needs attention.
3. Point the Dokploy service at the **new release tag** and **Redeploy**. Watch for
   `[migrate] database is up to date` before the server starts.

Pinning a tag (rather than tracking `main`) keeps upgrades deliberate.

## Security hardening checklist

- [ ] **Strong, unique secrets.** `BETTER_AUTH_SECRET` (≥ 32 chars, `openssl rand -base64 32`) and
      `POSTGRES_PASSWORD`. Rotating the auth secret invalidates existing sessions.
- [ ] **Gate setup.** Keep `SETUP_TOKEN` set until the owner account exists.
- [ ] **HTTPS-only `APP_URL`.** So session cookies get `Secure`. Let Traefik enforce HTTPS.
- [ ] **Don't expose the app or Postgres on the host.** The stock compose publishes the app on host
      port `${APP_PORT:-3000}` for convenience; with Dokploy/Traefik fronting it, that host port is
      unnecessary. To close it, change the `app` service's `ports:` to `expose:` in your fork
      (`expose: ["3000"]`) so only Traefik on the internal network can reach it. Postgres is never
      published — keep it that way. Use the host firewall to allow only 80/443 (and your SSH port).
- [ ] **Rate limiting is on in production** for auth endpoints. Behind a proxy that rewrites the client
      IP (e.g. Cloudflare), set `TRUSTED_PROXY_IP_HEADER=cf-connecting-ip` so limits are per-client.
- [ ] **Keep the host and Dokploy patched**, and take **off-box backups** on a schedule.
- [ ] **AGPL-3.0.** BragBit is network-copyleft — if you modify it and offer the modified version over
      a network, you must make your source available. Unmodified self-hosting has no such obligation.

## Troubleshooting

| Symptom                                                  | Likely cause & fix                                                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Certificate won't issue / site not secure**            | DNS wasn't pointing at the server when the domain was created. Fix the `A` record, then recreate the domain in Dokploy (or restart Traefik). Cloudflare-proxied? Issue with "DNS only" first.                              |
| **App container won't boot; env error in logs**          | `BETTER_AUTH_SECRET` is < 32 chars, or a required var is missing. The error names the offending variable (fail-fast in `src/lib/env.ts`). Fix it in the Environment tab and redeploy.                                      |
| **`Bind for :::3000 failed: port is already allocated`** | The compose publishes host port `${APP_PORT:-3000}`, and Dokploy's own UI already holds host 3000. Add `APP_PORT=3001` (any free port) in the Environment tab and redeploy — Traefik still serves the app via your domain. |
| **`/api/health` returns 503**                            | The app is up but Postgres is unreachable. Check the `postgres` service is healthy and `POSTGRES_PASSWORD` matches what the DB was first initialized with.                                                                 |
| **Login doesn't stick / redirect loop**                  | `APP_URL` is `http://` (cookies ship without `Secure` behind TLS) or doesn't exactly match the domain. Set it to the exact `https://` origin and redeploy.                                                                 |
| **Invitations / verification emails never arrive**       | SMTP misconfigured. Verify `SMTP_*`, that `SMTP_FROM` is an allowed sender, and check the relay's dashboard. Send yourself a test invite. Nothing works in ORG mode without deliverable mail.                              |
| **Legit users hit rate limits**                          | You're behind a proxy using a non-standard client-IP header, so all traffic looks like one IP. Set `TRUSTED_PROXY_IP_HEADER` to your proxy's header (e.g. `cf-connecting-ip`).                                             |
| **Data disappeared after a redeploy**                    | You (or a script) ran `docker compose down -v`, which deletes volumes. Never use `-v`. Volumes persist across normal redeploys; restore from backup if lost.                                                               |
| **Changed `POSTGRES_PASSWORD` and DB won't connect**     | Postgres only reads it on first init. Changing it later doesn't re-key an existing volume — either keep the original, or reset the DB (and restore a dump) deliberately.                                                   |
| **Build runs out of memory**                             | The multi-stage Next.js build needs headroom. Use ≥ 4 GB RAM (or add swap), or build the image elsewhere and deploy a prebuilt tag.                                                                                        |

---

## Appendix — environment variable reference

Required and org-relevant variables. Full reference: [Configuration](../configuration.md); annotated
template: [`.env.example`](../../.env.example).

### Required (ORG mode)

| Variable                      | Example                          | Notes                                                                         |
| ----------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `INSTANCE_MODE`               | `private-org`                    | Enables the setup wizard + invitation/member surface.                         |
| `APP_URL`                     | `https://brag.example.com`       | Exact public origin, **https**. Baked into emails, share links, auth cookies. |
| `BETTER_AUTH_SECRET`          | _(32+ random chars)_             | `openssl rand -base64 32`. App won't boot if shorter.                         |
| `POSTGRES_PASSWORD`           | _(strong)_                       | Read by compose for the bundled Postgres + the wired `DATABASE_URL`.          |
| `SMTP_HOST`                   | `smtp.your-relay.com`            | Required — all account/reminder mail flows through it.                        |
| `SMTP_PORT`                   | `587`                            | `465` with implicit TLS (`SMTP_SECURE=true`).                                 |
| `SMTP_SECURE`                 | `false`                          | `true` for port 465.                                                          |
| `SMTP_USER` / `SMTP_PASSWORD` | _(relay creds)_                  | If your relay authenticates.                                                  |
| `SMTP_FROM`                   | `BragBit <no-reply@example.com>` | Must be an allowed sender on your relay.                                      |

### Recommended / common optional

| Variable                                            | Default           | Notes                                                                                          |
| --------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `SETUP_TOKEN`                                       | _(unset)_         | Gate the first-run wizard while the URL is public. Remove after setup.                         |
| `TRUSTED_PROXY_IP_HEADER`                           | _x-forwarded-for_ | Set to your proxy's real-client-IP header (e.g. `cf-connecting-ip`) for correct rate-limiting. |
| `INVITATION_TTL_DAYS`                               | `7`               | Invite link lifetime.                                                                          |
| `MAX_UPLOAD_MB`                                     | `25`              | Per-attachment cap (avatars 5 MB, logos 2 MB are fixed).                                       |
| `REMINDER_HOUR`                                     | `9`               | Local hour (0–23) the weekly reminder fires.                                                   |
| `STORAGE_DRIVER` + `S3_*`                           | `local`           | Switch to `s3` for object storage — see [Storage](#storage-local-disk-vs-s3r2).                |
| `GITHUB_CLIENT_*` / `GOOGLE_CLIENT_*`               | _(unset)_         | Social **sign-in** buttons (only sign in provisioned accounts).                                |
| `GITHUB_IMPORT_CLIENT_*` / `LINEAR_IMPORT_CLIENT_*` | _(unset)_         | One-click **import** Connect buttons.                                                          |
| `INTEGRATIONS_TOKEN_KEY`                            | _(unset)_         | Encrypts stored integration tokens; else derived from `BETTER_AUTH_SECRET`.                    |

### Wired by Compose — do not set

| Variable       | What Compose sets it to                                         |
| -------------- | --------------------------------------------------------------- |
| `DATABASE_URL` | `postgres://bragbit:${POSTGRES_PASSWORD}@postgres:5432/bragbit` |
| `STORAGE_DIR`  | `/app/.data/uploads` (the `bragbit_uploads` volume)             |
| `NODE_ENV`     | `production`                                                    |
| `CRON_SECRET`  | Not needed — the Docker server runs reminders in-process.       |

### Compose knobs (read by `docker-compose.yml`, not the app)

| Variable            | Default   | Notes                                                                                                                                                            |
| ------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD` | `bragbit` | **Set a real one.** Also feeds the wired `DATABASE_URL`.                                                                                                         |
| `APP_PORT`          | `3000`    | Host port for the app. **On Dokploy set a free port (e.g. `3001`)** — the default 3000 collides with Dokploy's own UI. Traefik serves via the domain regardless. |
| `COMPOSE_PROFILES`  | _(unset)_ | Set to `minio` to run the bundled MinIO services.                                                                                                                |

---

### Related documentation

- [Instance modes](../instance-modes.md) — `private-org` vs `private-solo`
- [Admin guide](../admin-guide.md) — members, invitations, roles, ownership
- [Configuration](../configuration.md) — every environment variable
- [Docker Compose](docker-compose.md) · [Dokploy reference](dokploy.md) · [Backup & upgrades](backup-and-upgrades.md)
- [Source integrations](integrations.md)
