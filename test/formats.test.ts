import { describe, expect, it } from "vitest";
import {
  tagsBalanced,
  androidEscape,
  androidUnescape,
  detectFormat,
  exportAndroid,
  exportAppleStrings,
  exportArb,
  exportFileName,
  exportJson,
  exportXcstrings,
  FormatError,
  parse,
} from "../src/formats";

describe("detectFormat", () => {
  it("by extension", () => {
    expect(detectFormat("{}", "app_en.arb")).toBe("arb");
    expect(detectFormat("<resources/>", "strings.xml")).toBe("android");
    expect(detectFormat("", "Localizable.xcstrings")).toBe("xcstrings");
    expect(detectFormat("", "Localizable.strings")).toBe("strings");
  });
  it("by content", () => {
    expect(detectFormat('{"a":"b"}')).toBe("json");
    expect(detectFormat('{"@@locale":"en","a":"b"}')).toBe("arb");
    expect(detectFormat('{"sourceLanguage":"en","strings":{},"version":"1.0"}')).toBe("xcstrings");
    expect(detectFormat("<resources></resources>")).toBe("android");
    expect(detectFormat('"a" = "b";')).toBe("strings");
    expect(() => detectFormat("hello")).toThrow(FormatError);
  });
});

describe("JSON", () => {
  it("round-trips nested JSON", () => {
    const src = { a: { b: "B {x}", c: "C" }, d: "D" };
    const cat = parse(JSON.stringify(src), "json");
    expect(cat.entries.map((e) => e.key)).toEqual(["a.b", "a.c", "d"]);
    expect(JSON.parse(exportJson(cat, { "a.b": "BB {x}", "a.c": "CC", d: "DD" }))).toEqual({ a: { b: "BB {x}", c: "CC" }, d: "DD" });
  });
  it("leaves untranslated strings out of the export (apps fall back to the source)", () => {
    const cat = parse('{"a":"A","b":"B"}', "json");
    expect(JSON.parse(exportJson(cat, { a: "AA" }))).toEqual({ a: "AA" });
    expect(exportArb(cat, "fr", { b: "BB" })).not.toContain('"a"');
    expect(exportAndroid(cat, { a: "AA" })).not.toContain('name="b"');
    expect(exportAppleStrings(cat, {})).toBe("");
  });
  it("refuses reserved keys", () => {
    expect(() => parse('{"__proto__":"x"}', "json")).toThrow(/reserved/);
    expect(() => parse('{"a":{"constructor":"x"}}', "json")).toThrow(/reserved/);
    expect(() => parse('{"@@locale":"en","prototype":"x"}', "arb")).toThrow(/reserved/);
  });
  it("keeps flat dotted keys flat", () => {
    const cat = parse('{"a.b":"x"}', "json");
    expect(JSON.parse(exportJson(cat, { "a.b": "y" }))).toEqual({ "a.b": "y" });
  });
  it("rejects non-strings and bad JSON", () => {
    expect(() => parse('{"a":1}', "json")).toThrow(/not a string/);
    expect(() => parse("{", "json")).toThrow(/Invalid JSON/);
    expect(() => parse("{}", "json")).toThrow(/No strings/);
  });
  it("rejects too many strings", () => {
    const big = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`k${i}`, "v"]));
    expect(() => parse(JSON.stringify(big), "json")).toThrow(/limit/);
  });
});

describe("ARB", () => {
  it("reads descriptions and locale, writes the target locale", () => {
    const cat = parse('{"@@locale":"en","hello":"Hello {name}","@hello":{"description":"Greeting"}}', "arb");
    expect(cat.entries).toEqual([{ key: "hello", text: "Hello {name}", note: "Greeting" }]);
    expect(JSON.parse(exportArb(cat, "pt-BR", { hello: "Olá {name}" }))).toEqual({ "@@locale": "pt_BR", hello: "Olá {name}" });
  });
});

describe("Android strings.xml", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Shown on the cart button -->
    <string name="cart_items">%d items in your cart</string>
    <string name="apos">Don\\'t &amp; &lt;b&gt;stop&lt;/b&gt;</string>
    <string name="app_id" translatable="false">sweekly</string>
    <string name="quoted">"  spaced  "</string>
</resources>`;
  it("parses notes, escapes, translatable=false", () => {
    const cat = parse(xml, "android");
    expect(cat.entries).toEqual([
      { key: "cart_items", text: "%d items in your cart", note: "Shown on the cart button" },
      { key: "apos", text: "Don't & <b>stop</b>" },
      { key: "quoted", text: "  spaced  " },
    ]);
  });
  it("escapes on export so aapt accepts it", () => {
    expect(androidEscape(`It's "x" & <b>\n@home`)).toBe(`It\\'s \\"x\\" &amp; &lt;b&gt;\\n@home`);
    expect(androidEscape("@string/x")).toBe("\\@string/x");
    const out = exportAndroid(parse(xml, "android"), { cart_items: "%d articles", apos: "N'arrête pas" });
    expect(out).toContain(`<string name="apos">N\\'arrête pas</string>`);
    expect(out).toContain("<!-- Shown on the cart button -->");
  });
  it("round-trips escape/unescape", () => {
    for (const s of [`a'b"c&d<e>f\\g\nh`, "@x", "?y", "100%", "literal \\n stays"]) expect(androidUnescape(androidEscape(s))).toBe(s);
  });
  it("reads a literal backslash-n as text, not a newline", () => {
    expect(androidUnescape("C:\\\\new")).toBe("C:\\new");
  });
  it("keeps raw styling tags on a styled string", () => {
    const styled = `<resources><string name="x">Hello <b>%1$s</b> &amp; <a href="https://sweekly.app">more</a>'s</string></resources>`;
    const cat = parse(styled, "android");
    expect(cat.entries[0]).toMatchObject({ text: `Hello <b>%1$s</b> & <a href="https://sweekly.app">more</a>'s`, markup: true });
    const out = exportAndroid(cat, { x: `Bonjour <b>%1$s</b> & <a href="https://sweekly.app">plus</a>` });
    expect(out).toContain(`<string name="x">Bonjour <b>%1$s</b> &amp; <a href="https://sweekly.app">plus</a></string>`);
  });
  it("escapes & inside a kept tag's attribute so the XML stays valid", () => {
    const cat = parse(`<resources><string name="x">See <a href="https://sweekly.app/?a=1&amp;b=2">terms</a></string></resources>`, "android");
    expect(cat.entries[0].text).toBe(`See <a href="https://sweekly.app/?a=1&b=2">terms</a>`);
    const out = exportAndroid(cat, { x: `Voir <a href="https://sweekly.app/?a=1&b=2">conditions</a>` });
    expect(out).toContain(`<a href="https://sweekly.app/?a=1&amp;b=2">conditions</a>`);
    expect(out).not.toMatch(/&b=2/);
  });
  it("escapes everything when kept tags are unbalanced", () => {
    expect(tagsBalanced("<b>x</b> <i>y</i>")).toBe(true);
    expect(tagsBalanced("<b>x")).toBe(false);
    expect(tagsBalanced("<b><i>x</b></i>")).toBe(false);
    expect(androidEscape("<b>x", true)).toBe("&lt;b&gt;x");
  });
  it("decodes \\uXXXX escapes", () => {
    expect(androidUnescape("Caf\\u00e9 \\u2192 ok")).toBe("Café → ok");
  });
  it("keeps escaped markup escaped (text meant for Html.fromHtml)", () => {
    const cat = parse(`<resources><string name="x">&lt;b&gt;Hi&lt;/b&gt;</string></resources>`, "android");
    expect(cat.entries[0].markup).toBeUndefined();
    expect(exportAndroid(cat, { x: "<b>Salut</b>" })).toContain("&lt;b&gt;Salut&lt;/b&gt;");
  });
  it("refuses DTD entities", () => {
    expect(() => parse('<!DOCTYPE r [<!ENTITY x "y">]><resources></resources>', "android")).toThrow(/entities/);
  });
});

describe("Android CDATA (a real open-source strings.xml writes it\\'s inside CDATA)", () => {
  const xml = `<resources>
    <string name="intro"><![CDATA[Whether it\\'s <b>On this day</b> or not.<br/>Line \\"two\\"\\nend]]></string>
</resources>`;
  it("applies Android's backslash escapes inside CDATA but leaves its markup as text", () => {
    const [e] = parse(xml, "android").entries;
    expect(e.text).toBe('Whether it\'s <b>On this day</b> or not.<br/>Line "two"\nend');
    expect(e.markup).toBeUndefined();
  });
  it("round-trips with no stray backslash", () => {
    const cat = parse(xml, "android");
    const out = exportAndroid(cat, { intro: cat.entries[0].text });
    expect(parse(out, "android").entries[0].text).toBe(cat.entries[0].text);
    expect(out).not.toContain("\\\\");
  });
});

describe("Apple .strings", () => {
  it("round-trips comments and escapes", () => {
    const src = '/* Title */\n"title" = "Say \\"hi\\"\\n";\n"b" = "B";\n';
    const cat = parse(src, "strings");
    expect(cat.entries).toEqual([
      { key: "title", text: 'Say "hi"\n', note: "Title" },
      { key: "b", text: "B" },
    ]);
    const out = exportAppleStrings(cat, { title: 'Dis "salut"\n' });
    expect(parse(out, "strings").entries[0]).toEqual({ key: "title", text: 'Dis "salut"\n', note: "Title" });
  });
});

describe("String Catalog .xcstrings", () => {
  const xc = JSON.stringify({
    sourceLanguage: "en",
    strings: {
      "Hello %@": { comment: "Greeting", localizations: { de: { stringUnit: { state: "translated", value: "Hallo %@" } } } },
      Done: {},
      ID: { shouldTranslate: false },
    },
    version: "1.0",
  });
  it("uses the key as source text when there is no en value, skips shouldTranslate=false", () => {
    const cat = parse(xc, "xcstrings");
    expect(cat.entries).toEqual([
      { key: "Hello %@", text: "Hello %@", note: "Greeting" },
      { key: "Done", text: "Done" },
    ]);
  });
  it("merges new languages and keeps existing ones", () => {
    const cat = parse(xc, "xcstrings");
    const out = JSON.parse(exportXcstrings(xc, cat, { fr: { "Hello %@": "Bonjour %@", Done: "Terminé" } }));
    expect(out.strings["Hello %@"].localizations.de.stringUnit.value).toBe("Hallo %@");
    expect(out.strings["Hello %@"].localizations.fr.stringUnit).toEqual({ state: "needs_review", value: "Bonjour %@" });
    expect(out.strings.ID).toEqual({ shouldTranslate: false });
  });
  it("builds a catalog from another format", () => {
    const cat = parse('{"cart.empty":"Your cart is empty."}', "json");
    const out = JSON.parse(exportXcstrings("", cat, { ja: { "cart.empty": "カートは空です。" } }));
    expect(out.sourceLanguage).toBe("en");
    expect(out.strings["cart.empty"].localizations.en.stringUnit.value).toBe("Your cart is empty.");
    expect(out.strings["cart.empty"].localizations.ja.stringUnit.value).toBe("カートは空です。");
  });
});

describe("exportFileName", () => {
  it("uses each platform's folder conventions", () => {
    expect(exportFileName("android", "pt-BR")).toBe("values-pt-rBR/strings.xml");
    expect(exportFileName("android", "zh-Hans")).toBe("values-b+zh+Hans/strings.xml");
    expect(exportFileName("arb", "zh-Hans")).toBe("app_zh_Hans.arb");
    expect(exportFileName("strings", "ja")).toBe("ja.lproj/Localizable.strings");
  });
});
