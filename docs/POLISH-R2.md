# SafeSense polish audit, round 2

Build: `origin/safesense` 6ac8db9 (includes the rebuilt Long Con), local vite + `safesense-local`, audited 2026-11-08 ~01:30–02:30 CST.
Passes: 390x844 (every route; Scam or Not? all 15 rounds with Check it; Fraudle win + loss; Long Con all 3 stories, fooled and caught runs), 360x740 normal and "larger", 390 "larger", desktop 1280x800.
No chat messages were sent. Forget me was opened and cancelled. The recovery key was shown and copied, never pasted; the shown-key screenshot is blurred.
Screenshots are in this folder.

Counts: **P0 0 · P1 12 · P2 21** (33 items)

---

## A. Round-1 verification (P0/P1 items)

| id | status | note |
|---|---|---|
| G-1 favicon | fixed | Green shield SVG, plus apple-touch-icon |
| G-2 AI naming | fixed, with leftovers | "SafeSense assistant" is used throughout. Leftovers: a missing article and "we/us" in a few places (N-1, N-2) |
| G-3 meta/OG | fixed | description, og:*, twitter:*, theme-color, og.png 1200x630 |
| G-4 larger-text header | fixed | 360 and 390 "larger": brand and buttons fit (x360L-home.png) |
| G-5 about/privacy/credit | fixed | About page plus footer privacy note and Forget me link |
| H-1 home first screen | fixed | "Start practicing" / "Check a message" under the H1 |
| H-2 Fraudle card copy | fixed | |
| H-3 help banner | fixed | |
| H-4 Text SafeSense | still open | Photon/iMessage isn't shown anywhere in the UI or on About. Fine if that's deliberate, but then leave it out of the Devpost story too |
| F-1 keyboard below fold | fixed | Sticky dock. Caveat at 360 "larger" (N-20) |
| F-2 12-letter word | fixed | Words are 4–8 letters |
| C-1 privacy claim | fixed | Honest copy about the server and Gemini |
| C-2 textarea far down | fixed | Text box is on the first screen at 390 |
| C-3 button hierarchy | fixed | Send is primary |
| C-4 I/we voice | mostly fixed | "we/us" leftovers on Profile, Long Con and the recovery key (N-2) |
| C-5 chat breadcrumb | fixed | |
| C-6 "parcel" | fixed | |
| L-2 (P2) ending ignores earlier doubts | **regressed in the rebuild** | Now worse: see N-4 |
| S-3 (P2) faded verdict contrast | not fixed | N-23 |
| S-5 / F-6 (P2) | not fixed | N-27 |

---

## B. New items

### P1

| id | route | problem | exact text | one-line fix | file | shot |
|---|---|---|---|---|---|---|
| N-1 | #/chat, Forget me | The assistant name is used without an article, so it reads like a person's name | `SafeSense assistant is an AI. It gives guidance, not guarantees.` · `what SafeSense assistant remembers` · `everything SafeSense assistant remembers about you` · `once SafeSense assistant connects` · `Can’t reach SafeSense assistant right now` | Use "the {ASSISTANT}" in running text, or export a `THE_ASSISTANT = 'the SafeSense assistant'` constant (keep the bare name only for bubble labels and the card heading) | `pages/Chat.tsx:39,63`, `components/chat/ForgetMe.tsx:31,36,85,96`, `Composer.tsx:107`, `Conversation.tsx:69,73` | c390-01.png, c390-05-forget.png |
| N-2 | #/profile, #/long-con | "we/us" implies humans behind the app | `What should we call you?` · `We can’t show your progress right now` · `This browser won’t let us save the key…` / `…let us switch keys…` · Long Con debrief side panel: `We can help you think it through.` | "What would you like to be called?" · "Your progress can’t be shown right now" · "This browser won’t save the key…" · "The SafeSense assistant can help you think it through." | `profile/NicknamePanel.tsx:27`, `pages/Profile.tsx:119`, `profile/RecoveryKey.tsx:154,236`, `pages/LongCon.tsx:173` | p390-05.png |
| N-3 | #/profile | The storage story contradicts About and the footer, which say progress lives on SafeSense's server and the key brings it to another device | `Your progress is saved on this device. No account needed.` | "Your progress is saved privately with SafeSense, linked to this browser. No account needed." | `profile/NicknamePanel.tsx:63` | p390-05.png |
| N-4 | #/long-con (Hi Mom, bank) | The one-person stories end on the **last move only**. Linda says "I’m going to call her on her old number", then "I’ll ask Dad", yet one more text gets "Linda believed it… the money would be gone". The story contradicts itself (round-1 L-2, now in the new engine) | Feed: `Who is this? … I’m going to call her on her old number.` → ending `Linda believed it.` | Once a person has "checked", keep that status (no flip back to believed), or end the story early on a check. Fooled only if ≥2 moves worked | `content/longCon.ts` `fromStory` (~756–790), `components/longcon/useCampaign.ts` | l390-E-ending.png |
| N-5 | #/long-con | A move that **failed** still reports gains: "Linda noticed…" followed by `+2 people believed it` (the reach for a failed move is 2) | `+2 people believed it  Believability -20` | Use reach 0 for moves that don't work, and hide the "+0" line | `content/longCon.ts` `fromStory` (`reach: m.works ? reach[i] : 2`) | l390-E-ending.png |
| N-6 | #/long-con (package fee) | Two different "believed" numbers sit side by side, and the ending ignores how you played. "2 of 4 people you met believed it" is followed by "About 133 people believed it". With believability at 12/100 it still says "About 125 people believed it… Then you met one man who checked for himself". The ending text is the same for every run | Ending: `2 of the 4 people you met believed it.` / `About 133 people believed it, and your believability ended at 80 out of 100. Then you met one man who checked…` | Pick one headline number: "About 133 of 10,000 people believed it". Name the person ("Then you met Sam, who checked for himself"). Vary the line by believability (≥50 vs <25) | `content/longCon.ts:719-721`, `pages/LongCon.tsx` Ending, `components/longcon/Hud.tsx:95` | l390-A-05-ending.png, l390-A-02-mid.png |
| N-7 | #/long-con debrief | The debrief contradicts the player. Choosing "Give them 24 hours" is labeled **"You used: Urgency"**, then the text says "You chose not to rush anyone". It also clashes with Scam or Not? round 1, where "Pay within 24 hours" is the red flag | `You used: Urgency` / `You chose not to rush anyone, and fewer people fell for it.` | Drop the tactic from the 24-hour option (no tactic, so not listed as "used"), or label it "You held back: Urgency". Change it to "Give them a week" so 24 hours stays a red flag everywhere | `content/longCon.ts:561-572` | l390-A-07-debrief2.png |
| N-8 | #/long-con | Tone drifts from the calm promise toward "scam boss" game feel. A judge or an older player may find it glib | `Welcome to the floor.` · `friends ruin everything` · `She isn’t careless. She’s hurrying, which is better for you.` · final choice `Pretty good` / `I have moral objections` after "How are you feeling?" · cover `Tonight, you’re the scammer… then watch it fail` (it often succeeds) | Keep the inside view but soften the narrator. Replace the closing pair with "That was uncomfortable" / "Show me how to spot it". Cover: "Learn the playbook from the inside, then turn it around." Drop "Tonight" (any time of day) | `content/longCon.ts` (PARCEL scenes ~446–716, VOICES), `pages/LongCon.tsx:19-20` | l390-A-00-picker.png, l390-A-02-mid.png |
| N-9 | #/profile | The recovery-key warning understates the risk. The key is the SpacetimeDB identity token: whoever has it can read your **chat history** and what the assistant remembers, and can delete it all | `This key is like a password for your progress. Keep it private. Anyone with it can see your progress.` | "This key works like a password. Anyone with it can see your progress and your chats with the SafeSense assistant. Never share it, even with someone who says they're support." | `profile/RecoveryKey.tsx` SaveKey | p390-08-shown-blurred.png |
| N-10 | #/profile | The recovery buttons are confusing. "Save my progress" suggests progress isn't saved yet (it is); it only reveals a key. "Use my progress on this device" is vague | `Save my progress` · `Use my progress on this device` | "Show my recovery key" · "I have a recovery key" | `profile/RecoveryKey.tsx` SaveKey/UseKey | p390-05.png |
| N-11 | all | UK English is still left in places, against the US-English decision (D7) | Fraudle and Scam or Not? `Well spotted — …` · Fraudle clue `A number in a message that asks you to ring it.` · sign `An unexpected charge with a number to ring.` | "Nice catch — …" · "asks you to call it" · "a number to call" | `pages/Fraudle.tsx:159`, `pages/ScamOrNot.tsx:292`, `content/fraudle.ts:37`, `content/signs.ts` | f390-03-won.png, s390-03-revealed.png |
| N-12 | header, home, chat, About | The assistant goes by three names, and one is an action rather than a name | Header/banner/About `Ask SafeSense` · hero `Check a message` · page `SafeSense assistant` · Scam or Not?/debrief `Ask SafeSense about a message` | Pick one pair everywhere: label "Ask the assistant" (header, banners, buttons) + name "SafeSense assistant". Or keep "Ask SafeSense", but the hero button should match it | `Layout.tsx:84-88`, `Home.tsx:102,151-154`, `About.tsx:99`, `LongCon.tsx:175` | h390-01.png, h390-04.png |

### P2

| id | route | problem | exact text | one-line fix | file | shot |
|---|---|---|---|---|---|---|
| N-13 | header (phone) | On phones the header is icons only. A sprout icon with an unlabeled number ("126") doesn't say "your progress/points" to an older user | `[Aa] [sprout 126] [chat]` | At ≤480px add tiny labels under the icons ("Text", "Progress", "Ask"), or show "126 pts" | `Layout.tsx`, `index.css` .progress-label/.chat-label | s390-07-wrap.png |
| N-14 | #/profile (empty) | The empty-state lead claims practice that hasn't happened | `Here’s what you’ve practiced so far. Take it at your own pace.` (with 0 activity) | When events===0: "Play any game and your progress will show up here." | `pages/Profile.tsx:100-104` | p390-10-empty.png |
| N-15 | points | Points mostly reward being right (+10 correct vs +2 wrong), but every surface says they show "how much you've practiced". The wording isn't explained anywhere | `Points show how much you’ve practiced — there’s no rush.` | Either +5 for every answer or word (true to the copy), or say "+10 for each one you get right, +2 for every try" on the profile | `lib/progress.ts:69-75`, `pages/Profile.tsx:57` | p390-01.png |
| N-16 | #/fraudle | "Words solved today" is really "this visit" (it resets on reload). It is also shown twice on one screen (lesson card and side panel) | `Words solved today: 1` | "Words solved this visit: 1", shown only in the lesson card on mobile | `pages/Fraudle.tsx` (session counter, ~330/440) | f390-03-won.png |
| N-17 | #/fraudle | The feedback line ignores letters that are in the word but in a different place, so a decent guess reads as total failure | `0 letters are in the right place. Try again.` (with S and A marked ⇄) | "2 letters are in the word, in a different place. Try again." (say both counts) | `pages/Fraudle.tsx:173` | x360L-fr-row2.png |
| N-18 | #/fraudle | Near-duplicate words and clues: URGENT and URGENCY are both in the list | URGENT `A message that says you must act right now.` / URGENCY `The feeling that you have to act right now.` | Drop URGENT (or replace it with e.g. "BLOCK") | `content/fraudle.ts` | – |
| N-19 | #/fraudle | The A-to-Z keyboard is explained in the lead, but there's still no QWERTY option, so phone users hunt for keys | `tap the letters (in A to Z order)` | Fine to keep. Optional: a "Keyboard: A–Z / QWERTY" toggle | `pages/Fraudle.tsx:12` | f390-01.png |
| N-20 | #/fraudle @360 larger | On first load the sticky keyboard dock covers the clue and the whole board. The first thing you see is "Stop for a moment before" cut off | – | When the dock is taller than ~55% of the viewport, make it non-sticky until the first key press, or scroll the board into view on load | `fraudle.css` .fraudle-dock, `Fraudle.tsx` (~222) | x360L-fraudle.png |
| N-21 | #/scam-or-not | The order is fixed and the answers repeat a pattern (scam, scam, safe, scam, scam, safe…). Answering by the pattern gave 12/15 without reading. "Play again" is identical | – | Shuffle the order on each play (keep message 1 fixed as the gentle opener) | `pages/ScamOrNot.tsx` / `content/scamOrNot.ts` | – |
| N-22 | #/scam-or-not | The breadcrumb casing differs from the title | crumb `Scam or not?` vs title `Scam or Not?` | `Crumb label="Scam or Not?"` | `pages/ScamOrNot.tsx:233` | s390-01-top.png |
| N-23 | #/scam-or-not | The unchosen verdict after answering is still white text on pale grey (~1.7:1) (round-1 S-3) | `Not a scam` (faded) | Keep the text dark and fade only the background | `scamornot.css` .verdict.faded | s390-03-revealed.png |
| N-24 | #/scam-or-not | The "Check it" note nags even when you got it right without checking. Repeated 15 times, it reads as a scolding | `You went with your first look. Next time, try a “Check it” too.` | Show it only on a wrong answer, or once per game | `pages/ScamOrNot.tsx:310-314` | s390-06-r4.png |
| N-25 | #/scam-or-not | The credit line uses internal jargon ("Inspect") for a button the user knows as "Check it" | `Inspect mechanic adapted from Friend or Fraud? by Krishna (SafeSense team).` | "The “Check it” idea comes from Friend or Fraud? by Krishna (SafeSense team)." | `pages/ScamOrNot.tsx:341` | s390-04-revealed2.png |
| N-26 | #/scam-or-not | Small layout glitches. The Learn-more external icon wraps alone onto its own line. Unmarked links break at the hyphen (`package-` / `redelivery.example/pay`) and phone numbers break at 360 larger (`+1 (833) 555-` / `0142`) | – | `.son-source a{white-space:nowrap}` (or keep the icon with the last word); `.sender-name{white-space:nowrap}` for phone numbers; `overflow-wrap:anywhere` instead of hyphen breaks on links | `scamornot.css` | s390-04-revealed2.png, x360L-son.png |
| N-27 | games | The exit and next-game actions still differ by game (round-1 S-5/F-6) | Scam or Not? `Leave game`; Fraudle `Back to home`; Long Con `Choose a different campaign`; Scam or Not? wrap-up has no "try another game" | "Back to home" everywhere, plus a "Try another game" on the Scam or Not? wrap-up | `pages/ScamOrNot.tsx:344`, `Fraudle.tsx`, `LongCon.tsx` | s390-08-wrap2.png |
| N-28 | #/long-con | The debrief format differs by campaign. The package fee shows `You used: X` + a lesson title. Hi Mom and the bank show only the tactic name. The package fee also lists a non-move ("Let her go") as "You used: A number to call back" | `You used: A number to call back` / `Her own route beat the whole campaign` | Use one format. Skip options whose label is "let go/hold back", or say "You held back" | `components/longcon/Debrief.tsx`, `content/longCon.ts:803` | l390-A-06-debrief.png |
| N-29 | #/long-con @360 | The sticky HUD takes 177px (normal) to 187px (larger) of a 740px screen (~25%), so only one or two feed cards show between it and the choices | – | At ≤400px, collapse it to one row while scrolling: "133 believed · Believable · D B P S" | `longcon.css` .con-side/.con-hud | x360L-longcon.png, l390-A-02-mid.png |
| N-30 | #/chat, About | Mixed words for the same thing | chat `Add a picture` / `Pictures aren’t stored` vs home/About/footer `add a screenshot` / `Screenshots aren’t stored` | Use "picture" in buttons and "screenshot or photo" in prose, or pick one word | `Composer.tsx`, `Home.tsx:151`, `About.tsx`, `Layout.tsx` footer | c390-02.png, h390-04.png |
| N-31 | #/chat Forget me | The consequence doesn't mention points, and the nickname is kept. A user who wants a clean slate will still see "Hi, Margaret" | `This deletes this conversation, your game history and everything …` | "…your game history and points…". Also clear the local nickname on success, or say it's kept | `components/chat/ForgetMe.tsx`, `lib/profileStore.ts` | c390-05-forget.png |
| N-32 | #/about | "Who made it" has no names. Judges look for the team. Krishna is credited only inside the games | `Made by the SafeSense team at HackUTD 2026.` | List the names and roles (incl. the designer and Krishna's game ideas) | `pages/About.tsx:83-90` | a390-01.png |
| N-33 | #/profile | The sign grid lists "A genuine message" under the **Scam messages** heading. "Not seen yet" is said twice for screen readers (sr prefix + visible) | `Scam messages` › `A genuine message` | Put the genuine sign in its own small "Safe messages" group. Drop the sr-only "Not seen yet:" prefix on unseen tiles | `components/profile/SignsGrid.tsx` | p390-03.png |

---

## Calm promise vs the new game feel (summary)

- **Scam or Not?:** "Check it" lands well. It is optional, free and highlights the clue in the message, and the sources (AARP/FTC) add credibility. The streak notes ("3 in a row — nice and steady") are gentle. The only friction is the repeated "next time try Check it" note (N-24).
- **Fraudle:** the tile flip is smooth and respects reduced motion. "Words solved today" and "nice and steady" are fine.
- **Points chip:** quiet and OK. The copy promises "practice, not score" but the math rewards correctness (N-15).
- **The Long Con:** the strongest piece visually (the dial, avatars and checks/shields are well done, with no red flashing), and the furthest from calm. The +N counters, the narrator's voice and the contradictory endings (N-4 to N-8) are what a judge will notice.

## Not checked

- Real chat send/receive, image upload and error states (zero AI calls).
- Pasting a recovery key or restoring the previous one (no key pasted).
- Real mobile keyboards and voice input.
