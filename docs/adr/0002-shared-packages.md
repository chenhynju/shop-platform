# ADR 0002: shared package exports

Status: accepted, revised 2026-10-17.

- @repo/ui and @repo/types export TypeScript sources. Next transpiles shared UI; API imports the public contracts as types. Public user/project DTOs explicitly implement those contracts and serialize dates as ISO strings.
- @repo/db exports built JavaScript, declarations, the Prisma singleton and the PrismaClient constructor. The runtime constructor must be a value export; export type alone cannot be used by tests or an application to instantiate a client.
- The root postinstall generates Prisma and builds the database package. Turbo orders database builds before API build/typecheck/tests. Root commands load the root environment file.
- pnpm deploy creates a pruned API dependency tree. A generated Prisma client is captured before deployment and copied into the nearest .prisma/client location in the deployed dependency tree; a placeholder nearer to @prisma/client must not shadow it.
- The Docker package stage performs a real SELECT 1 through the deployed Prisma client before producing the runtime image. Migrations use a separate pre-deploy workspace stage so pnpm deploy cannot change its installation metadata.
- Runtime containers run JavaScript as a non-root user. They do not install dependencies or generate clients on startup.
