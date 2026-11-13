import "./style.css";
import { HybridTranslator, deviceAvailability, type DeviceAvailability } from "./ai";
import { readAppCheckProvider, readFirebaseConfig } from "./config";
import { LANGUAGES, languageName, stats, translateAll, validate, type ItemResult, type Mode } from "./engine";
import {
  detectFormat,
  exportAndroid,
  exportAppleStrings,
  exportArb,
  exportFileName,
  exportJson,
  exportXcstrings,
  parse,
  type Catalog,
  type Format,
} from "./formats";
import { checkPlaceholders, lengthWarning } from "./placeholders";
import { SAMPLE } from "./sample";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const input = $<HTMLTextAreaElement>("input");
const fileInput = $<HTMLInputElement>("file");
const formatChip = $("format");
const parseMsg = $("parse-msg");
const sourceSel = $<HTMLSelectElement>("source");
const keepInput = $<HTMLInputElement>("keep");
const targetsBox = $("targets");
const deviceGrid = $("device-grid");
const prepareBtn = $<HTMLButtonElement>("prepare");
const dl = $<HTMLProgressElement>("dl");
const goBtn = $<HTMLButtonElement>("go");
const stopBtn = $<HTMLButtonElement>("stop");
const progress = $<HTMLProgressElement>("progress");
const statsBox = $("stats");
const tools = $("tools");
const onlyIssues = $<HTMLInputElement>("only-issues");
const exportsBox = $("exports");
const table = $<HTMLTableElement>("results");
const enginePill = $("engine-pill");

const { config, isPlaceholder } = readFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG);
const translator = HybridTranslator.create(
  config,
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || undefined,
  import.meta.env.DEV && !isPlaceholder,
  readAppCheckProvider(import.meta.env.VITE_APPCHECK_PROVIDER),
);
function lockPrivate(reason: string) {
  const banner = $("config-banner");
  banner.textContent = reason;
  banner.hidden = false;
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
    r.checked = r.value === "private";
    r.disabled = r.value !== "private";
  }
}
const missingAppCheck = !import.meta.env.DEV && !isPlaceholder && !import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (missingAppCheck) {
  // A production build with a Firebase project but no App Check key would fail every cloud call
  // once App Check is enforced. Say so plainly and stay on the device.
  lockPrivate("Configuration error: the App Check site key is missing from this build, so the cloud is off. Private mode only.");
}
if (!isPlaceholder && !missingAppCheck) {
  void translator.loadPolicy().then((p) => {
    if (!p.cloudEnabled) lockPrivate("The cloud fallback is paused right now: Private mode only, translation runs on this device.");
  });
}
if (isPlaceholder) {
  // No Firebase project in this build: on-device only, and never a request to a placeholder project.
  lockPrivate("Demo build without a Firebase project: Private mode only, translation runs in Chrome with Gemini Nano and nothing is sent to the cloud.");
}

let catalog: Catalog | null = null;
let fileName = "";
let results: Record<string, Record<string, ItemResult>> = {}; // language → key → result
let running: AbortController | null = null;
const availability = new Map<string, DeviceAvailability>();

// ---------- setup ----------

for (const code of LANGUAGES) {
  sourceSel.add(new Option(`${languageName(code)} (${code})`, code, code === "en", code === "en"));
}
for (const code of LANGUAGES) {
  const label = document.createElement("label");
  label.className = "lang";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.value = code;
  box.checked = ["es", "ja", "fr", "de"].includes(code);
  label.append(box, ` ${languageName(code)}`);
  targetsBox.append(label);
}

function targets(): string[] {
  return [...targetsBox.querySelectorAll<HTMLInputElement>("input:checked")]
    .map((b) => b.value)
    .filter((c) => c !== sourceSel.value);
}

function mode(): Mode {
  return (document.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value ?? "hybrid") as Mode;
}

function keepTerms(): string[] {
  return keepInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------- input ----------

function reparse() {
  catalog = null;
  parseMsg.textContent = "";
  parseMsg.className = "msg";
  const text = input.value;
  if (!text.trim()) {
    formatChip.textContent = "JSON · ARB · strings.xml · .strings · .xcstrings";
    formatChip.className = "chip muted";
    updateGo();
    return;
  }
  try {
    const format = detectFormat(text, fileName);
    catalog = parse(text, format, sourceSel.value);
    if (catalog.sourceLanguage !== sourceSel.value && LANGUAGES.includes(catalog.sourceLanguage)) {
      sourceSel.value = catalog.sourceLanguage;
    }
    formatChip.textContent = `${FORMAT_NAMES[format]} · ${catalog.entries.length} strings`;
    formatChip.className = "chip ok";
  } catch (e) {
    formatChip.textContent = "Not recognised";
    formatChip.className = "chip bad";
    parseMsg.textContent = (e as Error).message;
    parseMsg.className = "msg bad";
  }
  updateGo();
}

const FORMAT_NAMES: Record<Format, string> = {
  json: "JSON",
  arb: "Flutter ARB",
  android: "Android strings.xml",
  strings: "Apple .strings",
  xcstrings: "Apple String Catalog",
};

input.addEventListener("input", () => {
  fileName = "";
  reparse();
});
fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  if (f.size > 2_000_000) {
    parseMsg.textContent = "File is over 2 MB.";
    parseMsg.className = "msg bad";
    return;
  }
  fileName = f.name;
  input.value = await f.text();
  reparse();
});
$("sample").addEventListener("click", () => {
  fileName = "sample.json";
  input.value = SAMPLE;
  keepInput.value = "Sweekly, Sweekly Plus";
  reparse();
});
sourceSel.addEventListener("change", () => {
  reparse();
  void refreshDevice();
});
targetsBox.addEventListener("change", () => {
  updateGo();
  void refreshDevice();
});

function updateGo() {
  goBtn.disabled = !catalog || targets().length === 0 || running !== null;
}

// ---------- on-device status ----------

async function refreshDevice() {
  const src = sourceSel.value;
  const ts = targets();
  deviceGrid.replaceChildren();
  let anyDownloadable = false;
  let anyAvailable = false;
  let noApi = false;
  for (const t of ts) {
    const a = await deviceAvailability(src, t);
    availability.set(t, a);
    if (a === "downloadable" || a === "downloading") anyDownloadable = true;
    if (a === "available") anyAvailable = true;
    if (a === "no-api") noApi = true;
    const cell = document.createElement("div");
    cell.className = `dev ${a === "available" ? "on" : a === "downloadable" || a === "downloading" ? "dl" : "off"}`;
    const name = document.createElement("b");
    name.textContent = languageName(t);
    const state = document.createElement("span");
    state.textContent =
      a === "available"
        ? "Gemini Nano on this device"
        : a === "downloadable"
          ? "Nano can be downloaded"
          : a === "downloading"
            ? "Nano downloading…"
            : mode() === "private"
              ? "Not on this device: will be flagged"
              : "Cloud (Nano lacks this language here)";
    cell.append(name, state);
    deviceGrid.append(cell);
  }
  prepareBtn.hidden = !anyDownloadable;
  enginePill.textContent = noApi
    ? "No built-in AI in this browser: cloud fallback"
    : anyAvailable
      ? "Gemini Nano ready in this browser"
      : anyDownloadable
        ? "Gemini Nano available to download"
        : "Built-in AI present; these languages use the cloud";
  enginePill.className = `pill ${anyAvailable ? "on" : noApi ? "off" : "dl"}`;
}

prepareBtn.addEventListener("click", async () => {
  const t = targets().find((x) => availability.get(x) === "downloadable" || availability.get(x) === "downloading");
  if (!t) return;
  prepareBtn.disabled = true;
  dl.hidden = false;
  try {
    await translator.prepareDevice(sourceSel.value, t, (p) => (dl.value = p));
  } catch (e) {
    parseMsg.textContent = `Download failed: ${(e as Error).message}`;
    parseMsg.className = "msg bad";
  } finally {
    prepareBtn.disabled = false;
    dl.hidden = true;
    await refreshDevice();
  }
});

// ---------- translate ----------

goBtn.addEventListener("click", async () => {
  if (!catalog) return;
  const cat = catalog;
  const ts = targets();
  const m = mode();
  running = new AbortController();
  updateGo();
  stopBtn.hidden = false;
  progress.hidden = false;
  progress.value = 0;
  results = {};
  const total = cat.entries.length * ts.length;
  let done = 0;
  renderTable(cat, ts);
  try {
    for (const t of ts) {
      results[t] = {};
      await translateAll({
        entries: cat.entries,
        sourceLanguage: cat.sourceLanguage,
        targetLanguage: t,
        mode: m,
        keepTerms: keepTerms(),
        deviceAvailable: availability.get(t) === "available",
        generate: translator.generate,
        batchSize: translator.policy.batchSize,
        signal: running.signal,
        onBatch: (batch) => {
          for (const r of batch) results[t][r.key] = r;
          done += batch.length;
          progress.value = done / total;
          renderTable(cat, ts);
        },
      });
    }
  } catch (e) {
    if (!running.signal.aborted) {
      parseMsg.textContent = `Stopped: ${(e as Error).message}`;
      parseMsg.className = "msg bad";
    }
  } finally {
    running = null;
    stopBtn.hidden = true;
    progress.hidden = true;
    updateGo();
    renderTable(cat, ts);
  }
});

for (const r of document.querySelectorAll('input[name="mode"]')) r.addEventListener("change", () => void refreshDevice());
stopBtn.addEventListener("click", () => running?.abort());
onlyIssues.addEventListener("change", () => catalog && renderTable(catalog, Object.keys(results)));

// ---------- results ----------

const BADGE: Record<string, [string, string]> = {
  on_device: ["On-device", "b-dev"],
  in_cloud: ["Cloud", "b-cloud"],
};

function renderTable(cat: Catalog, langs: string[]) {
  table.hidden = false;
  tools.hidden = false;
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  for (const h of ["Key", languageName(cat.sourceLanguage), ...langs.map(languageName)]) {
    const th = document.createElement("th");
    th.textContent = h;
    head.append(th);
  }
  const body = table.createTBody();
  for (const e of cat.entries) {
    const rs = langs.map((l) => results[l]?.[e.key]);
    if (onlyIssues.checked && !rs.some((r) => r && (r.status !== "ok" || r.warning))) continue;
    const row = body.insertRow();
    const k = row.insertCell();
    k.className = "key";
    k.textContent = e.key;
    const s = row.insertCell();
    s.textContent = e.text;
    langs.forEach((l, i) => row.append(resultCell(e.key, e.text, l, rs[i])));
  }
  renderStats();
  renderExports(cat, langs);
}

function resultCell(key: string, sourceText: string, lang: string, r: ItemResult | undefined): HTMLTableCellElement {
  const td = document.createElement("td");
  if (!r) {
    td.className = "pending";
    td.textContent = "…";
    return td;
  }
  td.className = `st-${r.status}`;
  const text = document.createElement("textarea");
  text.value = r.text ?? "";
  text.rows = 2;
  text.setAttribute("aria-label", `${languageName(lang)} translation of ${key}`);
  text.addEventListener("change", () => {
    // A human edit: re-run the same checks on the new text.
    const problem = validate({ key, text: sourceText }, text.value, keepTerms());
    r.text = text.value;
    r.status = problem ? "flagged" : "ok";
    r.reason = problem ? problem : "edited by you";
    r.warning = lengthWarning(sourceText, text.value) ?? undefined;
    if (catalog) renderTable(catalog, Object.keys(results));
  });
  const meta = document.createElement("div");
  meta.className = "meta";
  if (r.source) {
    const [label, cls] = BADGE[r.source];
    const b = document.createElement("span");
    b.className = `badge ${cls}`;
    b.textContent = r.status === "escalated" ? "Cloud fix" : label;
    meta.append(b);
  }
  if (r.status === "flagged" || r.status === "failed") {
    const b = document.createElement("span");
    b.className = "badge b-flag";
    b.textContent = r.status === "failed" ? "Failed" : "Check";
    meta.append(b);
  }
  const why = r.reason ?? r.warning;
  if (why) {
    const w = document.createElement("span");
    w.className = "why";
    w.textContent = why;
    meta.append(w);
  }
  if (r.text && !checkPlaceholders(sourceText, r.text).ok) td.classList.add("ph-bad");
  td.append(text, meta);
  return td;
}

function allResults(): ItemResult[] {
  return Object.values(results).flatMap((m) => Object.values(m));
}

function renderStats() {
  const s = stats(allResults());
  if (s.total === 0) {
    statsBox.hidden = true;
    return;
  }
  statsBox.hidden = false;
  const pct = (n: number) => `${Math.round((n / s.total) * 100)} %`;
  const tiles: [string, string, string][] = [
    [pct(s.onDevice), "translated on this device", "on"],
    [String(s.inCloud), "sent to the cloud", "cloud"],
    [String(s.escalated), "fixed by cloud after a failed check", "esc"],
    [String(s.flagged + s.failed), "need a human look", s.flagged + s.failed ? "bad" : "ok"],
  ];
  statsBox.replaceChildren(
    ...tiles.map(([v, l, c]) => {
      const d = document.createElement("div");
      d.className = `stat ${c}`;
      const b = document.createElement("b");
      b.textContent = v;
      const span = document.createElement("span");
      span.textContent = l;
      d.append(b, span);
      return d;
    }),
  );
}

/** Only strings that passed every check (or that a person edited until they did). */
function translationsFor(lang: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, r] of Object.entries(results[lang] ?? {})) {
    if (r.text !== undefined && (r.status === "ok" || r.status === "escalated")) out[k] = r.text;
  }
  return out;
}

function needsLook(langs: string[], cat: Catalog): number {
  let n = 0;
  for (const l of langs) for (const e of cat.entries) {
    const r = results[l]?.[e.key];
    if (!r || (r.status !== "ok" && r.status !== "escalated")) n++;
  }
  return n;
}

function renderExports(cat: Catalog, langs: string[]) {
  exportsBox.replaceChildren();
  const ready = langs.filter((l) => Object.keys(results[l] ?? {}).length > 0);
  if (!ready.length || running) return;
  const formats: Format[] = ["json", "arb", "android", "strings", "xcstrings"];
  for (const f of formats) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = f === cat.format ? "primary small" : "ghost small";
    btn.textContent = f === "xcstrings" ? ".xcstrings" : FORMAT_NAMES[f].replace("Apple ", "");
    btn.addEventListener("click", () => exportAs(cat, f, ready));
    exportsBox.append(btn);
  }
}

function exportAs(cat: Catalog, f: Format, langs: string[]) {
  const n = needsLook(langs, cat);
  if (
    n > 0 &&
    !confirm(
      `${n} string${n === 1 ? "" : "s"} failed a check or have no translation. They are left out of the export, so the app shows the source language there. Fix them in the table first, or export the rest now?`,
    )
  ) {
    onlyIssues.checked = true;
    renderTable(cat, Object.keys(results));
    return;
  }
  if (f === "xcstrings") {
    const all = Object.fromEntries(langs.map((l) => [l, translationsFor(l)]));
    download(exportFileName(f, ""), exportXcstrings(input.value, cat, all));
    return;
  }
  for (const l of langs) {
    const t = translationsFor(l);
    const body =
      f === "json"
        ? exportJson(cat, t)
        : f === "arb"
          ? exportArb(cat, l, t)
          : f === "android"
            ? exportAndroid(cat, t)
            : exportAppleStrings(cat, t);
    download(exportFileName(f, l).replace(/\//g, "_"), body);
  }
}

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

void refreshDevice();
