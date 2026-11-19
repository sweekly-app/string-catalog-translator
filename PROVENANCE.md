# Provenance of data and media

Every piece of data or media in this repository and in the demo video, with its source. No scraped, personal or third-party data.

| Item | Where | Source |
| --- | --- | --- |
| Sample string catalog ("Load sample") | `src/sample.ts` | Synthetic, written for this project: a "client app" checkout screen and three strings for an imaginary unreleased feature. The shop name is our own company name. |
| Unit test fixtures | `test/*.test.ts` | Synthetic, written for this project. |
| App icon | `public/icon.svg` | Drawn for this project (hand-written SVG). |
| Video title cards | `video/cards.html` → `video/cards/*.png` | Made for this project. Text only, plus our icon; no logos or images. Product names shown: Google's own (Firebase AI Logic, Gemini, Gemini Nano). The "why it matters" card states two public facts without naming the companies or outlets; the sources are linked in README.md and SUBMISSION.md, and Sweekly Apps keeps a dated copy of each cited page (captured 14 Nov 2026). |
| Video narration | `video/narration/*.mp3` | AI-generated voice (ElevenLabs, voice "Chris", model eleven_v3) on our paid plan, from our own script (`video/script.md`). One take per row of the current script (`video/narration/README.md`); the on-screen captions are the narration text, timed from the alignment ElevenLabs returns with each take. |
| Video footage | the screen recording in the video (not in the repo) | Our own recording of this app running in Google Chrome (18 Nov 2026). Its first run translates an unmodified 33-string excerpt of the open-source Wikipedia Android app's strings file (Apache License 2.0), used as test input: `third_party/wikipedia-android/` (source https://github.com/wikimedia/apps-android-wikipedia, `app/src/main/res/values/strings.xml` at commit b39e649981a97d8e24eb938f04ccc3d20aa3b456, licence file and source line there). Row 5 is our own capture of this app replaying the bundled recorded run and exporting it (`video/capture-export.cjs`), labelled as a replay. |
| Stills | `video/stills/*.png` | Frames of that recording (18 Nov 2026), cropped and scaled; nothing edited. |
| Recorded run | `src/recorded-run.json` | A run of this app saved with *Save run (.json)* on 18 Nov 2026 in desktop Chrome with Gemini Nano, on the built-in sample catalog (the sample run in the video); unedited. |
| Fonts | `src/style.css` | The visitor's system fonts; no font files are shipped. |
| Music | none | n/a |

Language names in `src/engine.ts` are plain English words. AI output shown in the app or the video is generated at runtime by Gemini (Google) from the synthetic sample.
