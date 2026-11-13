/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FIREBASE_CONFIG?: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_APPCHECK_PROVIDER?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
