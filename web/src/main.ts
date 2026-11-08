import "./style.css";
import "./bot/bot.css";
import * as L from "./lobby";
import { h, render } from "./ui";
import type { GameHandle } from "./games/types";
import { isBotOpen, onNav, closeBot } from "./bot/nav";
import { mountChat, type ChatView } from "./bot/chat";

const screenEl = h("main", { class: "screen-host" });
const gameEl = h("div", { class: "game-host", hidden: true });
const toastEl = h("div", { class: "toast", role: "status", hidden: true });

document.getElementById("app")!.replaceChildren(
  h("header", { class: "header" }, h("span", { class: "brand-mark" }), h("span", { class: "brand" }, "SECURITY ARCADE")),
  screenEl,
  gameEl,
  toastEl,
);

// The game canvas lives outside the re-rendered area. Phaser is loaded only when a game starts,
// so the lobby stays small and fast on phones.
let game: GameHandle | null = null;
let gameId: string | null = null;

async function syncGame() {
  const room = L.myRoom();
  const want = L.screen() === "playing" && room ? room.game : null;
  if (want === gameId) return;
  game?.destroy();
  game = null;
  gameId = want;
  gameEl.hidden = !want;
  document.body.classList.toggle("playing", !!want);
  if (!want) return;
  const { mountGame } = await import("./games");
  if (gameId !== want) return; // changed while loading
  game = mountGame(want, gameEl);
}

// Help Bot (#bot): a persistent chat view that replaces the lobby screen while open; it updates
// itself from the bot store, so the lobby's re-render doesn't touch it.
let chat: ChatView | null = null;

function update() {
  const bot = isBotOpen();
  document.body.classList.toggle("bot-open", bot);
  if (bot) {
    chat ??= mountChat({ onBack: closeBot });
    if (screenEl.firstChild !== chat.el) screenEl.replaceChildren(chat.el);
    screenEl.dataset.screen = "bot";
  } else {
    if (chat) { chat.destroy(); chat = null; }
    render({ screen: screenEl, toast: toastEl });
  }
  void syncGame();
}

L.onChange(update);
onNav(update);
update();
L.connect();

// Desktop: type the room code on a keyboard.
window.addEventListener("keydown", (e) => {
  if (isBotOpen() || L.screen() !== "join" || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Backspace") L.backspace();
  else if (e.key === "Escape") L.backHome();
  else if (e.key.length === 1) L.typeChar(e.key);
});
