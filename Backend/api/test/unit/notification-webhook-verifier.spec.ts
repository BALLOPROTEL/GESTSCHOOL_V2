import { createHmac } from "node:crypto";

import { ConfigService } from "@nestjs/config";

import type { NotificationDeliveryEventDto } from "../../src/school-life/dto/school-life.dto";
import {
  canonicalNotificationWebhookPayload,
  NotificationWebhookVerifierService
} from "../../src/notifications/notification-webhook-verifier.service";

const secret = "notification-webhook-signing-secret-for-tests";
const now = new Date("2026-07-16T10:00:00.000Z");
const timestamp = String(Math.floor(now.getTime() / 1000));
const eventId = "provider-event-0001";
const payload: NotificationDeliveryEventDto = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  provider: "WEBHOOK_EMAIL",
  providerMessageId: "provider-message-001",
  status: "DELIVERED",
  occurredAt: now.toISOString()
};

const service = new NotificationWebhookVerifierService(
  ({
    get: jest.fn((key: string, fallback = "") =>
      key === "NOTIFICATION_WEBHOOK_SIGNING_SECRET"
        ? secret
        : key === "NOTIFICATION_WEBHOOK_REPLAY_WINDOW_SECONDS"
          ? "300"
          : fallback
    )
  }) as unknown as ConfigService
);

function signature(forPayload = payload, forTimestamp = timestamp, forEventId = eventId): string {
  return createHmac("sha256", secret)
    .update(canonicalNotificationWebhookPayload(forEventId, forTimestamp, forPayload))
    .digest("hex");
}

describe("NotificationWebhookVerifierService", () => {
  it("accepts a valid signed callback", () => {
    expect(
      service.verify({ eventId, timestamp, signature: signature(), payload, now })
    ).toEqual({ eventId, signatureTimestamp: now });
  });

  it("rejects an invalid signature", () => {
    expect(() =>
      service.verify({ eventId, timestamp, signature: "0".repeat(64), payload, now })
    ).toThrow("Invalid notification webhook signature");
  });

  it("rejects a stale callback outside the replay window", () => {
    const staleTimestamp = String(Math.floor((now.getTime() - 301_000) / 1000));
    expect(() =>
      service.verify({
        eventId,
        timestamp: staleTimestamp,
        signature: signature(payload, staleTimestamp),
        payload,
        now
      })
    ).toThrow("outside the replay window");
  });

  it("binds the signature to the tenant and provider message", () => {
    const changed = { ...payload, tenantId: "00000000-0000-4000-8000-000000000002" };
    expect(() =>
      service.verify({ eventId, timestamp, signature: signature(), payload: changed, now })
    ).toThrow("Invalid notification webhook signature");
  });
});
