# Demo video (about 2:00; hard limit under 3:00)

Footage: one real screen recording of the deployed final build in desktop Chrome with Gemini Nano, made by Sweekly Apps. Company voice only: no face, no personal name. Narration is an AI voice (ElevenLabs), recorded after the footage, because the numbers in row 2 and the reason in row 3 come from the real run. No logos: citations are text. YouTube description must contain: "Narration: AI-generated voice (ElevenLabs)."

The takes in `narration/` follow an earlier script and are replaced from this table before composing; `compose.sh` builds the cut from `footage/cuts.txt` (rows 1-5) and the cards (rows 6-8).

| # | Time | Picture | Narration (AI voice) |
| --- | --- | --- | --- |
| 1 | 0:00-0:12 | Recording (step 8): Translate clicked; the language columns fill with green "On-device" badges. Caption: "A client's unreleased app, translated on this laptop" | "This is a client's next release, still under NDA. Gemini Nano is translating it inside Chrome, on this laptop." |
| 2 | 0:12-0:24 | Recording (step 9): the receipt headline, whole box in view. Caption: "What left this laptop, and why" | "[N] of [M] translations never left this browser. [X] went to the cloud, each with a reason. [Y] confidential strings stayed on the device." |
| 3 | 0:24-0:39 | Recording (step 10): one "Cloud fix" cell with its reason. Caption: "Failed a check, so the cloud fixed it" | "Here the on-device answer failed a check: [reason read from the cell]. Only that string went to Gemini in the cloud, and the reason is written next to it." |
| 4 | 0:39-0:52 | Recording (step 11): a `feature.unreleased.*` row with the "Held back" badge. Caption: "Confidential: never sent" | "These keys are marked never send. They are translated on the device or flagged for a person, never escalated." |
| 5 | 0:52-1:08 | Recording (steps 12-13): the receipt lists; click "Download receipt (.json)" and "Save run (.json)". Caption: "A receipt for the client" | "The receipt lists every string that left and every string kept back. Download it, or save the whole run, and hand it to the client with the release." |
| 6 | 1:08-1:24 | `cards/01-why.png` | "Why it matters: localisation is where a roadmap leaks. A popular messaging app's paid tier was spotted in its translation strings before launch. And more than one in four organisations have banned generative AI apps for now. Under an NDA, you can't paste this into a cloud translator." |
| 7 | 1:24-1:42 | `cards/02-how.png` | "Under the hood: Firebase AI Logic hybrid inference. Gemini Nano in Chrome first; per-string checks decide what may go to cloud Gemini; checkout strings may go out, unreleased feature keys never do." |
| 8 | 1:42-1:52 | `cards/03-end.png` | "String Catalog Translator. Open source, by Sweekly Apps. Narration: AI-generated voice." |

Cut notes: row 1 is the final receipt frame of the same recording, moved to the front; nothing is simulated or re-made. Rows 3-6 keep the real order of the recording. If rows 3-6 run long, speed up only the translation wait, never a result.
