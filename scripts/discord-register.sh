#!/usr/bin/env bash
# Register (bulk-overwrite) the Help Bot's global Discord commands: /check, /link, /unlink and the
# message context-menu command "Check with Help Bot" (server side: spacetimedb/Discord.cs).
# Reads DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN from .env (the token is used only here: it is
# not declared in the module's EnvironmentSchema, so the publish scripts never send it to the database).
# Usage: scripts/discord-register.sh [--dry-run]   (--dry-run prints the JSON and sends nothing)
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
API="https://discord.com/api/v10"

# integration_types: 0 = installed to a server, 1 = installed to a user account.
# contexts: 0 = server channels, 1 = DMs with the app, 2 = group DMs / other DMs (user installs).
read -r -d '' COMMANDS <<'JSON' || true
[
  {
    "name": "check", "type": 1,
    "description": "Is this a scam? Check a message, link or screenshot (only you see the answer)",
    "integration_types": [0, 1], "contexts": [0, 1, 2],
    "options": [
      { "name": "message", "type": 3, "required": false, "max_length": 4000,
        "description": "Paste the text, email or link you're unsure about" },
      { "name": "screenshot", "type": 11, "required": false,
        "description": "A screenshot of the message (PNG, JPEG or WebP)" }
    ]
  },
  {
    "name": "Check with Help Bot", "type": 3,
    "integration_types": [0, 1], "contexts": [0, 1, 2]
  },
  {
    "name": "link", "type": 1,
    "description": "Link Discord to your Security Arcade account",
    "integration_types": [0, 1], "contexts": [0, 1, 2],
    "options": [
      { "name": "code", "type": 3, "required": true, "min_length": 6, "max_length": 12,
        "description": "The code from Help Bot → ⋯ → Link Discord in the app" }
    ]
  },
  {
    "name": "unlink", "type": 1,
    "description": "Unlink Discord from your Security Arcade account",
    "integration_types": [0, 1], "contexts": [0, 1, 2]
  }
]
JSON

if [ "${1:-}" = "--dry-run" ]; then printf '%s\n' "$COMMANDS"; exit 0; fi

: "${DISCORD_APPLICATION_ID:?set DISCORD_APPLICATION_ID in .env}"
if [ -z "${DISCORD_BOT_TOKEN:-}" ]; then echo "set DISCORD_BOT_TOKEN in .env (Developer Portal → Bot → Reset Token)" >&2; exit 1; fi
case "$DISCORD_APPLICATION_ID" in *[!0-9]*) echo "DISCORD_APPLICATION_ID must be numeric" >&2; exit 1;; esac

# The token goes to curl through a header file on a pipe (printf is a builtin), so it never shows up in
# the process list or the terminal.
out=$(mktemp); trap 'rm -f "$out"' EXIT
status=$(printf '%s' "$COMMANDS" | curl -sS -o "$out" -w '%{http_code}' -X PUT \
  "$API/applications/$DISCORD_APPLICATION_ID/commands" \
  -H @<(printf 'Authorization: Bot %s\n' "$DISCORD_BOT_TOKEN") \
  -H 'Content-Type: application/json' --data-binary @-)
if [ "$status" != 200 ]; then echo "Discord answered HTTP $status:" >&2; cat "$out" >&2; echo >&2; exit 1; fi

echo "Registered $(grep -o '"application_id"' "$out" | wc -l) commands: /check, /link, /unlink, \"Check with Help Bot\" (message menu)."
echo "Global commands can take a minute to show up (restart Discord if they don't)."
echo
echo "Install link (server or user install, per the portal's Installation settings):"
echo "  https://discord.com/oauth2/authorize?client_id=$DISCORD_APPLICATION_ID"
echo "Put it in web/src/bot/config.ts as DISCORD_INSTALL_URL to show \"Link Discord\" in the web chat."
