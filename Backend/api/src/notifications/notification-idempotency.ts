import { createHash } from "node:crypto";

import type { PublishNotificationRequestInput } from "./notification-request.contract";

export const DEFAULT_NOTIFICATION_TEMPLATE_VERSION = "v1";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalized(value: string | undefined, fallback = "none"): string {
  const result = value?.trim().toLowerCase();
  return result || fallback;
}

export function buildNotificationIdempotencyKey(
  input: PublishNotificationRequestInput,
  requestId: string
): string {
  const templateVersion = normalized(
    input.content.templateVersion,
    DEFAULT_NOTIFICATION_TEMPLATE_VERSION
  );
  const eventIdentity = normalized(
    input.idempotencyKey,
    `${input.source.domain}:${input.source.action}:${input.kind}:${requestId}`
  );
  const targetFingerprint = input.recipient.targetAddress?.trim()
    ? digest(input.recipient.targetAddress.trim().toLowerCase())
    : "none";

  const canonical = [
    `tenant=${normalized(input.tenantId)}`,
    `event=${eventIdentity}`,
    `domain=${normalized(input.source.domain)}`,
    `action=${normalized(input.source.action)}`,
    `resourceType=${normalized(input.source.referenceType)}`,
    `resourceId=${normalized(input.source.referenceId)}`,
    `student=${normalized(input.recipient.studentId)}`,
    `audience=${normalized(input.recipient.audienceRole)}`,
    `target=${targetFingerprint}`,
    `channel=${normalized(input.channel)}`,
    `template=${normalized(input.content.templateKey)}`,
    `templateVersion=${templateVersion}`
  ].join("|");

  return `notification:v2:${digest(canonical)}`;
}
