# Provenance of data and media

Every piece of data or media in this repository and in the demo video, with its source. No scraped, personal or third-party data.

| Item | Where | Source |
| --- | --- | --- |
| Sample string catalog ("Load sample") | `src/sample.ts` | Synthetic, written for this project. The shop name is our own company name. |
| Unit test fixtures | `test/*.test.ts` | Synthetic, written for this project. |
| App icon | `public/icon.svg` | Drawn for this project (hand-written SVG). |
| Video title cards | `video/cards.html` → `video/cards/*.png` | Made for this project. Text only, plus our icon. The only product names shown are Google's own (Firebase AI Logic, Gemini, Gemini Nano). |
| Video narration | `video/narration/*.mp3` | AI-generated voice (ElevenLabs, premade voice "Matilda", model eleven_multilingual_v2) on our paid plan, from our own script (`video/script.md`). |
| Video footage | the screen recording in the video (not in the repo) | Our own recording of this app running in Google Chrome. |
| Fonts | `src/style.css` | The visitor's system fonts; no font files are shipped. |
| Music | none | n/a |

Language names in `src/engine.ts` are plain English words. AI output shown in the app or the video is generated at runtime by Gemini (Google) from the synthetic sample.
