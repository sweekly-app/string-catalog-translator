// Writes the captions of one row as an ASS subtitle file, from the alignment ElevenLabs returned with its take.
// Usage: node captions.cjs <row> <out.ass>
// Reads narration/<NN>.json ({ characters, character_start_times_seconds, character_end_times_seconds },
// or a response object holding it under "alignment") and the row's Narration cell in script.md.
// The captions are the spoken text word for word: the script exits non-zero if the alignment's text differs
// from the script cell, so a caption can never differ from the voice.
const fs = require("fs");
const path = require("path");

const MAX = 44; // characters per caption line
const [row, out] = process.argv.slice(2);
const nn = String(row).padStart(2, "0");
const dir = __dirname;

const raw = JSON.parse(fs.readFileSync(path.join(dir, "narration", `${nn}.json`), "utf8"));
const al = raw.alignment ?? raw;
const chars = al.characters;
const starts = al.character_start_times_seconds;
const ends = al.character_end_times_seconds;
if (!Array.isArray(chars) || chars.length !== starts.length || chars.length !== ends.length) {
  throw new Error(`narration/${nn}.json: no character alignment`);
}

const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const spoken = norm(chars.join(""));
const cell = fs
  .readFileSync(path.join(dir, "script.md"), "utf8")
  .split("\n")
  .find((l) => new RegExp(`^\\| ${Number(row)} \\|`).test(l));
if (!cell) throw new Error(`script.md has no row ${row}`);
const scripted = norm(cell.split("|")[4].trim().replace(/^"|"$/g, ""));
if (spoken !== scripted) {
  console.error(`row ${row}: the take's text differs from script.md\n  take:   ${spoken}\n  script: ${scripted}`);
  process.exit(1);
}

// Words with their times (start of first letter, end of last letter).
const words = [];
let cur = null;
chars.forEach((c, i) => {
  if (/\s/.test(c)) {
    cur = null;
    return;
  }
  if (!cur) {
    cur = { text: "", start: starts[i], end: ends[i] };
    words.push(cur);
  }
  cur.text += c;
  cur.end = ends[i];
});

// Chunks: fill a line up to MAX characters, and break after a sentence end.
const chunks = [];
let line = null;
for (const w of words) {
  if (line && (line.text.length + 1 + w.text.length > MAX || /[.?!]$/.test(line.text))) line = null;
  if (!line) {
    line = { text: w.text, start: w.start, end: w.end };
    chunks.push(line);
  } else {
    line.text += " " + w.text;
    line.end = w.end;
  }
}
// Each chunk stays up until the next one starts (or 0.4 s after its last word).
chunks.forEach((c, i) => (c.until = i + 1 < chunks.length ? chunks[i + 1].start : c.end + 0.4));

const t = (s) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
const ass = [
  "[Script Info]",
  "ScriptType: v4.00+",
  "PlayResX: 1920",
  "PlayResY: 1080",
  "WrapStyle: 2",
  "",
  "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  "Style: Cap,Inter SemiBold,46,&H00FFFFFF,&H00FFFFFF,&H3020140F,&H3020140F,0,0,0,0,100,100,0,0,3,14,0,2,120,120,64,1",
  "",
  "[Events]",
  "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ...chunks.map((c) => `Dialogue: 0,${t(c.start)},${t(c.until)},Cap,,0,0,0,,${esc(c.text)}`),
  "",
];
fs.writeFileSync(out, ass.join("\n"));
console.log(`row ${row}: ${chunks.length} captions, ${words.length} words`);
