/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_ENABLE_PREVIEW?: string;
  readonly VITE_FEATURE_MESSAGES?: string;
  readonly VITE_FEATURE_MOSQUEE?: string;
  readonly VITE_FEATURE_STUDENT_PORTAL?: string;
  readonly VITE_FEATURE_USER_BILLING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
