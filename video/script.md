# Demo video (about 2:00 with the final narration; hard limit under 3:00)

Narration: `narration/01.mp3`–`06.mp3`, ElevenLabs voice "Matilda", eleven_multilingual_v2 (13 Nov). Times below are the first estimate; the real takes run 12, 11, 55, 22, 6 and 8 s.

AI narration (ElevenLabs), no face, no personal name. Footage is real: the demo clip is a screen recording of the deployed app in desktop Chrome with Gemini Nano . Nothing is simulated. YouTube description must contain: "Narration: AI-generated voice (ElevenLabs)."

| # | Time | Picture | Narration |
| --- | --- | --- | --- |
| 1 | 0:00–0:16 | `cards/01-title.png` | Shipping an app in ten languages usually means pasting every string into a cloud translator and hoping. Then a placeholder gets translated, a tag disappears, and your checkout screen breaks in French. |
| 2 | 0:16–0:30 | `cards/02-idea.png` | String Catalog Translator does it the other way round. Gemini Nano translates on your own device. Every string is checked. Only the ones that fail go to Gemini in the cloud. |
| 3 | 0:30–1:50 | screen recording `footage/demo.mov`, trimmed and sped to fit | Open any catalog: JSON, Flutter ARB, Android strings X M L, Apple strings, or a String Catalog. Here, a checkout screen with placeholders, tags and a brand name to keep. Pick the languages. The panel asks Chrome, pair by pair, whether Gemini Nano can handle it on this device. Hybrid mode is the default. Translate. Every cell shows where it ran: on-device, in the cloud, or a cloud fix when the on-device answer failed a check. The checks compare placeholders and tags, keep brand names unchanged, and warn when a translation will overflow its button. Filter to the strings that need a look, edit one, and it is checked again. Then export: per-platform files, or one String Catalog for Xcode with every language marked for review. |
| 4 | 1:50–2:16 | `cards/03-how.png` | Under the hood it's Firebase AI Logic hybrid inference. One model per language pair declares its languages, so Chrome answers for each pair, and pairs Nano doesn't support go to the cloud automatically. The response says where inference ran. If the on-device call fails, the app retries in the cloud, and only for the strings that need it. |
| 5 | 2:16–2:32 | `cards/04-private.png` | And when strings can't leave the building, Private mode keeps everything on the device and flags what needs a person. |
| 6 | 2:32–2:40 | `cards/05-end.png` | String Catalog Translator. On-device first, cloud only when it has to. Open source, by Sweekly Apps. |
