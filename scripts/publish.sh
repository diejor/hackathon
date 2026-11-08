#!/usr/bin/env bash
# Build + publish the SpacetimeDB module, skipping system wasm-opt (v133 emits
# wasm the spacetime CLI can't parse). Usage: scripts/publish.sh [-c]  (-c = wipe data)
set -euo pipefail
cd "$(dirname "$0")/.."
# Secrets (AI_API_KEY, ...) from the gitignored .env; the CLI sends declared env vars to the database.
# Variables already exported in the shell win over .env (e.g. a one-off test DISCORD_PUBLIC_KEY).
if [ -f .env ]; then shell_env=$(export -p); set -a; . ./.env; set +a; eval "$shell_env"; fi
export DOTNET_ROOT="$HOME/.dotnet" PATH="$HOME/.dotnet:$PATH"
(cd spacetimedb && dotnet publish -c Release -v quiet -nologo)
spacetime publish -s local -y "$@" -b spacetimedb/bin/Release/net8.0/wasi-wasm/AppBundle/StdbModule.wasm hackathon-local
