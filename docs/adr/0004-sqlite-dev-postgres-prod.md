# ADR 0004: explicit single-instance SQLite baseline

Status: accepted, revised 2026-10-17.
The existing implementation uses SQLite. This release keeps SQLite in development and the small production demo, with versioned Prisma migrations and a dedicated Docker volume at /data. It does not claim PostgreSQL support or horizontal availability. Only one API instance may write this volume.
DATABASE_URL is mandatory at API startup and must use file:. Local root commands supply file:./dev.db by default. Production uses file:/data/toolkit.db. Never put the file on a shared/network filesystem or expose its directory through the web server.
Use prisma migrate deploy for deployment, not db push. The initial migration preserves a pre-existing legacy User table; the second migration adds nullable password hashes and USER as the safe default role. Legacy demonstration users cannot sign in until deliberately provisioned; no automatic privilege changes occur.
Existing databases previously created by db push need a backup and migration-history reconciliation by the operator before deploy; never reset them. The Virginia release uses a fresh isolated volume.
A future PostgreSQL variant needs its own schema provider, migration SQL, test matrix, backup/restore and concurrency evidence. Changing a connection string alone is insufficient.
Before every migration stop this project's API, archive its data volume, and keep the previous source/image. Roll back source only when schema compatible; otherwise stop the API and restore the matching database backup.
