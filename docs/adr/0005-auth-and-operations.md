# ADR 0005: authentication and release boundaries

Status: accepted, 2026-10-17.
Use opaque seven-day sessions with database token digests instead of browser-stored JWTs. Passwords use asynchronous scrypt and random salts. All responses use explicit public DTOs. Cookie flags are HttpOnly and SameSite=Lax, with Secure required by production HTTPS configuration. Logout deletes the server-side session before the UI returns to its guest state.
Mutation requests require a custom header and production Origin matching the configured application origin. No cross-origin CORS permission is granted. A JSON content type is attached only when the JSON client actually sends a body: Fastify deliberately rejects empty JSON bodies, including a misconfigured logout or delete request.
Authentication does not replace authorization. Users may only query/mutate rows filtered by their ownerId; even a known project ID from another user returns 404. Role and owner fields cannot be injected. Administrator access is checked using the current database role on every request.
Abort pending project fetches when the account changes so a late response cannot repopulate a previous account's client state.
Use a single isolated SQLite volume, explicit migrations, non-root runtime containers and host-loopback ports behind a dedicated HTTPS Caddy site. The existing Virginia host's applications, ports, databases and DNS entries are outside this deployment's scope.
New registration always creates a USER. Operators can explicitly bootstrap an administrator through environment variables. Acceptance administrators are temporary and removed after production tests. There are no public default privileged credentials.
This starter does not implement email verification, account recovery, high availability, distributed throttling or an off-host backup service. It is a bounded single-instance starter, not evidence of those operational capabilities.
