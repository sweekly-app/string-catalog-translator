# Demo video (1:31; hard limit under 3:00)

Footage: one real screen recording of the deployed final build in desktop Chrome with Gemini Nano, made by Sweekly Apps. Company voice only: no face, no personal name. Narration is an AI voice (ElevenLabs), recorded after the footage, because the numbers in row 2 and the reason in row 3 come from the real run. No logos: citations are text. YouTube description must contain: "Narration: AI-generated voice (ElevenLabs)."

The takes in `narration/` are read from this table, one per row; `compose.sh` builds the cut from `cuts.txt` (rows 1-5) and the cards (rows 6-8).

| # | Time | Picture | Narration (AI voice) |
| --- | --- | --- | --- |
| 1 | 0:00-0:09 | Recording (step 8): Translate clicked; the real wait at 40x, labelled; the finished table with green "On-device" badges. Caption: "A client's unreleased app, translated on this laptop" | "This is a client's next release, still under NDA. Gemini Nano is translating it inside Chrome, on this laptop." |
| 2 | 0:09-0:20 | Recording (step 9): the receipt headline, whole box in view. Caption: "What left this laptop, and why" | "Seventy-one of seventy-two translations never left this browser. One went to the cloud, with its reason. Twelve of them are confidential, and those are never sent." |
| 3 | 0:20-0:32 | Recording (step 10): one "Cloud fix" cell with its reason. Caption: "Failed a check, so the cloud fixed it" | "Here the on-device answer failed a check: the Japanese for 'Sign out' was missing from the model's reply. Only that string went to Gemini in the cloud, and the reason is written next to it." |
| 4 | 0:32-0:40 | Recording (step 11): a `feature.unreleased.*` row with the "Held back" badge. Caption: "Confidential: never sent" | "These keys are marked never send. They are translated on the device or flagged for a person, never escalated." |
| 5 | 0:40-0:49 | Recording (steps 12-13): the receipt lists and the "Download receipt (.json)" and "Save run (.json)" buttons. Caption: "A receipt for the client" | "The receipt lists every string that left and every string kept back. Download it, or save the whole run, and hand it to the client with the release." |
| 6 | 0:49-1:10 | `cards/01-why.png` | "Why it matters: localisation is where a roadmap leaks. A popular messaging app's paid tier was spotted in its translation strings before launch. And more than one in four organisations have banned generative AI apps for now. Under an NDA, you can't paste this into a cloud translator." |
| 7 | 1:10-1:24 | `cards/02-how.png` | "Under the hood: Firebase AI Logic hybrid inference. Gemini Nano in Chrome first; per-string checks decide what may go to cloud Gemini; checkout strings may go out, unreleased feature keys never do." |
| 8 | 1:24-1:31 | `cards/03-end.png` | "String Catalog Translator. Open source, by Sweekly Apps. Narration: AI-generated voice." |

Cut notes: rows 1-5 are clips of one recording (15 Nov 2026, desktop Chrome with Gemini Nano, the deployed demo), in its real order; the segments are in `cuts.txt`. The numbers in row 2 and the reason in row 3 are read from that recording's receipt: 71 of 72 translations on-device, 12 of them confidential, 1 Cloud fix (`account.logout`, Japanese, "first try on-device: missing from the model's reply"). Row 1 shows the click on Translate, then the real 1 min 50 s wait at 40x speed with a label saying so, then the finished table. Only that wait is sped up, never a result. Rows 2-5 may zoom into part of the frame (crop) and hold their last frame until the narration ends. Nothing is simulated or re-made.
