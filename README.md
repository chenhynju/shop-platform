# shop-platform

A full-stack ecommerce demonstration built from fullstack-toolkit: Next.js 15, Fastify 5, Prisma/PostgreSQL, Redis, BullMQ, pnpm and Turborepo. Payments are simulated; no real payment provider is connected.

[简体中文](README.zh-CN.md) · [Deployment and recovery](docs/shop-deployment.md)

## Run locally

Use Node 22.14+ and the pinned pnpm 11.7.0. Docker Compose v2 is required for the local database/cache.

```sh
cp .env.example .env
docker compose -f docker/compose.dev.yml up -d --wait
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

The example database password is for disposable local development only. Keep the private `.env` out of Git. PostgreSQL/Redis development ports bind to loopback; production databases expose no host ports.

## Pages and roles

- `/shop`: public product catalog.
- `/shop/cart`: private cart, quantity changes, promotion estimate and checkout.
- `/shop/orders`: account-owned orders, mock payment and pending-order cancellation.
- `/`: inherited account registration/login and private project example; it is not a deployment control panel. The store's account links currently lead here.
- USER can operate only their own cart/orders. ADMIN APIs manage products, stock and promotions; the inherited member directory also requires ADMIN. There are no public default privileged credentials.

Provision an administrator only through the explicit operator bootstrap documented in `docs/shop-deployment.md`. Do not copy a real production database or credential into a template/test environment.

## Checks

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm size-check
pnpm e2e
```

API tests require real PostgreSQL and Redis. Use disposable services: the concurrency suite creates orders and inventory fixtures. E2E writes accounts/business data and must not target production without the separately controlled, temporary-fixture acceptance procedure. CI provides isolated PostgreSQL/Redis and an explicitly seeded administrator. Tests do not establish real payment settlement or production capacity.

## Deploy and recover

Production uses `/opt/shop-platform`, Compose project `shop-platform`, ports 3280/3281 on loopback and dedicated persistent PostgreSQL/Redis volumes. Domain: https://shop.purelamp.uk/shop. TLS terminates at the existing Caddy proxy. See `docs/shop-deployment.md` for immutable source packaging, private runtime configuration, backup, migration and recovery. GitHub Actions requires deployment secrets and the production Environment; the hostname input does not configure DNS or credentials.

## Operational limits

Mock payment is not a payment-provider integration. The current source defines a delayed cancellation worker but does not start it from the API entry point; automatic order expiry is not an operational guarantee. Manual cancellation is a distinct tested flow. No HA, external alert delivery, off-host disaster recovery or real checkout throughput SLA is claimed. Storefront copy is primarily English; the inherited account interface has English/Chinese localization.

The older toolkit adoption/manual documents are inherited background material. This README and `docs/shop-deployment.md` are authoritative for the shop's PostgreSQL/Redis setup; SQLite/toolkit deployment instructions do not apply here.
