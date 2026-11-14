import { describe, expect, it } from "vitest";

// Rules: no third-party trademarks in the video (audit H-1). Google's own product names are allowed.
const THIRD_PARTY = /telegram|cisco|android headlines|samsung|chatgpt|openai|9to5|forbes|atlas translations|xcode|apple|crowdin/i;

const files = import.meta.glob<string>(["../video/cards.html", "../video/script.md"], { query: "?raw", import: "default", eager: true });
const read = (name: string): string => {
  const hit = Object.entries(files).find(([k]) => k.endsWith(name));
  if (!hit) throw new Error(`missing ${name}`);
  return hit[1];
};

describe("video text", () => {
  it("cards name no third-party product or outlet", () => {
    const html = read("cards.html").replace(/<[^>]*>/g, " ");
    expect(html.match(THIRD_PARTY)).toBeNull();
  });

  it("narration names no third-party product or outlet", () => {
    const script = read("script.md");
    const narration = script
      .split("\n")
      .filter((l: string) => /^\| \d+ \|/.test(l))
      .map((l: string) => l.split("|")[4] ?? "")
      .join("\n");
    expect(narration.length).toBeGreaterThan(100);
    expect(narration.match(THIRD_PARTY)).toBeNull();
  });
});
