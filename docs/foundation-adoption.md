# Adopt the foundation across projects

The foundation is a versioned template plus portable packages and verified operating conventions. It is not a central service that automatically owns every product's identity or data.

| Product situation                | Start with                                                                    | Preserve                                                                 | Acceptance                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| New product                      | Fresh template copy and init-project                                          | Independent origin, credentials, volume, database and business contracts | Login/logout, real domain CRUD, roles/owners, error paths, restart/recovery                 |
| Existing Next/React product      | Portable i18n artifact, app-specific provider/catalog, explicit quality gates | Framework version, current UI flows and user content                     | Default English, Chinese preference, SSR and refresh, mobile/accessibility, domain workflow |
| Existing Nest/FastAPI/other API  | Error/request-ID/log/env/health/CI patterns adapted to its framework          | Tenant/role rules, sessions, schema/migration history and data           | Existing negative authorization tests plus real browser business acceptance                 |
| Existing production installation | Reviewed isolated pilot, backup and release-specific runbook                  | Current working release and unrelated services                           | Independent staging proof followed by an explicitly scoped release                          |

## First pilot: InvoiceFlow

The existing project has React 18, NestJS, Prisma 5, organization memberships, multiple finance roles and an XML/review pipeline. Replacing those with the template's personal project owner model would discard business rules. The pilot therefore reuses @toolkit/i18n in a source-only isolated copy and retains the real API/tenant logic. It checks bilingual account/workspace navigation and the existing invoice workflow. See examples/invoiceflow/README.md and docs/i18n-verification.md for exact results and remaining localization scope.

No original .env, credentials, database, uploads, generated client or node_modules are copied. Generate a new client, use a disposable database and local-only ports. The original project is read-only throughout. Source hashes record the input, the exact core artifact and unmodified backend source. A passing local pilot is not a release of the existing InvoiceFlow SaaS service.

## Version and upgrade procedure

Record the template revision and shared-package version/digest in each product. Keep product copy in its own catalog and schema in its own migrations. When adopting an update, compare changes and apply a small capability at a time rather than overwriting a working project. If the API error wire format differs, use an explicit adapter and document the gap; do not relabel message-only responses as stable-code/request-ID support.

Run product-specific tests in addition to shared tests. A shared package passing unit tests does not prove tenant isolation, invoice extraction or browser usability in its consumer. Only migrate production data after an appropriate backup/restore and deployment plan is reviewed for that product. Never create a shared secret, database or session cookie merely to make multiple projects look connected.
