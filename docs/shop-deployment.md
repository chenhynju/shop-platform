# Shop deployment

## Local

Copy `.env.example` to private `.env`. Start `docker compose -f docker/compose.dev.yml up -d --wait`, then run `pnpm install --frozen-lockfile`, `pnpm db:migrate`, and `pnpm dev`. Open localhost:3000/shop. PostgreSQL and Redis bind only to loopback 5432/6379. Local default passwords are not production credentials.

## Production

Use project `shop-platform`, `/opt/shop-platform`, and loopback ports 3280/3281. Provision private `/opt/shop-platform/shared/runtime.env` (mode 600) with a unique `POSTGRES_PASSWORD`, matching URL-encoded `DATABASE_URL=postgresql://postgres:<password>@postgres:5432/shop`, and `APP_ORIGIN=https://shop.purelamp.uk`. Never overwrite an existing database password without synchronizing PostgreSQL and clients.

Run `python scripts/package_release.py .local/release.tgz`, upload as `/tmp/shop-<release-id>.tgz`, then execute `bash scripts/release.sh <release-id> shop.purelamp.uk` on the host. Docker Compose v2, Python 3 and curl are required. Builds finish before switching services; an existing PostgreSQL database is dumped before migration. Schema rollback needs a compatible release and a verified database restore. No automatic destructive rollback is attempted.

The default Compose entry point includes `compose.prod.yml`; it requires Compose 2.20+. The release script uses the production file directly. Configure only the dedicated shop Caddy site from `docker/Caddyfile.example`, validate the entire configuration and reload. Preserve existing sites, toolkit ports and all volumes. A record, reachable 80/443, and a valid ACME certificate are required.

## Accounts and acceptance

Actual roles: USER and ADMIN. Visitors browse products; USER uses their own cart/orders; ADMIN additionally manages products, inventory, promotions and members. No seller or finance roles exist.

Bootstrap a new administrator with explicit ADMIN_EMAIL/ADMIN_PASSWORD using `pnpm --filter @repo/db seed` in the migration image. Seed refuses to overwrite existing accounts. Register separate USER accounts through the public API. Store credentials outside source and report accounts only after successful login.

Verify HTTPS `/shop`, `/api/ready` and `/api/shop/products`, then browser login, cart operations, orders and user isolation. Readiness checks PostgreSQL only; a cart operation additionally verifies Redis. Payment is a mock demonstration, not live payment-provider reconciliation. HTTP 200 alone does not prove the full purchase flow.
