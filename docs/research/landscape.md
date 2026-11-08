# Fraud-prevention landscape: Security Arcade vs. the field
Researched 2026-11-07. Pages opened are listed in Sources. **[unverified]** = could not open a primary page.

## 1. Comparison table

| Product | Type | Channels | Input | Output | Cost | Source |
|---|---|---|---|---|---|---|
| **T-Mobile ScamShield** | Carrier network | Network (automatic) + T-Life app | None (passive on calls, SMS/MMS, web) | Scam Likely label/block, spam-text block ("SMS and MMS only"), Safe Web Browsing, callback warning | Free; Premium $4/mo/line | [T-Mobile][tm1], [support][tm2] |
| AT&T ActiveArmor | Carrier | App | Calls; iOS text filtering now delegated to iOS | Block/label calls | Free; Advanced $7/mo/line | [App Store][att] |
| Verizon Call Filter | Carrier | App | Calls | Spam alerts, auto-block high-risk | Free; Plus $3.99/mo/line | [App Store][vz] |
| Google Messages Scam Detection | OS (Android) | Messages app | Live conversations, links | Inline warnings; new cloud tier + on-device link check (Oct 2026) | Free (Pixel 6+, Galaxy S24+) | [Droid Life][gm] |
| Google Circle to Search / Lens | OS/search | Android, Lens on iOS | Screenshot or circled text | Overview + next steps, only when "high confidence" | Free (Dec 2025) | [Chrome Unboxed][cts] |
| Apple iOS 26 | OS | Phone, Messages | Calls, texts | Call Screening, Unknown Senders folder, on-device spam filter, **links disabled in spam** | Free | [Apple][apple] |
| Bitdefender Scamio | AI chatbot | Web, WhatsApp, Messenger, **Discord** | Text, screenshot, link, QR, description | Safe/threat verdict + tips | Free, account required | [Bitdefender][bd] |
| Malwarebytes in ChatGPT / Scam Guard | AI chatbot | ChatGPT app (Feb 2026); mobile app | Text, URL, phone, email address; screenshots **[unverified, help page 403]** | Red flags + next steps; link/phone/WHOIS reputation | Free | [Malwarebytes][mb] |
| Norton Genie / Scam Protection | AI assistant | App, web, now in Norton 360 | Text, screenshot, link | Verdict + guidance | Bundled in Norton 360 **[free standalone unverified]** | [Norton][nor] |
| McAfee Scam Detector | AI, automatic | Mobile app, Gmail/Outlook link | Texts, email, video (deepfake audio) automatically | Flags + explains why | Paid plans only | [Help Net][mca] |
| Trend Micro ScamCheck | AI app | iOS/Android | Number, site, email, text, video link, image | AI scam check, SMS filter | Free limited + paid tier | [App Store][tmc] |
| F-Secure Text Message Checker | Web tool | Browser | Text only (sender + 2,048 chars) | Verdict + justification | Free (beta) | [F-Secure][fs] |
| O2 "Daisy" | Carrier AI scambaiter | Phone (seeded numbers) | Scammer calls | Wastes scammers' time ("40 minutes at a time"); PR stunt | n/a | [TechCrunch][daisy] |
| FTC ReportFraud / US 7726 | Reporting | SMS short code, web | Forwarded text | Carrier blocks similar texts; feeds FTC data | Free | [FTC][ftc24], [T-Mobile][tm2] |
| Google **Be Scam Ready** | Inoculation game | Browser, classroom | Choices in scenarios | Teaches manipulation *techniques*; teacher guides | Free (Nov 2025) | [Filament][bsr] |
| Jigsaw Phishing Quiz | Quiz | Browser | 8 emails | Explains red flags per item | Free | [Jigsaw][jig] |
| Bad News (Cambridge) | Inoculation game | Browser | Role-play as fake-news producer | Technique recognition | Free | [HKS][bn] |
| Corporate phishing sims (KnowBe4-style) | Training | Email | Simulated lures | Embedded training on fail | Paid | [UCSD study][ucsd] |

## 2. What is genuinely different, honestly

**Not new:** a paste/screenshot/link checker with verdict, red flags and next steps is a commodity. Scamio does it free on WhatsApp, Messenger **and Discord**; Malwarebytes does it in ChatGPT; Google Lens does it from a screenshot. They beat us on **link/number reputation** (real threat databases, not LLM reasoning). Google and Apple catch scams **in the inbox**, before the user thinks to ask.

**Actually different:**
1. **Social, multiplayer practice.** Every game we found (Be Scam Ready, Jigsaw, Bad News) is single-player. A QR-join room suits families, classrooms, senior centres and T-Mobile store events.
2. **Training-to-coaching loop.** Missed tactics shape the bot's coaching. Inoculation fades and boosters restore it (Maertens 2025), so this is a personalised booster. No competitor links a game to a checker.
3. **Fills ScamShield's gaps.** ScamShield's text blocking is "SMS and MMS only" and never explains *why*. That leaves iMessage/RCS, WhatsApp, email and social DMs (social media leads losses), plus the "is this real?" moment.

## 3. Lessons to steal (ranked by value/hour)

1. **"Report it" step after a scam verdict** (S). Buttons: forward to **7726**, report in Messages, [ReportFraud.ftc.gov](https://reportfraud.ftc.gov). It is T-Mobile's own advice and feeds their filter.
2. **ScamShield nudge** (S). For T-Mobile users, a verdict on a call/number says "turn on Scam Block: dial #662#." Positions us as ScamShield's companion.
3. **Link reputation via Google Web Risk `uris.search`** (S–M): free for 100k calls/month, then $0.50/1k. Show it beside the LLM opinion. (Safe Browsing and VirusTotal public APIs forbid commercial use; URLhaus is free under fair use.)
4. **Prebunking framing for Friend or Fraud** (S). Name the *technique* at reveal (urgency, impersonation, fake fee), as Be Scam Ready does, and mix in real messages: ShieldUp players initially grew over-suspicious.
5. **24-hour/7-day "booster" round** (M). The bot re-tests one missed tactic (Maertens 2025).
6. **Seed rounds with FTC top-5 text scams** (S). Delivery, job/task, bank alert, toll, "wrong number": data-driven content.

## 4. Pitch angles and evidence

- "Americans reported **$15.9B** in fraud losses in 2025 across 3M reports, up from $12B. **Text message was the #1 reported contact method**" ([FTC testimony, Mar 25 2026][ftct]).
- "Losses to scams that start with a text hit **$470M in 2024, five times 2020**. The top five lures are package, job, bank alert, toll and wrong-number" ([FTC, Apr 2025][ftc24]). *No 2025 text-only figure found.*
- "Game-based scam inoculation works. Google's ShieldUp RCT (n≈3,000, India) beat both scam-awareness videos and a control game, and the gains **held at 21 days**" ([arXiv 2025][shield]).
- "Passive training fails; engagement matters. In a 19,500-employee RCT, training changed failure rates by only **1.7 points** and over half of sessions ended within 10 s, yet completed interactive training cut clicks **19%**" ([UCSD, IEEE S&P 2025][ucsd]).
- "Inoculation fades, especially from games, unless boosted" ([Maertens et al., Nature Comms 2025][boost]). That is why our bot follows up.

## 5. Risks and claims to avoid

- **Don't claim to replace or beat ScamShield.** It blocks at network level, before the user sees anything. We are the layer for what gets through, and for teaching.
- **No accuracy claims.** Ours is unmeasured; vendor figures (McAfee ">99%") are self-reported. Say "second opinion" and point to official verification.
- **"Likely safe" is the dangerous verdict.** Phrase it as "no red flags found" and pair it with verification steps.
- **Screenshots still go to Gemini's servers.** Say "we don't store them," not "never leave your phone."
- **Don't overstate durability:** game effects decay faster than text/video; boosters are the answer.
- Don't call the Discord bot unique (Scamio has one).

## Sources (all opened 2026-11-07)
[tm1]: https://www.t-mobile.com/benefits/scam-shield
[tm2]: https://www.t-mobile.com/support/plans-features/help-with-scams-spam-and-fraud
- https://www.t-mobile.com/benefits/scam-shield
- https://www.t-mobile.com/support/plans-features/help-with-scams-spam-and-fraud
- https://www.t-mobile.com/dialed-in/tips-tricks/avoid-phone-scams (Sep 24 2026)
[att]: https://apps.apple.com/us/app/at-t-activearmor/id1218465964
- https://apps.apple.com/us/app/at-t-activearmor/id1218465964 ; https://www.att.com/security/
[vz]: https://apps.apple.com/us/app/verizon-call-filter/id777875529
- https://apps.apple.com/us/app/verizon-call-filter/id777875529
[gm]: https://www.droid-life.com/2026/10/14/google-messages-is-getting-a-massive-gemini-powered-scam-defense-upgrade/
- https://www.droid-life.com/2026/10/14/google-messages-is-getting-a-massive-gemini-powered-scam-defense-upgrade/
[cts]: https://chromeunboxed.com/googles-circle-to-search-can-now-instantly-tell-you-if-a-text-message-is-a-scam/
- https://chromeunboxed.com/googles-circle-to-search-can-now-instantly-tell-you-if-a-text-message-is-a-scam/
[apple]: https://www.apple.com/sg/newsroom/2025/10/apple-helps-safeguard-users-from-scams-and-fraud-while-protecting-personal-data/
- https://www.apple.com/sg/newsroom/2025/10/apple-helps-safeguard-users-from-scams-and-fraud-while-protecting-personal-data/
[bd]: https://www.bitdefender.com/en-us/consumer/scamio
- https://www.bitdefender.com/en-us/consumer/scamio
[mb]: https://www.malwarebytes.com/blog/product/2026/02/scam-checking-just-got-easier-malwarebytes-is-now-in-chatgpt
- https://www.malwarebytes.com/blog/product/2026/02/scam-checking-just-got-easier-malwarebytes-is-now-in-chatgpt ; https://www.helpnetsecurity.com/?p=355651
[nor]: https://us.norton.com/products/genie-scam-detector
- https://us.norton.com/products/genie-scam-detector
[mca]: https://www.helpnetsecurity.com/2025/01/07/mcafee-scam-detector/
- https://www.helpnetsecurity.com/2025/01/07/mcafee-scam-detector/
[tmc]: https://apps.apple.com/us/app/tm-check-spam-call-blocker/id1566099565
- https://apps.apple.com/us/app/tm-check-spam-call-blocker/id1566099565
[fs]: https://www.f-secure.com/en/text-message-checker
- https://www.f-secure.com/en/text-message-checker
[daisy]: https://techcrunch.com/2024/11/15/ai-granny-scambaiter-wastes-telephone-fraudsters-time-with-boring-chat
- https://techcrunch.com/2024/11/15/ai-granny-scambaiter-wastes-telephone-fraudsters-time-with-boring-chat
[ftc24]: https://www.ftc.gov/news-events/news/press-releases/2025/04/new-ftc-data-show-top-text-message-scams-2024-overall-losses-text-scams-hit-470-million
- https://www.ftc.gov/news-events/news/press-releases/2025/04/new-ftc-data-show-top-text-message-scams-2024-overall-losses-text-scams-hit-470-million
[ftct]: https://www.ftc.gov/system/files/ftc_gov/pdf/ftc-testimony-jec-hearing-on-the-rising-scam-economy.pdf
- https://www.ftc.gov/system/files/ftc_gov/pdf/ftc-testimony-jec-hearing-on-the-rising-scam-economy.pdf ; https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-testifies-joint-economic-committee-agencys-efforts-combat-fraud ; https://www.ftc.gov/news-events/data-visualizations/data-spotlight
[bsr]: https://www.filamentgames.com/blog/game-launch-be-scam-ready-with-google-and-filament-games
- https://www.filamentgames.com/blog/game-launch-be-scam-ready-with-google-and-filament-games
[shield]: https://arxiv.org/abs/2503.12341
- https://arxiv.org/abs/2503.12341
[jig]: https://phishingquiz.withgoogle.com/
- https://phishingquiz.withgoogle.com/ (page is JS-only; details from press coverage **[partly unverified]**)
[bn]: https://misinforeview.hks.harvard.edu/article/global-vaccination-badnews/
- https://misinforeview.hks.harvard.edu/article/global-vaccination-badnews/ (d≈0.33–0.41, immediate post-test only)
[ucsd]: https://sysnet.ucsd.edu/~voelker/pubs/phishtrain-oakland25.pdf
- https://sysnet.ucsd.edu/~voelker/pubs/phishtrain-oakland25.pdf
[boost]: https://www.memlab.psychol.cam.ac.uk/pubs/Maertens2025%20NatureComms.htm
- https://www.memlab.psychol.cam.ac.uk/pubs/Maertens2025%20NatureComms.htm
- https://www.cam.ac.uk/stories/inoculateexperiment (YouTube prebunk field test: +5% recognition, ~$0.05/view)
- https://cloud.google.com/web-risk/pricing ; https://developers.google.com/safe-browsing/v4/usage-limits ; https://docs.virustotal.com/reference/public-vs-premium-api ; https://urlhaus.abuse.ch/api/
- Not opened (403/blocked): Ofcom 7726 page, Malwarebytes help center (screenshot claim), AT&T support article, PubMed anti-scam board game, ACM role-based simulation paper.
