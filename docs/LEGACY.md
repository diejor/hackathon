# Legacy: Security Arcade, Help Bot (C#) and the Unity client

These are the developer notes from before SafeSense. They describe code that is still in this repo
(the `spacetimedb/` C# module, the arcade UI in `web/`, the Unity client in `client/`) and the old demo
that is still running (Maincloud db `hackathon-1aa18263`, arcade at https://diejor.github.io/hackathon/arcade/).

SafeSense runs on the TypeScript port in `spacetimedb-ts/`. It keeps the same table, view, reducer and
route names, so most of the Help Bot notes below apply to it too; only the file names differ
(`Bot.cs` → `bot.ts`, `Activity.cs` → `activity.ts`, `Photon.cs` → `photon.ts`, `Discord.cs` → `discord.ts`,
`Ed25519.cs`/`Sha256.cs` → `crypto.ts`). Back to the main [README](../README.md).

## Security Arcade

Phone-first multiplayer security games (T-Mobile security hackathon). A web app (Vite + TypeScript,
games in [Phaser](https://phaser.io/)) on a SpacetimeDB backend. Players get together Kahoot-style:
one creates a room, others scan its QR code or type the 4-character code, then they play real-time
mini-games.

### Quick start (web)

```sh
cd web && npm install
npm run dev                      # http://127.0.0.1:5173 (uses the shared Maincloud db)
# against a local server:        http://127.0.0.1:5173/?server=ws://127.0.0.1:3001&db=hackathon-local
```

Careful: `scripts/deploy-pages.sh` with **no argument** builds `web/` and force-pushes it to the root of
GitHub Pages, which would replace SafeSense. Deploy an assembled folder instead (see the main README).

### How it fits together

- `spacetimedb/Lib.cs`: server lobby (rooms, members, ready-up, host picks a game, start).
  Games add their own tables keyed by `RoomId`.
- `web/src/lobby.ts`: client state + actions (connection, views, reducers).
- `web/src/ui.ts`: lobby screens (plain DOM). `web/src/style.css`: magenta phone-first styles.
- `web/src/games/`: Phaser games, loaded only when a game starts (keeps the lobby ~45 KB gzipped).
  Register a scene in `games/index.ts` under the same id as in `GAMES` (`lobby.ts`).
- `web/src/module_bindings/`: generated; regenerate with `scripts/gen-web.sh` (C#) or `scripts/gen-web-ts.sh` (TS) after server changes.
- `client/`: the earlier Unity 6.3 + Rish client (same server, kept for reference).

#### Security model
- Room/member tables are **private**; clients only see their own room via per-user **views**
  (`my_room`, `my_room_members`), so you can't list rooms or scrape codes.
- Joining needs the code; **failed join attempts are rate-limited** per identity (8/min).
- All authorization uses `ctx.Sender`; the scheduled cleanup reducer refuses client calls.
- Embedding: the game only talks to its parent page when the iframe URL names it exactly
  (`?parentOrigin=https://host.example`); no `*` origins in either direction.

## Help Bot (scam checker + coach)

In the arcade, open the chat from the home-screen card or with `#bot` in the URL (add `demo=1` for a "Load demo game history" button).
Code: `spacetimedb/Bot.cs`, `spacetimedb/Activity.cs`, `web/src/bot/` (SafeSense reuses `web/src/bot/` as its data layer).

**Games: log what the player did** so the bot can coach them. Call the reducer `log_activity(game, kind, details)`:
- `game`, `kind`: slugs (`a-z 0-9 - _`, ≤ 32 chars), e.g. `scam-or-not`. Recommended kinds: `answer_correct`, `answer_wrong`, `round_done`.
- `details`: short JSON text (≤ 500 chars), e.g. `{"item":"usps-sms","tactic":"urgency","chose":"friend"}`. Include `tactic` on answers: the bot counts missed tactics.
- Owner and time come from the server (`ctx.Sender`, `ctx.Timestamp`). The last 200 events per player are kept.

```ts
conn.reducers.logActivity({ game: "friend-or-fraud", kind: "answer_wrong",
  details: JSON.stringify({ item: "usps-sms", tactic: "fake-delivery", chose: "friend" }) });
```

`web/src/bot/bot.ts` API:
- `onChange(fn)`: re-render on any change; `ready()`: connected and subscribed.
- `messages()`, `facts()`, `activity()`: the player's chat, remembered facts, game events (oldest first).
- `send(text, image?)`: ask the bot (`bot_send`); `state.sending` / `state.error` show progress.
- `forgetMe()`: delete everything; `seedDemo()`: replace the player's demo game history (~15 events).

**iMessage (Photon Beta):** the module serves a signed webhook at `/v1/database/<db>/route/photon`
(env `PHOTON_WEBHOOK_SECRET`, `PHOTON_API_KEY`, optional `PHOTON_PROJECT_ID`, `PHOTON_BASE_URL`; see `.env.example`).
It runs the same bot pipeline as the web and replies in plain text. Senders get their own pseudo identity until they text
`LINK <code>`; after that, their chats share the player's history and show up in the web chat as "via iMessage".
Other commands: `UNLINK`, `FORGET ME`. Set the bot's number in `web/src/bot/config.ts` (`BOT_IMESSAGE_ADDRESS`).
Setup and testing: [`PHOTON.md`](PHOTON.md).

**Discord (HTTP interactions, not part of the SafeSense demo):** the module serves the app's Interactions Endpoint at
`/v1/database/<db>/route/discord` (env `DISCORD_PUBLIC_KEY`, optional `DISCORD_APPLICATION_ID`, `DISCORD_API_BASE`).
Every request's Ed25519 signature is checked (C#: `spacetimedb/Ed25519.cs`, pure C#, ~70 ms; TS: `@noble/curves`).
Commands: `/check message: screenshot:`, the message menu **Apps → Check with Help Bot**, `/link <code>` and `/unlink`.
Checks are deferred: a scheduled procedure runs the bot and edits in one ephemeral embed (verdict, red flags, what to do;
no clickable links). Register the commands with `scripts/discord-register.sh` (needs `DISCORD_BOT_TOKEN` in `.env`;
the token is never sent to the database) and set `DISCORD_INSTALL_URL` in `web/src/bot/config.ts`.

**Privacy:** chat messages, memory facts and game activity live in private tables; each player sees only their own
rows through per-user views (`my_messages`, `my_facts`, `my_activity`), and screenshots are never stored.
"Forget me" deletes the player's messages, facts and game activity.

## Setup notes (C# module and Unity)

- **Layout:** `spacetimedb/` = SpacetimeDB C# server module (.NET 8 + `wasi-experimental` workload). `client/` = Unity 6000.3.28f1 project (WebGL target).
- **Shared server:** Maincloud db `hackathon-1aa18263` (`wss://maincloud.spacetimedb.com`), the default in `GameManager.cs`. Only one person should publish to it at a time; `-c` wipes data for everyone.
- **Local server:** `127.0.0.1:3001`, db `hackathon-local`. Run `spacetime start --listen-addr 127.0.0.1:3001` (or point your `local` nickname elsewhere with `spacetime server edit local --url ...`).
- **Scripts:** `scripts/publish.sh` (local), `scripts/publish-cloud.sh` (Maincloud), `scripts/gen-unity.sh` (regenerate C# bindings into `client/Assets/autogen`), `scripts/gen-web.sh` (TS bindings for `web/`), `scripts/serve-webgl.sh` (serve a WebGL build on :8081). They publish the *unoptimized* wasm via `-b` because some `wasm-opt` versions (binaryen v133) emit wasm the spacetime CLI can't parse ("invalid leading byte (0x7f) for external kind"). They expect .NET in `~/.dotnet`; edit `DOTNET_ROOT` if yours is elsewhere.
- **After changing tables/reducers:** publish (local and/or cloud), then `scripts/gen-web.sh` (and `scripts/gen-unity.sh` if you still use the Unity client).
- **Scene:** `Assets/Scenes/Main.unity` is generated by **Hackathon → Rebuild Main Scene** (also sets the WebGL template, build scene list, product name). Re-run it rather than hand-editing the scene.
- **WebGL:** **Hackathon → Build WebGL** → `client/Builds/WebGL` (uses the phone-friendly `Assets/WebGLTemplates/Mobile` template). Test locally with `scripts/serve-webgl.sh` and open `http://localhost:8081/?server=ws://127.0.0.1:3001&db=hackathon-local`.
- **URL parameters:** `room` (auto-join, used by the QR), `name`, `server`, `db`, `joinUrl` (base URL put in QR codes, e.g. your embedding page), `parentOrigin` (enables the iframe bridge).
- **Names:** server reducers/tables are snake_cased: `JoinRoom` → `join_room`, `RoomMember` → `room_member` (for `spacetime call`/`sql`).
- **Editor automation (optional):** MCP for Unity (`com.coplaydev.unity-mcp` v10.3.0). In Unity: Ctrl+Shift+M → Transport "HTTP Local" → Start Server; point your MCP client at `http://127.0.0.1:8080/mcp` (e.g. `claude mcp add --transport http UnityMCP http://127.0.0.1:8080/mcp`). Unity doesn't always notice outside file edits on Linux; refresh assets via MCP (or Ctrl+R).

## Unity/Rish gotchas we hit (legacy client)

- Rish elements **ignore pointer input unless an ancestor sets `--pointer-detection: rect`** in USS
  (see the top of `app.uss`). A native (non-Rish) UI Toolkit element in between breaks inheritance.
- Don't use UI Toolkit's `ScrollView` on WebGL: trackpad ticks jump ~100px, the wheel overshoots and
  snaps back, and drags hitch when they start on a button. Use our `Scroller` (`Components.cs`) inside
  a `overflow: hidden` viewport instead.
- Pass callbacks to `AbstractButton` as `Action`s (cast method groups: `(Action)Press`).
- `Label`/`StyleBackground` clash between `RishUI` and `UnityEngine.UIElements`; alias them.
- `link.xml` keeps Rish/Roots/Sappy and `UnityEngine.UIElementsModule` from being stripped (Rish reflects into UI Toolkit internals).
- Roots' editor code needs `com.unity.collab-proxy` (for `Unity.Plastic.Newtonsoft.Json`).
