# Friend or Fraud: content bank

`messages.json` is a JSON array of 40 items: 25 fraud and 15 friend.

## Schema

```
{ "id": "usps-redelivery-fee",        // kebab-case, unique
  "channel": "sms" | "email" | "dm" | "call",
  "sender": "+1 (833) 555-0142",       // number, "Name <addr>", contact label, or "Caller ID: X"
  "subject": "...",                    // email only, else ""
  "body": "...",                       // <= 320 chars (max used: 251). Call bodies are quoted transcripts.
  "is_fraud": true,
  "tactic": "fake-delivery",           // one primary tag; "legit" for friend items
  "flags": ["...", "..."],             // 2-3 red flags (fraud) or green flags (legit), <= 60 chars each
  "lesson": "...",                     // <= 140 chars
  "difficulty": 1 | 2 | 3 }
```

A body may contain `\n` newlines. One legit item (`google-code-you-requested`) opens with a bracketed context line (`[You're signing in to Gmail on your new laptop]`), because a 2FA code only reads as legit if you requested it.

## Counts

| tactic | items |
|---|---|
| fake-delivery | 3 |
| toll-unpaid | 3 |
| carrier-impersonation | 3 |
| bank-impersonation | 2 |
| account-locked-otp | 2 |
| wrong-number | 2 |
| family-emergency | 2 |
| boss-gift-card | 2 |
| job-offer | 2 |
| prize-giveaway | 2 |
| tech-support | 2 |
| legit (friend) | 15 |

- That is 11 fraud tactics. `crypto-investment` and `romance` have no items of their own; `wrong-number-crypto-pivot` covers the crypto pitch.
- Fraud difficulty: 9 easy (1), 10 medium (2), 6 subtle (3).
- Friend difficulty: 4 easy (1), 5 medium (2), 6 tricky (3).
- Channels: 21 sms, 8 email, 6 call, 5 dm.

## Safety checks (run 2026-11-07)

- All phone numbers match `555-01xx`, including the toll-free `8xx-555-01xx` ones. The validator enforces this. Brand short codes are not shown; legit senders appear as the brand name.
- No real people: all personal names are generic first names or made up.
- **Fraud domains:** 15 registrable domains, checked with `socket.gethostbyname`. None resolved, so none had to change. Their full hostnames were checked too.
  - Domains: bitgainpro-exchange.com, brightlane-careers.com, chase-secure-verify.com, com-reschedule.info, costco-winnerclaim.top, dmv-gov-portal.top, ezpass-tollpay.icu, fedex-customsclear.net, galaxy-winners-claim.com, gs-renewal-center.com, outlook-mailbox.net, redelivery-help.top, tollsvc-billing.xyz, t-mobile-accountcenter.com, t-mobile-rewardpoints.com.
  - Hostnames: usps.redelivery-help.top, ups.com-reschedule.info, sunpass.tollsvc-billing.xyz.
  - Control check: usps.com and t-mobile.com resolved in the same environment, so DNS was working.
- **Legit domains** (real brand domains):
  - These resolve: t-mobile.com, careers.t-mobile.com, ups.com, airbnb.com, amazon.com, chase.com, account.microsoft.com, bestbuy.com (merchant name in an alert).
  - `accountprotection.microsoft.com` is only a mail domain. It has no A record but does have an MX record pointing to outlook.com mail protection.
  - Brand domains named only in flags or lessons (usps.com, fedex.com, sunpass.com) are references to the real sites.
- The script that builds and validates the bank (ids, required fields, lengths, tactics, phone pattern, DNS) is `../fof-build/build.py`.
