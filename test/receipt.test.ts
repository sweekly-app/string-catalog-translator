import { describe, expect, it } from "vitest";
import {
  friendlyError,
  isConfidential,
  receipt,
  stats,
  translateBatch,
  type Generate,
  type GenerateArgs,
  type ItemResult,
} from "../src/engine";
import type { Entry } from "../src/formats";

const entries: Entry[] = [
  { key: "checkout.pay", text: "Pay {amount}" },
  { key: "cart.items", text: "%d items" },
  { key: "feature.unreleased.split.title", text: "Split the bill with {name}" },
];
const CONF = ["feature.unreleased."];

/** Fake model answering per route; records every call so a test can prove what was sent where. */
function fake(answer: (key: string, a: GenerateArgs) => string | undefined, source: (a: GenerateArgs) => "on_device" | "in_cloud") {
  const calls: GenerateArgs[] = [];
  const g: Generate = async (a) => {
    calls.push(a);
    const items = JSON.parse(a.prompt.slice(a.prompt.indexOf("["))) as { id: string; key: string }[];
    const out: Record<string, string> = {};
    for (const it of items) {
      const v = answer(it.key, a);
      if (v !== undefined) out[it.id] = v;
    }
    return { text: JSON.stringify(out), source: source(a) };
  };
  return { g, calls };
}
const good: Record<string, string> = {
  "checkout.pay": "Payer {amount}",
  "cart.items": "%d articles",
  "feature.unreleased.split.title": "Partager l'addition avec {name}",
};
const keysSent = (calls: GenerateArgs[], pred: (a: GenerateArgs) => boolean) =>
  calls.filter(pred).flatMap((a) => (JSON.parse(a.prompt.slice(a.prompt.indexOf("["))) as { key: string }[]).map((i) => i.key));
const mayReachCloud = (a: GenerateArgs) => a.route !== "only_on_device";

describe("confidential keys", () => {
  it("matches by key prefix and ignores blanks", () => {
    expect(isConfidential("feature.unreleased.x", CONF)).toBe(true);
    expect(isConfidential("feature.x", CONF)).toBe(false);
    expect(isConfidential("anything", ["", "  "])).toBe(false);
  });

  it("Hybrid with Nano: a confidential string is only ever sent on-device; its failure is flagged, never escalated", async () => {
    const { g, calls } = fake(
      (k, a) => (k === "feature.unreleased.split.title" && a.route === "only_on_device" ? "Partager l'addition" : good[k]),
      (a) => (a.route === "only_in_cloud" ? "in_cloud" : "on_device"),
    );
    const r = await translateBatch(entries, {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "hybrid", generate: g, confidential: CONF, deviceAvailable: true,
    });
    expect(keysSent(calls, mayReachCloud)).not.toContain("feature.unreleased.split.title");
    const conf = r.find((x) => x.key === "feature.unreleased.split.title")!;
    expect(conf).toMatchObject({ status: "flagged", held: true, left: false, source: "on_device" });
    expect(conf.reason).toMatch(/lost \{name\}/);
    expect(r.filter((x) => !x.held).every((x) => x.status === "ok" && x.left === false)).toBe(true);
  });

  it("Hybrid without Nano: open strings go to the cloud, confidential ones are held back with no call at all", async () => {
    const { g, calls } = fake((k) => good[k], () => "in_cloud");
    const r = await translateBatch(entries, {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "hybrid", generate: g, confidential: CONF, deviceAvailable: false,
    });
    expect(keysSent(calls, () => true)).toEqual(["checkout.pay", "cart.items"]);
    expect(r.map((x) => [x.key, x.status, x.left, x.held ?? false])).toEqual([
      ["checkout.pay", "ok", true, false],
      ["cart.items", "ok", true, false],
      ["feature.unreleased.split.title", "held", false, true],
    ]);
    expect(r[2].text).toBeUndefined();
  });

  it("Cloud mode never sends a confidential key either", async () => {
    const { g, calls } = fake((k) => good[k], () => "in_cloud");
    const r = await translateBatch(entries, {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "cloud", generate: g, confidential: CONF, deviceAvailable: false,
    });
    expect(keysSent(calls, () => true)).not.toContain("feature.unreleased.split.title");
    expect(r[2]).toMatchObject({ status: "held", left: false });
  });
});

describe("what left the device", () => {
  it("Hybrid on-device success: nothing left; the escalated string left", async () => {
    const { g } = fake(
      (k, a) => (k === "checkout.pay" && a.route !== "only_in_cloud" ? "Payer {montant}" : good[k]),
      (a) => (a.route === "only_in_cloud" ? "in_cloud" : "on_device"),
    );
    const r = await translateBatch(entries.slice(0, 2), {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "hybrid", generate: g, deviceAvailable: true,
    });
    expect(r.map((x) => [x.key, x.status, x.left])).toEqual([
      ["checkout.pay", "escalated", true],
      ["cart.items", "ok", false],
    ]);
  });

  it("Private never marks anything as left", async () => {
    const { g, calls } = fake(() => undefined, () => "on_device");
    const r = await translateBatch(entries, { entries, sourceLanguage: "en", targetLanguage: "fr", mode: "private", generate: g });
    expect(calls.every((a) => a.route === "only_on_device")).toBe(true);
    expect(r.every((x) => x.left === false)).toBe(true);
  });

  it("a failed Hybrid call on a pair without Nano counts as possibly sent", async () => {
    const g: Generate = async (a) => {
      if (a.route === "prefer_on_device") throw new Error("network down");
      throw new Error("network down");
    };
    const r = await translateBatch(entries.slice(0, 1), {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "hybrid", generate: g, deviceAvailable: false, sleep: async () => {},
    });
    expect(r[0]).toMatchObject({ status: "failed", left: true });
  });
});

describe("quota and errors", () => {
  const quota = new Error(
    "AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/projects/p/models/m:generateContent: [429 ] Resource has been exhausted (e.g. check quota). (AI/fetch-error)",
  );

  it("friendlyError turns raw SDK errors into plain reasons with no URL", () => {
    expect(friendlyError(quota.message)).toBe("cloud busy: the demo's free quota is used up for now; try again in a minute");
    expect(friendlyError("[503 ] The model is overloaded")).toBe("cloud temporarily unavailable; try again shortly");
    expect(friendlyError("AI: Local LanguageModel API not available in this browser. (AI/api-not-enabled)")).toBe(
      "Gemini Nano is not available in this browser",
    );
    expect(friendlyError("no answer within 45 s (blocked network or App Check)")).toBe("no answer within 45 s (blocked network or App Check)");
    const other = friendlyError("Error at https://example.com/x?y=1 went wrong");
    expect(other).not.toMatch(/https?:/);
    expect(other).toContain("went wrong");
  });

  it("friendlyError stays fast and short on a huge message", () => {
    const t0 = Date.now();
    const out = friendlyError(" ".repeat(50_000) + "x (AI/fetch-error)" + " ".repeat(50_000));
    expect(Date.now() - t0).toBeLessThan(100);
    expect(out.length).toBeLessThanOrEqual(160);
  });

  it("a 429 is retried once after a pause, then succeeds", async () => {
    let n = 0;
    const waits: number[] = [];
    const g: Generate = async (a) => {
      n++;
      if (n === 1) throw quota;
      const items = JSON.parse(a.prompt.slice(a.prompt.indexOf("["))) as { id: string; key: string }[];
      return { text: JSON.stringify(Object.fromEntries(items.map((i) => [i.id, good[i.key]]))), source: "in_cloud" };
    };
    const r = await translateBatch(entries.slice(0, 2), {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "cloud", generate: g, sleep: async (ms) => void waits.push(ms),
    });
    expect(n).toBe(2);
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(0);
    expect(r.every((x) => x.status === "ok")).toBe(true);
  });

  it("a 429 that persists ends in a plain reason, without the project URL", async () => {
    const g: Generate = async () => {
      throw quota;
    };
    const r = await translateBatch(entries.slice(0, 1), {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "cloud", generate: g, sleep: async () => {},
    });
    expect(r[0].status).toBe("failed");
    expect(r[0].reason).toContain("cloud busy");
    expect(r[0].reason).not.toMatch(/googleapis|projects\//);
  });

  it("an on-device-only error is not retried", async () => {
    let n = 0;
    const g: Generate = async () => {
      n++;
      throw new Error("[429 ] quota");
    };
    await translateBatch(entries.slice(0, 1), {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "private", generate: g, sleep: async () => {},
    });
    // Private: first try + one per-string retry, no backoff retries on the device route.
    expect(n).toBe(2);
  });
});

describe("keep-unchanged terms (audit M-5)", () => {
  it("a keep term goes into a prompt only when a string of that batch contains it", async () => {
    const seen: string[] = [];
    const g: Generate = async (a) => {
      seen.push(a.system);
      const items = JSON.parse(a.prompt.slice(a.prompt.indexOf("["))) as { id: string; key: string }[];
      return { text: JSON.stringify(Object.fromEntries(items.map((i) => [i.id, good[i.key]]))), source: "in_cloud" };
    };
    await translateBatch(entries.slice(0, 2), {
      entries, sourceLanguage: "en", targetLanguage: "fr", mode: "cloud", generate: g, keepTerms: ["Project Falcon", "Pay"],
    });
    expect(seen[0]).toContain('"Pay"');
    expect(seen[0]).not.toContain("Project Falcon");
  });
});

describe("error wording (audit L-3)", () => {
  it("a disabled cloud API is not blamed on Gemini Nano", () => {
    expect(friendlyError("AI: The Firebase AI Logic API is not enabled for this project. (AI/api-not-enabled)")).not.toMatch(/Gemini Nano/);
  });
});

describe("receipt", () => {
  it("counts what never left, lists what left with its reason, and what was held back", () => {
    const fr: ItemResult[] = [
      { key: "a", text: "x", source: "on_device", status: "ok", left: false },
      { key: "b", text: "y", source: "in_cloud", status: "escalated", left: true, reason: "first try on-device: lost {amount}" },
      { key: "feature.unreleased.c", status: "held", left: false, held: true, reason: "confidential" },
    ];
    const de: ItemResult[] = [{ key: "a", text: "z", source: "in_cloud", status: "ok", left: true }];
    const rc = receipt({ fr, de });
    expect(rc.total).toBe(4);
    expect(rc.stayed).toBe(2);
    expect(rc.onDevice).toBe(1);
    expect(rc.left).toEqual([
      { key: "b", language: "fr", reason: "first try on-device: lost {amount}" },
      { key: "a", language: "de", reason: "this language pair has no on-device model here" },
    ]);
    expect(rc.held).toEqual([{ key: "feature.unreleased.c", language: "fr", state: "not translated" }]);
    fr[2].text = "à la main";
    fr[2].edited = true;
    expect(receipt({ fr }).held[0].state).toBe("translated by hand");
    expect(receipt({ fr }).onDevice).toBe(1);
    expect(stats([...fr, ...de]).held).toBe(1);
  });
});
