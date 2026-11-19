# Devpost submission: #BuildHybridAI

The text of each field of the Devpost submission form, and how the project meets the official rules.

- **Entrant:** Organization, Sweekly Apps LLC, United States, display name "Sweekly Apps".
- **Deadline:** 30 Nov 2026 14:00 PST (22:00 UTC). Commits after that are not evaluated.
- **Judging** (official rules §8): stage one is pass/fail on every requirement. Stage two scores four equal criteria from 1 to 5: Technological Implementation (how well it is built and how effectively it uses Firebase AI Logic hybrid inference), Design (a complete, coherent product, not a proof of concept), Potential Impact (a credible, specific case for a real problem and a real audience), and Quality of the Idea (creative, non-obvious, with real understanding of the problem).
- **Requirement checklist** (rules §6): Web (Chrome) with Gemini Nano via Firebase AI Logic ✔; App Check ✔ (reCAPTCHA); a text description with how Firebase AI Logic is used, the features and the value proposition ✔ (below); a public GitHub repo with all source, instructions and the value proposition, Firebase AI Logic imported and called at runtime (`src/ai.ts`) ✔; an open-source licence file shown in the repo's About section ✔ (Apache-2.0, the preferred one); a public YouTube video under 3 minutes, in English, showing the app working on its platform ✔; a free hosted demo ✔; no production keys, secrets or personal data in the repo, form or instructions ✔ (the config is in Actions variables).

## Project name
String Catalog Translator

## Elevator pitch (max 200 characters)
Localise a client's unreleased app without sending its roadmap to the cloud: Gemini Nano translates on your laptop, confidential keys never leave, and a receipt lists every string that did.

## About the project (Markdown field)

### Value proposition
A release's string file is its roadmap. String Catalog Translator lets a developer localise unreleased strings without handing that roadmap to a cloud service: Gemini Nano translates them in Chrome on their own machine, every string is checked for broken placeholders, tags and brand names, only the strings that fail (or languages Nano can't serve there) go to Gemini in the cloud, and keys marked confidential never do. A receipt for the client lists how many translations never left the laptop, which strings did, and why. The output drops straight into Flutter, Android, iOS or web projects.

### Who it's for
Agencies, contract developers and small app teams who translate a client's or their own next release before launch, often under an NDA. Today they send everything to a vendor or a cloud tool and hope, or translate by hand and fix broken placeholders.

Tested on a real catalog, not only the sample: the English `strings.xml` of the open-source Wikipedia Android app (2,261 strings, 72 of them in CDATA; Apache License 2.0). Importing and exporting it found a bug: inside CDATA, Android's `\'` escape reached the model, and the exported file would have shown `it\'s` in the app. It is fixed with a test, and the whole file now goes in and out with no string changed. A 33-string excerpt was then translated on-device in desktop Chrome with Gemini Nano into Spanish, Japanese, French and German (18 Nov 2026, the first run in the video): 127 of 132 translations never left the browser; in five Japanese and German strings Nano dropped an HTML tag, the check caught each one and only those five went to Gemini in the cloud. Used for testing only; Wikimedia is not affiliated with and does not endorse this project.

### Inspiration
Localisation is where a release's roadmap leaks: Telegram Premium was seen before launch in strings on its own translation platform, cited as "further proof of his earlier leak pointing to the imminent launch of Telegram Premium" ([Notebookcheck, 28 May 2022](https://www.notebookcheck.net/Telegram-More-evidence-of-a-new-Premium-tier-allegedly-comes-to-light-thanks-to-new-website-code.622988.0.html)). Buyers react by keeping AI away from confidential text: 27 % of organisations in Cisco's 2024 privacy benchmark "had banned GenAI applications altogether for the time being" ([Cisco, 25 Jan 2024](https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2024/m01/organizations-ban-use-of-generative-ai-over-data-privacy-security-cisco-study.html)), and one UK translation agency's policy says its translators "should not use AI translation tools for our clients’ work unless we have specifically asked them to do so" ([Atlas Translations, 25 Aug 2026](https://www.atlas-translations.co.uk/blog/ai-legislation-in-translation/)). Translation is where pre-launch strings leave the building. Hybrid inference fits this job exactly: a small on-device model can translate UI strings in place, per-string checks decide which few are worth sending to a bigger cloud model, and the team decides which may never go.

### What it does
String Catalog Translator opens the five catalog formats app developers use (JSON, Flutter ARB, Android strings.xml, Apple .strings and Apple String Catalogs) and translates them into up to 15 languages.

- **Hybrid** (default): Gemini Nano runs in Chrome for every language pair it supports; pairs it doesn't support go to Gemini in the cloud.
- **Never send to the cloud**: key prefixes such as `feature.unreleased.`. Those strings are translated on-device only in every mode; one that fails a check is flagged for a person, never escalated. Without Gemini Nano they are held back untranslated, with no request at all.
- **Receipt**: "N of M translations never left this browser (A translated on-device, H confidential kept on the device) · K sent to the cloud", the policy in force, each string that left with its reason, and a JSON download for the client or the release log.
- **Saved runs**: save the whole run (catalog, policy, every result) and reopen it exactly as recorded.
- **Checks on every string**: the same placeholders and tags (`{name}`, `{{name}}`, `%1$s`, `%@`, `<b>`), ICU select keywords unchanged and plural forms valid with `other` kept, keep-unchanged terms such as brand names, no empty or missing output, and a warning for likely UI overflow.
- **Escalation, one string at a time**: when an on-device translation fails a check, only that string is re-sent to the cloud. Each cell shows where it was translated: On-device, Cloud, or Cloud fix with the reason.
- **Private mode**: on-device only, no string leaves the browser, and failures are flagged for a person instead of being sent anywhere. It is offered only when Gemini Nano serves a chosen language in this Chrome.
- **Edit and export**: every cell is editable and re-checked on edit; export to any of the five formats as one .zip with each language in its platform's folder (`values-pt-rBR/strings.xml`), or a single .xcstrings file with every language marked "needs review" in Xcode. Strings that still fail a check are left out after a warning, so the app falls back to the source language instead of shipping a broken placeholder.

Summary tiles show what share ran on the device, what went to the cloud, what the cloud fixed and what still needs a person.

### How we built it
- Vite and TypeScript, Firebase JS SDK 13.3 with **Firebase AI Logic** (Gemini Nano in Chrome on-device): `getAI` with the Gemini Developer API backend and `getGenerativeModel` in `prefer_on_device`, `only_on_device` and `only_in_cloud` modes, with `gemini-3.5-flash-lite` as the cloud model.
- One model per language pair. `onDeviceParams.createOptions` declares the expected input and output languages, so Chrome's `LanguageModel.availability()` answers per pair and the SDK sends unsupported pairs to the cloud by itself.
- `response.inferenceSource` labels every string, and `initializeDeviceModel()` downloads Gemini Nano from a button, with a progress bar.
- The routing engine is pure TypeScript with the model call injected, so the hybrid rules (keep, escalate, flag) are covered by unit tests without a browser. There are 83 tests across formats, placeholders (ICU plural and select included), routing, confidential keys, the receipt, busy-cloud retries, saved runs, the zip export, the video text and the Remote Config policy.
- **App Check** (reCAPTCHA Enterprise or v3, chosen at build time; debug tokens for local development) protects the cloud calls; enforcement is on for the demo project, so only the demo site can spend its Gemini quota. Each cloud call that meets a busy cloud (429 or 503) is retried once, then explained in plain words; on-device results are unaffected.
- **Remote Config** serves the cloud model name, the batch size and a switch that pauses the cloud fallback (the app then runs in Private mode), all without a redeploy. Values are validated, and defaults live in code.
- No server: a static site on GitHub Pages, built by GitHub Actions; the Firebase config comes from repository variables, not the source.

### Challenges we ran into
- In `prefer_on_device` mode, an error thrown on-device does not fall back to the cloud inside the SDK, so the app catches it and retries the batch with `only_in_cloud`, labelled as a cloud fix.
- A small model sometimes "translates" placeholders. Comparing the multiset of placeholders, not their order, lets languages reorder them (`%2$d … %1$s`) while catching real breakage, without false alarms on French spacing such as `{percent} %`.
- Each platform escapes differently: Android's `\'` and leading `@`, Apple's `\"`, ARB's `pt_BR` against Android's `values-pt-rBR`. The converters round-trip under test.

### Accomplishments that we're proud of
Hybrid as a data policy you can audit: checks decide which strings may go to the cloud, the team decides which never may, and the receipt shows what actually left. Every cell says whether it was translated on-device, in the cloud, fixed by the cloud after a failed check, or held back.

### What we learned
The useful question is not "on-device or cloud" but "which string, and who decides": a mechanical check per string and a policy per key answer it better than one global switch. Counting a failed call as possibly sent keeps the receipt honest.

### What's next
Translation memory stored on the device, a glossary per project, and a signed receipt a client can verify.

Firebase, Gemini and Chrome are trademarks of Google LLC. Telegram is a trademark of its owner. Wikipedia is a trademark of the Wikimedia Foundation. Used for identification only.

## Built with
firebase, firebase-ai-logic, firebase-app-check, firebase-remote-config, gemini-nano, gemini, chrome-built-in-ai, prompt-api, typescript, vite, vitest, github-pages

## Try it out
- Live demo: https://sweekly-app.github.io/string-catalog-translator/ (free; desktop Chrome with built-in AI for on-device; other browsers use the cloud)
- Source: https://github.com/sweekly-app/string-catalog-translator

## Video
The public YouTube link (under 3 minutes). Its description contains: "Narration: AI-generated voice (ElevenLabs)." and "Test input shown on screen: strings from the open-source Wikipedia Android app, Apache License 2.0. Wikimedia is not affiliated with and does not endorse this project."

## Testing instructions for judges
Open the live demo in desktop Chrome (Gemini Nano: see developer.chrome.com/docs/ai/get-started). Click **Load sample** (a client app's next release; "Never send to the cloud" is prefilled with `feature.unreleased.`), keep **Hybrid**, click **Translate**. The status panel shows which language pairs run on this device. If it says "Nano can be downloaded", click **Download Gemini Nano** first. Read the **receipt** above the table: how many translations never left the browser, which strings went to the cloud and why, and the three confidential keys kept on the device in every language. Tick **Only strings that need a look** to see escalations and flags, then export with any format button or download the receipt. In a browser without Gemini Nano, open strings go to the cloud and are labelled "Cloud", Private mode is not offered, and the confidential strings are held back untranslated: the receipt shows that too, in grey. To see an on-device run there, click **See a recorded on-device run**: a run saved on 18 Nov 2026 in desktop Chrome with Gemini Nano, shown exactly as recorded (nothing is translated again and nothing is sent). It is the sample run shown in the video (70 of 72 on-device). No account and no payment are needed.

## Statements

Required by rules §6: what was built during the submission period, any pre-existing code, and authorisation for third-party tools.

**Built during the submission period:** all of the code in this repository was written between 13 and 30 Nov 2026 for this hackathon: the app, the routing engine, the format converters, the tests and the demo.

**Pre-existing code:** none of our own. Standard tools only: the Firebase JS SDK, Vite, TypeScript and Vitest (open source, installed from package.json, not committed, listed in NOTICE under their own licences), and an AI coding assistant (see below). No starter template, and no third-party code in the repository.

**AI tools:** the code and text were written with an AI coding assistant (Claude by Anthropic), directed and reviewed by Sweekly Apps. The app itself uses only Gemini (Gemini Nano on-device and Gemini in the cloud) through Firebase AI Logic. The video narration is an AI-generated voice (ElevenLabs).

**Ownership and disclosure:** "Built with AI coding assistance. Third-party open-source components are listed in NOTICE under their own licences; all other rights in the submission, to the extent they exist, are held by Sweekly Apps LLC."

**Data and media:** synthetic sample data written for this project, plus one public open-source strings file used under its licence (see NOTICE); our own icon, cards and screen recording. The narration is an AI-generated voice. No scraped or personal data, and no third-party logos, images or music (`PROVENANCE.md`).

**Third-party tools:** Firebase AI Logic, App Check and Remote Config are used under the Firebase terms on a Firebase project owned by Sweekly Apps; Gemini Nano is used through Chrome's built-in AI under Chrome's terms.

**Third-party content:** the sample strings were written for this demo; the app and the video add no third-party logos (screen recordings show the browser's own interface). The video shows, on screen and as test input only, text from the strings file of the open-source Wikipedia Android app (Apache License 2.0); the narration does not name it. The written description cites three public sources by name, with short quotes and links, for context only, and names the open-source Wikipedia Android app (Apache License 2.0) whose English strings file was used to test the importer; none of them is affiliated with or endorses this project. Test input shown on screen: strings from the open-source Wikipedia Android app, Apache License 2.0. Wikimedia is not affiliated with and does not endorse this project.
