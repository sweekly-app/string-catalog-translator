// Operational switches served by Firebase Remote Config, with safe defaults in code.
// They let the cloud model be changed, or the cloud fallback be switched off (for
// example if the free quota runs out), without redeploying the static site.

export interface Policy {
  cloudModel: string;
  cloudEnabled: boolean;
  batchSize: number;
}

export const DEFAULT_POLICY: Policy = {
  cloudModel: "gemini-3.5-flash-lite",
  cloudEnabled: true,
  batchSize: 12,
};

/** Remote Config parameter names and their default values (Remote Config stores strings). */
export const REMOTE_DEFAULTS: Record<string, string> = {
  cloud_model: DEFAULT_POLICY.cloudModel,
  cloud_fallback_enabled: String(DEFAULT_POLICY.cloudEnabled),
  batch_size: String(DEFAULT_POLICY.batchSize),
};

/** Validate raw Remote Config values; anything malformed falls back to the default. */
export function readPolicy(get: (key: string) => string | undefined): Policy {
  const model = get("cloud_model")?.trim();
  const enabled = get("cloud_fallback_enabled")?.trim().toLowerCase();
  const batch = Number(get("batch_size"));
  return {
    cloudModel: model && /^gemini-[\w.-]{1,60}$/.test(model) ? model : DEFAULT_POLICY.cloudModel,
    cloudEnabled: enabled === "false" ? false : DEFAULT_POLICY.cloudEnabled,
    batchSize: Number.isInteger(batch) && batch >= 1 && batch <= 40 ? batch : DEFAULT_POLICY.batchSize,
  };
}
