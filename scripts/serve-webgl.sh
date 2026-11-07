#!/usr/bin/env bash
# Serve the WebGL build locally at http://localhost:8081
set -euo pipefail
cd "$(dirname "$0")/../client/Builds/WebGL"
exec python3 -m http.server 8081 --bind 127.0.0.1
