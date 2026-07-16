export const NOTIFICATION_LIFECYCLE_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
  "DEAD_LETTER",
  "CANCELLED"
] as const;

export type NotificationLifecycleStatus =
  (typeof NOTIFICATION_LIFECYCLE_STATUSES)[number];

export type ProviderFailureKind = "PERMANENT" | "RETRYABLE" | "UNKNOWN_OUTCOME";

export class ProviderDispatchError extends Error {
  constructor(
    message: string,
    readonly kind: ProviderFailureKind,
    readonly options: {
      httpStatus?: number;
      retryAfterMs?: number;
      provider?: string;
    } = {}
  ) {
    super(message);
    this.name = "ProviderDispatchError";
  }

  get retryable(): boolean {
    return this.kind !== "PERMANENT";
  }

  get outcomeUnknown(): boolean {
    return this.kind === "UNKNOWN_OUTCOME";
  }
}

export type NotificationFailureDecision = {
  errorMessage: string;
  httpStatus?: number;
  nextAttemptAt: Date | null;
  outcomeUnknown: boolean;
  retryAfterAt: Date | null;
  retryable: boolean;
  status: "FAILED_RETRYABLE" | "FAILED_PERMANENT" | "DEAD_LETTER";
};

export function sanitizeProviderError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Notification provider request failed.";
  return raw
    .replace(/(api[-_ ]?key|authorization|bearer|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{40,}/g, "[redacted]")
    .slice(0, 500);
}
