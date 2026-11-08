// Help Bot chat screen: bare DOM built with h(), styled by the "Help Bot" section of style.css
// (all classes bot-*). The view is mounted once and updates its parts in place, so the composer
// keeps focus and its draft. All message text goes through textContent (h() children are text
// nodes): model output and pasted scam texts are untrusted, and URLs are deliberately not linkified.
import { h } from "../ui";
import * as Bot from "./bot";
import { BOT_IMESSAGE_ADDRESS, CHANNEL_LABELS, DISCORD_INSTALL_URL } from "./config";
import { createDictation, voiceSupported } from "./voice";

const VERDICTS: Record<string, string> = { scam: "Scam", suspicious: "Suspicious", likely_safe: "Likely safe" };

const EXAMPLES = [
  { label: "A text says USPS is holding my package", text: "I got this text: \"USPS: Your package is on hold due to an unpaid fee of $1.99. Pay within 24h: https://usps-redelivery-help.top/pay\" Is it real?" },
  { label: "Is this link safe?", text: "Is this link safe? https://paypa1-account-verify.com/login" },
  { label: "How do I set up 2FA?", text: "How do I set up two-factor authentication on my accounts?" },
];

const HOW_AM_I_DOING = { label: "How am I doing?", text: "How am I doing in the games? What should I practice?" };
const PLACEHOLDER = "Ask or paste…";
const CHECK_HINT = "Paste the text, email or link…";
const DEMO = new URLSearchParams(location.search).get("demo") === "1"; // ?demo=1 shows "Load demo game history"

export interface ChatView { el: HTMLElement; destroy(): void }

export function mountChat(opts: { onBack: () => void }): ChatView {
  // The attached screenshot is converted as soon as it's picked or pasted, so `image` is the exact JPEG
  // data URL that will be sent (and the preview shows it). Phones can hand out files that later become
  // unreadable or that the browser can't decode (HEIC), so problems surface right away, not on Send.
  let image: string | null = null;
  let preparing = false;
  let imageFailed = false; // last attach failed: the preview area says so (the reason is in the error line)
  let imageSeq = 0; // drops a conversion that finished after a newer pick/remove
  let confirming = false;
  let menuOpen = false;
  let linking: "imessage" | "discord" | null = null; // "Link iMessage" / "Link Discord" panel open
  let linkTimer: ReturnType<typeof setInterval> | null = null;
  let lastCount = -1;
  let seeding = false;
  let hint = false; // "Check a message" chip: textarea shows CHECK_HINT until the next send

  // ---------- Top bar (⋯ menu: Link iMessage, Link Discord, Forget me) + panels ----------
  const menuBtn = h("button", {
    class: "bot-top-btn bot-menu-btn", "aria-label": "Menu", "aria-haspopup": "menu", "aria-expanded": "false",
    onclick: () => { menuOpen = !menuOpen; update(); },
  }, "⋯");
  const menu = h("div", { class: "bot-menu", role: "menu" },
    h("button", { class: "bot-menu-item bot-menu-link", role: "menuitem", hidden: !BOT_IMESSAGE_ADDRESS, onclick: () => void openLink("imessage") }, "Link iMessage"),
    h("button", { class: "bot-menu-item bot-menu-link bot-menu-discord", role: "menuitem", hidden: !DISCORD_INSTALL_URL, onclick: () => void openLink("discord") }, "Link Discord"),
    h("button", { class: "bot-menu-item bot-forget", role: "menuitem", onclick: () => { menuOpen = false; linking = null; confirming = true; update(); } }, "Forget me"));
  const top = h("div", { class: "bot-top" },
    h("button", { class: "bot-top-btn bot-back", onclick: opts.onBack, "aria-label": "Back" }, "‹ Back"),
    h("div", { class: "bot-title" }, "Help Bot"),
    h("div", { class: "bot-menu-wrap" }, menuBtn, menu));

  // "Link iMessage" / "Link Discord": a one-time code the player sends to the bot ("LINK ABC123" / "/link ABC123").
  const linkBody = h("div", { class: "bot-link-body" });
  const linkTitle = h("div", { class: "bot-link-title" }, "Link iMessage");
  const linkBox = h("div", { class: "bot-link", role: "dialog", "aria-label": "Link iMessage" },
    linkTitle,
    linkBody,
    h("div", { class: "bot-confirm-actions" },
      h("button", { class: "btn btn-secondary btn-small", onclick: () => void Bot.createLinkCode() }, "New code"),
      h("button", { class: "btn btn-primary btn-small", onclick: () => closeLink() }, "Done")));

  async function openLink(kind: "imessage" | "discord") {
    menuOpen = false;
    confirming = false;
    linking = kind;
    linkTimer ??= setInterval(update, 15_000); // keep "expires in" fresh
    update();
    if (!Bot.linkCode()) await Bot.createLinkCode();
  }

  function closeLink() {
    linking = null;
    if (linkTimer) { clearInterval(linkTimer); linkTimer = null; }
    update();
  }

  function renderLink() {
    const code = Bot.linkCode();
    const links = Bot.channelLinks();
    const discord = linking === "discord";
    const title = discord ? "Link Discord" : "Link iMessage";
    linkTitle.textContent = title;
    linkBox.setAttribute("aria-label", title);
    const kids: (HTMLElement | null)[] = [];
    if (code) {
      const mins = Math.max(1, Math.ceil(Number(code.expiresAt.microsSinceUnixEpoch / 1000n - BigInt(Date.now())) / 60_000));
      kids.push(
        h("div", { class: "bot-link-code", "aria-label": `Code ${code.code.split("").join(" ")}` }, code.code),
        discord
          ? h("p", { class: "bot-link-text" }, "In Discord, run ", h("b", null, `/link ${code.code}`), ".")
          : h("p", { class: "bot-link-text" }, "Text ", h("b", null, `LINK ${code.code}`), " to the Help Bot on iMessage at ", h("b", null, BOT_IMESSAGE_ADDRESS), "."),
        h("p", { class: "bot-link-sub" }, `Your ${discord ? "Discord checks" : "iMessage chats"} will then share this history and show up here. The code works once and expires in ${mins} min.`),
        discord ? h("p", { class: "bot-link-sub" }, "No Help Bot in Discord yet? ",
          h("a", { href: DISCORD_INSTALL_URL, target: "_blank", rel: "noopener noreferrer" }, "Add it to Discord"), ".") : null);
    } else {
      kids.push(h("p", { class: "bot-link-text" }, Bot.ready() ? "Making a code…" : "Connecting…"));
    }
    if (links.length) {
      kids.push(h("div", { class: "bot-link-linked" },
        ...links.map((l) => h("div", null, `✓ Linked: ${CHANNEL_LABELS[l.platform] ?? l.platform} ${l.handleHint}`)),
        h("button", { class: "bot-link-unlink", onclick: () => void Bot.unlinkChannels() }, "Unlink")));
    }
    linkBody.replaceChildren(...kids.filter((k): k is HTMLElement => !!k));
  }

  const confirmFacts = h("ul", { class: "bot-confirm-facts" });
  const confirmBox = h("div", { class: "bot-confirm", role: "alertdialog", "aria-label": "Forget me" },
    h("p", { class: "bot-confirm-text" }, "Delete this whole conversation, your game history and everything the bot remembers about you? This can't be undone."),
    confirmFacts,
    h("div", { class: "bot-confirm-actions" },
      h("button", { class: "btn btn-secondary btn-small", onclick: () => { confirming = false; update(); } }, "Cancel"),
      h("button", { class: "btn btn-primary btn-small bot-confirm-yes", onclick: async () => { confirming = false; update(); await Bot.forgetMe(); } }, "Delete everything")));

  // ---------- Message list ----------
  const list = h("div", { class: "bot-list", role: "log", "aria-live": "polite" });

  // ---------- Composer ----------
  const status = h("div", { class: "bot-status", role: "status" });
  const textarea = h("textarea", {
    class: "bot-input", rows: 1, placeholder: PLACEHOLDER,
    enterkeyhint: "send", "aria-label": "Message", maxlength: 4000,
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); void submit(); }
    },
    oninput: () => { autosize(); Bot.clearError(); if (imageFailed) { imageFailed = false; update(); } },
    onpaste: (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])].filter((i) => i.kind === "file" && (!i.type || i.type.startsWith("image/")));
      const f = files[0]?.getAsFile();
      if (!f) return;
      void setImage(f);
      if (!e.clipboardData?.getData("text/plain")) e.preventDefault();
    },
  }) as HTMLTextAreaElement;
  const fileInput = h("input", {
    type: "file", accept: "image/*", class: "bot-file", tabindex: -1, "aria-hidden": "true",
    onchange: () => { const f = fileInput.files?.[0]; if (f) void setImage(f); fileInput.value = ""; },
  }) as HTMLInputElement;
  const attachBtn = h("button", { class: "bot-attach", "aria-label": "Attach screenshot", title: "Attach screenshot", onclick: () => fileInput.click() }, "📷");
  const sendBtn = h("button", { class: "bot-send", "aria-label": "Send", onclick: () => void submit() }, "Send");
  const micSlot = h("span", { class: "bot-mic-slot" }); // empty (hidden) when voice isn't supported
  const dictation = createDictation(textarea, {
    onText: () => { autosize(); textarea.scrollTop = textarea.scrollHeight; },
    onState: () => update(),
    onError: (msg) => Bot.showError(msg),
  });
  const micBtn = voiceSupported()
    ? h("button", { class: "bot-mic", type: "button", "aria-label": "Speak your message", title: "Speak your message",
      "aria-pressed": "false", onclick: () => { Bot.clearError(); dictation.toggle(); } }, "🎤")
    : null;
  if (micBtn) micSlot.append(micBtn);
  const previewImg = h("img", { class: "bot-preview-img", alt: "Screenshot to send" }) as HTMLImageElement;
  const previewNote = h("div", { class: "bot-preview-note" });
  const preview = h("div", { class: "bot-preview" },
    previewImg,
    previewNote,
    h("button", { class: "bot-preview-remove", "aria-label": "Remove screenshot", onclick: () => void setImage(null) }, "✕"));
  // Quick chips above the input once a conversation exists (the empty state has its own examples).
  const howChip = h("button", { class: "bot-chip", onclick: () => void submit(HOW_AM_I_DOING.text) }, HOW_AM_I_DOING.label);
  const checkChip = h("button", {
    class: "bot-chip", onclick: () => { hint = true; update(); textarea.focus(); },
  }, "Check a message");
  const shotChip = h("button", { class: "bot-chip", onclick: () => fileInput.click() }, "📷 Check a screenshot");
  const chips = h("div", { class: "bot-chips", role: "group", "aria-label": "Quick actions" }, howChip, checkChip, shotChip);
  const composer = h("div", { class: "bot-composer" },
    chips,
    status,
    preview,
    h("div", { class: "bot-compose-row" }, attachBtn, fileInput, textarea, micSlot, sendBtn));

  const el = h("div", { class: "bot-chat" }, top, linkBox, confirmBox, list, composer);

  /** Attach a picked/pasted file (converted to JPEG right away) or clear the attachment (null). */
  async function setImage(file: Blob | null) {
    const seq = ++imageSeq;
    showImage(null);
    imageFailed = false;
    preparing = !!file;
    Bot.clearError();
    update();
    if (!file) return;
    try {
      const url = await Bot.toJpegDataUrl(file); // reads the bytes before anything else awaits
      if (seq !== imageSeq) return;
      showImage(url);
    } catch (e) {
      if (seq !== imageSeq) return;
      imageFailed = true;
      Bot.showError(e instanceof Error ? e.message : String(e));
    } finally {
      if (seq === imageSeq) { preparing = false; update(); }
    }
  }

  /** Set the attachment to an already-prepared data URL (no error reset; used to give a draft back). */
  function showImage(url: string | null) {
    image = url;
    if (url) previewImg.src = url; else previewImg.removeAttribute("src");
  }

  function autosize() {
    const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 80; // a taller composer shrinks the list
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 140 ? "auto" : "hidden";
    if (stick) list.scrollTop = list.scrollHeight;
  }

  async function submit(text = textarea.value) {
    if (Bot.state.sending || preparing || (!text.trim() && !image)) return;
    dictation.cancel(); // don't let late speech results land in the cleared box
    hint = false;
    const img = image;
    const draft = textarea.value;
    textarea.value = "";
    autosize();
    void setImage(null);
    const ok = await Bot.send(text, img ?? undefined);
    if (!ok && !textarea.value && !image && !preparing) { // rejected: give the draft back, keep the error showing
      textarea.value = draft;
      autosize();
      if (img) showImage(img);
      update();
    }
  }

  // ---------- Rendering ----------
  function messageEl(m: Bot.ChatMessage): HTMLElement {
    const user = m.role.tag === "User";
    const kids: (HTMLElement | null)[] = [];
    if (user && Bot.hasScreenshot(m))
      kids.push(h("div", { class: "bot-shot" }, "📷 screenshot",
        m.imageNote ? h("div", { class: "bot-shot-note" }, m.imageNote) : null));
    const label = VERDICTS[m.verdict];
    if (!user && label)
      kids.push(h("div", { class: `bot-verdict bot-verdict-${m.verdict}` }, label));
    if (m.text) kids.push(h("div", { class: "bot-text" }, m.text));
    const via = Bot.channelLabel(m);
    if (!user && label) {
      if (m.redFlags.length) kids.push(h("div", { class: "bot-section" }, h("div", { class: "bot-section-title" }, "Red flags"), h("ul", null, m.redFlags.map((f) => h("li", null, f)))));
      if (m.nextSteps.length) kids.push(h("div", { class: "bot-section" }, h("div", { class: "bot-section-title" }, "What to do"), h("ul", null, m.nextSteps.map((s) => h("li", null, s)))));
    }
    if (via) kids.push(h("div", { class: "bot-via" }, `via ${via}`));
    const cls = `bot-msg ${user ? "bot-msg-user" : "bot-msg-bot"}${!user && label ? " bot-card" : ""}${m.isError ? " bot-msg-error" : ""}`;
    return h("div", { class: cls }, kids);
  }

  function emptyState() {
    const played = Bot.activity().length;
    const examples = played ? [HOW_AM_I_DOING, ...EXAMPLES] : EXAMPLES;
    return h("div", { class: "bot-empty" },
      h("div", { class: "bot-empty-title" }, "Not sure about a text, email or link?"),
      h("p", { class: "bot-empty-sub" }, "Paste it here or attach a screenshot. I'll tell you if it looks like a scam and what to do."),
      h("div", { class: "bot-examples" },
        examples.map((ex) => h("button", { class: "bot-example", disabled: !Bot.ready(), onclick: () => void submit(ex.text) }, ex.label))),
      DEMO ? h("button", {
        class: "bot-demo-seed", disabled: !Bot.ready() || seeding,
        onclick: async () => { seeding = true; update(); await Bot.seedDemo(); seeding = false; update(); },
      }, seeding ? "Loading…" : played ? `Reload demo game history (${played} events)` : "Load demo game history") : null);
  }

  // Scroll to the newest message now and again once layout settles (the view may not be attached
  // yet on first render, and the visual viewport can resize right after).
  function toBottom() {
    list.scrollTop = list.scrollHeight;
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  function update() {
    const msgs = Bot.messages();
    const ready = Bot.ready();
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    const last = msgs[msgs.length - 1];
    const thinking = Bot.state.sending && (!last || last.role.tag === "User");

    const items: HTMLElement[] = msgs.length || !ready ? msgs.map(messageEl) : [emptyState()];
    if (!ready) items.push(h("div", { class: "bot-note" }, "Connecting…"));
    if (thinking) items.push(h("div", { class: "bot-msg bot-msg-bot bot-thinking" }, "thinking…"));
    list.replaceChildren(...items);
    if (nearBottom || msgs.length !== lastCount || thinking) toBottom();
    lastCount = msgs.length;

    status.textContent = Bot.state.error ?? "";
    status.hidden = !Bot.state.error;
    preview.hidden = !image && !preparing && !imageFailed;
    preview.classList.toggle("bot-preview-busy", preparing);
    preview.classList.toggle("bot-preview-failed", imageFailed && !image && !preparing);
    previewImg.hidden = !image;
    previewNote.hidden = !!image;
    previewNote.textContent = preparing ? "Preparing screenshot…" : imageFailed ? "⚠ Screenshot not attached" : "";
    const busy = Bot.state.sending || !ready;
    sendBtn.toggleAttribute("disabled", busy || preparing);
    attachBtn.toggleAttribute("disabled", busy);
    sendBtn.textContent = Bot.state.sending ? "…" : "Send";
    if (micBtn) {
      const on = dictation.active;
      micBtn.classList.toggle("bot-mic-on", on);
      micBtn.setAttribute("aria-pressed", String(on));
      micBtn.setAttribute("aria-label", on ? "Stop listening" : "Speak your message");
      micBtn.title = on ? "Stop listening" : "Speak your message";
      micBtn.textContent = on ? "■" : "🎤";
      micBtn.toggleAttribute("disabled", !ready);
    }
    textarea.placeholder = dictation.active ? "Listening…" : hint ? CHECK_HINT : PLACEHOLDER;
    chips.hidden = !msgs.length || Bot.state.sending;
    howChip.hidden = !Bot.activity().length;
    for (const c of [howChip, checkChip, shotChip]) c.toggleAttribute("disabled", !ready);

    confirmBox.hidden = !confirming;
    menu.hidden = !menuOpen;
    menuBtn.setAttribute("aria-expanded", String(menuOpen));
    menuBtn.toggleAttribute("disabled", !ready);
    linkBox.hidden = linking === null;
    if (linking) renderLink();
    const facts = Bot.facts();
    confirmFacts.replaceChildren(...facts.map((f) => h("li", null, f.fact)));
    confirmFacts.hidden = !facts.length;
  }

  // Keep the composer above the on-screen keyboard: size the chat to the visual viewport.
  const vv = window.visualViewport;
  const fit = () => {
    if (!vv) return;
    el.style.setProperty("--bot-h", `${vv.height}px`);
    el.style.setProperty("--bot-top", `${vv.offsetTop}px`);
    if (document.activeElement === textarea) list.scrollTop = list.scrollHeight;
  };
  vv?.addEventListener("resize", fit);
  vv?.addEventListener("scroll", fit);
  fit();

  const off = Bot.onChange(update);
  update();
  toBottom(); // once attached to the page (rAF runs after main.ts inserts el)
  return {
    el,
    destroy() {
      off();
      if (linkTimer) clearInterval(linkTimer);
      dictation.cancel();
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      void setImage(null);
    },
  };
}
