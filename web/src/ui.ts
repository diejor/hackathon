// Lobby screens as plain DOM. render() rebuilds #screen from lobby state on every change.
import QRCode from "qrcode";
import * as L from "./lobby";
import { openBot } from "./bot/nav";

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; onclick?: (e: MouseEvent) => void };

export function h(tag: string, props: Props | null = null, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "class") el.className = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const btn = (label: string, onclick: () => void, opts: { variant?: "primary" | "secondary" | "ghost"; small?: boolean; disabled?: boolean } = {}) =>
  h("button", { class: `btn btn-${opts.variant ?? "primary"}${opts.small ? " btn-small" : ""}`, disabled: opts.disabled, onclick }, label);

// ---------- Screens ----------

function connecting() {
  return h("div", { class: "screen center" },
    h("div", { class: "spinner" }),
    h("p", { class: "muted" }, L.state.connectError ? "Reconnecting…" : "Connecting…"));
}

function home() {
  const busy = L.state.busy !== null;
  return h("div", { class: "screen" },
    h("div", { class: "hero" },
      h("h1", null, "Play security games with friends"),
      h("p", { class: "muted" }, "Create a room and share the code or QR, or join a friend's room.")),
    h("div", { class: "card name-card" },
      h("div", { class: "label-small" }, "PLAYING AS"),
      h("div", { class: "row" },
        h("div", { class: "name grow" }, L.state.myName),
        btn("New name", L.rerollName, { variant: "ghost", small: true }))),
    h("div", { class: "stack" },
      btn(L.state.busy === "create" ? "Creating…" : "Create room", L.createRoom, { disabled: busy }),
      btn("Join with code", L.openJoin, { variant: "secondary", disabled: busy })),
    h("p", { class: "hint" }, "Got a QR? Just scan it with your camera."),
    h("button", { class: "card bot-entry", onclick: openBot },
      h("div", { class: "bot-entry-title" }, "Help Bot"),
      h("div", { class: "bot-entry-sub" }, "Got a weird text, email or link? Ask if it's a scam.")));
}

function join() {
  const code = L.state.typedCode;
  const busy = L.state.busy === "join";
  const slots = Array.from({ length: L.CODE_LENGTH }, (_, i) =>
    h("div", { class: `code-slot${i < code.length ? " filled" : ""}${i === code.length ? " active" : ""}` }, code[i] ?? ""));
  const keys = [...L.CODE_ALPHABET].map((c) =>
    h("button", { class: "key", disabled: busy || code.length >= L.CODE_LENGTH, onclick: () => L.typeChar(c) }, c));
  keys.push(h("button", { class: "key key-wide", disabled: busy || code.length === 0, onclick: L.backspace }, "DEL"));
  return h("div", { class: "screen" },
    h("div", { class: "row" }, btn("Back", L.backHome, { variant: "ghost", small: true })),
    h("h2", null, busy ? "Joining…" : "Enter room code"),
    h("div", { class: "code-slots" }, slots),
    h("div", { class: "keypad" }, keys));
}

function roomScreen() {
  const room = L.myRoom()!;
  const ms = L.members();
  const host = L.isHost();
  const me = L.me();

  const qr = h("canvas", { class: "qr", "aria-label": `QR code to join room ${room.code}` }) as HTMLCanvasElement;
  QRCode.toCanvas(qr, L.joinLink(room.code), { margin: 2, scale: 8, color: { dark: "#141418", light: "#ffffff" } })
    .catch((e: unknown) => console.error("QR", e));

  const list = ms.map((m) => {
    const tags = [m.identity.isEqual(room.host) ? "HOST" : "", m.online ? "" : "OFFLINE"].filter(Boolean).join(" · ");
    const mine = L.isMe(m.identity);
    return h("div", { class: `member${mine ? " me" : ""}` },
      h("span", { class: `seat-dot seat-${m.seat % 8}` }),
      h("div", { class: "grow" },
        h("div", { class: "member-name" }, mine ? `${m.name} (you)` : m.name),
        tags ? h("div", { class: "member-tags" }, tags) : null),
      h("span", { class: `ready-pill${m.ready ? " on" : ""}` }, m.ready ? "READY" : "…"));
  });

  const games = L.GAMES.map((g) =>
    h("button", { class: `game-card${room.game === g.id ? " selected" : ""}`, disabled: !host, onclick: () => L.chooseGame(g.id) },
      h("div", { class: "grow" }, h("div", { class: "game-title" }, g.title), h("div", { class: "game-blurb" }, g.blurb)),
      h("span", { class: `radio${room.game === g.id ? " on" : ""}` })));

  const ready = ms.filter((m) => m.ready).length;
  const hint =
    ms.length < L.MIN_PLAYERS ? "Waiting for another player to join…"
    : room.game === "" ? (host ? "Pick a game" : "Host is picking a game…")
    : ready < ms.length ? `${ready}/${ms.length} ready`
    : host ? "Everyone's ready!" : "Waiting for host to start…";

  return h("div", { class: "screen" },
    h("div", { class: "row" }, btn("Leave room", L.leaveRoom, { variant: "ghost", small: true })),
    h("div", { class: "card share-card" },
      h("div", { class: "label-small" }, "ROOM CODE"),
      h("div", { class: "room-code" }, room.code),
      qr,
      h("p", { class: "hint" }, "Friends scan this or enter the code")),
    h("div", { class: "section-title" }, `PLAYERS · ${ms.length}`),
    h("div", null, list),
    h("div", { class: "section-title" }, host ? "PICK A GAME" : "GAME"),
    h("div", null, games),
    h("div", { class: "footer" },
      h("p", { class: "hint" }, hint),
      h("div", { class: "stack" },
        btn(me?.ready ? "Not ready" : "I'm ready", L.toggleReady, { variant: me?.ready ? "secondary" : "primary" }),
        host ? btn("Start game", L.startGame, { disabled: !L.canStart() }) : null)));
}

function playingBar() {
  const room = L.myRoom()!;
  const title = L.gameById(room.game)?.title ?? room.game;
  return h("div", { class: "play-bar" },
    h("div", { class: "grow" }, h("div", { class: "label-small" }, `ROOM ${room.code}`), h("div", { class: "play-title" }, title)),
    L.isHost() ? btn("Lobby", L.returnToLobby, { variant: "secondary", small: true }) : null);
}

// ---------- Root ----------

export function render(root: { screen: HTMLElement; toast: HTMLElement }) {
  const s = L.screen();
  const view = s === "home" ? home() : s === "join" ? join() : s === "room" ? roomScreen() : s === "playing" ? playingBar() : connecting();
  root.screen.replaceChildren(view);
  root.screen.dataset.screen = s;
  root.toast.textContent = L.state.error ?? "";
  root.toast.hidden = !L.state.error;
}
