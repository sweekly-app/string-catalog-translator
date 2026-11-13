# String Catalog Translator

**Translate an app's UI strings on your own device with Gemini Nano. Only the strings that fail a check go to Gemini in the cloud.**

Built for #BuildHybridAI with [Firebase AI Logic hybrid inference](https://firebase.google.com/docs/ai-logic): Gemini Nano runs inside Chrome through the built-in Prompt API, and the same `GenerativeModel` falls back to a Gemini model in the cloud.

## The problem

Machine translation of UI strings breaks apps in boring, expensive ways: `{amount}` becomes `{montant}`, `%1$d` disappears, `<b>` loses its closing tag, the brand name gets translated, "Remove" turns into a 40-character phrase that overflows its button. Most teams also can't paste an unreleased product's strings into a cloud service without a review.

## Who it's for and why it matters

Indie developers and small teams who ship a Flutter, Android, iOS or web app and want it in more languages without a localisation budget. Today they choose between paying per word for an agency or a cloud API, and pasting their strings into a chatbot and fixing the broken placeholders by hand. String Catalog Translator does most of the work for free on the developer's own machine, sends only the hard cases to the cloud, and never exports a string that fails a check: it flags the string in the table for a person instead. That means one run per release, minutes rather than days, and a file that drops straight into the project.

## What it does

1. **Paste or open a string catalog**: JSON (flat or nested), Flutter ARB, Android `strings.xml`, Apple `.strings` or Apple String Catalog (`.xcstrings`). The format is detected; notes and descriptions are kept and sent as context.
2. **Pick languages and where strings may go**:
   - **Hybrid** (default): Gemini Nano on this device for every language pair Chrome supports; Gemini in the cloud for pairs Nano lacks.
   - **Private**: on-device only. Nothing leaves the browser; what fails is flagged for a human.
   - **Cloud**: Gemini in the cloud for everything.
3. **Every translation is checked**: same placeholders and tags (order may change), ICU plural and select keywords unchanged, keep-unchanged terms present, nothing empty or missing, likely UI overflow.
4. **Hybrid escalation**: when an on-device translation fails a check, only that string, not the batch, is re-sent to the cloud. The table shows each string's origin: *On-device*, *Cloud*, or *Cloud fix* with the reason.
5. **Edit and export**: every cell is editable and re-checked on edit; export to any of the five formats (each in the platform's folder naming: `values-pt-rBR/strings.xml`, `app_pt_BR.arb`, `ja.lproj/Localizable.strings`), or one `.xcstrings` file with every language marked `needs_review` for Xcode. Strings that still fail a check are left out of the files after a warning, so the app falls back to the source language there instead of shipping a broken placeholder. Android styled strings (`<b>`, `<i>`, `<a>`) keep their markup.

The summary shows how much ran on the device, how much went to the cloud, how much the cloud fixed, and what still needs a person.

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
- `response.inferenceSource` (`on_device` / `in_cloud`) is shown on every string and counted in the summary.
- An on-device error does not fall back inside the SDK in `prefer_on_device` mode; the app retries that batch with `only_in_cloud` (Hybrid) or flags it (Private).
- `initializeDeviceModel()` runs from the *Download Gemini Nano* button (a user gesture), with a progress bar.
- In Private mode, a failed string gets one more on-device try, alone, since a shorter prompt is easier for a small model.
- **App Check** (reCAPTCHA Enterprise, or v3 by build setting) protects the cloud calls, so only this site can spend the project's Gemini quota. Local development uses an App Check debug token.
- **Remote Config** serves the cloud model name, the batch size and a switch that pauses the cloud fallback (the app then runs in Private mode), all without a redeploy. Defaults are in code, and malformed values are ignored (`src/policy.ts`).

The routing is pure TypeScript with the model call injected (`src/engine.ts`), so it is unit-tested without a browser.

## Run it

```bash
npm install
cp .env.example .env.local   # paste your Firebase web config as one line of JSON
npm run dev
```

- Firebase console → AI Logic → Gemini Developer API; then Project settings → Add app → Web, and copy the `firebaseConfig` into `VITE_FIREBASE_CONFIG`.
- App Check: register the web app with reCAPTCHA Enterprise (default) or classic reCAPTCHA v3, and set the site key (`VITE_RECAPTCHA_SITE_KEY`) and the provider (`VITE_APPCHECK_PROVIDER`: `enterprise` or `v3`). In `npm run dev` the app prints an App Check debug token in the console; add it under App Check → Manage debug tokens.
- The deployed demo reads both values from GitHub Actions repository variables; no keys are committed.
- Without a config the app runs in Private mode only: Gemini Nano in Chrome, no network calls to a model.
- On-device needs desktop Chrome with built-in AI (Gemini Nano); see [Chrome's hardware requirements](https://developer.chrome.com/docs/ai/get-started).

```bash
npm test          # 58 unit tests: formats, placeholders and ICU, routing, Remote Config policy
npm run build     # typecheck + production build to dist/
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
- In Private mode the app makes no model request over the network; in Hybrid mode only the strings that need it are sent.
- Android XML with a DTD is refused; files are capped at 2 MB and 2,000 strings.

## Licence

Apache-2.0 © 2026 Sweekly Apps LLC (`LICENSE`). Built with AI coding assistance. Third-party open-source components are listed in `NOTICE` under their own licences; all other rights in the submission, to the extent they exist, are held by Sweekly Apps LLC. Data and media sources: `PROVENANCE.md`. Licence check: `npm run licence-scan`.
