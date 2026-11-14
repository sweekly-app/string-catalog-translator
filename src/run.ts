// A saved run: the catalog, the policy and every result, so a team can hand a client the whole run
// (not only the receipt), and a judge without Gemini Nano can open a run recorded on a machine with it.
// The file is untrusted input: every field is checked and unknown fields are dropped.

import { LANGUAGES, type ItemResult, type Mode, type Source, type Status } from "./engine";

export interface SavedRun {
  kind: "string-catalog-translator/run";
  version: 1;
  created: string;
  /** Browser and version the run was made in (from the user agent), for the reader. */
  browser: string;
  mode: Mode;
  sourceLanguage: string;
  confidential: string[];
  keepTerms: string[];
  fileName: string;
  catalogText: string;
  /** Target languages Chrome reported Gemini Nano "available" for at run time. */
  onDeviceLanguages: string[];
  results: Record<string, Record<string, ItemResult>>;
}

const MAX_BYTES = 5_000_000;
const MODES: Mode[] = ["hybrid", "private", "cloud"];
const STATUSES: Status[] = ["ok", "escalated", "flagged", "failed", "held"];
const SOURCES: Source[] = ["on_device", "in_cloud"];

export function serializeRun(run: SavedRun): string {
  return JSON.stringify(run, null, 2) + "\n";
}

function fail(why: string): never {
  throw new Error(`not a usable saved run: ${why}`);
}
const str = (v: unknown, what: string, max = 1_000_000): string => {
  if (typeof v !== "string" || v.length > max) fail(`${what} must be text`);
  return v;
};
const strList = (v: unknown, what: string): string[] => {
  if (!Array.isArray(v) || v.length > 200) fail(`${what} must be a list`);
  return v.map((x) => str(x, what, 200));
};
const lang = (v: unknown): string => {
  if (typeof v !== "string" || !LANGUAGES.includes(v)) fail(`unknown language ${JSON.stringify(v)}`);
  return v;
};

function item(key: string, v: unknown): ItemResult {
  if (!v || typeof v !== "object") fail(`result for ${key} must be an object`);
  const o = v as Record<string, unknown>;
  if (o.key !== key) fail(`result key ${JSON.stringify(o.key)} does not match ${JSON.stringify(key)}`);
  if (!STATUSES.includes(o.status as Status)) fail(`bad status for ${key}`);
  if (o.source !== undefined && !SOURCES.includes(o.source as Source)) fail(`bad source for ${key}`);
  if (typeof o.left !== "boolean") fail(`left must be true or false for ${key}`);
  const r: ItemResult = { key, status: o.status as Status, left: o.left };
  if (o.text !== undefined) r.text = str(o.text, `text of ${key}`, 20_000);
  if (o.source !== undefined) r.source = o.source as Source;
  if (o.reason !== undefined) r.reason = str(o.reason, `reason of ${key}`, 500);
  if (o.warning !== undefined) r.warning = str(o.warning, `warning of ${key}`, 500);
  if (o.held !== undefined) r.held = o.held === true;
  if (o.edited !== undefined) r.edited = o.edited === true;
  return r;
}

export function parseRun(text: string): SavedRun {
  if (text.length > MAX_BYTES) throw new Error("not a usable saved run: file too large");
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("not a saved run (invalid JSON)");
  }
  if (!o || typeof o !== "object" || o.kind !== "string-catalog-translator/run") throw new Error("not a saved run");
  if (o.version !== 1) fail(`unsupported version ${JSON.stringify(o.version)}`);
  if (!MODES.includes(o.mode as Mode)) fail("unknown mode");
  const results: SavedRun["results"] = {};
  if (!o.results || typeof o.results !== "object") fail("results missing");
  for (const [l, byKey] of Object.entries(o.results as Record<string, unknown>)) {
    lang(l);
    if (!byKey || typeof byKey !== "object") fail(`results for ${l} must be an object`);
    results[l] = Object.create(null) as Record<string, ItemResult>;
    for (const [k, v] of Object.entries(byKey as Record<string, unknown>)) results[l][k] = item(k, v);
  }
  return {
    kind: "string-catalog-translator/run",
    version: 1,
    created: str(o.created, "created", 40),
    browser: str(o.browser, "browser", 200),
    mode: o.mode as Mode,
    sourceLanguage: lang(o.sourceLanguage),
    confidential: strList(o.confidential, "confidential"),
    keepTerms: strList(o.keepTerms, "keepTerms"),
    fileName: str(o.fileName, "fileName", 200),
    catalogText: str(o.catalogText, "catalogText", MAX_BYTES),
    onDeviceLanguages: strList(o.onDeviceLanguages, "onDeviceLanguages").map(lang),
    results,
  };
}
