# Deploy and operate

> Shop operators: use [shop-deployment.md](shop-deployment.md). This inherited toolkit runbook describes a separate SQLite application and is not the current shop deployment procedure.

## Prerequisites

Docker with Compose/BuildKit, a host with enough build memory and disk, an unused HTTPS hostname, DNS pointing to the host, and an existing Caddy installation. This is a single-instance SQLite deployment. Node 22 and pnpm are only needed on the developer/CI machine; containers provide runtimes.

## Local development and tests

Copy .env.example to .env. Run pnpm install --frozen-lockfile and pnpm db:migrate, then pnpm dev. Root commands load .env with Node's standard environment parser and supply development defaults only. API startup requires DATABASE_URL; production additionally requires an explicit HTTPS APP_ORIGIN. Node 22.14+ is required.
Run pnpm build before pnpm e2e; Playwright starts production servers and rejects occupied local ports. Set E2E_BASE_URL for external acceptance without starting local servers. Admin browser tests require explicit E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD; otherwise that test is reported skipped.

## Existing legacy SQLite databases

Fresh databases use `pnpm db:migrate` directly. For a database created by the original template's `db push`, first stop its writers, make a consistent backup and inspect its actual schema. For the default local path, from the repository root:

```sh
python -c "import sqlite3,pathlib; pathlib.Path('.local').mkdir(exist_ok=True); source=sqlite3.connect('packages/db/prisma/dev.db'); backup=sqlite3.connect('.local/legacy-before-baseline.db'); source.backup(backup); print(source.execute('PRAGMA table_info(User)').fetchall()); backup.close(); source.close()"
```

Use the actual resolved file path when DATABASE_URL is customized. Confirm the existing User table and its unique email index exactly match `packages/db/prisma/migrations/202610170001_initial/migration.sql`, and verify the backup before proceeding. Only for that matching legacy schema, record the initial migration as already applied, then apply the additive auth/projects migration:

```sh
node scripts/run.mjs pnpm --filter @repo/db exec prisma migrate resolve --applied 202610170001_initial
pnpm db:migrate
```

If the schema differs or has other tables/migration history, inspect and design the corresponding migration first. Never reset an existing database to make deployment pass. Legacy accounts retain their records but have no password hash; this release does not invent passwords for them or claim an email recovery flow.

## One-command container startup

Set APP_ORIGIN to your exact HTTPS origin in an operator-only environment file outside the source tree, then run:

```sh
docker compose --env-file /secure/runtime.env -f docker/docker-compose.yml up -d --build
```

Compose migrates a dedicated volume before starting API and web, waits for database readiness, restarts application containers and applies CPU/memory/log limits. It binds 3180/3181 only to loopback, exposes no database port, and runs runtime containers as the node user with capabilities dropped. Override WEB_PORT/API_PORT for another project. The Next API rewrite is a build argument, not a runtime-only environment switch.
Configure a dedicated Caddy site using docker/Caddyfile.example and validate the entire Caddyfile before reloading. Preserve existing sites and DNS records. Caddy provisions HTTPS through ACME; do not disable TLS checks.

For a derived product on the same host, use an explicit independent project name, such as `docker compose --project-name my-product --env-file /secure/my-product.env -f docker/docker-compose.yml up -d --build`, and set unused WEB_PORT/API_PORT plus its own APP_ORIGIN in that private file. Renaming package.json does not rename the Compose project. Never run the default fullstack-toolkit deployment against an existing product's volume or ports.

## Releases

Run python scripts/package_release.py .local/release.tgz. This archive excludes secrets, databases, dependencies and build output. Inspect it before upload. Upload it as /tmp/toolkit-RELEASE_ID.tgz through SSH with a verified known_hosts entry, then run scripts/release.sh on the host with the immutable release ID and hostname. The script builds sequentially and switches /opt/fullstack-toolkit/current only after local and public HTTPS readiness. It keeps each release environment in /opt/fullstack-toolkit/shared/RELEASE_ID.env. New release IDs keep source history; retain the previous images and volume backup. Full browser acceptance remains a separate required gate.
The GitHub deploy workflow is manual, uses the production Environment and DEPLOY_HOST/DEPLOY_USER/DEPLOY_SSH_KEY/DEPLOY_KNOWN_HOSTS secrets. Configure a dedicated least-privilege operator and host paths before using it. DNS/Caddy bootstrapping is intentionally an operator step. A green local run does not mean Actions or branch protection ran.

## Backup, restore and rollback

Before schema migration, stop only this project's API and archive the entire toolkit data volume into a protected host directory. Restart after the backup. Do not archive a live SQLite file without SQLite's backup API or stopping its writer. Keep backups off-host with retention and test restoration.
For an app-only rollback use the previous release's immutable image tags and compatible schema. For a schema rollback, stop API, preserve the failed database, restore the complete pre-migration volume backup, and launch the matching previous images. Never use docker compose down -v on a live deployment. Only switch back to a schema-compatible pair. See verification.md for what was actually exercised.

## Acceptance and operations

Check /api/health (liveness), /api/ready (database connectivity), real registration/login/project CRUD and separate-user isolation over public HTTPS. Verify HttpOnly/Secure/SameSite cookies, CSRF rejection, member access and request IDs, then restart containers and verify persistence. Check all pre-existing services after release.
No email verification/recovery, distributed session store, HA, external monitoring/alerts or automatic off-host backup is claimed in this version. Apply a registration policy and those operational features before exposing sensitive or large-scale workloads.

## This deployment

The 2026-10-17 installation uses toolkit.purelamp.uk, release r20261017d, loopback web 3180/API 3181, Compose project fullstack-toolkit and volume fullstack-toolkit_toolkit-data. Initial provisioning was performed in explicit build/migrate/start/proxy/acceptance steps, rather than asserting that the complete release automation ran. The dedicated Caddy site is /etc/caddy/sites-enabled/fullstack-toolkit.caddy. Existing Caddy sites and other application volumes are preserved. DNS is an A record in Cloudflare with DNS-only mode; Caddy terminates valid public TLS. Local operator credentials, server access details and acceptance fixtures remain excluded from source archives.

The follow-up bilingual/manual frontend is r20261017-i18n-02 and `/opt/fullstack-toolkit/current` points to that source release after public browser acceptance. The running API container remains the original r20261017d image; no schema migration or API restart was needed. Byte-identical API and migration image aliases under the new release tag make the full component set available for later compatible rollback; this is not a claim that a changed API was built or released. The component manifest is in the protected shared/reports directory. See i18n-verification.md for the exact checks and adoption limits.
