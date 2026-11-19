import { describe, expect, it, vi } from "vitest";

// The Remote Config pause switch: once the policy says the cloud fallback is off, no call may use a cloud route.
const modes: string[] = [];
vi.mock("firebase/ai", () => ({
  getAI: () => ({}),
  GoogleAIBackend: class {},
  InferenceMode: { PREFER_ON_DEVICE: "prefer_on_device", ONLY_ON_DEVICE: "only_on_device", ONLY_IN_CLOUD: "only_in_cloud" },
  getGenerativeModel: (_ai: unknown, o: { mode: string }) => {
    modes.push(o.mode);
    return { generateContent: async () => ({ response: { text: () => "{}", inferenceSource: "on_device" } }) };
  },
}));

const { HybridTranslator } = await import("../src/ai");
const { DEFAULT_POLICY } = await import("../src/policy");

describe("Remote Config pause switch", () => {
  const call = (t: InstanceType<typeof HybridTranslator>, route: "prefer_on_device" | "only_in_cloud" | "only_on_device") =>
    t.generate({ route, sourceLanguage: "en", targetLanguage: "fr", system: "s", prompt: "p" } as never);

  it("with the cloud paused, every call runs on-device only and a cloud call is refused before any model is made", async () => {
    (globalThis as { LanguageModel?: unknown }).LanguageModel = {};
    const t = new HybridTranslator({} as never);
    t.policy = { ...DEFAULT_POLICY, cloudEnabled: false };
    modes.length = 0;
    await call(t, "prefer_on_device");
    await expect(call(t, "only_in_cloud")).rejects.toThrow(/paused/);
    expect(modes).toEqual(["only_on_device"]);
    delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
  });

  it("with the cloud paused and no on-device model, nothing is called at all", async () => {
    const t = new HybridTranslator({} as never);
    t.policy = { ...DEFAULT_POLICY, cloudEnabled: false };
    modes.length = 0;
    await expect(call(t, "prefer_on_device")).rejects.toThrow(/nothing was sent/);
    expect(modes).toEqual([]);
  });
});
