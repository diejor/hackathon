// Help Bot routing: the chat is open while the URL hash is #bot (query params like ?server=&db= stay).
const listeners = new Set<() => void>();
const notify = () => { for (const fn of listeners) fn(); };
addEventListener("popstate", notify);
addEventListener("hashchange", notify);

export const isBotOpen = () => location.hash === "#bot";

export function onNav(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function openBot() {
  if (isBotOpen()) return;
  history.pushState({ bot: true }, "", "#bot");
  notify();
}

// Back: pop our own history entry if we pushed it; if the page was opened at #bot, drop the hash.
export function closeBot() {
  if (!isBotOpen()) return;
  if ((history.state as { bot?: boolean } | null)?.bot) history.back();
  else {
    history.replaceState(null, "", location.pathname + location.search);
    notify();
  }
}
