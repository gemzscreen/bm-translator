# BM Translator - Bahasa Brunei (offline)

An app for your phone that translates Malay / Brunei Malay to and from English. It works offline.

| Feature | Offline? |
|---|---|
| Type text and see the meaning (phrase match + word-by-word guide, about 930 built-in entries) | Yes |
| Scan a photo (signs, letters, DOs, labels) | Yes, after a one-time 8 MB download |
| Phrasebook: site, suppliers, safety, office, daily life, with read-aloud and saved favourites | Yes |
| My words: add your own terms, which the translator uses right away. Back them up or import them as JSON or CSV | Yes |
| Speak instead of typing (voice input) | No, needs data. Offline, use the microphone on your keyboard. |
| Full-sentence machine translation (MyMemory, or open in Google Translate) | No, needs data |

---

## 1. Put it online (free, one time, about 10 minutes)

The app needs a secure (https) web address before your phone can install it and keep it for offline use. GitHub Pages hosts it for free.

1. Go to **github.com** and create a free account (skip this if you already have one).
2. Click **+** at the top right, then **New repository**. Name: `bm-translator`. Set it to **Public**. Click **Create repository**.
3. On the new page, click **uploading an existing file**.
4. Unzip `bm-translator.zip` on your computer. Open the `bm-translator` folder, select **everything inside it** (the `ocr` and `icons` folders and all the files), and drag it all into the GitHub upload area. Wait until every file is listed, then click **Commit changes**.
5. Go to the repository's **Settings**, then **Pages**. Under *Source* choose **Deploy from a branch**. Set the branch to **main** and the folder to **/ (root)**, then click **Save**.
6. Wait 1-2 minutes. Your app's address is:
   **`https://YOUR-GITHUB-USERNAME.github.io/bm-translator/`**

> The repository is public, but it only holds the app and the built-in glossary. **Your own words and history never leave your phone.**

## 2. Install it on your phone

1. Connect to Wi-Fi and open the address above.
   - **Android:** use **Chrome**. Tap **Install**, or menu ⋮ then **Add to Home screen**.
   - **iPhone:** use **Safari**. Tap **Share**, then **Add to Home Screen**.
2. Open the app from your home screen. Go to **Settings** and tap **Download scanner for offline use**.
3. Done. Turn on airplane mode and test it: translating, the phrasebook, My words and scanning all keep working.

**For better read-aloud:** if Settings shows no Malay voice, install one in your phone's text-to-speech settings. Indonesian is a close fallback.

## 3. Daily use tips

- **Red words** are not in the glossary yet. Tap one, then **Add to My words**. The next time, it translates offline.
- The offline result is a **word-by-word guide**. Malay grammar is simple, so this is usually enough to understand a message. For contracts or letters, tap **Translate online** and have a Bruneian colleague confirm the wording.
- In **My words**, use **Download backup** now and then. You can share the backup file with colleagues, and they can import it.
- **Scanning tip:** get close, keep the text flat, use good light, and choose **Malay only** or **English only** when you know the language. You can correct the text found before translating.

## 4. Updating the app

- **To add built-in words for everyone:** edit `data.js` (one entry per line: `malay|english|note`, under a `#category` heading).
- **After changing any file,** open `sw.js` and change `const VERSION = "bm-1.0.0"` to a new number, for example `bm-1.0.1`. Upload the changed files to GitHub. Phones pick up the update the next time they open the app with data (or use **Settings > Check for app update**).

## Files

```
index.html            app screens and styles
app.js                app logic (translate, voice, scan, phrasebook, my words, settings)
engine.js             offline translation engine (phrase match, glossary, Malay root-word analysis)
data.js               built-in glossary and phrasebook - edit to add words
sw.js                 offline caching (service worker)
manifest.webmanifest  install settings (name, icon, colours)
icons/                app icons
ocr/                  offline text scanner (Tesseract.js 5.1.1, Apache-2.0), Malay + English language data
```
