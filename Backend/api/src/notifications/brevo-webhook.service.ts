import { timingSafeEqual } from "node:crypto";

import { ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  normalizeBrevoWebhook,
  type BrevoWebhookPayload,
  type NormalizedBrevoWebhook
} from "./brevo-contract";

export type VerifiedBrevoWebhook = NormalizedBrevoWebhook & {
  signatureTimestamp?: Date;
};

@Injectable()
export class BrevoWebhookService {
  constructor(private readonly configService: ConfigService) {}

  verify(input: {
    authorization?: string;
    now?: Date;
    payload: BrevoWebhookPayload;
  }): VerifiedBrevoWebhook {
    if (!this.booleanConfig("BREVO_WEBHOOK_ENABLED", false)) {
      throw new ServiceUnavailableException("Brevo webhooks are disabled.");
    }

    const expectedToken = this.configService
      .get<string>("BREVO_WEBHOOK_AUTH_TOKEN", "")
      .trim();
    if (!expectedToken) {
      throw new ServiceUnavailableException("Brevo webhook authentication is unavailable.");
    }
    const actualToken = this.bearerToken(input.authorization);
    if (!this.constantTimeEquals(actualToken, expectedToken)) {
      throw new ForbiddenException("Invalid Brevo webhook authentication.");
    }

    const now = input.now || new Date();
    const normalized = normalizeBrevoWebhook(input.payload, now);
    if (normalized.providerTimestampPresent) {
      const ageMs = now.getTime() - normalized.occurredAt.getTime();
      if (ageMs < -300_000 || ageMs > this.maxAgeSeconds() * 1000) {
        throw new ForbiddenException(
          "Brevo webhook timestamp is outside the accepted window."
        );
      }
    }
    return normalized;
  }

  private bearerToken(value?: string): string {
    const match = value?.trim().match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || "";
  }

  private booleanConfig(key: string, fallback: boolean): boolean {
    const raw = this.configService
      .get<string>(key, fallback ? "true" : "false")
      .trim()
      .toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  }

  private maxAgeSeconds(): number {
    const raw = Number(
      this.configService.get<string>("BREVO_WEBHOOK_MAX_AGE_SECONDS", "90000")
    );
    return Number.isInteger(raw) && raw >= 300 && raw <= 90000 ? raw : 90000;
  }

  private constantTimeEquals(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
