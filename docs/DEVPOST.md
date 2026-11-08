# SafeSense: Devpost draft

Paste each section into the matching Devpost field. Things to fill in are marked **TODO**.

- **Name:** SafeSense
- **Tagline (one line):** Pause. Check. Then act. A calm place to practice spotting scams, and to ask when something doesn't feel right.
- **Tracks:** T-Mobile Safe Signal · Best Use of Photon API · MLH Best Use of Gemini API
- **Links:**
  - Live: https://diejor.github.io/hackathon/
  - Code: https://github.com/diejor/hackathon (branch `safesense`)
  - Video: **TODO**
- **Team:**
  - Diego Rodrigues (lead, backend and integration)
  - Krishanth Sentil (Safe Signal research, Photon practice texts, game logic)
  - Emily Yuan (product design and UI)

---

## Inspiration

In 2024, Americans reported **$470 million** lost to scams that started with a text message (FTC). The top five were:
- fake package-delivery notices;
- fake jobs;
- fake fraud alerts;
- unpaid tolls;
- "wrong number" openers.

Most advice about scams is a list of warnings, and warnings make people anxious without making them better at spotting one. The people most at risk, often older adults, don't need more fear. They need practice, and someone calm to ask when a message feels off.

Carriers already block a lot at the network level; T-Mobile's Scam Shield does this quietly. But some messages always get through: a screenshot from another app, an iMessage, a new trick. We wanted to cover that last step: the person holding the phone.

## What it does

SafeSense has three parts.

**1. Practice with short games.** There are no timers, no pressure and no scores to chase. Each game ends with one plain lesson.
- **Fraudle:** guess the scam word from a clue, in six tries (for example SMISH, SPOOF or CALLBACK). Every word comes with a one-line lesson.
- **Scam or Not?:** realistic texts from made-up companies. You decide whether each one is a scam, then see the signs that give it away. Some are genuine, so the game also teaches people not to panic at every message.
- **Role Reversal:** *you* play the scammer. You choose the tactics, such as a fake brand, a deadline, a small fee or a callback number. You watch a careful person spot each move, forward the text to 7726 and check her real order history. The debrief turns every tactic into a defense.

**2. Chat with SafeSense.**
- **How you ask:** type a message, say it, or add a screenshot of anything that worries you.
- **What you get back:** a verdict ("Scam", "Suspicious" or "Looks safe"), the signs to notice and what to do next.
- **What it remembers:** what you struggle with in the games, so it can coach you on that.
- **What it won't do:** it gives guidance with reasons, and never claims certainty.

**3. Text SafeSense (iMessage, via Photon).** Forward a suspicious text to the SafeSense number and get the same calm verdict back in a few seconds.
- **Linking:** text `LINK <code>` to connect your phone to the same memory as the web chat.
- **Practice texts:** reply `PRACTICE` and SafeSense sends a clearly labeled fake scam text a minute or two later. Reply `REPORT` if you think it's a scam, and you get an instant debrief.
- **Limits:** practice texts are opt-in only, use fictional brands and contain no links. STOP is honored.

**Progress without an account:**
- every finished game earns 1 point;
- your dashboard shows what you've practiced and what's worth practicing next;
- a locked 4th game, *The Phone Call*, opens at 2 points: SafeSense places a practice scam call (private beta, invited numbers only).

There's no sign-up. A **recovery key** carries your progress to another device.

## How we built it

- **Frontend:** React 19 and Vite, hosted on GitHub Pages. It's built for phones first, with a text-size control and large tap targets. Our designer's design is used throughout.
- **Backend:** a single **SpacetimeDB** TypeScript module on Maincloud. The database *is* the backend; there's no other server.
  - Game history, chat and memory live in **private tables**.
  - Each person sees only their own rows, through per-user views.
  - AI calls run in procedures that make outbound HTTPS requests.
- **Google Gemini** (`gemini-3.5-flash`, falling back to `flash-lite` when it's overloaded):
  - reads text and screenshots (vision);
  - answers in a strict JSON schema: verdict, signs, next steps and facts to remember;
  - is given a short summary of the person's game history so it can coach them;
  - treats pasted content as data, with prompt-injection rules, so a screenshot can't instruct it.
- **Photon 2.0 (iMessage):**
  - Photon's signed webhooks arrive at an HTTP route *inside the database*, which checks the HMAC-SHA256 Standard Webhooks signature, rejects duplicates and drops anything older than 5 minutes.
  - Replies go out through Photon's REST API.
  - Guards: a kill switch, STOP/START, a 30-replies-per-day cap per sender, and limits on practice texts (1 a day, 3 in total).
  - Practice texts are scheduled with a SpacetimeDB scheduled table, and the user's reply is graded before the normal assistant turn.

## Challenges we ran into

- **Merging three directions in one night.** We started from two different prototypes: a game arcade, and Krishna's Safe Signal games plus Photon drill. Then our designer delivered the final design. We kept the designer's UI, ported Krishna's game logic, content and safety rules into it, and moved the whole backend from C# to TypeScript so the team could share one language.
- **Photon's free shared line** only replies to one registered sender, and only after that sender texts first. We designed the iMessage flow around replying inside the incoming conversation, with `LINK` codes to prove who owns the phone.
- **Doing crypto inside the database.** The webhook signature check had to run inside a SpacetimeDB module, so we used audited pure-JS libraries (`@noble`).
- **Tone.** Writing scam lessons that teach without scaring anyone took many rewrites. One example: "legit" answers in Scam or Not? are framed as "over-caution is fine", not as mistakes.

## Accomplishments that we're proud of

- A full loop: practice, then ask, then text. It all shares one memory, and a lesson from a game shows up in the coaching later.
- The iMessage reply comes back in about 3 seconds, end to end through Photon, the database and Gemini.
- Role Reversal: playing the scammer turned out to be the most memorable way to learn the tactics.
- Privacy by design:
  - no account;
  - screenshots are never stored;
  - "Forget me" deletes everything, including a linked phone.

## What we learned

- People learn scam signs faster by *doing* (and by playing the scammer) than by reading warnings.
- SpacetimeDB can be a complete backend, including webhooks, scheduled jobs and outbound AI calls, with no server of our own.
- Safety rules for messaging have to be in the code from day one: STOP handling, caps, a kill switch, fictional brands and no links.

## What's next for SafeSense

1. A dedicated Photon line, so anyone can text SafeSense rather than one registered phone.
2. Optional sign-in (SpacetimeAuth), with "bring my progress" from the anonymous key.
3. Open *The Phone Call* to everyone: personalized practice calls that target the tricks each person misses, plus more games and server-side unlocks.
4. A partner dashboard with anonymous aggregates (which tactics people miss most), so carriers and community groups can target their education.
5. Points earned over iMessage counting the same as on the web.

## Built with

`typescript` · `react` · `vite` · `spacetimedb` · `google-gemini` · `photon` · `imessage` · `github-pages` · `noble-crypto`

---

**Disclaimer (put this in the description):** SafeSense is meant as a companion to T-Mobile's Scam Shield. It is not affiliated with or endorsed by T-Mobile. All companies, people and phone numbers in the games are fictional.
