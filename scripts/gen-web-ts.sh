#!/usr/bin/env bash
# Rebuild the TypeScript module (spacetimedb-ts/) and generate TypeScript client bindings from it.
# Usage: scripts/gen-web-ts.sh [out_dir]   (default: web/src/module_bindings)
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-web/src/module_bindings}"
[ -d spacetimedb-ts/node_modules ] || (cd spacetimedb-ts && npm ci --no-audit --no-fund)
spacetime build -p spacetimedb-ts
spacetime generate --no-config --lang typescript --out-dir "$out" -y -j spacetimedb-ts/dist/bundle.js
