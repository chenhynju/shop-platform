# fullstack-toolkit

An English-first, reusable full-stack foundation: **Next.js 15, Fastify 5, Prisma, pnpm and Turborepo**. Includes a working private project board, authentication, server-enforced permissions, shared contracts, quality gates, Docker deployment and English/Simplified Chinese UI.

[简体中文](README.zh-CN.md) · [User manual](docs/user-manual.en.md) · [中文操作手册](docs/user-manual.zh-CN.md)

## Run locally

Use Node **22.14+** and **pnpm 11.7.0**, pinned in package.json.

```sh
corepack enable
# Copy .env.example to a private .env, or keep the development defaults.
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 and create your own account. The API listens on 3001. Root commands load the root .env through scripts/run.mjs. The default development database is packages/db/prisma/dev.db. Never publish it. For a legacy database, follow the verified backup/baseline procedure in [deployment.md](docs/deployment.md); do not reset existing data.

## Working features

- Register, sign in and sign out; asynchronous salted scrypt passwords, seven-day opaque sessions stored as digests, HttpOnly/SameSite cookies and Secure cookies in production.
- Private project CRUD, status changes and search; owner filters and role checks in the API. Another user's project returns 404. Only explicitly provisioned administrators can read the member directory.
- Strict inputs, CSRF/Origin checks, request IDs, safe error envelopes, redacted structured logs, throttling and security headers.
- English by default, explicit Simplified Chinese selection, server-rendered language preference and localized interface/error/date presentation. User content and API identifiers retain their original values.
- A full bilingual manual at `/manual`, plus the matching Markdown editions linked above.
- Single-instance SQLite, versioned migrations, isolated persistent Docker volume, loopback-only ports, health checks, backup/restore and rollback procedures.

No public default administrator, email verification/recovery, cross-product SSO, team project sharing, payments, HA or automatic off-host backups are claimed. PostgreSQL requires its own data migration; it is not an environment-string toggle.

## Quality gates

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm size-check
pnpm e2e
```

API integration tests use temporary real SQLite databases. Browser tests create data in the configured application database: use disposable local/CI environments. External browser acceptance requires an explicit E2E_BASE_URL. Admin browser tests require explicit operator test credentials; otherwise the test is skipped. Never point tests at customer data accidentally.

Root installation builds @toolkit/i18n. Root development also watches that package. Windows builds avoid standalone symlink privilege requirements; Docker builds enable standalone explicitly. Dependencies must be installed before scripts run, preventing hidden concurrent dependency changes during checks.

## Reuse and existing-project adoption

For a new product, start from a fresh source copy and run `node scripts/init-project.mjs my-product`. Keep its origin, ports, volume, credentials and database independent. See [reuse.md](docs/reuse.md).

For an existing product, preserve its framework and domain authorization. Adopt portable packages and operational conventions incrementally. **@toolkit/i18n has no React/Next/Fastify dependency.** The [InvoiceFlow pilot](examples/invoiceflow/README.md) applies the same compiled package to an isolated React 18/NestJS project while retaining its own organization permissions and XML invoice pipeline. This does not migrate or replace the existing InvoiceFlow production deployment.

- [Infrastructure adoption guide](docs/foundation-adoption.md)
- [i18n contract and extension guide](docs/i18n.md)
- [Deploy, back up, restore and roll back](docs/deployment.md)
- [Initial release evidence](docs/verification.md)
- [Manual, i18n and pilot follow-up evidence](docs/i18n-verification.md)

## Repository

apps/web contains the interface and Playwright journeys; apps/api owns authentication and project authorization. packages/db owns the schema/migrations; packages/types owns API contracts; packages/i18n is the portable locale core. Shared UI/configuration packages stay versioned with the workspace. Product-specific adoption adapters live in examples/.

CI and manual deployment workflows are provided. Actual Actions execution, repository secrets, required checks and production Environment policies must be configured and verified in GitHub; a local green run does not establish those gates.
