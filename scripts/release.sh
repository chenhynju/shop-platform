#!/usr/bin/env bash
# Operator-provisioned environment; never overwrites database credentials.
set -euo pipefail
release_id="${1:?release id required}"
hostname="${2:?hostname required}"
[[ "$release_id" =~ ^[a-zA-Z0-9-]+$ ]] && [[ "$hostname" =~ ^[a-zA-Z0-9.-]+$ ]]
base=/opt/shop-platform
release="$base/releases/$release_id"
runtime="$base/shared/runtime.env"
test -f "$runtime" || { echo "Provision $runtime with POSTGRES_PASSWORD, DATABASE_URL and APP_ORIGIN first."; exit 1; }
test ! -e "$release"
install -d -m 700 "$base/releases" "$base/backups" "$base/shared/reports"
mkdir "$release"
tar -xzf "/tmp/shop-$release_id.tgz" -C "$release"
export RELEASE_TAG="$release_id"
compose=(docker compose --project-name shop-platform --env-file "$runtime" -f "$release/docker/compose.prod.yml")
"${compose[@]}" config --quiet
# Validate origin without logging secrets or the expanded configuration.
"${compose[@]}" config --format json | python3 -c 'import json,sys; c=json.load(sys.stdin); assert c["services"]["api"]["environment"]["APP_ORIGIN"] == "https://"+sys.argv[1], "APP_ORIGIN does not match hostname"' "$hostname"
# Finish all builds before touching running services.
"${compose[@]}" build api
"${compose[@]}" build migrate
"${compose[@]}" build web
if "${compose[@]}" ps --status running --services | grep -qx postgres; then
  umask 077
  "${compose[@]}" exec -T postgres pg_dump -U postgres -d shop -Fc > "$base/backups/before-$release_id.dump"
  test -s "$base/backups/before-$release_id.dump"
fi
echo 'Applying shop release; preserve state and inspect logs before any rollback.'
"${compose[@]}" up -d --wait postgres redis
"${compose[@]}" up --no-deps --force-recreate --exit-code-from migrate migrate
"${compose[@]}" up -d --no-build api web
for attempt in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:3281/api/ready >/dev/null && curl --fail --silent http://127.0.0.1:3280/shop >/dev/null; then break; fi
  sleep 2
done
curl --fail --silent http://127.0.0.1:3281/api/ready
curl --fail --silent -o /dev/null http://127.0.0.1:3280/shop
curl --fail --silent "https://$hostname/api/ready"
curl --fail --silent "https://$hostname/api/shop/products" > "$base/shared/reports/$release_id-products.json"
curl --fail --silent -o /dev/null "https://$hostname/shop"
ln -sfn "$release" "$base/current"
echo 'Shop HTTPS readiness passed. Run authenticated browser acceptance separately.'
