# SafeSense polish audit (B11)

Live site https://diejor.github.io/hackathon/ (build `index-CaqPCgYy.js`), audited 2026-11-08 ~01:00 CST.
Phone 390x844 (full pass, every game to its end), 360x740 and 412x915 spot checks, desktop 1280x800, plus "larger" text mode.
No chat messages were sent (no AI calls). Forget me was opened and cancelled.
Screenshots: same folder (`b11/*.png`). Paths below are relative to this folder.

Counts: **P0 3 · P1 15 · P2 21** (39 items)

---

## Global (header, footer, shell, meta)

| id | P | problem | current text | fix (one line) | file | shot |
|---|---|---|---|---|---|---|
| G-1 | P0 | The favicon is the default Vite logo (purple lightning bolt). It shows in every browser tab during the demo | `public/favicon.svg` = Vite logo; `public/icons.svg` = Vite template social icons (unused) | Replace with the green shield (ShieldCheck on #355f4b). Delete `icons.svg` | `safesense/public/favicon.svg`, `public/icons.svg` | (browser tab, not visible in headless) |
| G-2 | P0 | The AI is presented as people, under a name that appears nowhere else. "Chat with us" plus "Steady assistant" on every bubble suggests a human team called "Steady" (a leftover design name). Older users may think they're talking to a person | `Steady assistant` (greeting, thinking bubble, every reply); `Chat with us` (header, home banner, Long Con panel); `Talk it through with us` (game end screens) | Pick one name: "SafeSense coach" (PLAN calls it the coach). Header/banner: "Ask the coach". Say once that it's an AI: "SafeSense coach (AI)" | `components/chat/Conversation.tsx:31,66`, `Message.tsx:40`, `Layout.tsx:52-58`, `Home.tsx:118`, `LongCon.tsx:291`, `ScamOrNot.tsx:120`, `LongCon.tsx:83` | c390-01-top.png, d1280-01-home.png |
| G-3 | P1 | No meta description or Open Graph/Twitter tags. A Devpost or Slack link preview shows a bare "SafeSense" with no image. There's also no theme-color or apple-touch-icon | `<title>SafeSense</title>` only | Add description, og:title/description/image (a 1200x630 PNG of the home hero), theme-color #355f4b | `safesense/index.html` | – |
| G-4 | P1 | Text size "larger" breaks the header on phones. At 390px the brand mark is squeezed into a narrow pill. At 360px "SafeSense" is cut off under the Text size button ("SafeSens") | – | `.brand-mark{flex-shrink:0}`; at ≤400px hide the "Text size" word (keep "Aa") or hide the brand name | `index.css` (.header-inner/.brand/.text-size) | n360-07-home-larger.png, x390-01-larger-home.png |
| G-5 | P1 | Nothing says what SafeSense is, who made it, or what happens to your data. There's no About, privacy note or hackathon credit, and the footer is generic | Footer: `Learn at your own pace.` / `SafeSense · A little practice, more confidence.` (repeats the hero eyebrow) | Footer: "Built for HackUTD 2026 · Practice is private · The coach is an AI (Google Gemini) and can be wrong · About" with a short About/privacy section | `Layout.tsx:66-75` | d1280-02-home2.png |
| G-6 | P2 | The footer on mobile has no bottom padding and sits flush with the screen edge. The tagline is hidden (display:none) | `Learn at your own pace.` | Add padding-bottom (plus safe-area inset) and drop or replace the generic line (see G-5) | `index.css` .footer | h390-04.png |
| G-7 | P2 | The Text size button never shows the current size, so the user can't tell what changed | `Aa Text size` (always) | Show the state: "Aa Text size: Larger", or 3 segmented buttons | `Layout.tsx:31-33` | h390-01-top.png |
| G-8 | P2 | The page title never changes and focus is not moved on route change, so screen-reader users get no announcement of the new page | `SafeSense` on every route | In `useRoute`, set `document.title = "Fraudle · SafeSense"` and focus the h1 (tabIndex=-1) | `router.ts` | – |
| G-9 | P2 | On #/chat the header chat icon looks the same as on other pages (aria-current is set but has no visible style) | – | Style `.chat-link[aria-current]` (outline/inverted) or hide it on the chat page | `index.css` .chat-link | c390-01-top.png |

## Home (#/)

| id | P | problem | current text | fix | file | shot |
|---|---|---|---|---|---|---|
| H-1 | P1 | The first screen on a phone never says what you can do. It's all tagline and the motto panel. The games start at about 1.6 screens down, and the coach (the AI feature judges care about) is only at the very bottom | Hero + `Pause. Check. Then act.` panel fill 390x844 | Add a one-line "what this is" plus two buttons right under the H1: "Practice with a game" (#games) and "Ask about a message" (#/chat). Move the motto panel below the games on mobile | `Home.tsx:84-104` | h390-01-top.png |
| H-2 | P1 | The Fraudle card copy is design-sample wording that doesn't match the game ("Any character length" sounds technical, and the game says "safety word") | `Deduce the word. Any character length, six tries.` | "Guess the safety word from a clue. Six tries." | `Home.tsx:20` | h390-02.png |
| H-3 | P1 | The help banner reads as a human team and leaves out voice. "Type, ask" is redundant | `Something on your mind?` / `Talk it through with us. Type, ask, or upload an image.` / `Chat with us` | "Got a message that worries you? Ask the SafeSense coach. Type it, say it, or add a screenshot." / "Ask the coach" | `Home.tsx:112-119` | h390-04.png |
| H-4 | P1 | "Text SafeSense" (Photon/iMessage, PLAN feature 3) appears nowhere in the UI. If it's part of the demo, the site should show the number | – | If Photon is live, add a home card: "Prefer texting? Forward it to (xxx) xxx-xxxx". If not, leave it out | `Home.tsx` | – |
| H-5 | P2 | The game cards are tall on phones (about 330px each) because of the large icon tile, and the three cards take about 2 screens | – | On ≤600px, put the icon inline with the kind label, or shrink the tile to 40px | `index.css` .game-card/.icon-tile | h390-02.png |
| H-6 | P2 | The "Scam or Not?" time estimate looks low for 12 messages, each with feedback | `About 5 minutes` | "About 8 minutes", or cut to 8 messages | `Home.tsx:29` | h390-02.png |

## Fraudle (#/fraudle)

| id | P | problem | current text | fix | file | shot |
|---|---|---|---|---|---|---|
| F-1 | P1 | On a phone the 6-row board (~60px tiles) pushes the keyboard and Check word below the fold, so you type without seeing your guess. The status line ("Well done…") is also off-screen while you use the keys | – | Cap the tile size on mobile (e.g. `min(48px, …)`). Show only the used rows + active row + empty rows at reduced height, or make the keyboard sticky | `Fraudle.tsx:144-170`, `index.css` .board/.tile | f390-01-top.png, f390-02.png |
| F-2 | P1 | The 12-letter word (IMPERSONATOR) shrinks the tiles to 23px, which is too small for the target audience. In larger text mode the letters are tiny | `One word · Twelve letters` | Drop words over 9 letters, or wrap the board to 2 lines | `content/fraudle.ts:37-41` | x390-03-larger-fraudle12.png |
| F-3 | P2 | "Try a different word" uses a shuffle icon but just steps to the next word. After 7 words it silently loops, with no "you've done them all" | `Try a different word` | Use an arrow icon and label it "Skip to next word". After the last word, show "You've seen all 7 words" | `Fraudle.tsx:244-250` | f390-05-won.png |
| F-4 | P2 | The on-screen keyboard is A–Z alphabetical, while most phone users know QWERTY | rows `ABCDEFG / HIJKLMN / …` | Keep it if deliberate for non-typists, but say so in the lead. Otherwise use QWERTY | `Fraudle.tsx:9` | f390-02.png |
| F-5 | P2 | Key buttons are 41px wide (<44). Their color state (✓ / ⇄ / –) isn't in the accessible name | – | `aria-label={`${ch}${mark ? ', ' + markName : ''}`}`; reduce the gap so keys are ≥44px | `Fraudle.tsx:176-187` | f390-05-won.png |
| F-6 | P2 | The exit buttons are named differently in each game | Fraudle `Back to home` · Scam or Not `Leave game` · Long Con none | Use "Back to home" everywhere (Long Con: add it under the scenario picker / debrief) | `Fraudle.tsx:251`, `ScamOrNot.tsx:258`, `LongCon.tsx` | f390-05-won.png |

## Scam or Not? (#/scam-or-not)

| id | P | problem | current text | fix | file | shot |
|---|---|---|---|---|---|---|
| S-1 | P2 | On a 390x844 phone the Scam / Not a scam buttons start right at the fold on the first message. You must scroll to answer | – | Compact the sender card on mobile (smaller avatar, tags inline) | `index.css` .sender-card | s390-01-top.png |
| S-2 | P2 | Progress is 12 unlabeled dots. There's no visible "3 of 12" (only in aria-label) | – | Add a small visible "Message 3 of 12" next to the dots | `ScamOrNot.tsx:173-182` | s390-01-top.png |
| S-3 | P2 | After answering, the unchosen verdict is faded to white text on pale grey-green (contrast ~1.7:1) | `Not a scam` (faded) | Fade with opacity on the icon/background only and keep the text ≥4.5:1, or use dark text | `index.css` .verdict.faded | s390-03-revealed.png |
| S-4 | P2 | Fake links are underlined like real links, but tapping does nothing and nothing says why | `package-redelivery.example/pay` | Add a small "(links are disabled in practice)" caption, or a tap tooltip "In real life, don't tap — check first" | `ScamOrNot.tsx:72-90` | s390-01-top.png |
| S-5 | P2 | The wrap-up never offers another game. "Leave game" only appears below it, in the side panel | `Play again` / `Talk it through with us` | Add a third button: "Try another game" → #/ | `ScamOrNot.tsx:113-121` | s390-06-wrapup.png |

## The Long Con (#/long-con)

| id | P | problem | current text | fix | file | shot |
|---|---|---|---|---|---|---|
| L-1 | P2 | The step counter appears twice on screen | `Step 1 of 3` (top right) and `Step 1 of 3: Make first contact` (heading) | Drop the top-right counter during play (keep "Debrief") | `LongCon.tsx:209` | l390-03-step1.png |
| L-2 | P2 | The ending depends only on the last move. You can be "Spotted" on steps 1–2 and still get "Robert was fooled". That reads oddly in the debrief | `Robert was fooled, this time.` with steps `Spotted, Spotted, It worked` | Fooled only if ≥2 moves worked, or add a line: "He had doubts, but the last push worked" | `LongCon.tsx:63` | l390-40-bank-debrief.png |
| L-3 | P2 | A bank move says "Stay on the line" inside a **text message** simulation | `Stay on the line and don’t tell the branch staff.` / `Text message simulation` | "Don't call the branch, and don't tell the staff. They may be part of the fraud." | `content/longCon.ts` (bank step 3) | l390-33-bank-after-tap.png |
| L-4 | P2 | In the "What careful people do" list, the shield icons shrink by line length (flex-shrink), so they look misaligned. The third tip implies gift cards are fine when you're not hurried | `Never pay with gift cards or wire transfers in a hurry` | `.watch-list svg{flex-shrink:0}`; "Never pay anyone with gift cards or a wire transfer because they asked" | `index.css` .watch-list, `LongCon.tsx:274` | l390-22-debrief3.png |

## Chat (#/chat)

| id | P | problem | current text | fix | file | shot |
|---|---|---|---|---|---|---|
| C-1 | P0 | The privacy claim is wrong. Messages are stored in SpacetimeDB and sent to Google Gemini, and the coach "remembers" facts | `Only you can see this` | "Private to this device · Messages are read by an AI to answer you" (or link the privacy note from G-5) | `pages/Chat.tsx:39` | c390-01-top.png |
| C-2 | P1 | On a phone the text box is ~1.3 screens down (y≈1093px). The header, 4-line lead, greeting, 3 chips and the mic button all come first | – | Shorten the lead to one line, put the textarea above the mic button, or make the chips horizontal-scroll | `pages/Chat.tsx:29-33`, `Composer.tsx` | c390-01-top.png, c390-02.png |
| C-3 | P1 | Button hierarchy is upside down. "Use microphone" is the big primary button, while "Send message" is a grey outline (disabled-looking even when enabled) | `Use microphone` (primary) · `Send message` (secondary) | Make Send primary and the mic secondary, or put the mic as an icon in the textarea | `Composer.tsx:113-127,196-198` | c390-02.png |
| C-4 | P1 | Voice mixes "I" and "we" on one page: the lead uses I, the side panel uses we, and the buttons say "us" | `I can offer guidance, but I cannot confirm…` / `We will take it one step at a time.` | Use the coach in third person or a consistent "I" (ties to G-2) | `pages/Chat.tsx:31,52` | c390-03.png |
| C-5 | P1 | Chat has no breadcrumb or way back to the games (every other page has `Home / …`) | eyebrow `A safe place to ask` | Use `<Crumb label="Ask the coach" />` like the games, or add a "Practice with a game" link in the side panel | `pages/Chat.tsx:29` | c390-01-top.png |
| C-6 | P1 | UK term in an example chip (US English is a decision) | `I got a text about a parcel fee` | "I got a text about a package delivery fee" | `components/chat/Conversation.tsx:7` | c390-01-top.png |
| C-7 | P2 | In larger text mode at 360px, the chat header title runs into the note, and the empty greeting needs an inner scrollbar inside the message box | `Conversation` + `Only you can see this` | Let `.chat-head` wrap (flex-wrap, gap). Don't cap the message list height while empty | `chat.css` .chat-head/.chat-scroll | n360-06-chat-larger.png |
| C-8 | P2 | After "Keep my history", focus falls to `<body>`, which is lost for keyboard and screen-reader users | – | Return focus to the Forget me button on cancel | `components/chat/ForgetMe.tsx:33` | c390-09-forget-cancelled.png |
| C-9 | P2 | Forget me (which also deletes game history) can only be reached from the bottom of the chat page | `Forget me` | Also link it from the footer privacy note (G-5) | `ForgetMe.tsx` | c390-07-sidebottom.png |
| C-10 | P2 | The mobile side panels repeat home-page messages and push Forget me ~3 screens down | `You are not alone.` / `Keep private details private` / `Already sent money?` | On mobile, collapse "You are not alone" or merge the first two into one panel | `pages/Chat.tsx:46-68` | c390-07-sidebottom.png |

---

## Good, keep it

- Calm visual system: warm off-white, one green, Lora headings, generous spacing. The desktop home and games look finished (d1280-01-home.png).
- Every game reaches a clear, kind end state: Fraudle lesson "Worth remembering", Scam or Not wrap-up with "One sign worth remembering", Long Con debrief with "How a careful person spots it". No scores, as promised.
- Content is US-localized and realistic (555 numbers, `.example` domains, doctor's office, Mom). Feedback is gentle ("Good try — this one is not a scam").
- Long Con's "made-up person" framing and the "No messages or money will be sent" lead follow the safety rules.
- Forget me confirm is well done: autofocus on the safe option, a red destructive button, a clear consequence.
- No horizontal overflow at 360/390/412/1280. Focus-visible outlines exist. Reduced-motion is respected. Most tap targets are ≥44px.
- Example chips fill the box instead of sending, a good safety choice.

## Not checked

- A real send/receive in the chat (verdict bubbles, image upload, rate-limit and error states), excluded by the zero-AI-call rule.
- The microphone on real iOS/Android (headless Chromium reports voice as supported).
- The favicon as rendered in a tab (inspected from the file instead).
- The profile page (#/profile), being built in parallel.
