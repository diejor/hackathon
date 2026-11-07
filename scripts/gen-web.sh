#!/usr/bin/env bash
# Rebuild the module and regenerate TypeScript bindings for the web app (web/src/module_bindings).
set -euo pipefail
cd "$(dirname "$0")/.."
export DOTNET_ROOT="$HOME/.dotnet" PATH="$HOME/.dotnet:$PATH"
(cd spacetimedb && dotnet publish -c Release -v quiet -nologo)
spacetime generate --lang typescript --out-dir web/src/module_bindings -y \
  -b spacetimedb/bin/Release/net8.0/wasi-wasm/AppBundle/StdbModule.wasm
