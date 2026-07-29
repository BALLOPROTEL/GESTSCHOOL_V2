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

  it.each([200, 201])(
    "maps the Brevo email contract and accepts an HTTP %s provider message id",
    async (status) => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ messageId: "<brevo-message-001>" }, status)
    );
    const result = await new NotificationGatewayService(configService()).dispatch(payload);

    expect(result).toMatchObject({
      provider: "BREVO_EMAIL",
      providerMessageId: "brevo-message-001",
      deliveryStatus: "SENT",
      providerIdempotencyKeySent: true
    });
    const request = fetchSpy.mock.calls[0]?.[1];
    const headers = request?.headers as Record<string, string>;
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(headers["api-key"]).toBe(values.BREVO_API_KEY);
    expect(headers["Idempotency-Key"]).toBeUndefined();
    expect(body).toMatchObject({
      sender: {
        email: values.BREVO_SENDER_EMAIL,
        name: values.BREVO_SENDER_NAME
      },
      to: [{ email: payload.targetAddress }],
      subject: payload.title,
      textContent: payload.message,
      headers: {
        "Idempotency-Key": payload.notificationId
      }
    });
    }
  );

  it.each([
    [400, "PERMANENT"],
    [401, "PERMANENT"],
    [403, "PERMANENT"],
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

  it("uses the Brevo rate-limit reset header when Retry-After is absent", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(
        { code: "rate_limit" },
        429,
        { "x-sib-ratelimit-reset": "45" }
      )
    );

    await expect(new NotificationGatewayService(configService()).dispatch(payload)).rejects
      .toMatchObject<Partial<ProviderDispatchError>>({
        kind: "RETRYABLE",
        options: expect.objectContaining({ retryAfterMs: 45_000 })
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

  it("rejects a disabled external channel before selecting or calling a provider", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");

    await expect(
      new NotificationGatewayService(
        configService({ NOTIFICATIONS_EMAIL_ENABLED: "false" })
      ).dispatch(payload)
    ).rejects.toMatchObject<Partial<ProviderDispatchError>>({
      kind: "PERMANENT",
      options: expect.objectContaining({ provider: "DISABLED" })
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts the numeric message id returned by Brevo SMS without claiming idempotency", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ messageId: 1511882900176220 }, 201)
    );
    const result = await new NotificationGatewayService(configService()).dispatch({
      ...payload,
      channel: "SMS",
      targetAddress: "+221770000000"
    });

    expect(result).toEqual({
      provider: "BREVO_SMS",
      providerMessageId: "1511882900176220",
      deliveryStatus: "SENT",
      providerIdempotencyKeySent: false
    });
    const request = fetchSpy.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(request?.headers).not.toMatchObject({ "Idempotency-Key": expect.anything() });
    expect(body).toMatchObject({
      sender: "GestSchool",
      recipient: "+221770000000",
      content: payload.message,
      type: "transactional",
      unicodeEnabled: true
    });
  });

  it.each([
    [{ ALLOW_REAL_SMS: "false", BREVO_SMS_DRY_RUN: "false" }, "BREVO_SMS_DRY_RUN"],
    [{ ALLOW_REAL_SMS: "true", BREVO_SMS_DRY_RUN: "true" }, "BREVO_SMS_DRY_RUN"]
  ])("keeps SMS in dry-run unless both production guards allow sending", async (overrides, provider) => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const result = await new NotificationGatewayService(
      configService(overrides)
    ).dispatch({
      ...payload,
      channel: "SMS",
      targetAddress: "+221770000000"
    });

    expect(result.provider).toBe(provider);
    expect(result.providerIdempotencyKeySent).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("verifies an active sender without sending an email", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
        senders: [
          {
            active: true,
            email: values.BREVO_SENDER_EMAIL,
            id: 42,
            name: values.BREVO_SENDER_NAME
          }
        ]
      })
    );

    await expect(
      new NotificationGatewayService(configService()).verifyBrevoEmailSender()
    ).resolves.toEqual({
      active: true,
      configured: true,
      provider: "BREVO_EMAIL"
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it.each([
    [{ senders: [] }, "Configured Brevo sender was not found."],
    [
      {
        senders: [
          {
            active: false,
            email: values.BREVO_SENDER_EMAIL
          }
        ]
      },
      "Configured Brevo sender is not active."
    ]
  ])("rejects an unavailable configured sender", async (response, expectedMessage) => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(response));

    await expect(
      new NotificationGatewayService(configService()).verifyBrevoEmailSender()
    ).rejects.toMatchObject({
      kind: "PERMANENT",
      message: expectedMessage
    });
  });

  it("rejects a non-versioned idempotency identifier before any network request", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");

    await expect(
      new NotificationGatewayService(configService()).dispatch({
        ...payload,
        notificationId: "notification-legacy"
      })
    ).rejects.toMatchObject({
      kind: "PERMANENT",
      message: "Notification identifier cannot be used for Brevo idempotency."
    });
    expect(fetchSpy).not.toHaveBeenCalled();
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
