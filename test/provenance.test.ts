import { describe, expect, it } from "vitest";

// Statements the contest form and legal rely on (audit H-1/H-2 of 19 Nov, legal L2 and L3).
const files = import.meta.glob<string>(
  ["../SUBMISSION.md", "../README.md", "../NOTICE", "../PROVENANCE.md", "../third_party/wikipedia-android/*", "../src/ai.ts"],
  { query: "?raw", import: "default", eager: true },
);
const read = (name: string): string => {
  const hit = Object.entries(files).find(([k]) => k.endsWith(name));
  if (!hit) throw new Error(`missing ${name}`);
  return hit[1];
};
const COMMIT = "b39e649981a97d8e24eb938f04ccc3d20aa3b456";
const URL = "https://github.com/wikimedia/apps-android-wikipedia";
const WIKI_LINE =
  "Test input shown on screen: strings from the open-source Wikipedia Android app, Apache License 2.0. Wikimedia is not affiliated with and does not endorse this project.";

describe("third-party test input (Wikipedia Android strings excerpt)", () => {
  it("ships with its Apache 2.0 licence and a source line pinned to a commit", () => {
    expect(read("third_party/wikipedia-android/LICENSE")).toMatch(/Apache License\s+Version 2\.0, January 2004/);
    const source = read("third_party/wikipedia-android/SOURCE.md");
    expect(source).toContain(URL);
    expect(source).toContain(COMMIT);
    expect(read("third_party/wikipedia-android/strings-excerpt.xml")).toMatch(/shareable_reading_lists_/);
  });

  it("is listed in NOTICE and PROVENANCE with URL, commit and licence", () => {
    for (const f of ["NOTICE", "PROVENANCE.md"]) {
      const t = read(f).replace(/\s+/g, " ");
      expect(t).toContain("third_party/wikipedia-android");
      expect(t).toContain(URL);
      expect(t).toContain(COMMIT);
      expect(t).toContain("Apache License 2.0");
    }
  });

  it("the form statements say so, in legal's wording", () => {
    const sub = read("SUBMISSION.md");
    expect(sub).not.toContain("No scraped, personal or third-party data");
    expect(sub).toContain("plus one public open-source strings file used under its licence (see NOTICE)");
    expect(sub).toContain("the app and the video add no third-party logos (screen recordings show the browser's own interface)");
    expect(sub).toContain(WIKI_LINE);
    expect(read("README.md")).toContain("used under its licence; the Wikipedia Android app is not affiliated with this project.");
  });
});

describe("on-device-only guard is wired in", () => {
  it("generate() refuses before it builds a model or calls the SDK", () => {
    const src = read("src/ai.ts");
    const body = src.slice(src.indexOf("generate: Generate"));
    const guard = body.indexOf("refuseIfNoDeviceModel(route, hasDeviceModelApi())");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(body.indexOf("this.model(route"));
    expect(guard).toBeLessThan(body.indexOf("generateContent("));
  });
});
