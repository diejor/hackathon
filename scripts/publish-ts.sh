#!/usr/bin/env bash
# Build + publish the TypeScript module (spacetimedb-ts/) to the LOCAL server, db `safesense-local`.
# Usage: scripts/publish-ts.sh [-c]   (-c = wipe data; extra args go to `spacetime publish`)
# Override the target with STDB_TS_DB=<name> and/or STDB_TS_SERVER=<nickname|url> (default: local).
set -euo pipefail
cd "$(dirname "$0")/.."
# Secrets (AI_API_KEY, ...) from the gitignored .env; the CLI sends declared env vars to the database.
# Variables already exported in the shell win over .env (e.g. a one-off test DISCORD_PUBLIC_KEY).
if [ -f .env ]; then shell_env=$(export -p); set -a; . ./.env; set +a; eval "$shell_env"; fi
db="${STDB_TS_DB:-safesense-local}"
server="${STDB_TS_SERVER:-local}"
[ -d spacetimedb-ts/node_modules ] || (cd spacetimedb-ts && npm ci --no-audit --no-fund)
# --no-config: the repo's spacetime.json describes the C# module (hackathon-local), not this one.
spacetime build -p spacetimedb-ts
spacetime publish --no-config -s "$server" -y "$@" -j spacetimedb-ts/dist/bundle.js "$db"
