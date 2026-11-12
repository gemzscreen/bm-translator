# BM Translator — changelog

Generated from the CHANGELOG in `version.js` by `node scripts/version.mjs changelog`. Do not edit by hand.

## v1.1.0 — 12 Nov 2026

- Version number and "What's new" list: tap the version in the header. Every update now has a number, a changelog and a GitHub release (same system as QS CRM).
- Scanner: drag a box around the text to read only that part; the whole photo is still read first automatically.
- Scanner ignores the random marks it "sees" in logos, objects and textured backgrounds, and shows "No readable text found" with tips instead of nonsense. You can still look at what was ignored.
- Scanner reads small text better: a boxed area is enlarged before reading.
- Settings: Save button for the MyMemory email, with a confirmation of what is saved, and a Remove button.
- Security: the app may only load its own files and talk to the translation service (content security policy), will not run inside another website, sends no referrer when opening links, and checks and size-limits imported files.
- App updates always download fresh files.
- Powered by DarkwizLab.com.

## v1.0.0 — 12 Nov 2026

- First release: offline Malay / Brunei Malay to English translator with phrasebook match, word-by-word meaning and root-word analysis (about 930 built-in entries).
- Photo scanner (Malay and English) that works offline after a one-time download.
- Voice input (online), read-aloud, phrasebook with favourites, My words with backup and import, online full-sentence translation (MyMemory) and Google Translate link.
- Installable on Android and iPhone; works without data.
