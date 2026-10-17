# User and project adoption manual

fullstack-toolkit is a reusable project foundation and a working private-project example. English is the default working language; Simplified Chinese is available from the language selector. Each adopted product keeps its own domain, data, credentials and authorization model. This is not a shared login service for all your products.

## 1. Create an account and sign in

1. Open the workspace homepage. Under Create account, enter your name, a valid email address and a unique password of 12–128 characters, then choose Create account. Registration signs you in as USER.

2. For an existing account, choose Sign in, enter the same email/password and submit. A wrong password produces an error message; use the request ID when asking an operator for help.

3. Your session can last up to seven days. Sign out when finished, especially on a shared device. Sign out revokes the current session on the server; closing a browser tab alone does not.

4. Email verification and password recovery are not implemented. Do not use an important account password. Ask the product operator about recovery before storing important data.

## 2. Manage your private projects

1. Choose + New project. Enter a title (1–120 characters), optional description (up to 2000 characters) and a status, then choose Create project. The card appears in Planned, In progress or Completed.

2. Choose Edit on a card to change its title, description or status. Choose Save changes, then refresh to verify the saved result. Cancel closes the form without saving.

3. Search projects filters the loaded titles and descriptions. The application displays the newest 100 projects. Overview counts refer to loaded projects; they are not an unlimited reporting system.

4. Choose Delete, then confirm the browser dialog. Deletion is permanent in the application; Cancel leaves the project in place. There is no recycle bin.

5. Projects belong to their creating account. Another account cannot read, edit or delete them, even by entering a known project URL or sending a request directly. No project sharing or organization membership is provided by this example.

## 3. Work in English or Simplified Chinese

1. Use the header language selector to choose English or 简体中文. English remains the default for a new visitor, regardless of the browser's preferred language.

2. The choice is stored in a non-sensitive preference cookie for one year and restored on refresh, including on the manual page. It does not change your account, session, project IDs or access rights.

3. Interface copy, form labels, status names, notifications, supported API error codes and date presentation change language. Your project names/descriptions and other user-entered content are never automatically translated.

4. API field names, enum values, error codes, request IDs, logs and source identifiers remain in English. New products can reuse @toolkit/i18n while owning their own message catalogs.

## 4. Administrator access

1. New accounts are always USER. There is no public default administrator, role selector during registration or browser action for promoting accounts.

2. An explicitly provisioned ADMIN sees Members in the sidebar. Open it to inspect the newest 100 members, then choose Back to projects. This screen is a directory, not a user/role editing console.

3. Operators provision a new administrator through pnpm db:seed with explicit ADMIN_EMAIL and a unique ADMIN_PASSWORD of 16–128 characters in a private operator environment. The command refuses to overwrite an existing account. Remove bootstrap variables afterward and never put credentials in source, CI logs or tickets.

4. USER cannot access the member directory API. Hiding a menu is only presentation: the actual role check is performed by the API.

## 5. Start the next project

1. Use a fresh copy of the template source. Keep the original project's files, database and deployment intact. Install Node 22.14+ and the package.json-pinned pnpm version; copy .env.example to a private .env.

2. Run node scripts/init-project.mjs my-product, pnpm install --frozen-lockfile and pnpm db:migrate, then pnpm dev. The initializer changes the root name/README title and creates .env only if missing; it does not create a remote repository.

3. For an existing database, follow docs/deployment.md's backup and verified-schema baseline procedure. Never use database reset, copy a production database into a template or invent passwords for legacy users.

4. Add domain fields through migrations, shared API contracts and server authorization. Reuse the working project workflow as a pattern. If the existing product already has tenant/role rules, preserve those rules; do not substitute this example's simpler owner-only model.

5. Run format:check, lint, typecheck, test, build, size-check and e2e. Use disposable test databases/accounts. E2E creates data; do not point it at a customer deployment by accident. Refer to docs/reuse.md and docs/i18n.md for extension details.

## 6. Deploy and operate

1. Every project needs a unique HTTPS origin, Compose project name, volume, host ports and private environment. Copying another project's credentials or reusing its data volume is not infrastructure reuse.

2. Set APP_ORIGIN to the exact HTTPS origin and run docker compose --env-file /secure/runtime.env -f docker/docker-compose.yml up -d --build. On a shared server, first choose unused loopback ports and a separate Compose project name/paths, and configure only the new hostname in the reverse proxy.

3. This release uses SQLite on one instance. /api/health checks process liveness; /api/ready queries the database. A green health endpoint is not proof that login, permissions or business operations work.

4. Before migration, stop this project's writer and back up its complete data volume. Test restoration into a separate disposable volume. Keep protected backups off-host with a retention policy. Never run compose down -v on a live deployment.

5. Keep immutable source/images and a per-release environment file. Roll back code only against a compatible schema; schema recovery requires a verified backup and matching application version. See docs/deployment.md and docs/verification.md. GitHub workflows require a real repository, secrets and Environment policies before they can run.

## 7. Troubleshooting and limits

1. API unavailable: check connectivity, the API/ready endpoint, runtime environment and proxy route. Do not disable TLS verification or expose the database to make the indicator green.

2. 401: sign in again. 403: check the current role and allowed Origin/CSRF configuration. 404 for another user's project is deliberate. 409 usually means a duplicate record. 429 means wait before retrying.

3. When reporting an error, include the page/action, time, request ID and expected result. Do not send passwords, cookies, access tokens, environment files or customer documents.

4. This version does not provide email recovery, SSO across products, team project sharing, online subscriptions, HA, PostgreSQL multi-replica operation, uptime guarantees or automated off-host backups. The InvoiceFlow pilot validates reuse in an isolated local environment; it does not silently migrate the existing InvoiceFlow production service.
