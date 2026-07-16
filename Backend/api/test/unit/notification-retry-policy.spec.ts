import { ConfigService } from "@nestjs/config";

import { ProviderDispatchError } from "../../src/notifications/notification-delivery.types";
import { NotificationRetryPolicyService } from "../../src/notifications/notification-retry-policy.service";

const configService = (values: Record<string, string>): ConfigService =>
  ({
    get: jest.fn((key: string, defaultValue = "") => values[key] ?? defaultValue)
  }) as unknown as ConfigService;

describe("NotificationRetryPolicyService", () => {
  const now = new Date("2026-07-16T10:00:00.000Z");

  beforeEach(() => {
    jest.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("classifies a provider 400 as a permanent failure", () => {
    const service = new NotificationRetryPolicyService(configService({}));
    const decision = service.decide(
      new ProviderDispatchError("HTTP 400", "PERMANENT", { httpStatus: 400 }),
      1,
      now
    );

    expect(decision).toMatchObject({
      status: "FAILED_PERMANENT",
      retryable: false,
      httpStatus: 400,
      nextAttemptAt: null,
      outcomeUnknown: false
    });
  });

  it("honors Retry-After for a provider 429", () => {
    const service = new NotificationRetryPolicyService(
      configService({ NOTIFY_RETRY_BASE_SECONDS: "30" })
    );
    const decision = service.decide(
      new ProviderDispatchError("HTTP 429", "RETRYABLE", {
        httpStatus: 429,
        retryAfterMs: 120_000
      }),
      1,
      now
    );

    expect(decision.status).toBe("FAILED_RETRYABLE");
    expect(decision.retryAfterAt?.toISOString()).toBe("2026-07-16T10:02:00.000Z");
    expect(decision.nextAttemptAt?.toISOString()).toBe("2026-07-16T10:02:00.000Z");
  });

  it("applies exponential backoff to a provider 500", () => {
    const service = new NotificationRetryPolicyService(
      configService({ NOTIFY_RETRY_BASE_SECONDS: "10", NOTIFY_RETRY_MAX_SECONDS: "60" })
    );
    const decision = service.decide(
      new ProviderDispatchError("HTTP 500", "RETRYABLE", { httpStatus: 500 }),
      3,
      now
    );

    expect(decision.nextAttemptAt?.toISOString()).toBe("2026-07-16T10:00:40.000Z");
  });

  it("records a timeout as an unknown retryable outcome", () => {
    const service = new NotificationRetryPolicyService(configService({}));
    const decision = service.decide(
      new ProviderDispatchError("timeout", "UNKNOWN_OUTCOME"),
      1,
      now
    );

    expect(decision).toMatchObject({
      status: "FAILED_RETRYABLE",
      retryable: true,
      outcomeUnknown: true
    });
  });

  it("moves an exhausted retryable delivery to dead-letter", () => {
    const service = new NotificationRetryPolicyService(
      configService({ NOTIFY_MAX_ATTEMPTS: "3" })
    );
    const decision = service.decide(
      new ProviderDispatchError("HTTP 500", "RETRYABLE", { httpStatus: 500 }),
      3,
      now
    );

    expect(decision).toMatchObject({
      status: "DEAD_LETTER",
      retryable: true,
      nextAttemptAt: null
    });
  });
});
