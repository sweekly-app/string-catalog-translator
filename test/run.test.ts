import { describe, expect, it } from "vitest";
import { parseRun, serializeRun, type SavedRun } from "../src/run";

const run: SavedRun = {
  kind: "string-catalog-translator/run",
  version: 1,
  created: "2026-11-24T10:00:00.000Z",
  browser: "Chrome/142.0.0.0",
  mode: "hybrid",
  sourceLanguage: "en",
  confidential: ["feature.unreleased."],
  keepTerms: ["Sweekly"],
  fileName: "sample.json",
  catalogText: '{"a":"Pay {amount}"}',
  onDeviceLanguages: ["es"],
  results: {
    es: { a: { key: "a", text: "Pagar {amount}", source: "on_device", status: "ok", left: false } },
  },
};

describe("saved runs", () => {
  it("round-trips", () => {
    expect(parseRun(serializeRun(run))).toEqual(run);
  });

  it("rejects anything that is not a saved run", () => {
    expect(() => parseRun("not json")).toThrow(/not a saved run/);
    expect(() => parseRun("{}")).toThrow(/not a saved run/);
    expect(() => parseRun(JSON.stringify({ ...run, version: 2 }))).toThrow(/version/);
    expect(() => parseRun(JSON.stringify({ ...run, mode: "turbo" }))).toThrow(/mode/);
    expect(() => parseRun(JSON.stringify({ ...run, sourceLanguage: "xx" }))).toThrow(/language/);
  });

  it("rejects malformed results instead of rendering them", () => {
    const bad = (results: unknown) => JSON.stringify({ ...run, results });
    expect(() => parseRun(bad({ zz: {} }))).toThrow(/language/);
    expect(() => parseRun(bad({ es: { a: { key: "a", status: "great", left: false } } }))).toThrow(/status/);
    expect(() => parseRun(bad({ es: { a: { key: "a", status: "ok", source: "moon", left: false } } }))).toThrow(/source/);
    expect(() => parseRun(bad({ es: { a: { key: "b", status: "ok", left: false } } }))).toThrow(/key/);
    expect(() => parseRun(bad({ es: { a: { key: "a", status: "ok", left: "no" } } }))).toThrow(/left/);
    expect(() => parseRun(bad({ es: { a: { key: "a", status: "ok", left: false, text: 5 } } }))).toThrow(/text/);
  });

  it("a __proto__ result key cannot change what other keys read (audit L-7)", () => {
    const raw = serializeRun(run).replace('"a": {', '"__proto__": { "key": "__proto__", "status": "ok", "left": false, "text": "x" }, "a": {');
    const back = parseRun(raw);
    expect((back.results.es as Record<string, unknown>).status).toBeUndefined();
    expect(back.results.es.a.text).toBe("Pagar {amount}");
  });

  it("drops unknown fields and caps the size", () => {
    const extra = JSON.parse(serializeRun(run));
    extra.results.es.a.evil = "<img onerror>";
    extra.surprise = 1;
    const back = parseRun(JSON.stringify(extra));
    expect((back.results.es.a as unknown as Record<string, unknown>).evil).toBeUndefined();
    expect((back as unknown as Record<string, unknown>).surprise).toBeUndefined();
    expect(() => parseRun("x".repeat(5_000_001))).toThrow(/too large/);
  });
});
