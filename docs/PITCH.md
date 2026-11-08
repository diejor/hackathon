# SafeSense: pitch sheet

## 30-second pitch (say it out loud a few times)

> "Last year Americans lost $470 million to scams that started with a text. Warnings make people anxious, but they don't make people better at spotting scams.
>
> SafeSense is a calm place to **practice**, and someone to **ask**.
> - You learn the tricks through three short games. In one of them you play the scammer, and watch a careful person take your tactics apart.
> - When a real message worries you, you ask SafeSense: on the web with a screenshot, or by texting it over iMessage. Gemini gives a verdict, the signs, and what to do, and it remembers what you missed in the games.
>
> It's a companion to Scam Shield, for the messages that still get through."

## One line for each track

- **T-Mobile Safe Signal:** Scam Shield blocks at the network. SafeSense trains the person and checks whatever reaches them anyway: screenshots from any app, and iMessage. Practice instead of fear.
- **Photon:**
  - Photon's signed webhooks arrive *inside the database* (SpacetimeDB). We check the HMAC signature, reject duplicates and drop anything older than 5 minutes.
  - Replies come back in about 3 seconds.
  - `LINK` codes connect a phone to the web memory.
  - `PRACTICE` sends an opt-in fake scam text, and the reply is graded (`REPORT` = caught).
  - STOP/START, a daily cap and a kill switch are built in.
- **Gemini:**
  - vision on screenshots;
  - a strict JSON verdict schema;
  - coaching based on each person's game history;
  - prompt-injection rules, so a screenshot can't instruct the model;
  - automatic fallback from flash to flash-lite.

## Likely judge questions

**Who is it for?**
People who feel unsure about scams, often older adults, and the family members who help them. That's why there are no timers or scores to chase, there's a text-size control and big buttons, and the tone is calm.

**How is this different from Scam Shield, or a spam filter?**
Filters block; they don't teach. And some messages always get through: a screenshot from WhatsApp, a new trick, an iMessage. SafeSense covers the person, not the network. We position it as a companion, not a replacement.

**Can the AI be wrong?**
Yes, and we say so. It gives guidance with reasons, never certainty. Every answer ends with a safe next step, like "contact the company using the number on your card". When it isn't sure, it says "Suspicious", not "Safe".

**What about privacy?**
- No accounts and no sign-up.
- Each person's data is in private tables that only they can read.
- Screenshots go to Gemini to be read and are **never stored**.
- "Forget me" deletes the chat, the memory, the game history and the linked phone.

**Why SpacetimeDB?**
The database *is* the backend: webhooks, scheduled practice texts and AI calls all run inside it, with no server for us to run or secure. Real-time sync means the web chat and the iMessage chat share one memory instantly.

**Why play the scammer?**
Research on "inoculation" games, like Bad News for misinformation, suggests that practicing a manipulation tactic in a safe setting helps people resist it later. Seeing a scam built one move at a time makes the moves easy to spot.

**Is the practice text safe to send?**
- It's opt-in, and only to your own linked phone.
- It ends with a clear label: "(SafeSense practice — reply REPORT if you think it's a scam)".
- It uses fictional brands and contains no links.
- Limits: 1 a day, 3 in total. STOP is honored, and a kill switch turns it off.

**Can I text it right now?**
*If it's still the shared line:* "Photon's free shared line only answers one registered phone, so for the demo that's our teammate's iPhone. A dedicated line removes the limit."
*If Photon Pro gave us a dedicated number:* invite them to try it.

**Business model or what's next?**
- A partner dashboard for carriers and community groups (libraries, senior centers), showing anonymous trends like which tactics people miss most, so they can target their education.
- Optional sign-in.
- More games, starting with The Phone Call (voice scams).

**What did each of you do?**
- **Diego:** the backend (SpacetimeDB), Gemini, Photon integration and deploys.
- **Krishanth:** scam research, the BadScam game design behind Role Reversal, the practice-text safety rules and the mascot.
- **Emily Yuan:** the whole look and the UX.

**What was hardest?**
Merging three directions in one night (two prototypes plus the final design), and porting the backend from C# to TypeScript halfway through.

## Facts you can cite safely

- **FTC (Data Spotlight, April 2025):** $470M reported lost in 2024 to scams that started with a text. The top five were fake package delivery, fake jobs, fake fraud alerts, unpaid tolls and wrong numbers.
- **Report a scam text:** forward it to **7726** (SPAM). It's free on major US carriers.
- **Don't say:**
  - that SafeSense is affiliated with T-Mobile;
  - that the AI is always right;
  - victim counts we haven't verified.
