# ADR 0003: quality gates and cache correctness

Status: accepted, revised 2026-10-17.

| Gate              | Actual configuration                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Format            | Prettier; generated output, lockfile and local artifacts ignored                                                                |
| Lint              | ESLint 9 flat config and repo-custom/no-untagged-console                                                                        |
| Types             | Strict TypeScript across applications and shared packages                                                                       |
| API tests         | Real temporary SQLite; lines/statements >=85%, functions >=90%, branches >=75%                                                  |
| Web utility tests | Vitest; lines/statements/functions >=80%, branches >=50%                                                                        |
| Build             | Prisma generation, tsc database output, tsup API, Next production build                                                         |
| Bundle            | check-budget.mjs: all JS chunks gzip total <=300 KB by default; BUDGET_KB override                                              |
| Browser           | Real Chromium: guest, registration, login/logout, project CRUD, separate-account isolation, admin directory and mobile overflow |
| Container         | Multi-stage Linux images plus deployed Prisma SELECT 1, migrations, health and restart/persistence checks                       |
| Dependencies      | Production audit fails CI at high severity; patch resolutions recorded in the lockfile                                          |

Local tests do not prove an Actions run or configured branch protection. GitHub required checks, production Environment rules and deployment secrets are separate operator setup.

pnpm store, Turbo task outputs and BuildKit layers solve different caching problems. Turbo hashes the lockfile, workspace settings, shared configuration and relevant environment; unit/integration and browser acceptance tasks are never replayed from cache. A repeated local build and environment-change dry run have separate evidence in verification.md.

Set verifyDepsBeforeRun to error: changing package manifests must lead to an explicit install before checks, rather than multiple hidden installs mutating node_modules concurrently. [pnpm reference](https://pnpm.io/settings/build#verifydepsbeforerun).
