#!/usr/bin/env bash
# Prerequisite: configured DNS/Caddy, Docker, and free project-specific ports.
set -euo pipefail
release_id="${1:?release id required}"
hostname="${2:?hostname required}"
[[ "$release_id" =~ ^[a-zA-Z0-9-]+$ ]] && [[ "$hostname" =~ ^[a-zA-Z0-9.-]+$ ]]
base=/opt/fullstack-toolkit
release="$base/releases/$release_id"
runtime="$base/shared/$release_id.env"
test ! -e "$release"
install -d -m 700 "$base/releases" "$base/shared" "$base/backups"
mkdir "$release"
tar -xzf "/tmp/toolkit-$release_id.tgz" -C "$release"
previous=""
if test -L "$base/current"; then previous="$(readlink -f "$base/current")"; fi
printf 'APP_ORIGIN=https://%s\nRELEASE_TAG=%s\n' "$hostname" "$release_id" > "$runtime"
chmod 600 "$runtime"
compose=(docker compose --project-name fullstack-toolkit --env-file "$runtime" -f "$release/docker/docker-compose.yml")
"${compose[@]}" config --quiet
# Build before stopping the current API. Preserve the previous immutable images.
"${compose[@]}" build api
"${compose[@]}" build migrate
"${compose[@]}" build web
schema_before=""
backup=""
if test -n "$previous"; then
  # Only auto-roll back code when migration directories are identical.
  schema_before="$(find "$previous/packages/db/prisma/migrations" -type f -exec sha256sum {} + | sed "s|$previous/||" | sort | sha256sum | cut -d' ' -f1)"
fi
schema_after="$(find "$release/packages/db/prisma/migrations" -type f -exec sha256sum {} + | sed "s|$release/||" | sort | sha256sum | cut -d' ' -f1)"
rollback() {
  echo 'Release failed. Source, immutable images and any volume backup are retained.'
  if test -n "$previous" && test "$schema_before" = "$schema_after"; then
    docker compose --project-name fullstack-toolkit --env-file "$base/shared/$(basename "$previous").env" -f "$previous/docker/docker-compose.yml" up -d --no-build api web || true
    echo 'Attempted compatible-schema application rollback.'
  else
    docker stop fullstack-toolkit-api-1 2>/dev/null || true
    echo "Schema compatibility is unconfirmed. Stop here and follow the restore runbook. Backup: $backup"
  fi
}
trap rollback ERR
if docker volume inspect fullstack-toolkit_toolkit-data >/dev/null 2>&1; then
  if docker inspect fullstack-toolkit-api-1 >/dev/null 2>&1; then
    docker stop fullstack-toolkit-api-1
  fi
  backup="$base/backups/before-$release_id.tgz"
  docker run --rm --user 0 --entrypoint tar -v fullstack-toolkit_toolkit-data:/data:ro -v "$base/backups:/backup" "fullstack-toolkit-api:$release_id" -czf "/backup/before-$release_id.tgz" -C /data .
fi
"${compose[@]}" up -d --no-build
for attempt in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:3181/api/ready >/dev/null && curl --fail --silent http://127.0.0.1:3180/ >/dev/null; then break; fi
  sleep 2
done
curl --fail --silent http://127.0.0.1:3181/api/ready
curl --fail --silent -o /dev/null http://127.0.0.1:3180/
curl --fail --silent "https://$hostname/api/ready"
curl --fail --silent -o /dev/null "https://$hostname/"
ln -sfn "$release" "$base/current"
trap - ERR
echo 'Release healthy on public HTTPS. Run the complete browser acceptance suite.'

