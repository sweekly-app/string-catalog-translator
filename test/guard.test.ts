import { afterEach, describe, expect, it } from "vitest";
import { hasDeviceModelApi, refuseIfNoDeviceModel } from "../src/guard";

describe("on-device-only guard (confidential keys)", () => {
  afterEach(() => {
    delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
  });

  it("refuses an on-device-only call when the browser has no built-in model API", () => {
    expect(hasDeviceModelApi()).toBe(false);
    expect(() => refuseIfNoDeviceModel("only_on_device", hasDeviceModelApi())).toThrow(/nothing was sent/);
  });

  it("lets it through when the API exists, and never blocks the other routes", () => {
    (globalThis as { LanguageModel?: unknown }).LanguageModel = {};
    expect(hasDeviceModelApi()).toBe(true);
    expect(() => refuseIfNoDeviceModel("only_on_device", hasDeviceModelApi())).not.toThrow();
    expect(() => refuseIfNoDeviceModel("prefer_on_device", false)).not.toThrow();
    expect(() => refuseIfNoDeviceModel("only_in_cloud", false)).not.toThrow();
  });
});
