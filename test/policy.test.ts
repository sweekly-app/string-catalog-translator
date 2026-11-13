import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, readPolicy } from "../src/policy";

describe("readPolicy", () => {
  it("uses defaults when nothing is set", () => {
    expect(readPolicy(() => undefined)).toEqual(DEFAULT_POLICY);
  });
  it("reads valid values", () => {
    const v: Record<string, string> = { cloud_model: "gemini-3.5-flash", cloud_fallback_enabled: "false", batch_size: "20" };
    expect(readPolicy((k) => v[k])).toEqual({ cloudModel: "gemini-3.5-flash", cloudEnabled: false, batchSize: 20 });
  });
  it("rejects malformed values", () => {
    const v: Record<string, string> = { cloud_model: "evil/../model", cloud_fallback_enabled: "maybe", batch_size: "500" };
    expect(readPolicy((k) => v[k])).toEqual(DEFAULT_POLICY);
  });
});
