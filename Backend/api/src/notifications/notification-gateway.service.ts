import { createHash, createHmac } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ProviderDispatchError } from "./notification-delivery.types";

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
    const response = await this.fetchProviderJson(
      this.configService.get<string>("BREVO_EMAIL_ENDPOINT", "https://api.brevo.com/v3/smtp/email"),
      {
        method: "POST",
        headers: this.brevoHeaders(payload.idempotencyKey),
        body: JSON.stringify({
          sender: {
            email: this.requiredConfig("BREVO_SENDER_EMAIL"),
            name: this.configService.get<string>("BREVO_SENDER_NAME", "GestSchool").trim()
          },
          to: [{ email: payload.targetAddress }],
          subject: payload.title,
          textContent: payload.message,
          htmlContent: payload.htmlMessage || this.toBasicHtml(payload.message),
          tags: ["gestschool"]
        })
      },
      "BREVO_EMAIL"
    );

    const providerMessageId =
      this.stringValue(response.messageId) || this.stringValue(response.id);
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
        providerIdempotencyKeySent: true
      };
    }

    const response = await this.fetchProviderJson(
      this.configService.get<string>(
        "BREVO_SMS_ENDPOINT",
        "https://api.brevo.com/v3/transactionalSMS/send"
      ),
      {
        method: "POST",
        headers: this.brevoHeaders(payload.idempotencyKey),
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

    const providerMessageId =
      this.stringValue(response.messageId) ||
      this.stringValue(response.reference) ||
      this.stringValue(response.id);
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
      providerIdempotencyKeySent: true
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

  private brevoHeaders(idempotencyKey: string): Record<string, string> {
    return {
      accept: "application/json",
      "api-key": this.requiredConfig("BREVO_API_KEY"),
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey
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
        const retryAfterMs = this.retryAfterMs(response.headers.get("retry-after"));
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
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

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key, "").trim();
    if (!value) {
      throw new ProviderDispatchError(`${key} is required for the notification provider.`, "PERMANENT");
    }
    return value;
  }

  private smsDryRunEnabled(): boolean {
    const allowRealSms = this.configService.get<string>("ALLOW_REAL_SMS", "false").trim().toLowerCase();
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
    return raw.replace(/[^a-zA-Z0-9 ]+/g, "").slice(0, 15) || "GestSchool";
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
