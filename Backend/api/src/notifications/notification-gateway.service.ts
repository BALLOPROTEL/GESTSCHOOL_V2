import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";
export type DeliveryStatus =
  | "QUEUED"
  | "SENT_TO_PROVIDER"
  | "DELIVERED"
  | "FAILED"
  | "RETRYING"
  | "UNDELIVERABLE";

export type DispatchNotificationInput = {
  notificationId: string;
  tenantId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  targetAddress?: string;
};

export type DispatchNotificationResult = {
  provider: string;
  providerMessageId: string;
  deliveryStatus: "SENT_TO_PROVIDER" | "DELIVERED";
};

@Injectable()
export class NotificationGatewayService {
  constructor(private readonly configService: ConfigService) {}

  async dispatch(payload: DispatchNotificationInput): Promise<DispatchNotificationResult> {
    if (payload.channel === "IN_APP") {
      return {
        provider: "IN_APP",
        providerMessageId: `inapp-${payload.notificationId}`,
        deliveryStatus: "DELIVERED"
      };
    }

    if (!payload.targetAddress?.trim()) {
      throw new Error(`Missing target address for ${payload.channel} notification.`);
    }

    const channel = payload.channel.toUpperCase() as "EMAIL" | "SMS";
    const providerMode = this.resolveProviderMode(channel);

    if (providerMode === "MOCK") {
      return {
        provider: `MOCK_${channel}`,
        providerMessageId: `mock-${channel.toLowerCase()}-${randomUUID().slice(0, 12)}`,
        deliveryStatus: "DELIVERED"
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

    throw new Error(`Unsupported ${channel} provider mode: ${providerMode}.`);
  }

  private resolveProviderMode(channel: "EMAIL" | "SMS"): string {
    const primaryKey =
      channel === "EMAIL" ? "NOTIFICATIONS_EMAIL_PROVIDER" : "NOTIFICATIONS_SMS_PROVIDER";
    const legacyKey = channel === "EMAIL" ? "NOTIFY_EMAIL_PROVIDER" : "NOTIFY_SMS_PROVIDER";
    return this.configService
      .get<string>(
        primaryKey,
        this.configService.get<string>(legacyKey, "MOCK")
      )
      .trim()
      .toUpperCase();
  }

  private async dispatchWithBrevoEmail(
    payload: DispatchNotificationInput
  ): Promise<DispatchNotificationResult> {
    const response = await this.fetchBrevoJson(
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
          htmlContent: this.toBasicHtml(payload.message),
          tags: ["gestschool", payload.tenantId]
        })
      }
    );

    const providerMessageId =
      this.stringValue(response.messageId) ||
      this.stringValue(response.id) ||
      `brevo-email-${randomUUID().slice(0, 12)}`;

    return {
      provider: "BREVO_EMAIL",
      providerMessageId,
      deliveryStatus: "SENT_TO_PROVIDER"
    };
  }

  private async dispatchWithBrevoSms(
    payload: DispatchNotificationInput
  ): Promise<DispatchNotificationResult> {
    if (this.smsDryRunEnabled()) {
      return {
        provider: "BREVO_SMS_DRY_RUN",
        providerMessageId: `brevo-sms-dry-run-${randomUUID().slice(0, 12)}`,
        deliveryStatus: "SENT_TO_PROVIDER"
      };
    }

    const response = await this.fetchBrevoJson(
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
      }
    );

    const providerMessageId =
      this.stringValue(response.messageId) ||
      this.stringValue(response.reference) ||
      this.stringValue(response.id) ||
      `brevo-sms-${randomUUID().slice(0, 12)}`;

    return {
      provider: "BREVO_SMS",
      providerMessageId,
      deliveryStatus: "SENT_TO_PROVIDER"
    };
  }

  private async dispatchWithWebhook(
    channel: "EMAIL" | "SMS",
    payload: DispatchNotificationInput
  ): Promise<DispatchNotificationResult> {
    const urlKey = channel === "EMAIL" ? "NOTIFY_EMAIL_WEBHOOK_URL" : "NOTIFY_SMS_WEBHOOK_URL";
    const tokenKey =
      channel === "EMAIL" ? "NOTIFY_EMAIL_WEBHOOK_TOKEN" : "NOTIFY_SMS_WEBHOOK_TOKEN";

    const webhookUrl = this.configService.get<string>(urlKey, "").trim();
    if (!webhookUrl) {
      throw new Error(`${urlKey} is required when provider mode is WEBHOOK.`);
    }

    const timeoutMs = Number(this.configService.get<string>("NOTIFY_WEBHOOK_TIMEOUT_MS", "8000"));
    const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
    const token = this.configService.get<string>(tokenKey, "").trim();
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), effectiveTimeoutMs);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        signal: abortController.signal,
        body: JSON.stringify({
          notificationId: payload.notificationId,
          tenantId: payload.tenantId,
          channel,
          to: payload.targetAddress,
          title: payload.title,
          message: payload.message
        })
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`${channel} webhook failed (${response.status}): ${raw.slice(0, 400)}`);
      }

      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }

      const providerMessageId =
        typeof parsed.providerMessageId === "string" && parsed.providerMessageId.trim().length > 0
          ? parsed.providerMessageId.trim()
          : `webhook-${channel.toLowerCase()}-${randomUUID().slice(0, 12)}`;

      const statusRaw =
        typeof parsed.status === "string" ? parsed.status.trim().toUpperCase() : "SENT_TO_PROVIDER";
      const deliveryStatus = statusRaw === "DELIVERED" ? "DELIVERED" : "SENT_TO_PROVIDER";

      return {
        provider:
          typeof parsed.provider === "string" && parsed.provider
            ? parsed.provider
            : `WEBHOOK_${channel}`,
        providerMessageId,
        deliveryStatus
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private brevoHeaders(): Record<string, string> {
    return {
      accept: "application/json",
      "api-key": this.requiredConfig("BREVO_API_KEY"),
      "content-type": "application/json"
    };
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key, "").trim();
    if (!value) {
      throw new Error(`${key} is required for Brevo notification provider.`);
    }
    return value;
  }

  private smsDryRunEnabled(): boolean {
    const allowRealSms = this.configService
      .get<string>("ALLOW_REAL_SMS", "false")
      .trim()
      .toLowerCase();
    if (allowRealSms !== "true") {
      return true;
    }

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

  private async fetchBrevoJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    const timeoutMs = Number(this.configService.get<string>("BREVO_TIMEOUT_MS", "8000"));
    const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), effectiveTimeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: abortController.signal
      });
      const raw = await response.text();
      const parsed = this.parseJsonObject(raw);
      if (!response.ok) {
        throw new Error(`Brevo request failed (${response.status}): ${this.safeProviderText(parsed)}`);
      }
      return parsed;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private parseJsonObject(raw: string): Record<string, unknown> {
    if (!raw.trim()) {
      return {};
    }
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

  private safeProviderText(value: Record<string, unknown>): string {
    return JSON.stringify({
      code: value.code,
      message: value.message,
      status: value.status
    }).slice(0, 400);
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
