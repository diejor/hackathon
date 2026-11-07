# Hackathon

Unity 6.3 + SpacetimeDB multiplayer game.

## Setup notes

- **Layout:** `spacetimedb/` = SpacetimeDB C# server module (.NET 8 + `wasi-experimental` workload). `client/` = Unity 6000.3.28f1 project (WebGL target).
- **Shared server:** Maincloud db `hackathon-1aa18263` (`wss://maincloud.spacetimedb.com`). This is the default in `client/Assets/Scripts/GameManager.cs`. Only one person should publish to it at a time; `-c` wipes data for everyone.
- **Scripts:** `scripts/publish.sh` (local), `scripts/publish-cloud.sh` (Maincloud), `scripts/gen-unity.sh` (regenerate C# bindings into `client/Assets/autogen`), `scripts/serve-webgl.sh` (serve a WebGL build on :8081). The scripts publish the *unoptimized* wasm via `-b` because some `wasm-opt` versions (binaryen v133) emit wasm the spacetime CLI can't parse. They expect .NET in `~/.dotnet` — edit `DOTNET_ROOT` if yours is elsewhere.
- **Local server:** the scripts' `local` server is `127.0.0.1:3001` (port 3000 was taken on one machine). Either run `spacetime start --listen-addr 127.0.0.1:3001` or point your `local` nickname elsewhere (`spacetime server edit local --url ...`).
- **After changing tables/reducers:** publish (local and/or cloud), then `scripts/gen-unity.sh`, then refresh Unity (Ctrl+R — Unity on Linux often misses outside edits).
- **Unity client:** `GameManager` auto-spawns on Play and adds the required `SpacetimeDBNetworkManager`. Place one in a scene to override `serverUri`/`databaseName` in the Inspector. WebGL builds also accept `?server=...&db=...` in the URL. Build via the menu **Hackathon → Build WebGL**.
- **Names:** server reducers/tables are snake_cased: `Add` → `add`, `Person` → `person` (for `spacetime call`/`sql`).
- **Editor automation (optional):** MCP for Unity (`com.coplaydev.unity-mcp` v10.3.0). In Unity: Ctrl+Shift+M → Transport "HTTP Local" → Start Server; point your MCP client at `http://127.0.0.1:8080/mcp` (e.g. `claude mcp add --transport http UnityMCP http://127.0.0.1:8080/mcp`).
