# String Catalog Translator

**Localise a client's unreleased app without sending its roadmap to the cloud.** Gemini Nano translates the strings on your laptop; in Hybrid mode only strings that fail a check, and languages Nano can't serve there, go to Gemini in the cloud, confidential keys never do, and a receipt lists every string that left the machine, and why.

Built for #BuildHybridAI with [Firebase AI Logic hybrid inference](https://firebase.google.com/docs/ai-logic): Gemini Nano runs inside Chrome through the built-in Prompt API, and the same `GenerativeModel` falls back to a Gemini model in the cloud.

![The receipt after a real run on 18 Nov 2026 in desktop Chrome with Gemini Nano, on a 33-string excerpt of an open-source Android app: 127 of 132 translations never left the browser, five strings went to the cloud each with its reason, and 28 confidential translations stayed on the device](video/stills/01-receipt.png)

## The problem

A release's string file is its roadmap, and localisation is where it leaks. Telegram Premium was seen before launch in strings on its own translation platform: a researcher cited "the new strings available on translations.telegram.org" as "further proof of his earlier leak pointing to the imminent launch of Telegram Premium" ([Notebookcheck, 28 May 2022](https://www.notebookcheck.net/Telegram-More-evidence-of-a-new-Premium-tier-allegedly-comes-to-light-thanks-to-new-website-code.622988.0.html)). Buyers react by keeping AI away from confidential text: 27 % of organisations in Cisco's 2024 privacy benchmark "had banned GenAI applications altogether for the time being" ([Cisco, 25 Jan 2024](https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2024/m01/organizations-ban-use-of-generative-ai-over-data-privacy-security-cisco-study.html)), and one UK translation agency's policy says its translators "should not use AI translation tools for our clients’ work unless we have specifically asked them to do so" ([Atlas Translations, 25 Aug 2026](https://www.atlas-translations.co.uk/blog/ai-legislation-in-translation/)).

So an agency or contract developer localising a client's next release under an NDA has two bad options: send everything to a vendor or a cloud tool and hope, or translate by hand. Machine translation also breaks apps in boring ways: `{amount}` becomes `{montant}`, `%1$d` disappears, the brand name gets translated, "Remove" overflows its button.

## Who it's for and why it matters

Agencies, contract developers and small app teams who ship Flutter, Android, iOS or web apps and translate strings before a launch. String Catalog Translator does the bulk of the work on the developer's own machine, sends the cloud only the strings that fail a check (or languages Nano can't serve there), never sends keys marked confidential, and gives a receipt to hand to the client: how many translations never left the laptop, which strings did, and why. It never exports a string that fails a check: it flags it in the table for a person instead.

Tested on a real catalog, not only the sample: the English `strings.xml` of the open-source Wikipedia Android app (2,261 strings, 72 of them in CDATA; Apache License 2.0). Importing and exporting it found a bug: inside CDATA, Android's `\'` escape reached the model, and the exported file would have shown `it\'s` in the app. It is fixed with a test, and the whole file now goes in and out with no string changed. A 33-string excerpt was then translated on-device in desktop Chrome with Gemini Nano into Spanish, Japanese, French and German (18 Nov 2026, the first run in the video): 127 of 132 translations never left the browser; in five Japanese and German strings Nano dropped an HTML tag, the check caught each one and only those five went to Gemini in the cloud. Used for testing only; Wikimedia is not affiliated with and does not endorse this project. Sample run: strings from the Wikipedia Android app (Apache License 2.0), used under its licence; the Wikipedia Android app is not affiliated with this project. The excerpt, its licence and its source are in `third_party/wikipedia-android/`.

## What it does

1. **Paste or open a string catalog**: JSON (flat or nested), Flutter ARB, Android `strings.xml`, Apple `.strings` or Apple String Catalog (`.xcstrings`). The format is detected; notes and descriptions are kept and sent as context.
2. **Pick languages and where strings may go**:
   - **Hybrid** (default): Gemini Nano on this device for every language pair Chrome supports; Gemini in the cloud for pairs Nano lacks.
   - **Private**: on-device only. No string leaves the browser; what fails is flagged for a human. Offered only when Gemini Nano serves at least one chosen language in this Chrome.
   - **Cloud**: Gemini in the cloud for everything.
   - **Never send to the cloud**: key prefixes (for example `feature.unreleased.`). In every mode those strings are translated on-device only; one that fails a check is flagged for a person, never escalated. Without Gemini Nano they are held back untranslated, with no request at all.
3. **Every translation is checked**: same placeholders and tags (order may change), ICU select keywords unchanged and plural forms valid with `other` kept, keep-unchanged terms present, nothing empty or missing, likely UI overflow.
4. **Hybrid escalation**: when an on-device translation fails a check, only that string, not the batch, is re-sent to the cloud. The table shows each string's origin: *On-device*, *Cloud*, or *Cloud fix* with the reason.
5. **Receipt**: above the table, "N of M translations never left this browser (A translated on-device, H confidential kept on the device) · K sent to the cloud" (a translation is one string in one language) (in a neutral box headed "Gemini Nano did not run here" when nothing ran on the device), the policy in force, every string that left with its reason, and every held-back key. *Download receipt (.json)* saves it for the release log or the client.
6. **Saved runs**: *Save run (.json)* keeps the catalog, the policy and every result; *Open file* reopens it exactly as recorded, with nothing translated again and nothing sent. A run file placed at `src/recorded-run.json` before the build adds a *See a recorded on-device run* button to the page, labelled as a recording with its date and browser, so a browser without Gemini Nano can still be shown an on-device run. The live demo ships one: the sample run shown in the video, saved on 18 Nov 2026 in desktop Chrome with Gemini Nano (70 of 72 translations on-device; the Japanese order-count string fixed by the cloud after a placeholder check failed, and one string missing from the model's reply).
7. **Edit and export**: every cell is editable and re-checked on edit; export to any of the five formats as one `.zip` with each language in its platform's folder (`values-pt-rBR/strings.xml`, `app_pt_BR.arb`, `ja.lproj/Localizable.strings`), or one `.xcstrings` file with every language marked `needs_review` for Xcode. Strings that still fail a check are left out of the files after a warning, so the app falls back to the source language there instead of shipping a broken placeholder. Android styled strings opened from a `strings.xml` keep their markup (`<b>`, `<i>`, `<a>`) when the tags are balanced; markup from other formats is written escaped, for `Html.fromHtml`.

The summary tiles show how much ran on the device, how much went to the cloud, how much the cloud fixed, and what still needs a person.

## How the hybrid routing works

```
string batch ──► GenerativeModel(mode: prefer_on_device, language pair declared)
                    │
                    ├─ Chrome has Gemini Nano for this pair ──► on-device ──► checks ──► pass: keep (On-device)
                    │                                                         └─► fail: that string only
                    │                                                               └─► only_in_cloud ──► checks ──► Cloud fix / Check
                    └─ not available (no API, no model, language unsupported) ──► cloud ──► checks
```

- One model per language pair: `onDeviceParams.createOptions` declares `expectedInputs` and `expectedOutputs` languages, so Chrome's `LanguageModel.availability()` answers per pair, and the SDK routes pairs Nano can't do to the cloud by itself.
- `response.inferenceSource` (`on_device` / `in_cloud`) is shown on every translated string and counted in the summary.
- An on-device error does not fall back inside the SDK in `prefer_on_device` mode; the app retries that batch with `only_in_cloud` (Hybrid) or flags it (Private).
- `initializeDeviceModel()` runs from the *Download Gemini Nano* button (a user gesture), with a progress bar.
- In Private mode, a failed string gets one more on-device try, alone, since a shorter prompt is easier for a small model.
- Confidential keys are split off before any call: with Nano they go through the Private path (`only_on_device`); without it they are held back. The receipt marks a string as sent whenever a call may have reached the cloud (an error on a pair without Nano counts as sent).
- Keep-unchanged terms are added to a batch's prompt only when a string of that batch contains them, so a name typed there never reaches the cloud on its own.
- Each cloud call that meets a busy cloud (HTTP 429 or 503) is retried once after a pause; if it is still busy, cells say so in plain words and a banner explains that on-device results are unaffected. URLs and SDK error codes are stripped from every message, and quota or overload errors are reworded in plain words.
- **App Check** (reCAPTCHA Enterprise, or v3 by build setting) protects the cloud calls; with enforcement on in the Firebase console (it is on for the demo), only this site can spend the project's Gemini quota. Local development uses an App Check debug token.
- **Remote Config** serves the cloud model name, the batch size and a switch that pauses the cloud fallback (the app then runs in Private mode), all without a redeploy. Defaults are in code, and malformed values are ignored (`src/policy.ts`).

The routing is pure TypeScript with the model call injected (`src/engine.ts`), so it is unit-tested without a browser.

## Run it

Copy `.env.example` to a new file named `.env.local` and paste your Firebase web config into it as one line of JSON. Then:

```
npm install
npm run dev
```

- Firebase console → AI Logic → Gemini Developer API; then Project settings → Add app → Web, and copy the `firebaseConfig` into `VITE_FIREBASE_CONFIG`.
- App Check: register the web app with reCAPTCHA Enterprise (default) or classic reCAPTCHA v3, and set the site key (`VITE_RECAPTCHA_SITE_KEY`) and the provider (`VITE_APPCHECK_PROVIDER`: `enterprise` or `v3`). In `npm run dev` the app prints an App Check debug token in the console; add it under App Check → Manage debug tokens.
- The deployed demo reads both values from GitHub Actions repository variables; no keys are committed.
- Without a config the app runs in Private mode only: Gemini Nano in Chrome, no network calls to a model.
- On-device needs desktop Chrome with built-in AI (Gemini Nano); see [Chrome's hardware requirements](https://developer.chrome.com/docs/ai/get-started).

Tests (93 unit tests: formats, placeholders and ICU, routing, confidential keys, receipt, saved runs, zip export, video text, Remote Config policy) and the production build (typecheck, then `dist/`):

```
npm test
npm run build
```

## Files

| File | What |
| --- | --- |
| `src/ai.ts` | Firebase AI Logic: `getAI`, hybrid `getGenerativeModel` per language pair, `initializeDeviceModel`; App Check; Remote Config |
| `src/policy.ts` | Remote Config parameters, defaults and validation |
| `src/engine.ts` | Routing, checks, escalation, batching, stats |
| `src/placeholders.ts` | Placeholder and tag extraction and comparison, overflow hint |
| `src/formats.ts` | Detect, parse and export the five catalog formats |
| `src/main.ts` | UI |

## Security and privacy

- Strings are rendered as text (no `innerHTML`), so a catalog can't inject markup into the page.
- In Private mode the app makes no model request over the network; in Hybrid mode the cloud receives only the strings that failed an on-device check, plus every string of a language pair Nano can't handle on this device.
- Android XML with entity declarations (`<!ENTITY`) is refused; files are capped at 2 MB and 2,000 strings.

## Licence

Apache-2.0 © 2026 Sweekly Apps LLC (`LICENSE`). Built with AI coding assistance. Third-party open-source components are listed in `NOTICE` under their own licences; all other rights in the submission, to the extent they exist, are held by Sweekly Apps LLC. Data and media sources: `PROVENANCE.md`. Licence check: `npm run licence-scan`.

Firebase, Gemini and Chrome are trademarks of Google LLC. Telegram is a trademark of its owner. Wikipedia is a trademark of the Wikimedia Foundation. Used for identification only.
