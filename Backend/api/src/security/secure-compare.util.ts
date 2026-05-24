import { createHash, timingSafeEqual } from "node:crypto";

export const secureCompare = (left: string | undefined, right: string | undefined): boolean => {
  const normalizedLeft = left?.trim();
  const normalizedRight = right?.trim();
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  const leftHash = createHash("sha256").update(normalizedLeft).digest();
  const rightHash = createHash("sha256").update(normalizedRight).digest();
  return timingSafeEqual(leftHash, rightHash);
};

export const isUnsafeSharedSecret = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized || normalized.length < 16) {
    return true;
  }

  return [
    "change-me",
    "changeme",
    "dev-only-secret-change-me",
    "dev-only-reset-secret-change-me",
    "secret",
    "test",
    "test-secret"
  ].includes(normalized);
};
