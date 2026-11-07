#!/usr/bin/env bash
# Publish a WebGL build to GitHub Pages (gh-pages branch) -> https://diejor.github.io/hackathon/
# Usage: scripts/deploy-pages.sh [build-dir]   (default: client/Builds/WebGL, from Hackathon > Build WebGL)
# The gh-pages branch only ever holds the latest build (force-pushed, single commit).
set -euo pipefail
cd "$(dirname "$0")/.."
BUILD="${1:-client/Builds/WebGL}"
[ -f "$BUILD/index.html" ] || { echo "No WebGL build at $BUILD (run Hackathon > Build WebGL first)"; exit 1; }
REMOTE="$(git remote get-url origin)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp -r "$BUILD"/. "$TMP"/
touch "$TMP/.nojekyll" # serve files as-is
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" \
  commit -qm "Deploy WebGL build $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE" gh-pages
echo "Deployed. Live in ~1 min at https://diejor.github.io/hackathon/"
