#!/usr/bin/env bash
# Serve the WebGL build locally at http://localhost:8080
set -euo pipefail
cd "$(dirname "$0")/../client/Builds/WebGL"
exec python3 -m http.server 8080 --bind 127.0.0.1
