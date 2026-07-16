import { createHmac, timingSafeEqual } from "node:crypto";

import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { NotificationDeliveryEventDto } from "../school-life/dto/school-life.dto";

export type VerifiedNotificationWebhook = {
  eventId: string;
  signatureTimestamp: Date;
};

export function canonicalNotificationWebhookPayload(
  eventId: string,
  timestamp: string,
  payload: NotificationDeliveryEventDto
): string {
  return [
    timestamp,
    eventId,
    payload.tenantId.trim().toLowerCase(),
    payload.provider.trim().toUpperCase(),
    payload.providerMessageId.trim(),
    payload.status.trim().toUpperCase(),
    payload.occurredAt?.trim() || "",
    payload.errorMessage?.trim() || ""
  ].join("\n");
}

@Injectable()
export class NotificationWebhookVerifierService {
  constructor(private readonly configService: ConfigService) {}

  verify(input: {
    eventId?: string;
    payload: NotificationDeliveryEventDto;
    signature?: string;
    timestamp?: string;
    now?: Date;
  }): VerifiedNotificationWebhook {
    const secret = this.configService
      .get<string>(
        "NOTIFICATION_WEBHOOK_SIGNING_SECRET",
        this.configService.get<string>("NOTIFICATION_WEBHOOK_SECRET", "")
      )
      .trim();
    const eventId = input.eventId?.trim() || "";
    const timestamp = input.timestamp?.trim() || "";
    const signature = input.signature?.trim().replace(/^sha256=/i, "") || "";

    if (!secret || !eventId || !timestamp || !/^[a-zA-Z0-9._:-]{8,160}$/.test(eventId)) {
      throw new ForbiddenException("Invalid notification webhook signature.");
    }

    const timestampSeconds = Number(timestamp);
    if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0) {
      throw new ForbiddenException("Invalid notification webhook signature.");
    }

    const now = input.now || new Date();
    const signedAt = new Date(timestampSeconds * 1000);
    const ageMs = now.getTime() - signedAt.getTime();
    const replayWindowMs = this.replayWindowSeconds() * 1000;
    if (ageMs < -30_000 || ageMs > replayWindowMs) {
      throw new ForbiddenException("Notification webhook timestamp is outside the replay window.");
    }

    const canonical = canonicalNotificationWebhookPayload(eventId, timestamp, input.payload);
    const expected = createHmac("sha256", secret).update(canonical).digest("hex");
    if (!this.constantTimeEquals(signature, expected)) {
      throw new ForbiddenException("Invalid notification webhook signature.");
    }

    return {
      eventId,
      signatureTimestamp: signedAt
    };
  }

  private replayWindowSeconds(): number {
    const raw = Number(
      this.configService.get<string>("NOTIFICATION_WEBHOOK_REPLAY_WINDOW_SECONDS", "300")
    );
    return Number.isFinite(raw) && raw >= 60 && raw <= 3600 ? Math.floor(raw) : 300;
  }

  private constantTimeEquals(actual: string, expected: string): boolean {
    if (!/^[a-f0-9]{64}$/i.test(actual)) {
      return false;
    }
    const actualBuffer = Buffer.from(actual, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
