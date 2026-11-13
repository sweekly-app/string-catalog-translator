import { describe, expect, it } from "vitest";
import { readAppCheckProvider, readFirebaseConfig } from "../src/config";

describe("readFirebaseConfig", () => {
  it("falls back to a placeholder", () => {
    expect(readFirebaseConfig(undefined).isPlaceholder).toBe(true);
  });
  it("accepts a console config", () => {
    const r = readFirebaseConfig('{"apiKey":"k","projectId":"p","appId":"a"}');
    expect(r).toEqual({ config: { apiKey: "k", projectId: "p", appId: "a" }, isPlaceholder: false });
  });
  it("rejects incomplete or invalid JSON", () => {
    expect(() => readFirebaseConfig("{")).toThrow(/JSON/);
    expect(() => readFirebaseConfig('{"apiKey":"k"}')).toThrow(/needs/);
  });
});

describe("readAppCheckProvider", () => {
  it("defaults to Enterprise and accepts v3", () => {
    expect(readAppCheckProvider(undefined)).toBe("enterprise");
    expect(readAppCheckProvider(" Enterprise ")).toBe("enterprise");
    expect(readAppCheckProvider("v3")).toBe("v3");
  });
  it("rejects anything else", () => {
    expect(() => readAppCheckProvider("v2")).toThrow(/enterprise/);
  });
});
