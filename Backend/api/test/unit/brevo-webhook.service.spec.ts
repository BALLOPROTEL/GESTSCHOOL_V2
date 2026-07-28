import { ConfigService } from "@nestjs/config";

import { BrevoWebhookService } from "../../src/notifications/brevo-webhook.service";

const token = "brevo-webhook-token-with-at-least-32-characters";
const now = new Date("2026-07-26T10:00:00.000Z");
const eventTimestamp = Math.floor(now.getTime() / 1000);

const configService = (overrides: Record<string, string> = {}): ConfigService =>
  ({
    get: jest.fn(
      (key: string, defaultValue = "") =>
        ({
          BREVO_WEBHOOK_ENABLED: "true",
          BREVO_WEBHOOK_AUTH_TOKEN: token,
          BREVO_WEBHOOK_MAX_AGE_SECONDS: "90000",
          ...overrides
        })[key] ?? defaultValue
    )
  }) as unknown as ConfigService;

describe("BrevoWebhookService", () => {
  it("authenticates and normalizes an official email delivery payload", () => {
    const result = new BrevoWebhookService(configService()).verify({
      authorization: `Bearer ${token}`,
      now,
      payload: {
        id: "26224",
        event: "delivered",
        "message-id": "<201798300811.5787683@relay.domain.com>",
        ts_event: eventTimestamp
      }
    });

    expect(result).toMatchObject({
      channel: "EMAIL",
      provider: "BREVO_EMAIL",
      providerMessageId: "201798300811.5787683@relay.domain.com",
      status: "DELIVERED"
    });
    expect(result.eventId).toMatch(/^brevo-[a-f0-9]{64}$/);
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("to");
  });

  it("normalizes the numeric identifier and status of an official SMS payload", () => {
    const result = new BrevoWebhookService(configService()).verify({
      authorization: `Bearer ${token}`,
      now,
      payload: {
        id: "26527",
        messageId: "1511882900176220",
        msg_status: "soft_bounce",
        status: "OK",
        ts_event: eventTimestamp
      }
    });

    expect(result).toMatchObject({
      channel: "SMS",
      provider: "BREVO_SMS",
      providerMessageId: "1511882900176220",
      status: "SENT"
    });
  });

  it.each([
    ["bl", "Blacklisted by provider"],
    ["rej", "Rejected by provider"]
  ])(
    "maps the official Brevo SMS status %s to a permanent failure",
    (msgStatus, description) => {
      const result = new BrevoWebhookService(configService()).verify({
        authorization: `Bearer ${token}`,
        now,
        payload: {
          id: "26527",
          description,
          messageId: "1511882900176220",
          msg_status: msgStatus
        }
      });

      expect(result).toMatchObject({
        channel: "SMS",
        errorMessage: description,
        occurredAt: now,
        provider: "BREVO_SMS",
        providerTimestampPresent: false,
        status: "FAILED_PERMANENT"
      });
    }
  );

  it("creates the same event fingerprint when Brevo retries with another timestamp", () => {
    const service = new BrevoWebhookService(configService());
    const first = service.verify({
      authorization: `Bearer ${token}`,
      now,
      payload: {
        id: "26224",
        event: "delivered",
        "message-id": "message-001",
        ts_event: eventTimestamp
      }
    });
    const retry = service.verify({
      authorization: `Bearer ${token}`,
      now,
      payload: {
        id: "26224",
        event: "delivered",
        "message-id": "message-001",
        ts_event: eventTimestamp - 60
      }
    });

    expect(retry.eventId).toBe(first.eventId);
  });

  it("maps the official invalid_email event to a permanent failure", () => {
    const result = new BrevoWebhookService(configService()).verify({
      authorization: `Bearer ${token}`,
      now,
      payload: {
        id: "26224",
        event: "invalid_email",
        "message-id": "message-001",
        ts_event: eventTimestamp
      }
    });

    expect(result.status).toBe("FAILED_PERMANENT");
  });

  it("keeps out-of-order events distinct for monotonic processing downstream", () => {
    const service = new BrevoWebhookService(configService());
    const delivered = service.verify({
      authorization: `Bearer ${token}`,
      now,
      payload: {
        id: "26224",
        event: "delivered",
        "message-id": "message-001",
        ts_event: eventTimestamp
      }
    });
    const olderFailure = service.verify({
      authorization: `Bearer ${token}`,
      now,
      payload: {
        id: "26224",
        event: "hard_bounce",
        "message-id": "message-001",
        ts_event: eventTimestamp - 60
      }
    });

    expect(delivered.status).toBe("DELIVERED");
    expect(olderFailure.status).toBe("FAILED_PERMANENT");
    expect(olderFailure.eventId).not.toBe(delivered.eventId);
  });

  it.each([
    [undefined],
    ["Basic dXNlcjpwYXNz"],
    ["Bearer invalid-token"]
  ])("rejects an invalid webhook authorization header", (authorization) => {
    expect(() =>
      new BrevoWebhookService(configService()).verify({
        authorization,
        now,
        payload: {
          id: "26224",
          event: "delivered",
          "message-id": "message-001",
          ts_event: eventTimestamp
        }
      })
    ).toThrow("Invalid Brevo webhook authentication.");
  });

  it("rejects disabled, stale and unsupported callbacks", () => {
    const payload = {
      id: "26224",
      event: "delivered",
      "message-id": "message-001",
      ts_event: eventTimestamp
    };
    expect(() =>
      new BrevoWebhookService(
        configService({ BREVO_WEBHOOK_ENABLED: "false" })
      ).verify({
        authorization: `Bearer ${token}`,
        now,
        payload
      })
    ).toThrow("Brevo webhooks are disabled.");

    expect(() =>
      new BrevoWebhookService(
        configService({ BREVO_WEBHOOK_MAX_AGE_SECONDS: "300" })
      ).verify({
        authorization: `Bearer ${token}`,
        now,
        payload: { ...payload, ts_event: eventTimestamp - 301 }
      })
    ).toThrow("Brevo webhook timestamp is outside the accepted window.");

    expect(() =>
      new BrevoWebhookService(configService()).verify({
        authorization: `Bearer ${token}`,
        now,
        payload: { ...payload, event: "unknown-event" }
      })
    ).toThrow("Brevo webhook event is not supported.");
  });
});
