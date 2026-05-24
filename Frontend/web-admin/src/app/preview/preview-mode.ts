import type { Session } from "../../shared/types/app";
import { LOCAL_PREVIEW_ACCESS_TOKEN } from "../../shared/services/local-preview-session";

const LOCAL_PREVIEW_HASH = "#preview-admin";

export const isLocalPreviewEnabled = (): boolean =>
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_PREVIEW !== "false";

export const isLocalPreviewRoute = (): boolean =>
  typeof window !== "undefined" && window.location.hash === LOCAL_PREVIEW_HASH;

export const isLocalPreviewSession = (session?: Session | null): boolean =>
  isLocalPreviewEnabled() && session?.accessToken === LOCAL_PREVIEW_ACCESS_TOKEN;
