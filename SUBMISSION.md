# Devpost submission: #BuildHybridAI

The text of each field of the Devpost submission form, and how the project meets the official rules.

- **Entrant:** Organization, Sweekly Apps LLC, United States, display name "Sweekly Apps".
- **Deadline:** 30 Nov 2026 14:00 PST (22:00 UTC). Commits after that are not evaluated.
- **Judging** (official rules §8): stage one is pass/fail on every requirement. Stage two scores four equal criteria from 1 to 5: Technological Implementation (how well it is built and how effectively it uses Firebase AI Logic hybrid inference), Design (a complete, coherent product, not a proof of concept), Potential Impact (a credible, specific case for a real problem and a real audience), and Quality of the Idea (creative, non-obvious, with real understanding of the problem).
- **Requirement checklist** (rules §6): Web (Chrome) with Gemini Nano 4 via Firebase AI Logic ✔; App Check ✔ (reCAPTCHA); a text description with how Firebase AI Logic is used, the features and the value proposition ✔ (below); a public GitHub repo with all source, instructions and the value proposition, Firebase AI Logic imported and called at runtime (`src/ai.ts`) ✔; an open-source licence file shown in the repo's About section ✔ (Apache-2.0, the preferred one); a public YouTube video under 3 minutes, in English, showing the app working on its platform ✔; a free hosted demo ✔; no production keys, secrets or personal data in the repo, form or instructions ✔ (the config is in Actions variables).

## Project name
String Catalog Translator

## Elevator pitch (max 200 characters)
Translate your app's UI strings on-device with Gemini Nano. Every string is checked; only failures, and languages Nano lacks, go to Gemini in the cloud. JSON, ARB, strings.xml, .xcstrings.

## About the project (Markdown field)

### Value proposition
Ship your app in more languages without breaking it and without sending everything to the cloud. Gemini Nano translates UI strings for free on the developer's own machine. Every string is checked for broken placeholders, tags and brand names, and only the strings that fail go to Gemini in the cloud. The output drops straight into Flutter, Android, iOS or web projects.

### Who it's for
Indie developers and small teams with a Flutter, Android, iOS or web app and no localisation budget. Today they either pay per word for an agency or a cloud API, or paste their strings into a chatbot and fix the broken placeholders by hand.

### Inspiration
Shipping an app in ten languages usually means pasting every string into a cloud translator and hoping. Then `{amount}` comes back as `{montant}`, `%1$d` vanishes, the brand name gets translated and "Remove" overflows its button. And many teams can't send an unreleased product's strings to a cloud service at all. Hybrid inference fits this job exactly: a small on-device model handles most UI strings well, and the cloud model is only needed for the hard cases.

### What it does
String Catalog Translator opens the five catalog formats app developers use (JSON, Flutter ARB, Android strings.xml, Apple .strings and Apple String Catalogs) and translates them into up to 15 languages.

- **Hybrid** (default): Gemini Nano runs in Chrome for every language pair it supports; pairs it doesn't support go to Gemini in the cloud.
- **Checks on every string**: the same placeholders and tags (`{name}`, `{{name}}`, `%1$s`, `%@`, `<b>`), ICU plural and select keywords unchanged, keep-unchanged terms such as brand names, no empty or missing output, and a warning for likely UI overflow.
- **Escalation, one string at a time**: when an on-device translation fails a check, only that string is re-sent to the cloud. Each cell shows where it was translated: On-device, Cloud, or Cloud fix with the reason.
- **Private mode**: on-device only, nothing leaves the browser, and failures are flagged for a person instead of being sent anywhere.
- **Edit and export**: every cell is editable and re-checked on edit; export to any of the five formats with each platform's file naming, or a single .xcstrings file with every language marked "needs review" in Xcode. Strings that still fail a check are left out after a warning, so the app falls back to the source language instead of shipping a broken placeholder.

A summary shows what share ran on the device, what went to the cloud, what the cloud fixed and what still needs a person.

### How we built it
- Vite and TypeScript, Firebase JS SDK 13.3 with **Firebase AI Logic** (Gemini Nano 4 in Chrome on-device): `getAI` with the Gemini Developer API backend and `getGenerativeModel` in `prefer_on_device`, `only_on_device` and `only_in_cloud` modes, with `gemini-3.5-flash-lite` as the cloud model.
- One model per language pair. `onDeviceParams.createOptions` declares the expected input and output languages, so Chrome's `LanguageModel.availability()` answers per pair and the SDK sends unsupported pairs to the cloud by itself.
- `response.inferenceSource` labels every string, and `initializeDeviceModel()` downloads Gemini Nano from a button, with a progress bar.
- The routing engine is pure TypeScript with the model call injected, so the hybrid rules (keep, escalate, flag) are covered by unit tests without a browser. There are 58 tests across formats, placeholders (ICU plural and select included), routing and the Remote Config policy.
- **App Check** (reCAPTCHA Enterprise or v3, chosen at build time; debug tokens for local development) protects the cloud calls, so only the demo site can spend the project's Gemini quota.
- **Remote Config** serves the cloud model name, the batch size and a switch that pauses the cloud fallback (the app then runs in Private mode), all without a redeploy. Values are validated, and defaults live in code.
- No server: a static site on GitHub Pages, built by GitHub Actions; the Firebase config comes from repository variables, not the source.

### Challenges we ran into
- In `prefer_on_device` mode, an error thrown on-device does not fall back to the cloud inside the SDK, so the app catches it and retries the batch with `only_in_cloud`, labelled as a cloud fix.
- A small model sometimes "translates" placeholders. Comparing the multiset of placeholders, not their order, lets languages reorder them (`%2$d … %1$s`) while catching real breakage, without false alarms on French spacing such as `{percent} %`.
- Each platform escapes differently: Android's `\'` and leading `@`, Apple's `\"`, ARB's `pt_BR` against Android's `values-pt-rBR`. The converters round-trip under test.

### Accomplishments that we're proud of
In Hybrid mode the cloud receives only the strings that need it, and every cell says whether it was translated on-device, in the cloud, or fixed by the cloud after a failed check.

### What we learned
For UI strings, on-device output is good enough most of the time; checking each string decides when the cloud is worth calling.

### What's next
ICU plural and select messages, translation memory stored on the device, and a glossary per project.

## Built with
firebase, firebase-ai-logic, firebase-app-check, firebase-remote-config, gemini-nano, gemini, chrome-built-in-ai, prompt-api, typescript, vite, vitest, github-pages

## Try it out
- Live demo: https://sweekly-app.github.io/string-catalog-translator/ (free; desktop Chrome with built-in AI for on-device; other browsers use the cloud)
- Source: https://github.com/sweekly-app/string-catalog-translator

## Video
The public YouTube link (under 3 minutes). Its description contains: "Narration: AI-generated voice (ElevenLabs)."

## Testing instructions for judges
Open the live demo in desktop Chrome (Gemini Nano: see developer.chrome.com/docs/ai/get-started). Click **Load sample**, keep **Hybrid**, click **Translate**. The status panel shows which language pairs run on this device. If it says "Nano can be downloaded", click **Download Gemini Nano** first. Tick **Only strings that need a look** to see escalations and flags, then export with any format button. In a browser without built-in AI, everything goes to the cloud and is labelled "Cloud". No account and no payment are needed.

## Statements

Required by rules §6: what was built during the submission period, any pre-existing code, and authorisation for third-party tools.

**Built during the submission period:** all of the code in this repository was written between 13 and 30 Nov 2026 for this hackathon: the app, the routing engine, the format converters, the tests and the demo.

**Pre-existing code:** none of our own. Standard tools only: the Firebase JS SDK, Vite, TypeScript and Vitest (open source, installed from package.json, not committed, listed in NOTICE under their own licences), and an AI coding assistant (see below). No starter template, and no third-party code in the repository.

**AI tools:** the code and text were written with an AI coding assistant (Claude by Anthropic), directed and reviewed by Sweekly Apps. The app itself uses only Gemini (Gemini Nano on-device and Gemini in the cloud) through Firebase AI Logic. The video narration is an AI-generated voice (ElevenLabs).

**Ownership and disclosure:** "Built with AI coding assistance. Third-party open-source components are listed in NOTICE under their own licences; all other rights in the submission, to the extent they exist, are held by Sweekly Apps LLC."

**Data and media:** synthetic sample data written for this project, and our own icon, cards and screen recording. The narration is an AI-generated voice. No scraped, personal or third-party data, and no third-party logos, images or music (`PROVENANCE.md`).

**Third-party tools:** Firebase AI Logic, App Check and Remote Config are used under the Firebase terms on a Firebase project owned by Sweekly Apps; Gemini Nano is used through Chrome's built-in AI under Chrome's terms.

**Third-party content:** the sample strings were written for this demo; no third-party trademarks or copyrighted material are used in the app or the video.
