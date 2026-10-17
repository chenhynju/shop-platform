# InvoiceFlow infrastructure adoption pilot

This is a bounded adapter for an existing product, not a replacement invoice application. It uses the template's compiled @toolkit/i18n in a source-only InvoiceFlow copy while retaining its NestJS API, Prisma schema, organization permissions and XML/review pipeline.

## Create an isolated copy

From the toolkit root:

```sh
pnpm --filter @toolkit/i18n build
python scripts/create-invoiceflow-pilot.py /path/to/invoiceflow .local/pilots/invoiceflow
```

The destination must not exist and cannot overlap the source. The script excludes environments, databases, uploads, generated clients, node_modules, build/test artifacts and private-key/binary file types. The adapter targets the existing account, workspace, shell and upload components; unsupported source layouts fail rather than modifying the original project. The pilot is local only. Review the generated diff before applying any changes to the original repository.

The new source manifest records original source hashes and the shared core digest. The vendor artifact contains compiled JavaScript/type definitions with no runtime dependencies. The pilot web package consumes it as an ordinary file dependency; it does not join the toolkit's pnpm workspace or reuse the original node_modules.

## Prepare and validate

Use InvoiceFlow's pinned pnpm version in the copy. Install its own dependencies and generate its own Prisma client. Configure a new private environment with SAAS_ENABLED=true, ALLOW_REGISTRATION=true **only for the disposable local test**, a new API_ACCESS_KEY, a disposable SQLite path, a new storage directory and unused loopback ports (the recorded run uses web 3290/API 3291). Build shared, API and web packages, explicitly using NODE_ENV=production for the Next build. The pilot removes the remote Google-font build dependency and uses system fonts.

Apply the original migration chain to the disposable database and record whether Prisma CLI or a SQL-only fixture initializer was actually used. Never claim a SQL fixture as a tested production CLI migration. Start API/web with the same server-side API key; the SaaS regression adapter adds that key to direct API test requests. No key is embedded in browser code or reports.

Run the original SaaS HTTP regression against this database, then the toolkit's dedicated pilot Playwright config. Real browser acceptance covers English-default registration, Chinese selection/persistence, organization creation, actual XML upload, parsed document state, organization switching/isolation and logout. This is one synthetic invoice workflow, not a claim that every supported country/format was browser-tested.

After building, start the local preview from the toolkit root with the newly created private environment (never an original production environment):

```sh
node --env-file=.local/pilots/invoiceflow/apps/api/.env examples/invoiceflow/run-local.mjs .local/pilots/invoiceflow
```

The runner verifies the generated-pilot marker, requires a private API key/database configuration, checks both ports and binds only to loopback. It runs the built API in local development mode and the built Next server in production mode. Ctrl+C stops both child processes. In another terminal:

```sh
pnpm --filter @repo/web exec playwright test --config playwright.pilot.config.ts
```

The dedicated browser config refuses a public hostname. The source manifest and migration-method report must accompany the acceptance results. English-first catalog changes do not alter stored organization names, invoice values or role enums.

## Deliberate limits

The first adapter localizes account/workspace navigation and selected upload copy. Existing document/detail/review pages and some backend message-only errors can still contain Chinese. This is incremental adoption evidence, not full InvoiceFlow localization. The pilot does not replace or harden InvoiceFlow's existing authentication implementation, add production migrations or deploy its SaaS mode. Message codes/request IDs, full UI catalogs and operational gates must be adapted separately before a broader rollout.

The recorded browser run uploads two fixtures: the untouched legacy `invoice-ubl-01.xml` is a negative case with a missing recognized total and must enter review; `fixtures/invoice-pilot-ubl.xml` independently checks subtotal 2000, tax 380 and total 2380 in both the API and visible form. Its missing VAT number still requires review. The legacy expected.json total assertion is inconsistent with the current strict parser and remains a reported existing-project issue, not a passing financial benchmark. No parser or original golden file was changed to make adoption pass.
