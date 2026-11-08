#!/usr/bin/env bash
# Build SafeSense (safesense/) against the Maincloud database and publish it to GitHub Pages at the site root,
# keeping the legacy Security Arcade under /arcade/ (copied from what's currently deployed on gh-pages).
# Usage: scripts/deploy-safesense.sh [--dry-run]
#   --dry-run  build and assemble only; print the folder instead of deploying
# Env: STDB_DB (default safesense-1aa18263), STDB_SERVER (default wss://maincloud.spacetimedb.com)
# This only touches the website. Publishing the backend is separate:
#   STDB_TS_SERVER=maincloud STDB_TS_DB=safesense-1aa18263 scripts/publish-ts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${STDB_DB:-safesense-1aa18263}"
SERVER="${STDB_SERVER:-wss://maincloud.spacetimedb.com}"
OUT="$(mktemp -d)"

(cd safesense && [ -d node_modules ] || npm ci --no-audit --no-fund)
(cd safesense && VITE_STDB_SERVER="$SERVER" VITE_STDB_DB="$DB" npm run build >/dev/null)
cp -r safesense/dist/. "$OUT"/

# Keep the arcade: take it from the live gh-pages branch (it lives under arcade/ since the first SafeSense deploy).
git fetch -q origin gh-pages
mkdir -p "$OUT/arcade"
git archive origin/gh-pages arcade | tar -x -C "$OUT"

# Sanity checks before anything goes live.
[ -f "$OUT/index.html" ] || { echo "missing index.html"; exit 1; }
[ -f "$OUT/arcade/index.html" ] || { echo "missing arcade/index.html"; exit 1; }
grep -q "$DB" "$OUT"/assets/*.js || { echo "build does not reference db $DB"; exit 1; }
grep -q '<title>SafeSense' "$OUT/index.html" || { echo "index.html is not SafeSense"; exit 1; }

if [ "${1:-}" = "--dry-run" ]; then echo "Assembled (not deployed): $OUT"; exit 0; fi
scripts/deploy-pages.sh "$OUT"
rm -rf "$OUT"
