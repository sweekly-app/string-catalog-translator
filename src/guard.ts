// An on-device-only call must never be able to reach the cloud. The SDK's "only_on_device" mode is not a hard
// guarantee when Chrome has no built-in model API (audit L-1), so the app refuses such a call itself, before
// anything is sent. Confidential keys only ever travel on this route.
export function refuseIfNoDeviceModel(route: string, hasDeviceModelApi: boolean): void {
  if (route === "only_on_device" && !hasDeviceModelApi) {
    throw new Error("on-device only, and this browser has no Gemini Nano: nothing was sent");
  }
}

export function hasDeviceModelApi(): boolean {
  return typeof (globalThis as { LanguageModel?: unknown }).LanguageModel !== "undefined";
}
