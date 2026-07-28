import { createHash, createHmac } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ProviderDispatchError } from "./notification-delivery.types";
import {
  normalizeBrevoProviderMessageId,
  type BrevoChannel
} from "./brevo-contract";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";
export type DeliveryStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "DELIVERED"
  | "FAILED_RETRYABLE"
  | "FAILED_PERMANENT"
  | "DEAD_LETTER"
  | "CANCELLED";

export type DispatchNotificationInput = {
  notificationId: string;
  tenantId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  htmlMessage?: string;
  targetAddress?: string;
  idempotencyKey: string;
  attemptNo: number;
};

export type DispatchNotificationResult = {
  provider: string;
  providerMessageId: string;
  deliveryStatus: "SENT" | "DELIVERED";
  providerIdempotencyKeySent: boolean;
};

export type BrevoSenderVerification = {
  active: true;
  configured: true;
  provider: "BREVO_EMAIL";
};

@Injectable()
export class NotificationGatewayService {
  constructor(private readonly configService: ConfigService) {}

  async dispatch(payload: DispatchNotificationInput): Promise<DispatchNotificationResult> {
    if (payload.channel === "IN_APP") {
      return {
        provider: "IN_APP",
        providerMessageId: `inapp-${payload.notificationId}`,
        deliveryStatus: "DELIVERED",
        providerIdempotencyKeySent: true
      };
    }

    if (!payload.targetAddress?.trim()) {
      throw new ProviderDispatchError(
        `Missing target address for ${payload.channel} notification.`,
        "PERMANENT"
      );
    }

    const channel = payload.channel.toUpperCase() as "EMAIL" | "SMS";
    const providerMode = this.resolveProviderMode(channel);

    if (providerMode === "MOCK") {
      return {
        provider: `MOCK_${channel}`,
        providerMessageId: `mock-${channel.toLowerCase()}-${this.shortDigest(payload.idempotencyKey)}`,
        deliveryStatus: "DELIVERED",
        providerIdempotencyKeySent: true
      };
    }

    if (providerMode === "BREVO") {
      return channel === "EMAIL"
        ? this.dispatchWithBrevoEmail(payload)
        : this.dispatchWithBrevoSms(payload);
    }

    if (providerMode === "WEBHOOK") {
      return this.dispatchWithWebhook(channel, payload);
    }

    throw new ProviderDispatchError(
      `Unsupported ${channel} provider mode.`,
      "PERMANENT",
      { provider: providerMode }
    );
  }

  private resolveProviderMode(channel: "EMAIL" | "SMS"): string {
    const primaryKey =
      channel === "EMAIL" ? "NOTIFICATIONS_EMAIL_PROVIDER" : "NOTIFICATIONS_SMS_PROVIDER";
    const legacyKey = channel === "EMAIL" ? "NOTIFY_EMAIL_PROVIDER" : "NOTIFY_SMS_PROVIDER";
    return this.configService
      .get<string>(primaryKey, this.configService.get<string>(legacyKey, "MOCK"))
      .trim()
      .toUpperCase();
  }

  private async dispatchWithBrevoEmail(
    payload: DispatchNotificationInput
  ): Promise<DispatchNotificationResult> {
    const providerIdempotencyKey = this.brevoEmailIdempotencyKey(payload.notificationId);
    const response = await this.fetchProviderJson(
      this.configService.get<string>("BREVO_EMAIL_ENDPOINT", "https://api.brevo.com/v3/smtp/email"),
      {
        method: "POST",
        headers: this.brevoHeaders(),
        body: JSON.stringify({
          sender: {
            email: this.requiredConfig("BREVO_SENDER_EMAIL"),
            name: this.configService.get<string>("BREVO_SENDER_NAME", "GestSchool").trim()
          },
          to: [{ email: payload.targetAddress }],
          subject: payload.title,
          textContent: payload.message,
          htmlContent: payload.htmlMessage || this.toBasicHtml(payload.message),
          headers: {
            "Idempotency-Key": providerIdempotencyKey
          },
          tags: ["gestschool"]
        })
      },
      "BREVO_EMAIL"
    );

    const providerMessageId = this.brevoResponseMessageId("EMAIL", response);
    if (!providerMessageId) {
      throw new ProviderDispatchError(
        "Provider response did not include a message identifier.",
        "UNKNOWN_OUTCOME",
        { provider: "BREVO_EMAIL" }
      );
    }

    return {
      provider: "BREVO_EMAIL",
      providerMessageId,
      deliveryStatus: "SENT",
      providerIdempotencyKeySent: true
    };
  }

  private async dispatchWithBrevoSms(
    payload: DispatchNotificationInput
  ): Promise<DispatchNotificationResult> {
    if (this.smsDryRunEnabled()) {
      return {
        provider: "BREVO_SMS_DRY_RUN",
        providerMessageId: `brevo-sms-dry-run-${this.shortDigest(payload.idempotencyKey)}`,
        deliveryStatus: "SENT",
        providerIdempotencyKeySent: false
      };
    }

    const response = await this.fetchProviderJson(
      this.configService.get<string>(
        "BREVO_SMS_ENDPOINT",
        "https://api.brevo.com/v3/transactionalSMS/send"
      ),
      {
        method: "POST",
        headers: this.brevoHeaders(),
        body: JSON.stringify({
          sender: this.smsSender(),
          recipient: payload.targetAddress,
          content: payload.message.slice(0, 640),
          type: "transactional",
          unicodeEnabled: true
        })
      },
      "BREVO_SMS"
    );

    const providerMessageId = this.brevoResponseMessageId("SMS", response);
    if (!providerMessageId) {
      throw new ProviderDispatchError(
        "Provider response did not include a message identifier.",
        "UNKNOWN_OUTCOME",
        { provider: "BREVO_SMS" }
      );
    }

    return {
      provider: "BREVO_SMS",
      providerMessageId,
      deliveryStatus: "SENT",
      providerIdempotencyKeySent: false
    };
  }

  async verifyBrevoEmailSender(): Promise<BrevoSenderVerification> {
    const expectedEmail = this.requiredConfig("BREVO_SENDER_EMAIL").toLowerCase();
    const response = await this.fetchProviderJson(
      this.configService.get<string>(
        "BREVO_SENDERS_ENDPOINT",
        "https://api.brevo.com/v3/senders"
      ),
      {
        method: "GET",
        headers: this.brevoHeaders()
      },
      "BREVO_SENDERS"
    );
    const senders = Array.isArray(response.senders) ? response.senders : [];
    const matchingSender = senders.find((sender) => {
      if (!sender || typeof sender !== "object" || Array.isArray(sender)) return false;
      const row = sender as Record<string, unknown>;
      return this.stringValue(row.email).toLowerCase() === expectedEmail;
    });
    if (!matchingSender || typeof matchingSender !== "object" || Array.isArray(matchingSender)) {
      throw new ProviderDispatchError(
        "Configured Brevo sender was not found.",
        "PERMANENT",
        { provider: "BREVO_EMAIL" }
      );
    }
    const sender = matchingSender as Record<string, unknown>;
    if (sender.active !== true) {
      throw new ProviderDispatchError(
        "Configured Brevo sender is not active.",
        "PERMANENT",
        { provider: "BREVO_EMAIL" }
      );
    }
    return {
      active: true,
      configured: true,
      provider: "BREVO_EMAIL"
    };
  }

  private async dispatchWithWebhook(
    channel: "EMAIL" | "SMS",
    payload: DispatchNotificationInput
  ): Promise<DispatchNotificationResult> {
    const urlKey = channel === "EMAIL" ? "NOTIFY_EMAIL_WEBHOOK_URL" : "NOTIFY_SMS_WEBHOOK_URL";
    const tokenKey =
      channel === "EMAIL" ? "NOTIFY_EMAIL_WEBHOOK_TOKEN" : "NOTIFY_SMS_WEBHOOK_TOKEN";
    const signingKey =
      channel === "EMAIL"
        ? "NOTIFY_EMAIL_WEBHOOK_SIGNING_SECRET"
        : "NOTIFY_SMS_WEBHOOK_SIGNING_SECRET";
    const webhookUrl = this.configService.get<string>(urlKey, "").trim();
    if (!webhookUrl) {
      throw new ProviderDispatchError(`${urlKey} is required for WEBHOOK.`, "PERMANENT");
    }

    const token = this.configService.get<string>(tokenKey, "").trim();
    const signingSecret = this.requiredConfig(signingKey);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      notificationId: payload.notificationId,
      tenantId: payload.tenantId,
      channel,
      to: payload.targetAddress,
      title: payload.title,
      message: payload.message,
      htmlMessage: payload.htmlMessage,
      idempotencyKey: payload.idempotencyKey,
      attemptNo: payload.attemptNo
    });
    const signature = createHmac("sha256", signingSecret)
      .update(`${timestamp}.${payload.idempotencyKey}.${body}`)
      .digest("hex");

    const response = await this.fetchProviderJson(
      webhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": payload.idempotencyKey,
          "X-GestSchool-Timestamp": timestamp,
          "X-GestSchool-Signature": `sha256=${signature}`,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body
      },
      `WEBHOOK_${channel}`,
      "NOTIFY_WEBHOOK_TIMEOUT_MS"
    );

    const providerMessageId = this.stringValue(response.providerMessageId);
    if (!providerMessageId) {
      throw new ProviderDispatchError(
        "Webhook response did not include providerMessageId.",
        "UNKNOWN_OUTCOME",
        { provider: `WEBHOOK_${channel}` }
      );
    }
    const status = this.stringValue(response.status).toUpperCase();

    return {
      provider: this.stringValue(response.provider) || `WEBHOOK_${channel}`,
      providerMessageId,
      deliveryStatus: status === "DELIVERED" ? "DELIVERED" : "SENT",
      providerIdempotencyKeySent: true
    };
  }

  private brevoHeaders(): Record<string, string> {
    return {
      accept: "application/json",
      "api-key": this.requiredConfig("BREVO_API_KEY"),
      "content-type": "application/json"
    };
  }

  private async fetchProviderJson(
    url: string,
    init: RequestInit,
    provider: string,
    timeoutKey = "BREVO_TIMEOUT_MS"
  ): Promise<Record<string, unknown>> {
    const timeoutMs = Number(this.configService.get<string>(timeoutKey, "8000"));
    const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), effectiveTimeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: abortController.signal });
      const raw = await response.text();
      const parsed = this.parseJsonObject(raw);
      if (!response.ok) {
        const retryAfterMs = this.providerRetryAfterMs(response);
        const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
        throw new ProviderDispatchError(
          `${provider} request failed with HTTP ${response.status}.`,
          retryable ? "RETRYABLE" : "PERMANENT",
          { httpStatus: response.status, provider, retryAfterMs }
        );
      }
      return parsed;
    } catch (error: unknown) {
      if (error instanceof ProviderDispatchError) {
        throw error;
      }
      const isTimeout = error instanceof Error && error.name === "AbortError";
      throw new ProviderDispatchError(
        isTimeout ? `${provider} request timed out.` : `${provider} network request failed.`,
        "UNKNOWN_OUTCOME",
        { provider }
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private retryAfterMs(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 24 * 60 * 60 * 1000);
    }
    const date = Date.parse(value);
    if (!Number.isFinite(date)) return undefined;
    return Math.min(Math.max(0, date - Date.now()), 24 * 60 * 60 * 1000);
  }

  private providerRetryAfterMs(response: Response): number | undefined {
    return (
      this.retryAfterMs(response.headers.get("retry-after")) ??
      this.retryAfterMs(response.headers.get("x-sib-ratelimit-reset"))
    );
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key, "").trim();
    if (!value) {
      throw new ProviderDispatchError(
        `${key} is required for the notification provider.`,
        "PERMANENT"
      );
    }
    return value;
  }

  private smsDryRunEnabled(): boolean {
    const allowRealSms = this.configService
      .get<string>("ALLOW_REAL_SMS", "false")
      .trim()
      .toLowerCase();
    if (allowRealSms !== "true") return true;
    const raw = this.configService
      .get<string>(
        "BREVO_SMS_DRY_RUN",
        this.configService.get<string>("NOTIFICATIONS_SMS_DRY_RUN", "true")
      )
      .trim()
      .toLowerCase();
    return raw !== "false";
  }

  private smsSender(): string {
    const raw = this.configService.get<string>("BREVO_SMS_SENDER", "GestSchool").trim();
    const normalized = raw.replace(/[^a-zA-Z0-9]+/g, "");
    if (/^\d{12,15}$/.test(normalized)) {
      return normalized;
    }
    return normalized.slice(0, 11) || "GestSchool";
  }

  private parseJsonObject(raw: string): Record<string, unknown> {
    if (!raw.trim()) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private stringValue(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private brevoResponseMessageId(
    channel: BrevoChannel,
    response: Record<string, unknown>
  ): string {
    const direct = normalizeBrevoProviderMessageId(channel, response.messageId);
    if (direct) return direct;
    if (channel === "EMAIL" && Array.isArray(response.messageIds)) {
      return normalizeBrevoProviderMessageId(channel, response.messageIds[0]);
    }
    return "";
  }

  private brevoEmailIdempotencyKey(notificationId: string): string {
    const normalized = notificationId.trim().toLowerCase();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        normalized
      )
    ) {
      throw new ProviderDispatchError(
        "Notification identifier cannot be used for Brevo idempotency.",
        "PERMANENT",
        { provider: "BREVO_EMAIL" }
      );
    }
    return normalized;
  }

  private shortDigest(value: string): string {
    return createHash("sha256").update(value).digest("hex").slice(0, 20);
  }

  private toBasicHtml(message: string): string {
    return `<html><body><p>${this.escapeHtml(message).replace(/\n/g, "<br>")}</p></body></html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
