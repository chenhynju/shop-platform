# F12 implementation and acceptance plan — 2026-10-17

## Existing project and preservation

Next.js / Fastify / shared packages / CI and test skeletons already exist. There is no Git metadata in the initial checkout. Preserve current files in a local source backup before implementation; never archive secrets, databases or dependencies in a release.

## Product and architecture

Ship a reusable team project tracker: visitors can inspect the template, register, sign in, manage their own projects, and sign out. Administrators can inspect the member directory. Authorization is enforced by the API and database owner filters, never by client visibility alone. A forged role or owner in a request is rejected. Other users' project IDs return 404.

Use the existing Fastify / Prisma / Next.js architecture. Keep SQLite explicitly as a single-instance, small-deployment baseline with a persistent volume and versioned migrations; PostgreSQL and horizontal scaling require a separate migration, not a provider-string toggle. The server is shared, so isolate this deployment and preserve every existing service. Route same-origin /api requests through the edge proxy to API and other paths to Next.js.

Authentication uses asynchronous scrypt hashes with random salts and opaque random session tokens; only token digests are stored. Sessions expire after seven days and logout revokes them. Cookies are HttpOnly, SameSite=Lax, Secure in production. Mutations require a custom CSRF header plus validated Origin when supplied; production requires Origin. Anonymous registration only creates USER accounts. An administrator can be bootstrapped explicitly through environment variables, without public default credentials. Rate limit login/registration and all requests. Add security headers, bounded request bodies, input validation, request IDs, redacted structured logs and a stable error envelope without internal exceptions.

## Delivery sequence

1. Implement and test shared contracts, data migrations, authentication, authorization and project CRUD.
2. Build the responsive application, empty/loading/error states and member directory.
3. Correct environment, Turbo cache inputs, dependency pins, CI, Docker, health checks, backup/rollback and reuse instructions.
4. Run fresh database migrations, lint/format/type checks, coverage tests, build/budget, production browser E2E, cache hit/invalidation and container persistence checks.
5. Inspect Virginia resource usage and existing proxy, deploy into an isolated project and persistent volume, configure an unoccupied Cloudflare subdomain and HTTPS, run public browser acceptance, check existing applications, record exact results.

## Release gates

- Registration, login, logout, persistence across reload; no password/session material returned in JSON.
- Invalid inputs and duplicate registration produce consistent safe errors with request IDs.
- Anonymous requests return 401; ordinary users cannot list users; owner IDs/roles cannot be injected.
- Two distinct accounts cannot read/update/delete each other's projects; both positive and negative paths tested.
- CRUD survives API/container restart; expired/revoked sessions cannot access data.
- Runtime production config fails closed. Secrets excluded from image/source/logs. No database host port.
- Cold build and repeated build cache hit; changing relevant environment invalidates build; database-dependent acceptance never cached.
- Docker production build, migration, readiness, HTTPS public browser journey and preservation of existing services verified independently.
- Any unperformed check is NOT_RUN; unavailable access is BLOCKED. No claim of CI execution without a real Actions run.

Target: 06:00 Asia/Shanghai. If gates fail, fix or roll back; do not present an unverified deployment as complete.
