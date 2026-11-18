import "./style.css";
import { HybridTranslator, deviceAvailability, type DeviceAvailability } from "./ai";
import { readAppCheckProvider, readFirebaseConfig } from "./config";
import { LANGUAGES, friendlyError, languageName, receipt, stats, translateAll, validate, type ItemResult, type Mode } from "./engine";
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
import { parseRun, serializeRun, type SavedRun } from "./run";
import { zip } from "./zip";

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
const confInput = $<HTMLInputElement>("confidential");
const privateWhy = $("private-why");
const cloudBanner = $("cloud-banner");
const receiptBox = $("receipt");
const replayBanner = $("replay-banner");
const recordedBtn = $<HTMLButtonElement>("recorded");

const { config, isPlaceholder } = readFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG);
const translator = HybridTranslator.create(
  config,
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || undefined,
  import.meta.env.DEV && !isPlaceholder,
  readAppCheckProvider(import.meta.env.VITE_APPCHECK_PROVIDER),
);
let privateLocked = false;
function lockPrivate(reason: string) {
  privateLocked = true;
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
let lastMode: Mode = "hybrid";
let runMode: Mode = "hybrid";
// The policy in force for the results on screen (set when a run starts or a saved run opens), so a
// receipt or a saved run never shows fields edited after the run (audit M-2).
let runConfidential: string[] = [];
let runKeepTerms: string[] = [];
// The opened saved run, so saving it again keeps its date, browser and Nano languages (audit L-8).
let openedRun: SavedRun | null = null;
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

function confidential(): string[] {
  return confInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function keepTerms(): string[] {
  return keepInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------- input ----------

function clearResults() {
  results = {};
  replayBanner.hidden = true;
  table.hidden = true;
  table.replaceChildren();
  tools.hidden = true;
  statsBox.hidden = true;
  receiptBox.hidden = true;
  cloudBanner.hidden = true;
  exportsBox.replaceChildren();
}

function reparse() {
  catalog = null;
  if (!running) clearResults();
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
  const text = await f.text();
  if (text.includes('"string-catalog-translator/run"')) {
    try {
      openRun(parseRun(text), "Saved run");
    } catch (e) {
      parseMsg.textContent = (e as Error).message;
      parseMsg.className = "msg bad";
    }
    return;
  }
  fileName = f.name;
  input.value = text;
  reparse();
});

// ---------- saved runs ----------

/** Show a saved run as it was recorded: nothing is translated again and nothing is sent. */
function openRun(run: SavedRun, label: string) {
  if (running) {
    parseMsg.textContent = "Stop the current run before opening a saved one.";
    parseMsg.className = "msg bad";
    return;
  }
  fileName = run.fileName;
  input.value = run.catalogText;
  sourceSel.value = run.sourceLanguage;
  keepInput.value = run.keepTerms.join(", ");
  confInput.value = run.confidential.join(", ");
  reparse();
  if (!catalog) return;
  const langs = Object.keys(run.results);
  for (const b of targetsBox.querySelectorAll<HTMLInputElement>("input")) b.checked = langs.includes(b.value);
  results = run.results;
  openedRun = run;
  runMode = run.mode;
  runConfidential = run.confidential;
  runKeepTerms = run.keepTerms;
  const date = run.created.slice(0, 10);
  const nano = run.onDeviceLanguages.length
    ? ` with Gemini Nano on that device for ${run.onDeviceLanguages.map(languageName).join(", ")}`
    : "";
  replayBanner.textContent = `${label}, recorded ${date} in ${run.browser}${nano} (${run.mode} mode). Shown as recorded: nothing is translated again and nothing is sent. The language status above describes this browser, not the one that recorded the run.`;
  replayBanner.hidden = false;
  renderTable(catalog, langs);
  void refreshDevice();
  // Like a finished live run, bring the banner and the receipt into view (the button sits far above them).
  replayBanner.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("run-save").addEventListener("click", () => {
  if (!catalog) return;
  const replaying = !replayBanner.hidden;
  const run: SavedRun = {
    kind: "string-catalog-translator/run",
    version: 1,
    created: replaying && openedRun ? openedRun.created : new Date().toISOString(),
    browser:
      replaying && openedRun
        ? openedRun.browser
        : (/(Chrome|Edg|Firefox|Version)\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? "unknown browser").replace("Version/", "Safari/"),
    mode: runMode,
    sourceLanguage: catalog.sourceLanguage,
    confidential: runConfidential,
    keepTerms: runKeepTerms,
    fileName: fileName || "catalog.json",
    catalogText: input.value,
    onDeviceLanguages:
      replaying && openedRun ? openedRun.onDeviceLanguages : Object.keys(results).filter((l) => availability.get(l) === "available"),
    results,
  };
  download("translation-run.json", serializeRun(run));
});

// A run recorded in desktop Chrome with Gemini Nano can ship with the demo as src/recorded-run.json,
// for judges whose browser has no on-device model. Bundled at build time when the file exists;
// without it there is no button and no request.
const bundled = import.meta.glob<string>("./recorded-run.json", { eager: true, query: "?raw", import: "default" });
for (const text of Object.values(bundled)) {
  try {
    const run = parseRun(text);
    recordedBtn.hidden = false;
    recordedBtn.addEventListener("click", () => openRun(run, "Recorded run"));
  } catch {
    recordedBtn.hidden = true;
  }
}

// A run lives only in this tab: warn before a reload or close throws it away.
window.addEventListener("beforeunload", (ev) => {
  if (Object.keys(results).length && replayBanner.hidden) ev.preventDefault();
});
$("sample").addEventListener("click", () => {
  fileName = "sample.json";
  input.value = SAMPLE;
  keepInput.value = "Sweekly, Sweekly Plus";
  confInput.value = "feature.unreleased.";
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
  // The catalog cannot change under a running translation (audit N-2).
  const busy = running !== null;
  input.readOnly = busy;
  fileInput.disabled = busy;
  $<HTMLButtonElement>("sample").disabled = busy;
  recordedBtn.disabled = busy;
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
              : "Cloud (no Gemini Nano for this language here)";
    cell.append(name, state);
    deviceGrid.append(cell);
  }
  prepareBtn.hidden = !anyDownloadable;
  enginePill.textContent = noApi
    ? "No Gemini Nano in this browser: Hybrid uses the cloud, confidential keys are held back"
    : anyAvailable
      ? "Gemini Nano ready in this browser"
      : anyDownloadable
        ? "Gemini Nano can be downloaded for these languages"
        : "Gemini Nano not available for these languages here: Hybrid uses the cloud, confidential keys are held back";
  // Private needs Gemini Nano for at least one chosen language; say so instead of failing every string.
  if (!privateLocked) {
    const priv = document.querySelector<HTMLInputElement>('input[name="mode"][value="private"]')!;
    priv.disabled = !anyAvailable;
    privateWhy.textContent = anyAvailable
      ? ""
      : anyDownloadable
        ? "Download Gemini Nano first (button below)."
        : "Needs Gemini Nano in this Chrome for the chosen languages (see the README's setup).";
    if (priv.disabled && priv.checked) {
      priv.checked = false;
      document.querySelector<HTMLInputElement>(`input[name="mode"][value="${lastMode === "private" ? "hybrid" : lastMode}"]`)!.checked = true;
    }
  }
  lastMode = mode();
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
    parseMsg.textContent = `Download failed: ${friendlyError((e as Error).message)}`;
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
  runMode = m;
  runConfidential = confidential();
  runKeepTerms = keepTerms();
  openedRun = null;
  replayBanner.hidden = true;
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
      if (m === "private" && availability.get(t) !== "available") {
        // No on-device model for this pair: flag every string without a call.
        for (const e of cat.entries)
          results[t][e.key] = { key: e.key, status: "failed", left: false, reason: "Gemini Nano does not serve this language on this device" };
        done += cat.entries.length;
        progress.value = done / total;
        renderTable(cat, ts);
        continue;
      }
      await translateAll({
        entries: cat.entries,
        sourceLanguage: cat.sourceLanguage,
        targetLanguage: t,
        mode: m,
        keepTerms: runKeepTerms,
        confidential: runConfidential,
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
      parseMsg.textContent = `Stopped: ${friendlyError((e as Error).message)}`;
      parseMsg.className = "msg bad";
    }
  } finally {
    running = null;
    stopBtn.hidden = true;
    progress.hidden = true;
    updateGo();
    renderTable(cat, ts);
    if (!receiptBox.hidden) receiptBox.scrollIntoView({ behavior: "smooth", block: "start" });
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
  if (onlyIssues.checked && body.rows.length === 0) {
    const td = body.insertRow().insertCell();
    td.colSpan = langs.length + 2;
    td.className = "empty";
    td.textContent = "Nothing needs a look: every translated string passed its checks.";
  }
  renderStats();
  renderReceipt(cat);
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
    r.edited = true;
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
  if (r.held) {
    const b = document.createElement("span");
    b.className = "badge b-held";
    b.textContent = "Held back";
    meta.append(b);
    if (r.status === "held") text.placeholder = "Confidential: translate here by hand";
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
  const stayedOnDevice = allResults().filter((r) => r.source === "on_device" && !r.left && !r.edited && (r.text ?? "").trim() !== "").length;
  const held = allResults().filter((r) => r.status === "held").length;
  const tiles: [string, string, string][] = [
    // Same rule as the receipt: from the device and never sent (audit M-1r).
    [pct(stayedOnDevice), "translated on this device", stayedOnDevice ? "on" : "none"],
    [String(allResults().filter((r) => r.left).length), "sent to the cloud", "cloud"],
    [String(s.escalated), "fixed by cloud after a failed check", "esc"],
    [String(s.flagged + s.failed + held), "need a human look", s.flagged + s.failed + held ? "bad" : "ok"],
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

let lastReceipt: ReturnType<typeof receipt> | null = null;

function renderReceipt(cat: Catalog) {
  const byLang = Object.fromEntries(Object.entries(results).map(([l, m]) => [l, Object.values(m)]));
  const rc = receipt(byLang, runMode);
  lastReceipt = rc;
  // A reopened run is history: never tell the viewer the cloud is busy now (audit N-3).
  const busy = replayBanner.hidden && allResults().some((r) => /cloud busy|cloud temporarily unavailable/.test(r.reason ?? ""));
  cloudBanner.hidden = !busy;
  cloudBanner.textContent = busy
    ? "The cloud is busy right now (the demo runs on a free quota). On-device results are unaffected; strings that needed the cloud are marked. Try again in a minute."
    : "";
  if (rc.total === 0) {
    receiptBox.hidden = true;
    return;
  }
  receiptBox.hidden = false;
  // "Did not run" only when no result came from the device at all (audit L-6).
  const noNano = !allResults().some((r) => r.source === "on_device") && runMode !== "cloud" && rc.left.length > 0;
  receiptBox.classList.toggle("neutral", noNano || runMode === "cloud");
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const replaying = !replayBanner.hidden;
  const here = replaying ? "the recording browser" : "this browser";
  $("rc-head").textContent = noNano
    ? `Gemini Nano did not run ${replaying ? "in that run" : "here"}: ${rc.left.length} of ${plural(rc.total, "translation")} sent to the cloud, ${rc.held.length} confidential kept on the device (${rc.held.filter((h) => h.state === "not translated").length} still untranslated)`
    : `${rc.stayed} of ${plural(rc.total, "translation")} never left ${here} (${rc.onDevice} translated on-device, ${rc.held.length} confidential kept on the device) · ${rc.left.length} sent to the cloud`;
  const conf = runConfidential;
  $("rc-policy").textContent =
    (conf.length ? `Policy: keys starting ${conf.map((c) => `"${c}"`).join(", ")} are never sent. ` : "Policy: no confidential keys set. ") +
    (runMode === "private" ? "Private mode: nothing is sent." : runMode === "cloud" ? "Cloud mode: every other string is sent." : "Hybrid: other strings go out only when Gemini Nano can't serve the language here or its answer fails a check.");
  const list = (id: string, items: string[]) => {
    const ul = $(id);
    const shown = items.slice(0, 8).map((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      return li;
    });
    if (items.length > 8) {
      const li = document.createElement("li");
      li.textContent = `and ${items.length - 8} more (in the downloaded receipt)`;
      shown.push(li);
    }
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "none";
      shown.push(li);
    }
    ul.replaceChildren(...shown);
  };
  // Escalations one by one (they are the interesting ones); whole languages sent for lack of Nano, grouped.
  const NO_NANO = "this language pair has no on-device model here";
  const lines: string[] = [];
  const grouped = new Map<string, string[]>();
  for (const x of rc.left) {
    if (x.reason === NO_NANO || x.reason === "Cloud mode chosen") {
      const g = `${languageName(x.language)}|${x.reason}`;
      grouped.set(g, [...(grouped.get(g) ?? []), x.key]);
    } else lines.push(`${x.key} · ${languageName(x.language)}: ${x.reason}`);
  }
  for (const [g, keys] of grouped) {
    const [lang, reason] = g.split("|");
    lines.push(`${lang}: ${keys.length} string${keys.length === 1 ? "" : "s"}, ${reason === NO_NANO ? "no Gemini Nano for this language here" : reason}`);
  }
  list("rc-left", lines);
  // One line per confidential key: how many languages, and what happened to them.
  const byKey = new Map<string, Map<string, string[]>>();
  for (const x of rc.held) {
    const states = byKey.get(x.key) ?? new Map<string, string[]>();
    states.set(x.state, [...(states.get(x.state) ?? []), languageName(x.language)]);
    byKey.set(x.key, states);
  }
  list(
    "rc-held",
    [...byKey].map(([key, states]) =>
      `${key}: ` +
      [...states]
        .map(([st, ls]) => `${st === "not translated" ? "not translated (no Gemini Nano here)" : st} in ${ls.join(", ")}`)
        .join("; "),
    ),
  );
  void cat;
}

$("rc-download").addEventListener("click", () => {
  if (!lastReceipt || !catalog) return;
  const body = {
    tool: "String Catalog Translator",
    created: new Date().toISOString(),
    mode: runMode,
    sourceLanguage: catalog.sourceLanguage,
    confidentialPrefixes: runConfidential,
    translations: lastReceipt.total,
    neverLeftThisBrowser: lastReceipt.stayed,
    sentToCloud: lastReceipt.left,
    confidentialHeldBack: lastReceipt.held,
  };
  download("translation-receipt.json", JSON.stringify(body, null, 2) + "\n");
});

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
  // One archive per format, each language in its platform's folder (values-pt-rBR/strings.xml, ja.lproj/...).
  const enc = new TextEncoder();
  const files = langs.map((l) => {
    const t = translationsFor(l);
    const body =
      f === "json"
        ? exportJson(cat, t)
        : f === "arb"
          ? exportArb(cat, l, t)
          : f === "android"
            ? exportAndroid(cat, t)
            : exportAppleStrings(cat, t);
    return { name: exportFileName(f, l), data: enc.encode(body) };
  });
  downloadBlob(`translations-${f}.zip`, new Blob([zip(files)], { type: "application/zip" }));
}

function download(name: string, body: string) {
  downloadBlob(name, new Blob([body], { type: "text/plain;charset=utf-8" }));
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

void refreshDevice();
