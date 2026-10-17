# Shop operations and release acceptance — 2026-10-18

## Delivered release

- Storefront: https://shop.purelamp.uk/shop ; the root page remains the account/workspace entry.
- Repository: https://github.com/chenhynju/shop-platform ; operations PR: https://github.com/chenhynju/shop-platform/pull/1 .
- Running application commit: `6e89afd6eacc3e1f1592c7890fb864e981c05c46`.
- Release: `r20261018-ops-02`, stored at `/opt/shop-platform/releases/r20261018-ops-02`; `/opt/shop-platform/current` points to this release.
- The archive also contains this report and private-file ignore rules added after the application release. Its exact source revision and checksum are recorded in the archive's external manifest. These documentation/ignore changes do not change the running application.

## Verified evidence

| Check                                                                    | Result          | Scope                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub quality, browser, container jobs                                  | PASS            | [Application CI run](https://github.com/chenhynju/shop-platform/actions/runs/39068946551)                                                                                                               |
| API tests                                                                | PASS            | 31 tests, 5 files; includes stock/concurrency assertions                                                                                                                                                |
| Web unit tests                                                           | PASS            | 21 tests, 4 files                                                                                                                                                                                       |
| CI browser tests                                                         | PASS            | 6/6, including commerce and account/isolation flows                                                                                                                                                     |
| Public HTTPS browser purchase                                            | PASS            | 1/1 dedicated scenario; catalogue, registration, cart add/remove/quantity, totals, pending order, mock payment, repeat payment, cancellation, stock, over-stock rejection, cross-user denial and logout |
| Public API/web restart                                                   | PASS            | Same secure session and cart survived; paid/cancelled orders remained; desktop/mobile reviewed                                                                                                          |
| Guest restrictions                                                       | PASS            | Orders/cart denied without authentication; ordinary user cannot administer products                                                                                                                     |
| PostgreSQL backup restore                                                | PASS            | Pre-release dump restored into a disposable isolated container; 0 users, 5 products, 0 orders, 1 migration                                                                                              |
| Redis backup restore                                                     | PASS            | Pre-release RDB loaded into an isolated container; PONG and 6 keys                                                                                                                                      |
| Test-data cleanup                                                        | PASS            | 2 temporary users and 2 orders removed; temporary product absent; original five products and inventory digest match; final counts 0 users / 5 products / 0 orders                                       |
| Unrelated services                                                       | PASS            | Container identities unchanged; no restart of other applications; the pre-existing unhealthy teamspace web container was not remediated                                                                 |
| Live rollback drill                                                      | NOT_RUN         | Previous source/images retained; no destructive database restore against live data                                                                                                                      |
| Real payments / automatic expiry                                         | NOT_IMPLEMENTED | Mock payments only; timeout worker exists but is not started by the API entry point                                                                                                                     |
| HA, external alert delivery, off-host disaster recovery, public load SLA | NOT_RUN         | Not represented by unit tests or health checks                                                                                                                                                          |

The first CI run failed because one restart fixture still supplied a SQLite URL and the new browser helper sent JSON Content-Type with an empty body. Both were corrected; no business assertion was removed. The 50-request concurrency test is an isolated API test, not a public throughput benchmark.

## Host isolation and secrets

Compose project is `shop-platform`. Only web/API publish loopback ports 3280/3281. PostgreSQL and Redis publish no host ports; their original containers and named volumes were retained. API/web run as UID 1000. Private environment is `/opt/shop-platform/shared/runtime.env`, mode 600; the release-specific private copy is `shared/r20261018-ops-02.env`. Existing database credentials were preserved and checked for consistency, never printed or archived.

The original server directory is also a legacy Git checkout. Host-local Git exclusions and Docker ignore rules now exclude root `shared`, `backups`, `releases`, environment files and database dumps. Equivalent safeguards are included in this source. Source/evidence archives exclude operator credentials, environment files, live database/Redis backups and temporary account passwords.

The domain already pointed at this server. Earlier TLS failures followed historical ACME NXDOMAIN attempts; issuance recovered automatically. This operation did not change Cloudflare records, global settings or Caddy configuration. Trusted public HTTPS was checked after publication and after restart.

## Backups and recovery

Private host backups, readable only by the operator:

- `backups/pre-ops-20261018.dump` and `backups/pre-ops-20261018.rdb`: independently restored into disposable containers before publication.
- `backups/before-r20261018-ops-02.dump`: immediate pre-publication PostgreSQL backup.
- `backups/after-r20261018-ops-02.dump` and `backups/after-r20261018-ops-02.rdb`: post-cleanup backups. These new snapshots were not separately restored during this run.

Separate PostgreSQL/Redis snapshots are not a cross-store atomic disaster-recovery guarantee. Backups remain on this host; an off-host encrypted copy and periodic restore exercises are follow-up work.

Normal operations, from the release directory on the host:

```sh
export RELEASE_TAG=r20261018-ops-02
docker compose --project-name shop-platform --env-file /opt/shop-platform/shared/runtime.env -f docker/compose.prod.yml ps
docker compose --project-name shop-platform --env-file /opt/shop-platform/shared/runtime.env -f docker/compose.prod.yml logs --tail=100 api web
```

Future releases follow [shop-deployment.md](shop-deployment.md) and `scripts/release.sh`: preserve credentials, build before switching, back up PostgreSQL before migration, apply migrations, switch only shop services and perform real purchase acceptance. Never use `down -v` or delete volumes to solve a deployment failure.

The retained original application uses tag `r20261017-shop-01`, legacy `/opt/shop-platform/docker/compose.prod.yml` and its original private `.env.prod`. For a compatible application rollback, verify the migration history and image availability first, explicitly set that tag, and recreate only API/web with `--no-build --no-deps`. Current and original migration directory hashes matched in this release. A future incompatible schema needs a separately reviewed restore plan; do not blindly restore a database dump or overwrite the current private environment.

## Limitations and archive meaning

Local uncommitted merchant features and next-phase design documents were observed during finalization. They are preserved in the working tree, excluded from this release/source archive, and have not been production-tested in this operation. The storefront currently describes prices as USD while its formatted amounts use a yen symbol; currency presentation needs correction before real commerce.

This is a demonstration commerce service, not a production payment system. No production administrator was created. The delayed expiry worker needs explicit deployment and acceptance before automatic stock recovery can be promised. `/api/ready` checks PostgreSQL only; Redis was checked separately through PING and cart/stock flows.

Measured Docker image sizes: API 630,120,340 bytes; web 322,379,919 bytes; migration 1,963,444,752 bytes. No sub-200 MB image or other unmeasured performance claim is made. Disk usage after cleanup was about 80%, with 12 GB free; growth needs monitoring.

Archiving here means an immutable source package, SHA-256 manifest and sanitized acceptance evidence. The GitHub repository stays active and the service stays online. It does not mean deleting the checkout, making GitHub read-only or shipping private database backups.
