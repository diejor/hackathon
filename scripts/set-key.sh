#!/usr/bin/env bash
# Store an API key in the gitignored .env without echoing it (hidden prompt, file mode 600).
# Usage: scripts/set-key.sh [VAR_NAME]   (default: AI_API_KEY)
set -euo pipefail
cd "$(dirname "$0")/.."
var="${1:-AI_API_KEY}"
read -rsp "$var: " value; echo
[ -n "$value" ] || { echo "Empty value, nothing saved."; exit 1; }
umask 077
{ grep -v "^${var}=" .env 2>/dev/null || true; printf '%s=%s\n' "$var" "$value"; } > .env.tmp
mv .env.tmp .env
chmod 600 .env
echo "Saved $var to .env"
