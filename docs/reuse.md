# Reuse this template

1. Install Node 22.14+ and the package.json-pinned pnpm version through Corepack. Copy .env.example to .env. Run pnpm install --frozen-lockfile, pnpm db:migrate and pnpm dev.
2. Create your own Git repository or use the GitHub Template feature after publishing. The initial working folder had no Git metadata; this release does not invent a remote repository.
3. Rename the root package and visible brand. Keep @repo/* workspace package names unless deliberately updating every dependency reference. Do not globally replace data, lockfile internals or generated clients.
4. Add business fields with a Prisma migration, API validation/owner authorization, packages/types contracts and a browser journey. The project tracker is the working example.
5. Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm size-check and pnpm e2e. Browser tests create distinct accounts in the configured database; use a disposable local/CI database. Set E2E_BASE_URL only when intentionally testing that deployment.
6. Bootstrap an administrator only when needed: set ADMIN_EMAIL and a unique ADMIN_PASSWORD of 16–128 characters in the operator environment, then pnpm db:seed. Existing accounts are never overwritten. Remove these variables after provisioning. No public default admin exists.
7. Each deployment needs its own APP_ORIGIN, volume, ports, domain, secrets and backup policy. Do not copy another project's .env, production data, credentials or sessions.
8. Follow deployment.md for Docker and release/rollback. GitHub required checks and production Environment approvals are configured in GitHub, not automatically enforced by a YAML file.

## Initialize a copy

Run `node scripts/init-project.mjs my-next-product` in a fresh copy to set the root package name, README title and create .env only if absent. Existing environment files are preserved. The script never initializes a remote repository or copies credentials.
