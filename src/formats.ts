// String catalog formats: detect, parse into one flat model, export back out.
// Pure functions (no DOM), so they run in unit tests and in the browser alike.

export type Format = "json" | "arb" | "android" | "xcstrings" | "strings";

export interface Entry {
  key: string;
  text: string;
  /** Translator note carried from the file (ARB @key.description, xcstrings comment, XML comment). */
  note?: string;
  /** Android only: the source held raw styling tags (<b>, <i>, <u>, <a>), kept as tags on export. */
  markup?: boolean;
}

export interface Catalog {
  format: Format;
  sourceLanguage: string;
  entries: Entry[];
  /** Nested JSON input is exported nested again. */
  nested?: boolean;
}

/** language → key → translated text */
export type Translations = Record<string, Record<string, string>>;

export class FormatError extends Error {}

const MAX_ENTRIES = 2000;
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function detectFormat(input: string, fileName = ""): Format {
  const name = fileName.toLowerCase();
  if (name.endsWith(".arb")) return "arb";
  if (name.endsWith(".xcstrings")) return "xcstrings";
  if (name.endsWith(".xml")) return "android";
  if (name.endsWith(".strings")) return "strings";
  const t = input.trim();
  if (t.startsWith("<")) return "android";
  if (t.startsWith("{")) {
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      if (o && typeof o === "object" && "strings" in o && "sourceLanguage" in o) return "xcstrings";
      if (Object.keys(o).some((k) => k.startsWith("@"))) return "arb";
    } catch {
      /* fall through: parse() reports the JSON error */
    }
    return "json";
  }
  if (/^\s*(\/\*|\/\/|")/.test(t)) return "strings";
  throw new FormatError("Unrecognised format: paste JSON, ARB, Android strings.xml, Apple .strings or .xcstrings.");
}

export function parse(input: string, format: Format, sourceLanguage = "en"): Catalog {
  let catalog: Catalog;
  switch (format) {
    case "json":
      catalog = parseJson(input, sourceLanguage);
      break;
    case "arb":
      catalog = parseArb(input, sourceLanguage);
      break;
    case "android":
      catalog = parseAndroid(input, sourceLanguage);
      break;
    case "xcstrings":
      catalog = parseXcstrings(input);
      break;
    case "strings":
      catalog = parseAppleStrings(input, sourceLanguage);
      break;
  }
  if (catalog.entries.length === 0) throw new FormatError("No strings found.");
  if (catalog.entries.length > MAX_ENTRIES) {
    throw new FormatError(`${catalog.entries.length} strings: the limit is ${MAX_ENTRIES} per run.`);
  }
  const seen = new Set<string>();
  for (const e of catalog.entries) {
    if (e.key.split(".").some((part) => RESERVED_KEYS.has(part)) || RESERVED_KEYS.has(e.key)) {
      throw new FormatError(`Key "${e.key}" is reserved and not accepted.`);
    }
    if (seen.has(e.key)) throw new FormatError(`Duplicate key "${e.key}".`);
    seen.add(e.key);
  }
  return catalog;
}

function parseJsonObject(input: string): Record<string, unknown> {
  let o: unknown;
  try {
    o = JSON.parse(input);
  } catch (e) {
    throw new FormatError(`Invalid JSON: ${(e as Error).message}`);
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new FormatError("Expected a JSON object of strings.");
  return o as Record<string, unknown>;
}

// ---------- JSON (flat or nested, i18next / react-intl / vue-i18n style) ----------

function parseJson(input: string, sourceLanguage: string): Catalog {
  const o = parseJsonObject(input);
  const entries: Entry[] = [];
  let nested = false;
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k.includes(".") && prefix === "" && typeof v !== "string") {
        throw new FormatError(`Key "${k}" contains a dot and an object: ambiguous nesting.`);
      }
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") entries.push({ key, text: v });
      else if (v && typeof v === "object" && !Array.isArray(v)) {
        nested = true;
        if (k.includes(".")) throw new FormatError(`Nested key "${key}" contains a dot: ambiguous nesting.`);
        walk(v as Record<string, unknown>, key);
      } else throw new FormatError(`Value of "${key}" is not a string.`);
    }
  };
  walk(o, "");
  return { format: "json", sourceLanguage, entries, nested };
}

export function exportJson(catalog: Catalog, translations: Record<string, string>): string {
  const out: Record<string, unknown> = {};
  for (const e of catalog.entries) {
    // Untranslated or excluded strings are left out: apps fall back to the source language.
    const value = translations[e.key];
    if (value === undefined) continue;
    if (!catalog.nested) {
      out[e.key] = value;
      continue;
    }
    const parts = e.key.split(".");
    let node = out;
    for (const p of parts.slice(0, -1)) {
      node[p] ??= {};
      node = node[p] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return JSON.stringify(out, null, 2) + "\n";
}

// ---------- Flutter ARB ----------

function parseArb(input: string, sourceLanguage: string): Catalog {
  const o = parseJsonObject(input);
  const locale = typeof o["@@locale"] === "string" ? (o["@@locale"] as string) : sourceLanguage;
  const entries: Entry[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith("@")) continue;
    if (typeof v !== "string") throw new FormatError(`Value of "${k}" is not a string.`);
    const meta = o[`@${k}`] as { description?: unknown } | undefined;
    const note = meta && typeof meta.description === "string" ? meta.description : undefined;
    entries.push(note ? { key: k, text: v, note } : { key: k, text: v });
  }
  return { format: "arb", sourceLanguage: locale, entries };
}

export function exportArb(catalog: Catalog, language: string, translations: Record<string, string>): string {
  const out: Record<string, unknown> = { "@@locale": arbLocale(language) };
  for (const e of catalog.entries) if (translations[e.key] !== undefined) out[e.key] = translations[e.key];
  return JSON.stringify(out, null, 2) + "\n";
}

function arbLocale(language: string): string {
  // Flutter uses underscores: pt_BR, zh_Hant.
  return language.replace(/-/g, "_");
}

// ---------- Android strings.xml ----------

function parseAndroid(input: string, sourceLanguage: string): Catalog {
  if (/<!ENTITY/i.test(input)) throw new FormatError("DTD entities are not accepted.");
  if (!/<resources[\s>]/.test(input)) throw new FormatError("No <resources> element: not an Android strings.xml.");
  const entries: Entry[] = [];
  const re = /(?:<!--([\s\S]*?)-->\s*)?<string\b([^>]*)>([\s\S]*?)<\/string>/g;
  for (const m of input.matchAll(re)) {
    const attrs = m[2];
    const name = /\bname="([^"]+)"/.exec(attrs)?.[1];
    if (!name) throw new FormatError("A <string> has no name attribute.");
    if (/\btranslatable="false"/.test(attrs)) continue;
    const note = m[1]?.trim();
    const raw = m[3];
    const text = androidUnescape(raw);
    const entry: Entry = note ? { key: name, text, note } : { key: name, text };
    if (!/^\s*<!\[CDATA\[/.test(raw) && STYLE_TAG.test(raw)) entry.markup = true;
    entries.push(entry);
  }
  return { format: "android", sourceLanguage, entries };
}

export function androidUnescape(raw: string): string {
  let s = raw;
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(s.trim());
  if (cdata) return cdata[1];
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  // XML entities first (the XML parser's layer), then Android's backslash escapes in one pass.
  s = s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, c: string) =>
    c.length === 5 ? String.fromCharCode(parseInt(c.slice(1), 16)) : c === "n" ? "\n" : c === "t" ? "\t" : c,
  );
}

/** Styling tags Android keeps in string resources (getText) when written raw. */
const STYLE_TAG = /<\/?(?:b|i|u|a|big|small|sup|sub|tt|strike|font|annotation|span)(?:\s[^<>]*)?\/?>/i;
const STYLE_TAG_G = new RegExp(STYLE_TAG.source, "gi");

export function androidEscape(text: string, keepTags = false): string {
  if (keepTags && tagsBalanced(text)) {
    // Styled string: tags stay raw so Android keeps the styling; the text between them is escaped.
    // Inside a tag only "&" needs escaping (an attribute such as href="?a=1&b=2").
    let out = "";
    let last = 0;
    for (const m of text.matchAll(STYLE_TAG_G)) {
      out += escapeText(text.slice(last, m.index), out === "") + m[0].replace(/&/g, "&amp;");
      last = (m.index ?? 0) + m[0].length;
    }
    return out + escapeText(text.slice(last), out === "");
  }
  return escapeText(text, true);
}

/** Every opening style tag has its closing tag, properly nested (otherwise the XML would break). */
export function tagsBalanced(text: string): boolean {
  const stack: string[] = [];
  for (const m of text.matchAll(STYLE_TAG_G)) {
    const tag = m[0];
    if (tag.endsWith("/>")) continue;
    const name = /^<\/?([a-zA-Z]+)/.exec(tag)![1].toLowerCase();
    if (tag.startsWith("</")) {
      if (stack.pop() !== name) return false;
    } else stack.push(name);
  }
  return stack.length === 0;
}

function escapeText(text: string, atStart: boolean): string {
  let s = text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  // A leading @ or ? is a resource reference to aapt.
  if (atStart && (s.startsWith("@") || s.startsWith("?"))) s = "\\" + s;
  return s;
}

export function exportAndroid(catalog: Catalog, translations: Record<string, string>): string {
  const lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>"];
  for (const e of catalog.entries) {
    const value = translations[e.key];
    if (value === undefined) continue;
    if (e.note) lines.push(`    <!-- ${e.note.replace(/--/g, "- -")} -->`);
    lines.push(`    <string name="${xmlAttr(e.key)}">${androidEscape(value, e.markup === true)}</string>`);
  }
  lines.push("</resources>", "");
  return lines.join("\n");
}

function xmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ---------- Apple .strings ----------

function parseAppleStrings(input: string, sourceLanguage: string): Catalog {
  const entries: Entry[] = [];
  const re = /(?:\/\*([\s\S]*?)\*\/\s*)?"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
  for (const m of input.matchAll(re)) {
    const note = m[1]?.trim();
    const key = appleUnescape(m[2]);
    const text = appleUnescape(m[3]);
    entries.push(note ? { key, text, note } : { key, text });
  }
  return { format: "strings", sourceLanguage, entries };
}

function appleUnescape(s: string): string {
  return s.replace(/\\(["\\nt])/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c));
}

function appleEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

export function exportAppleStrings(catalog: Catalog, translations: Record<string, string>): string {
  const out: string[] = [];
  for (const e of catalog.entries) {
    const value = translations[e.key];
    if (value === undefined) continue;
    if (e.note) out.push(`/* ${e.note.replace(/\*\//g, "* /")} */`);
    out.push(`"${appleEscape(e.key)}" = "${appleEscape(value)}";`, "");
  }
  return out.join("\n");
}

// ---------- Apple String Catalog (.xcstrings): one file holds every language ----------

interface XcUnit {
  stringUnit?: { state?: string; value?: string };
}
interface XcString {
  comment?: string;
  extractionState?: string;
  shouldTranslate?: boolean;
  localizations?: Record<string, XcUnit>;
}
interface XcFile {
  sourceLanguage: string;
  strings: Record<string, XcString>;
  version: string;
}

function parseXcstrings(input: string): Catalog {
  const o = parseJsonObject(input) as unknown as XcFile;
  if (typeof o.sourceLanguage !== "string" || !o.strings || typeof o.strings !== "object") {
    throw new FormatError("Not a String Catalog: sourceLanguage or strings missing.");
  }
  const entries: Entry[] = [];
  for (const [key, s] of Object.entries(o.strings)) {
    if (s?.shouldTranslate === false) continue;
    const text = s?.localizations?.[o.sourceLanguage]?.stringUnit?.value ?? key;
    if (typeof text !== "string") throw new FormatError(`Value of "${key}" is not a string.`);
    entries.push(s?.comment ? { key, text, note: s.comment } : { key, text });
  }
  return { format: "xcstrings", sourceLanguage: o.sourceLanguage, entries };
}

/**
 * Merge translations into the original catalog so nothing the file already held
 * (other languages, variations, shouldTranslate=false keys) is lost.
 */
export function exportXcstrings(original: string, catalog: Catalog, translations: Translations): string {
  const o =
    catalog.format === "xcstrings"
      ? (JSON.parse(original) as XcFile)
      : ({ sourceLanguage: catalog.sourceLanguage, strings: {}, version: "1.0" } as XcFile);
  for (const e of catalog.entries) {
    const s: XcString = (o.strings[e.key] ??= {});
    if (e.note && !s.comment) s.comment = e.note;
    s.localizations ??= {};
    if (catalog.format !== "xcstrings" && e.key !== e.text) {
      s.localizations[catalog.sourceLanguage] = { stringUnit: { state: "translated", value: e.text } };
    }
    for (const [lang, values] of Object.entries(translations)) {
      const v = values[e.key];
      if (v === undefined) continue;
      // "needs_review": Xcode shows it to a human before shipping.
      s.localizations[lang] = { stringUnit: { state: "needs_review", value: v } };
    }
  }
  return JSON.stringify(o, null, 2) + "\n";
}

/** File name for one language's export in a given format. */
export function exportFileName(format: Format, language: string): string {
  switch (format) {
    case "json":
      return `${language}.json`;
    case "arb":
      return `app_${arbLocale(language)}.arb`;
    case "android":
      return `values-${androidQualifier(language)}/strings.xml`;
    case "strings":
      return `${language}.lproj/Localizable.strings`;
    case "xcstrings":
      return "Localizable.xcstrings";
  }
}

function androidQualifier(language: string): string {
  const [lang, region] = language.split("-");
  if (!region) return lang;
  return region.length === 2 ? `${lang}-r${region.toUpperCase()}` : `b+${language.replace(/-/g, "+")}`;
}
