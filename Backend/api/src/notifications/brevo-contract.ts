import { createHash } from "node:crypto";

import { BadRequestException } from "@nestjs/common";

export type BrevoChannel = "EMAIL" | "SMS";
export type BrevoDeliveryStatus = "SENT" | "DELIVERED" | "FAILED_PERMANENT";

export type BrevoWebhookPayload = {
  id?: string;
  event?: string;
  "message-id"?: string;
  messageId?: string;
  msg_status?: string;
  status?: string;
  description?: string;
  ts_event?: number;
  ts_epoch?: number;
};

export type NormalizedBrevoWebhook = {
  channel: BrevoChannel;
  errorMessage?: string;
  eventId: string;
  occurredAt: Date;
  providerTimestampPresent: boolean;
  provider: "BREVO_EMAIL" | "BREVO_SMS";
  providerMessageId: string;
  status: BrevoDeliveryStatus;
};

const EMAIL_FAILURE_EVENTS = new Set([
  "blocked",
  "error",
  "hardbounce",
  "invalidemail",
  "spam",
  "unsubscribed"
]);
const EMAIL_DELIVERED_EVENTS = new Set([
  "click",
  "clicked",
  "delivered",
  "opened",
  "proxyopen",
  "uniqueopened",
  "uniqueproxyopen"
]);
const EMAIL_SENT_EVENTS = new Set(["deferred", "request", "sent", "softbounce"]);
const SMS_FAILURE_EVENTS = new Set([
  "bl",
  "hardbounce",
  "rej",
  "rejected",
  "skip"
]);
const SMS_DELIVERED_EVENTS = new Set([
  "delivered",
  "replied",
  "subscribe",
  "unsubscribe",
  "unsubscribed"
]);
const SMS_SENT_EVENTS = new Set(["accepted", "sent", "softbounce"]);

export function normalizeBrevoProviderMessageId(
  channel: BrevoChannel,
  value: unknown
): string {
  const normalized =
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";
  const withoutBrackets =
    channel === "EMAIL" && normalized.startsWith("<") && normalized.endsWith(">")
      ? normalized.slice(1, -1).trim()
      : normalized;
  if (!withoutBrackets || withoutBrackets.length > 160) {
    return "";
  }
  return withoutBrackets;
}

export function normalizeBrevoWebhook(
  payload: BrevoWebhookPayload,
  receivedAt = new Date()
): NormalizedBrevoWebhook {
  const channel = resolveChannel(payload);
  const providerMessageId = normalizeBrevoProviderMessageId(
    channel,
    channel === "EMAIL" ? payload["message-id"] : payload.messageId
  );
  if (!providerMessageId) {
    throw new BadRequestException("Brevo webhook message identifier is invalid.");
  }

  const webhookId = normalizeIdentifier(payload.id, 80);
  if (!webhookId) {
    throw new BadRequestException("Brevo webhook identifier is invalid.");
  }
  const { occurredAt, providerTimestampPresent } = resolveOccurredAt(
    payload,
    receivedAt
  );
  const rawEvent =
    channel === "EMAIL"
      ? normalizeEventName(payload.event)
      : normalizeEventName(payload.msg_status || payload.status);
  const status = resolveDeliveryStatus(channel, rawEvent);
  const provider = channel === "EMAIL" ? "BREVO_EMAIL" : "BREVO_SMS";
  const eventId = `brevo-${createHash("sha256")
    .update(
      [provider, webhookId, providerMessageId, rawEvent].join("\n")
    )
    .digest("hex")}`;

  return {
    channel,
    errorMessage:
      status === "FAILED_PERMANENT" && payload.description?.trim()
        ? payload.description.trim().slice(0, 500)
        : undefined,
    eventId,
    occurredAt,
    providerTimestampPresent,
    provider,
    providerMessageId,
    status
  };
}

function resolveChannel(payload: BrevoWebhookPayload): BrevoChannel {
  const emailMessageId = normalizeBrevoProviderMessageId("EMAIL", payload["message-id"]);
  const smsMessageId = normalizeBrevoProviderMessageId("SMS", payload.messageId);
  if (emailMessageId && payload.event?.trim()) return "EMAIL";
  if (smsMessageId && (payload.msg_status?.trim() || payload.status?.trim())) return "SMS";
  throw new BadRequestException("Brevo webhook channel cannot be determined.");
}

function resolveOccurredAt(
  payload: BrevoWebhookPayload,
  receivedAt: Date
): { occurredAt: Date; providerTimestampPresent: boolean } {
  const seconds = payload.ts_event;
  const milliseconds = payload.ts_epoch;
  const timestamp =
    Number.isInteger(seconds) && Number(seconds) > 0
      ? Number(seconds) * 1000
      : Number.isInteger(milliseconds) && Number(milliseconds) > 0
        ? Number(milliseconds)
        : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return {
      occurredAt: receivedAt,
      providerTimestampPresent: false
    };
  }
  return {
    occurredAt: new Date(timestamp),
    providerTimestampPresent: true
  };
}

function resolveDeliveryStatus(
  channel: BrevoChannel,
  event: string
): BrevoDeliveryStatus {
  const deliveredEvents = channel === "EMAIL" ? EMAIL_DELIVERED_EVENTS : SMS_DELIVERED_EVENTS;
  const failureEvents = channel === "EMAIL" ? EMAIL_FAILURE_EVENTS : SMS_FAILURE_EVENTS;
  const sentEvents = channel === "EMAIL" ? EMAIL_SENT_EVENTS : SMS_SENT_EVENTS;
  if (deliveredEvents.has(event)) return "DELIVERED";
  if (failureEvents.has(event)) return "FAILED_PERMANENT";
  if (sentEvents.has(event)) return "SENT";
  throw new BadRequestException("Brevo webhook event is not supported.");
}

function normalizeEventName(value: string | undefined): string {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeIdentifier(value: unknown, maxLength: number): string {
  const normalized =
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";
  return normalized && normalized.length <= maxLength ? normalized : "";
}
