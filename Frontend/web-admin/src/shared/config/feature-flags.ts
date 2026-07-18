import type { ScreenId } from "../types/app";

export const FEATURE_FLAG_KEYS = [
  "studentPortal",
  "mosquee",
  "messages",
  "userBilling"
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlags = Readonly<Record<FeatureFlagKey, boolean>>;

export const FEATURE_FLAG_ENV_NAMES: Record<FeatureFlagKey, string> = {
  studentPortal: "VITE_FEATURE_STUDENT_PORTAL",
  mosquee: "VITE_FEATURE_MOSQUEE",
  messages: "VITE_FEATURE_MESSAGES",
  userBilling: "VITE_FEATURE_USER_BILLING"
};

export const resolveFeatureFlags = (
  env: Readonly<Record<string, string | boolean | undefined>>
): FeatureFlags => ({
  studentPortal: env.VITE_FEATURE_STUDENT_PORTAL === "true",
  mosquee: env.VITE_FEATURE_MOSQUEE === "true",
  messages: env.VITE_FEATURE_MESSAGES === "true",
  userBilling: env.VITE_FEATURE_USER_BILLING === "true"
});

export const FEATURE_FLAGS = resolveFeatureFlags(import.meta.env);

const SCREEN_FEATURE_FLAGS: Partial<Record<ScreenId, FeatureFlagKey>> = {
  studentPortal: "studentPortal",
  mosquee: "mosquee",
  messages: "messages",
  billing: "userBilling"
};

export const getScreenFeatureFlag = (screen: ScreenId): FeatureFlagKey | null =>
  SCREEN_FEATURE_FLAGS[screen] ?? null;

export const isScreenFeatureEnabled = (
  screen: ScreenId,
  flags: FeatureFlags = FEATURE_FLAGS
): boolean => {
  const flag = getScreenFeatureFlag(screen);
  return flag ? flags[flag] : true;
};
