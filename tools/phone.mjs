// Headless "phone" for testing the web app without a device: drives Chromium over the DevTools
// protocol (touch emulation, taps, swipes, wheel, screenshots) and prints console lines matching
// STDB/DIAG/errors.
//
// Usage: node tools/phone.mjs <url> <outDir> <profileDir> <debugPort> step...
//   steps: wait:<ms>  shot:<name>  tap:<x>,<y>  click:<x>,<y>  swipe:<x1>,<y1>,<x2>,<y2>[,<moves>][,hold]
//          release  wheel:<x>,<y>,<deltaY>,<count>  cmds:<file>  (poll a file for more steps; "quit" ends)
//          tapsel:<css selector>  (tap the center of the first match)  type:<text>  (insert into the focused field)
//          key:<Enter|Shift+Enter|Backspace|...>  file:<css selector>,<path>  (set an <input type=file>)
//          reload
//   env:   W, H (viewport, default 390x844), DPR (default 2), DESKTOP=1 (no mobile emulation)
//   Use a fresh <profileDir> per simulated player (each gets its own SpacetimeDB identity).
// Example (phone, local server):
//   node tools/phone.mjs "http://127.0.0.1:5173/?server=ws://127.0.0.1:3001&db=hackathon-local" shots /tmp/p1 9301 wait:4000 shot:home
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const [url, outDir, profile, port, ...steps] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);

const chrome = spawn("chromium", [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--enable-gpu", "--ignore-gpu-blocklist",
  `--window-size=${W},${H}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  pending.set(msg.id, { resolve, reject });
  ws.send(JSON.stringify(msg));
});

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {}
  }
  ws = new WebSocket(target);
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    if (m.method === "Runtime.consoleAPICalled") {
      const text = m.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      if (/STDB|DIAG|rror|xception|HostBridge/.test(text)) console.log("console:", text.slice(0, 300));
    }
  });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Runtime.enable", {}, sessionId);
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: Number(process.env.DPR || 2), mobile: !process.env.DESKTOP }, sessionId);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId);
  await send("Page.navigate", { url }, sessionId);

  // "cmds:<file>" switches to interactive mode: poll <file> for new lines (steps), "quit" ends.
  async function* allSteps() {
    for (const step of steps) {
      if (!step.startsWith("cmds:")) { yield step; continue; }
      const file = step.slice(5);
      let done = 0;
      for (;;) {
        let lines = [];
        try { lines = readFileSync(file, "utf8").split("\n").filter(Boolean); } catch {}
        for (; done < lines.length; done++) {
          if (lines[done] === "quit") return;
          yield lines[done];
        }
        await sleep(250);
      }
    }
  }

  for await (const step of allSteps()) {
    const kind = step.slice(0, step.indexOf(":"));
    const arg = step.slice(step.indexOf(":") + 1);
    if (kind === "wait") await sleep(Number(arg));
    else if (kind === "release") { await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId); console.log("release"); }
    else if (kind === "wheel") {
      const [x, y, dy, n] = arg.split(",").map(Number);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId); await sleep(50);
      for (let i = 0; i < n; i++) { send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy }, sessionId); await sleep(16); }
      console.log("wheel:", arg);
    }
    else if (kind === "swipe") {
      const [x1, y1, x2, y2, n0] = arg.split(",").map(Number); const n = n0 || 12;
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1 }] }, sessionId);
      for (let i = 1; i <= n; i++) {
        await sleep(16);
        send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n }] }, sessionId);
      }
      if (!arg.endsWith(",hold")) await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
      console.log("swipe:", arg);
    }
    else if (kind === "shot") {
      const { data } = await send("Page.captureScreenshot", { format: "png" }, sessionId);
      writeFileSync(`${outDir}/${arg}.png`, Buffer.from(data, "base64"));
      console.log("shot:", `${outDir}/${arg}.png`);
    } else if (kind === "tap") {
      const [x, y] = arg.split(",").map(Number);
      const pt = [{ x, y }];
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt }, sessionId);
      await sleep(80);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
      console.log("tap:", x, y);
    } else if (kind === "click") {
      const [x, y] = arg.split(",").map(Number);
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }, sessionId);
      console.log("click:", x, y);
    } else if (kind === "tapsel") {
      const { result } = await send("Runtime.evaluate", { returnByValue: true, expression:
        `(() => { const r = document.querySelector(${JSON.stringify(arg)})?.getBoundingClientRect(); return r && [r.x + r.width / 2, r.y + r.height / 2]; })()` }, sessionId);
      if (!result.value) { console.log("tapsel: no match for", arg); continue; }
      const [x, y] = result.value;
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }, sessionId);
      await sleep(80);
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, sessionId);
      console.log("tapsel:", arg, Math.round(x), Math.round(y));
    } else if (step === "reload") {
      await send("Page.reload", {}, sessionId);
      console.log("reload");
    } else if (kind === "type") {
      await send("Input.insertText", { text: arg }, sessionId);
      console.log("type:", arg.slice(0, 60));
    } else if (kind === "key") {
      const shift = arg.startsWith("Shift+"), key = shift ? arg.slice(6) : arg;
      const codes = { Enter: 13, Backspace: 8, Escape: 27, Tab: 9 };
      const base = { key, code: key, windowsVirtualKeyCode: codes[key] ?? 0, modifiers: shift ? 8 : 0 };
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base }, sessionId);
      if (key === "Enter") await send("Input.dispatchKeyEvent", { type: "char", ...base, text: "\r" }, sessionId);
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...base }, sessionId);
      console.log("key:", arg);
    } else if (kind === "file") {
      const comma = arg.indexOf(","), selector = arg.slice(0, comma), path = arg.slice(comma + 1);
      const { root } = await send("DOM.getDocument", {}, sessionId);
      const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector }, sessionId);
      if (!nodeId) { console.log("file: no match for", selector); continue; }
      await send("DOM.setFileInputFiles", { nodeId, files: [path] }, sessionId);
      console.log("file:", selector, path);
    }
  }
} catch (e) {
  console.error("driver error:", e.message);
  process.exitCode = 1;
} finally {
  chrome.kill("SIGTERM");
  setTimeout(() => process.exit(), 300);
}
