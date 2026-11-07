#!/usr/bin/env bash
# Rebuild module and regenerate C# client bindings into the Unity project.
set -euo pipefail
cd "$(dirname "$0")/.."
export DOTNET_ROOT="$HOME/.dotnet" PATH="$HOME/.dotnet:$PATH"
(cd spacetimedb && dotnet publish -c Release -v quiet -nologo)
spacetime generate --lang csharp --out-dir client/Assets/autogen -y \
  -b spacetimedb/bin/Release/net8.0/wasi-wasm/AppBundle/StdbModule.wasm
