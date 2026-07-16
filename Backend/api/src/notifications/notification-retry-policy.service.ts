import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  type NotificationFailureDecision,
  ProviderDispatchError,
  sanitizeProviderError
} from "./notification-delivery.types";

@Injectable()
export class NotificationRetryPolicyService {
  constructor(private readonly configService: ConfigService) {}

  decide(error: unknown, attempt: number, now = new Date()): NotificationFailureDecision {
    const providerError =
      error instanceof ProviderDispatchError
        ? error
        : new ProviderDispatchError(sanitizeProviderError(error), "RETRYABLE");
    const maxAttempts = this.maxAttempts();
    const retryable = providerError.retryable;
    const exhausted = attempt >= maxAttempts;
    const retryAfterMs = providerError.options.retryAfterMs;
    const delayMs = Math.max(retryAfterMs || 0, this.backoffWithJitterMs(attempt));
    const nextAttemptAt = retryable && !exhausted ? new Date(now.getTime() + delayMs) : null;

    return {
      errorMessage: sanitizeProviderError(providerError),
      httpStatus: providerError.options.httpStatus,
      nextAttemptAt,
      outcomeUnknown: providerError.outcomeUnknown,
      retryAfterAt: retryAfterMs ? new Date(now.getTime() + retryAfterMs) : null,
      retryable,
      status: retryable ? (exhausted ? "DEAD_LETTER" : "FAILED_RETRYABLE") : "FAILED_PERMANENT"
    };
  }

  maxAttempts(): number {
    const raw = Number(this.configService.get<string>("NOTIFY_MAX_ATTEMPTS", "5"));
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 5;
  }

  private backoffWithJitterMs(attempt: number): number {
    const baseRaw = Number(this.configService.get<string>("NOTIFY_RETRY_BASE_SECONDS", "30"));
    const capRaw = Number(this.configService.get<string>("NOTIFY_RETRY_MAX_SECONDS", "7200"));
    const baseMs = (Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : 30) * 1000;
    const capMs = (Number.isFinite(capRaw) && capRaw > 0 ? capRaw : 7200) * 1000;
    const exponential = Math.min(baseMs * 2 ** Math.max(0, attempt - 1), capMs);
    const jitterRatio = Math.random() * 0.2;
    return Math.floor(exponential * (1 + jitterRatio));
  }
}
