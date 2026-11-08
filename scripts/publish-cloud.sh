#!/usr/bin/env bash
# Build + publish the module to SpacetimeDB Maincloud (needs `spacetime login` once).
# Usage: scripts/publish-cloud.sh [-c]      (-c = wipe cloud data on breaking schema changes)
# Override the database name with STDB_CLOUD_DB=name scripts/publish-cloud.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${STDB_CLOUD_DB:-hackathon-1aa18263}"
# Secrets (NVIDIA_API_KEY, ...) from the gitignored .env; the CLI sends declared env vars to the database.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export DOTNET_ROOT="$HOME/.dotnet" PATH="$HOME/.dotnet:$PATH"
(cd spacetimedb && dotnet publish -c Release -v quiet -nologo)
spacetime publish -s maincloud --yes=remote "$@" -b spacetimedb/bin/Release/net8.0/wasi-wasm/AppBundle/StdbModule.wasm "$DB"
echo
echo "Published to Maincloud as '$DB'."
echo "  Unity GameManager:  serverUri = wss://maincloud.spacetimedb.com   databaseName = $DB"
echo "  WebGL URL suffix:   ?server=wss://maincloud.spacetimedb.com&db=$DB"
echo "  Logs:               spacetime logs -s maincloud $DB"
