// Firebase AI Logic wiring: one hybrid GenerativeModel per (route, language pair).
// Gemini Nano runs in Chrome through the built-in Prompt API when Chrome has it for
// the language pair; otherwise the SDK sends the request to Gemini in the cloud.

import { initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from "firebase/app-check";
import type { AppCheckProviderKind } from "./config";
import { fetchAndActivate, getRemoteConfig, getValue } from "firebase/remote-config";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import type { Generate, Route } from "./engine";
import { DEFAULT_POLICY, readPolicy, REMOTE_DEFAULTS, type Policy } from "./policy";

/** Per model call. Gemini Nano and the cloud answer a 12-string batch in seconds. */
export const CALL_TIMEOUT_MS = 45_000;

export class HybridTranslator {
  private ai: AI;
  private models = new Map<string, GenerativeModel>();
  policy: Policy = DEFAULT_POLICY;

  constructor(private app: FirebaseApp) {
    this.ai = getAI(app, { backend: new GoogleAIBackend() });
  }

  /**
   * App Check comes first: Firebase AI Logic rejects cloud calls without a valid
   * App Check token when enforcement is on. Local dev uses a debug token (printed
   * in the console once, then registered in the Firebase console).
   */
  static create(
    config: FirebaseOptions,
    recaptchaSiteKey: string | undefined,
    dev: boolean,
    providerKind: AppCheckProviderKind = "enterprise",
  ): HybridTranslator {
    const app = initializeApp(config);
    if (dev) (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    if (recaptchaSiteKey || dev) {
      initializeAppCheck(app, {
        provider:
          providerKind === "v3"
            ? new ReCaptchaV3Provider(recaptchaSiteKey ?? "debug")
            : new ReCaptchaEnterpriseProvider(recaptchaSiteKey ?? "debug"),
        isTokenAutoRefreshEnabled: true,
      });
    }
    return new HybridTranslator(app);
  }

  /** Load the Remote Config policy; on any failure keep the defaults. */
  async loadPolicy(): Promise<Policy> {
    try {
      const rc = getRemoteConfig(this.app);
      rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
      rc.defaultConfig = REMOTE_DEFAULTS;
      await fetchAndActivate(rc);
      this.policy = readPolicy((k) => getValue(rc, k).asString());
    } catch {
      this.policy = DEFAULT_POLICY;
    }
    this.models.clear();
    return this.policy;
  }

  model(route: Route, sourceLanguage: string, targetLanguage: string): GenerativeModel {
    const id = `${route}|${sourceLanguage}|${targetLanguage}|${this.policy.cloudModel}`;
    let m = this.models.get(id);
    if (!m) {
      m = getGenerativeModel(this.ai, {
        mode: route as InferenceMode,
        onDeviceParams: {
          // Declaring the language pair lets Chrome say whether Gemini Nano supports it;
          // if not, prefer_on_device routes this pair to the cloud.
          createOptions: {
            expectedInputs: [{ type: "text", languages: unique(["en", sourceLanguage]) }],
            expectedOutputs: [{ type: "text", languages: [targetLanguage] }],
          },
        },
        inCloudParams: {
          model: this.policy.cloudModel,
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        },
      });
      this.models.set(id, m);
    }
    return m;
  }

  /** Must run after a user gesture: it may start the Gemini Nano download. */
  async prepareDevice(sourceLanguage: string, targetLanguage: string, onProgress: (p: number) => void): Promise<void> {
    await this.model(InferenceMode.PREFER_ON_DEVICE, sourceLanguage, targetLanguage).initializeDeviceModel(onProgress);
  }

  generate: Generate = async (a) => {
    let route = a.route;
    if (!this.policy.cloudEnabled) {
      // Cloud paused by Remote Config: nothing may leave the device.
      if (route === "only_in_cloud") throw new Error("cloud fallback is paused");
      route = "only_on_device";
    }
    const model = this.model(route, a.sourceLanguage, a.targetLanguage);
    // The system text goes in the prompt so the on-device and cloud paths see the same input.
    // A call that hangs (for example App Check waiting on a reCAPTCHA script a blocker stopped:
    // the SDK awaits the token before it looks at the abort signal) fails after CALL_TIMEOUT_MS
    // instead of freezing the run; the engine then retries or flags it.
    // Stop (the user's signal) also ends the wait at once.
    const ctrl = new AbortController();
    let onAbort = () => ctrl.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new Error(`no answer within ${CALL_TIMEOUT_MS / 1000} s (blocked network or App Check)`));
      }, CALL_TIMEOUT_MS);
      onAbort = () => {
        ctrl.abort();
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (a.signal?.aborted) onAbort();
    });
    a.signal?.addEventListener("abort", onAbort);
    let result;
    try {
      result = await Promise.race([model.generateContent(`${a.system}\n\n${a.prompt}`, { signal: ctrl.signal }), timedOut]);
    } finally {
      clearTimeout(timer);
      a.signal?.removeEventListener("abort", onAbort);
    }
    return { text: result.response.text(), source: result.response.inferenceSource ?? "in_cloud" };
  };
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

export type DeviceAvailability = "available" | "downloadable" | "downloading" | "unavailable" | "no-api";

interface LanguageModelStatic {
  availability(o: unknown): Promise<string>;
}

/** Ask Chrome directly whether Gemini Nano can serve a language pair (for the status panel). */
export async function deviceAvailability(sourceLanguage: string, targetLanguage: string): Promise<DeviceAvailability> {
  const lm = (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel;
  if (!lm) return "no-api";
  try {
    const a = await lm.availability({
      expectedInputs: [{ type: "text", languages: unique(["en", sourceLanguage]) }],
      expectedOutputs: [{ type: "text", languages: [targetLanguage] }],
    });
    return a === "available" || a === "downloadable" || a === "downloading" ? a : "unavailable";
  } catch {
    return "unavailable";
  }
}
