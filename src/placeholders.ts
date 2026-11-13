// Placeholder and markup protection: the part of UI translation that breaks apps
// when it goes wrong. A translation is accepted only if it keeps exactly the
// same placeholders and tags as the source string.

const PATTERNS: RegExp[] = [
  /\{\{\s*[\w.-]+\s*\}\}/g, // {{name}}  i18next / Handlebars
  /\{[\w.-]+\}/g, // {name}  ICU simple argument / ARB / Vue
  /%(?:\d+\$)?[-+#0]*\d*(?:\.\d+)?(?:ll|l|h)?[@sdifuxXoeEgGc%]/g, // %s %1$s %d %.2f %@ %lld %%
  /<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>/g, // <b> </b> <br/> <a href="...">
];

const ICU_HEADER = /\{\s*([\w.-]+)\s*,\s*(plural|selectordinal|select)\s*,/g;

const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

/**
 * ICU plural/select structure that must survive translation, as comparable tokens:
 * - the header "{count, plural," (argument name and type unchanged);
 * - select: every case keyword ("male", "female", "other"), the same set in both;
 * - plural/selectordinal: only "other" is required, because each language has its own
 *   CLDR categories (Polish adds few/many, Japanese has only other). A keyword that is
 *   not a CLDR category or "=N" (for example a translated "autre") is reported, so it
 *   never matches the source.
 */
export function extractIcu(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(ICU_HEADER)) {
    const [, arg, type] = m;
    out.push(`{${arg}, ${type},`);
    for (const kw of caseKeywords(text, (m.index ?? 0) + m[0].length)) {
      if (type === "select") out.push(`${arg}:${kw}`);
      else if (kw === "other") out.push(`${arg}:other`);
      else if (!PLURAL_CATEGORIES.has(kw) && !/^=\d+$/.test(kw)) out.push(`${arg}:invalid:${kw}`);
    }
  }
  return out;
}

/** Case keywords of the ICU block starting at `from`: at depth 1, the word right before each "{". */
function caseKeywords(text: string, from: number, bodies?: Set<number>): string[] {
  const out: string[] = [];
  let depth = 1;
  let word = "";
  for (let i = from; i < text.length && depth > 0; i++) {
    const c = text[i];
    if (c === "{") {
      if (depth === 1 && word) {
        out.push(word);
        bodies?.add(i);
      }
      depth++;
      word = "";
    } else if (c === "}") {
      depth--;
      word = "";
    } else if (depth === 1) {
      if (/\s/.test(c)) {
        if (word && !/^[=\w-]+$/.test(word)) word = "";
      } else word = /\s/.test(text[i - 1] ?? "") ? c : word + c;
    }
  }
  return out;
}

/** Positions of the "{" that open ICU case bodies ("one{…}"): those braces are not arguments. */
function icuBodyStarts(text: string): Set<number> {
  const bodies = new Set<number>();
  for (const m of text.matchAll(ICU_HEADER)) caseKeywords(text, (m.index ?? 0) + m[0].length, bodies);
  return bodies;
}

/** Every placeholder or tag in `text`, in order of appearance. */
export function extractPlaceholders(text: string): string[] {
  const found: { at: number; token: string }[] = [];
  const taken: [number, number][] = [];
  const bodies = icuBodyStarts(text);
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (bodies.has(start)) continue;
      // A shorter pattern must not re-match inside a longer one ({x} inside {{x}}).
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      found.push({ at: start, token: normalise(m[0]) });
    }
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.token);
}

function normalise(token: string): string {
  // {{ name }} and {{name}} are the same placeholder.
  return token.startsWith("{{") ? `{{${token.slice(2, -2).trim()}}}` : token;
}

export interface PlaceholderCheck {
  ok: boolean;
  missing: string[];
  extra: string[];
}

/** Same multiset of placeholders in source and translation (order may change). */
export function checkPlaceholders(source: string, translation: string): PlaceholderCheck {
  // In an ICU message an argument repeats once per case, and languages have different case
  // counts, so arguments are compared as a set there; elsewhere as a multiset.
  const icu = extractIcu(source).length > 0 || extractIcu(translation).length > 0;
  const tokens = (t: string) => {
    const all = [...extractPlaceholders(t), ...extractIcu(t)];
    return icu ? [...new Set(all)] : all;
  };
  const want = countTokens(tokens(source));
  const got = countTokens(tokens(translation));
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [t, n] of want) {
    for (let i = got.get(t) ?? 0; i < n; i++) missing.push(t);
  }
  for (const [t, n] of got) {
    for (let i = want.get(t) ?? 0; i < n; i++) extra.push(t);
  }
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

function countTokens(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/**
 * UI strings live in fixed-width buttons and labels. Flag a translation that is
 * much longer than its source (short strings get more room: "OK" → "Aceptar").
 */
export function lengthWarning(source: string, translation: string): string | null {
  const s = [...source].length;
  const t = [...translation].length;
  if (s === 0) return null;
  const limit = s <= 10 ? Math.max(s * 3, 12) : Math.ceil(s * 1.8);
  return t > limit ? `${t} chars vs ${s} in the source: may overflow its UI element` : null;
}
