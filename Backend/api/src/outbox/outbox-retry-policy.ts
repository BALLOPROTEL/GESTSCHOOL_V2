export function outboxRetryDelayMs(
  attempt: number,
  baseSeconds: number,
  maxSeconds: number,
  random: () => number = Math.random
): number {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  const normalizedBaseSeconds = Number.isFinite(baseSeconds) && baseSeconds > 0
    ? baseSeconds
    : 15;
  const normalizedMaxSeconds = Number.isFinite(maxSeconds) && maxSeconds > 0
    ? Math.max(maxSeconds, normalizedBaseSeconds)
    : 600;
  const exponentialMs = Math.min(
    normalizedBaseSeconds * 1000 * 2 ** (normalizedAttempt - 1),
    normalizedMaxSeconds * 1000
  );
  const jitterRatio = Math.max(0, Math.min(random(), 1)) * 0.2;

  return Math.min(
    Math.floor(exponentialMs * (1 + jitterRatio)),
    normalizedMaxSeconds * 1000
  );
}
