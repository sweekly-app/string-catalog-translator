// The Firebase web config is public by design (it identifies the project; access is
// enforced by Firebase, App Check and the API key's restrictions, not by secrecy).
// Set VITE_FIREBASE_CONFIG to the JSON object from the Firebase console at build time.

import type { FirebaseOptions } from "firebase/app";

const PLACEHOLDER: FirebaseOptions = {
  apiKey: "PLACEHOLDER",
  authDomain: "PLACEHOLDER.firebaseapp.com",
  projectId: "PLACEHOLDER",
  appId: "PLACEHOLDER",
};

export function readFirebaseConfig(raw: string | undefined): { config: FirebaseOptions; isPlaceholder: boolean } {
  if (!raw) return { config: PLACEHOLDER, isPlaceholder: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("VITE_FIREBASE_CONFIG is not valid JSON");
  }
  const c = parsed as FirebaseOptions;
  if (!c || typeof c.apiKey !== "string" || typeof c.projectId !== "string" || typeof c.appId !== "string") {
    throw new Error("VITE_FIREBASE_CONFIG needs apiKey, projectId and appId");
  }
  return { config: c, isPlaceholder: false };
}

export type AppCheckProviderKind = "enterprise" | "v3";

/**
 * Which reCAPTCHA provider App Check uses: it must match what the Firebase console has
 * registered for the web app (reCAPTCHA Enterprise, or classic reCAPTCHA v3).
 * Set at build time with VITE_APPCHECK_PROVIDER; Enterprise by default.
 */
export function readAppCheckProvider(raw: string | undefined): AppCheckProviderKind {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "" || v === "enterprise") return "enterprise";
  if (v === "v3") return "v3";
  throw new Error('VITE_APPCHECK_PROVIDER must be "enterprise" or "v3"');
}
