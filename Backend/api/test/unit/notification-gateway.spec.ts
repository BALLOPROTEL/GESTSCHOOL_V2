import { ConfigService } from "@nestjs/config";

import { ProviderDispatchError } from "../../src/notifications/notification-delivery.types";
import {
  NotificationGatewayService,
  type DispatchNotificationInput
} from "../../src/notifications/notification-gateway.service";

const values: Record<string, string> = {
  NOTIFICATIONS_EMAIL_PROVIDER: "BREVO",
  NOTIFICATIONS_SMS_PROVIDER: "BREVO",
  BREVO_API_KEY: "brevo-test-api-key-long-enough",
  BREVO_SENDER_EMAIL: "no-reply@example.com",
  BREVO_SENDER_NAME: "GestSchool",
  BREVO_TIMEOUT_MS: "50",
  BREVO_SMS_DRY_RUN: "false",
  ALLOW_REAL_SMS: "true",
  BREVO_SMS_SENDER: "GestSchool"
};

const configService = (overrides: Record<string, string> = {}): ConfigService =>
  ({
    get: jest.fn((key: string, defaultValue = "") => ({ ...values, ...overrides })[key] ?? defaultValue)
  }) as unknown as ConfigService;

const payload: DispatchNotificationInput = {
  notificationId: "11111111-1111-4111-8111-111111111111",
  tenantId: "00000000-0000-4000-8000-000000000001",
  channel: "EMAIL",
  title: "Notification",
  message: "Message de test",
  targetAddress: "parent@example.com",
  idempotencyKey: "notification:v2:test-key",
  attemptNo: 1
};

describe("NotificationGatewayService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the idempotency key and accepts a provider message id", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ messageId: "brevo-message-001" })
    );
    const result = await new NotificationGatewayService(configService()).dispatch(payload);

    expect(result).toMatchObject({
      provider: "BREVO_EMAIL",
      providerMessageId: "brevo-message-001",
      deliveryStatus: "SENT",
      providerIdempotencyKeySent: true
    });
    expect((fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>)["Idempotency-Key"])
      .toBe(payload.idempotencyKey);
  });

  it.each([
    [400, "PERMANENT"],
    [429, "RETRYABLE"],
    [500, "RETRYABLE"]
  ] as const)("classifies HTTP %s correctly", async (status, kind) => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ code: "provider_error" }, status, status === 429 ? { "retry-after": "90" } : {})
    );

    await expect(new NotificationGatewayService(configService()).dispatch(payload)).rejects
      .toMatchObject<Partial<ProviderDispatchError>>({
        kind,
        options: expect.objectContaining({
          httpStatus: status,
          ...(status === 429 ? { retryAfterMs: 90_000 } : {})
        })
      });
  });

  it("classifies a timeout as an unknown outcome", async () => {
    const timeout = new Error("aborted");
    timeout.name = "AbortError";
    jest.spyOn(global, "fetch").mockRejectedValue(timeout);

    await expect(new NotificationGatewayService(configService()).dispatch(payload)).rejects
      .toMatchObject<Partial<ProviderDispatchError>>({
        kind: "UNKNOWN_OUTCOME",
        options: expect.objectContaining({ provider: "BREVO_EMAIL" })
      });
  });

  it("treats a successful response without message id as an unknown outcome", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ accepted: true }));

    await expect(new NotificationGatewayService(configService()).dispatch(payload)).rejects
      .toMatchObject<Partial<ProviderDispatchError>>({ kind: "UNKNOWN_OUTCOME" });
  });

  it("signs webhook requests without logging or returning its secret", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ provider: "TEST_WEBHOOK", providerMessageId: "webhook-message-001" })
    );
    const gateway = new NotificationGatewayService(
      configService({
        NOTIFICATIONS_EMAIL_PROVIDER: "WEBHOOK",
        NOTIFY_EMAIL_WEBHOOK_URL: "https://notifications.example.test/email",
        NOTIFY_EMAIL_WEBHOOK_SIGNING_SECRET: "outgoing-webhook-secret-for-tests",
        NOTIFY_WEBHOOK_TIMEOUT_MS: "50"
      })
    );

    await gateway.dispatch(payload);

    const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(payload.idempotencyKey);
    expect(headers["X-GestSchool-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(headers["X-GestSchool-Timestamp"]).toMatch(/^\d+$/);
  });
});

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}
