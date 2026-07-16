import { createHmac, randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import * as request from "supertest";

import { AuditService } from "../src/audit/audit.service";
import { NotificationGatewayService } from "../src/notifications/notification-gateway.service";
import {
  NOTIFICATION_REQUESTED_VERSION,
  type NotificationRequestedEventMetadata,
  type NotificationRequestedEventPayload
} from "../src/notifications/notification-request.contract";
import { NotificationRetryPolicyService } from "../src/notifications/notification-retry-policy.service";
import { NotificationsService } from "../src/notifications/notifications.service";
import {
  canonicalNotificationWebhookPayload
} from "../src/notifications/notification-webhook-verifier.service";
import { OutboxService } from "../src/outbox/outbox.service";
import type { NotificationDeliveryEventDto } from "../src/school-life/dto/school-life.dto";
import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  seedUsers,
  TENANT_ID,
  type E2eAppContext
} from "./support/e2e-harness";

const OTHER_TENANT_ID = "11111111-1111-4111-8111-111111111111";
configureE2eEnvironment();
process.env.NOTIFY_MAX_ATTEMPTS = "2";
process.env.NOTIFY_RETRY_BASE_SECONDS = "1";
process.env.NOTIFY_RETRY_MAX_SECONDS = "2";
process.env.NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS = "60";
jest.setTimeout(120_000);

describe("Notification and outbox reliability (e2e)", () => {
  let context: E2eAppContext;
  let workerA: NotificationsService;
  let workerB: NotificationsService;
  let outboxService: OutboxService;

  beforeAll(async () => {
    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);
    workerA = createNotificationWorker(context);
    workerB = createNotificationWorker(context);
    outboxService = context.app.get(OutboxService);
  });

  beforeEach(async () => {
    await context.prisma.iamAuditLog.deleteMany({});
    await context.prisma.outboxEvent.deleteMany({});
    await context.prisma.notification.deleteMany({});
  });

  afterAll(async () => {
    delete process.env.NOTIFY_MAX_ATTEMPTS;
    delete process.env.NOTIFY_RETRY_BASE_SECONDS;
    delete process.env.NOTIFY_RETRY_MAX_SECONDS;
    delete process.env.NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS;
    await closeE2eApp(context);
  });

  it("deduplicates a business idempotency key per tenant", async () => {
    const event = notificationRequestedEvent("payment:invoice-42:parent:email:v1");

    const first = await workerA.materializeRequestedNotification(
      TENANT_ID,
      event.payload,
      event.metadata
    );
    const duplicate = await workerB.materializeRequestedNotification(
      TENANT_ID,
      { ...event.payload, requestId: randomUUID() },
      { ...event.metadata, eventId: randomUUID() }
    );
    const otherTenant = await workerB.materializeRequestedNotification(
      OTHER_TENANT_ID,
      { ...event.payload, requestId: randomUUID() },
      {
        ...event.metadata,
        eventId: randomUUID(),
        tenantId: OTHER_TENANT_ID
      }
    );

    expect(duplicate.id).toBe(first.id);
    expect(otherTenant.id).not.toBe(first.id);
    await expect(
      createDatabaseNotification({
        idempotencyKey: event.metadata.idempotencyKey,
        requestId: randomUUID()
      })
    ).rejects.toMatchObject({ code: "P2002" });
    expect(
      await context.prisma.notification.count({
        where: { idempotencyKey: event.metadata.idempotencyKey }
      })
    ).toBe(2);
  });

  it("allows only one of two workers to dispatch the same notification", async () => {
    const notification = await createDatabaseNotification();

    const [resultA, resultB] = await Promise.all([
      workerA.dispatchPendingNotifications(TENANT_ID, 10),
      workerB.dispatchPendingNotifications(TENANT_ID, 10)
    ]);

    const stored = await context.prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
      include: { deliveryAttempts: true }
    });
    expect(resultA.dispatchedCount + resultB.dispatchedCount).toBe(1);
    expect(stored.status).toBe("DELIVERED");
    expect(stored.attempts).toBe(1);
    expect(stored.deliveryAttempts).toHaveLength(1);
  });

  it("recovers an expired lease after a crash before provider dispatch", async () => {
    const notification = await createDatabaseNotification({
      status: "PROCESSING",
      deliveryStatus: "PROCESSING",
      attempts: 1,
      lockedAt: minutesAgo(3),
      lockedBy: "crashed-worker-before-send",
      leaseToken: randomUUID(),
      leaseExpiresAt: minutesAgo(2),
      lastAttemptAt: minutesAgo(3)
    });
    await createProcessingAttempt(notification.id, 1, {
      workerId: "crashed-worker-before-send"
    });

    await workerA.dispatchPendingNotifications(TENANT_ID, 10);

    const stored = await context.prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
      include: { deliveryAttempts: { orderBy: { attemptNo: "asc" } } }
    });
    expect(stored.status).toBe("DELIVERED");
    expect(stored.attempts).toBe(2);
    expect(stored.deliveryAttempts).toHaveLength(2);
    expect(stored.deliveryAttempts[0]).toMatchObject({
      status: "FAILED_RETRYABLE",
      outcomeUnknown: true,
      retryable: true
    });
  });

  it("reuses the same idempotency key after an unknown outcome crash", async () => {
    const idempotencyKey = "attendance:record-9:parent:in-app:v1";
    const notification = await createDatabaseNotification({
      idempotencyKey,
      status: "PROCESSING",
      deliveryStatus: "PROCESSING",
      attempts: 1,
      lockedAt: minutesAgo(3),
      lockedBy: "crashed-worker-after-send",
      leaseToken: randomUUID(),
      leaseExpiresAt: minutesAgo(2),
      lastAttemptAt: minutesAgo(3),
      deliveryOutcomeUnknown: true
    });
    await createProcessingAttempt(notification.id, 1, {
      outcomeUnknown: true,
      providerMessageId: `inapp-${notification.id}`,
      workerId: "crashed-worker-after-send"
    });

    await workerB.dispatchPendingNotifications(TENANT_ID, 10);

    const stored = await context.prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
      include: { deliveryAttempts: { orderBy: { attemptNo: "asc" } } }
    });
    expect(stored.status).toBe("DELIVERED");
    expect(stored.idempotencyKey).toBe(idempotencyKey);
    expect(stored.providerMessageId).toBe(`inapp-${notification.id}`);
    expect(stored.deliveryAttempts[1].providerMessageId).toBe(`inapp-${notification.id}`);
  });

  it("moves an exhausted lease to dead-letter and audits manual replay", async () => {
    const notification = await createDatabaseNotification({
      status: "PROCESSING",
      deliveryStatus: "PROCESSING",
      attempts: 2,
      lockedAt: minutesAgo(3),
      lockedBy: "exhausted-worker",
      leaseToken: randomUUID(),
      leaseExpiresAt: minutesAgo(2),
      lastAttemptAt: minutesAgo(3)
    });
    const actor = await context.prisma.user.findFirstOrThrow({
      where: { tenantId: TENANT_ID, username: "admin@gestschool.local" }
    });

    await workerA.dispatchPendingNotifications(TENANT_ID, 10);
    expect(
      await context.prisma.notification.findUniqueOrThrow({ where: { id: notification.id } })
    ).toMatchObject({ status: "DEAD_LETTER", deliveryStatus: "DEAD_LETTER" });

    const replayed = await workerA.replayNotification(
      TENANT_ID,
      notification.id,
      actor.id,
      "Provider incident resolved"
    );
    expect(replayed).toMatchObject({ status: "PENDING", attempts: 0, replayCount: 1 });
    expect(
      await context.prisma.iamAuditLog.count({
        where: {
          tenantId: TENANT_ID,
          userId: actor.id,
          action: "notification.replay",
          resourceId: notification.id
        }
      })
    ).toBe(1);
  });

  it("fences two outbox workers and recovers an expired lease", async () => {
    const event = await outboxService.publish({
      tenantId: TENANT_ID,
      aggregateType: "Notification",
      aggregateId: randomUUID(),
      eventType: "notification.reliability-test",
      payload: { test: true },
      dedupeKey: `notification-reliability:${randomUUID()}`
    });
    expect(event).not.toBeNull();

    const [claimA, claimB] = await Promise.all([
      outboxService.claim(event!.id, "worker-a", 60_000),
      outboxService.claim(event!.id, "worker-b", 60_000)
    ]);
    const winner = claimA || claimB;
    expect([claimA, claimB].filter(Boolean)).toHaveLength(1);

    await context.prisma.outboxEvent.update({
      where: { id: event!.id },
      data: { leaseExpiresAt: minutesAgo(1) }
    });
    const recovered = await outboxService.claim(event!.id, "worker-recovery", 60_000);
    expect(recovered).not.toBeNull();
    expect(await outboxService.markProcessed(winner!)).toBe(false);
    expect(await outboxService.markProcessed(recovered!)).toBe(true);
  });

  it("dead-letters an outbox event after repeated worker crashes", async () => {
    const event = await outboxService.publish({
      tenantId: TENANT_ID,
      aggregateType: "Notification",
      aggregateId: randomUUID(),
      eventType: "notification.crash-loop-test",
      payload: { test: true },
      dedupeKey: `notification-crash-loop:${randomUUID()}`
    });
    expect(event).not.toBeNull();

    const firstClaim = await outboxService.claim(event!.id, "crash-worker-a", 60_000, 2);
    expect(firstClaim?.event.attempts).toBe(1);
    await context.prisma.outboxEvent.update({
      where: { id: event!.id },
      data: { leaseExpiresAt: minutesAgo(1) }
    });

    const secondClaim = await outboxService.claim(event!.id, "crash-worker-b", 60_000, 2);
    expect(secondClaim?.event.attempts).toBe(2);
    await context.prisma.outboxEvent.update({
      where: { id: event!.id },
      data: { leaseExpiresAt: minutesAgo(1) }
    });

    expect(await outboxService.claim(event!.id, "crash-worker-c", 60_000, 2)).toBeNull();
    expect(
      await context.prisma.outboxEvent.findUniqueOrThrow({ where: { id: event!.id } })
    ).toMatchObject({
      status: "DEAD_LETTER",
      attempts: 2,
      claimedAt: null,
      claimedBy: null,
      leaseToken: null,
      leaseExpiresAt: null
    });
  });

  it("accepts signed webhooks once, rejects replays and isolates tenants", async () => {
    const providerMessageId = `provider-${randomUUID()}`;
    const tenantANotification = await createDatabaseNotification({
      channel: "EMAIL",
      status: "SENT",
      deliveryStatus: "SENT",
      provider: "MOCK_EMAIL",
      providerMessageId,
      sentAt: new Date(),
      targetAddress: "recipient-a@example.test"
    });
    const tenantBNotification = await createDatabaseNotification({
      tenantId: OTHER_TENANT_ID,
      channel: "EMAIL",
      status: "SENT",
      deliveryStatus: "SENT",
      provider: "MOCK_EMAIL",
      providerMessageId,
      sentAt: new Date(),
      targetAddress: "recipient-b@example.test"
    });
    const payload: NotificationDeliveryEventDto = {
      tenantId: OTHER_TENANT_ID,
      provider: "MOCK_EMAIL",
      providerMessageId,
      status: "DELIVERED",
      occurredAt: new Date().toISOString()
    };
    const eventId = `evt-${randomUUID()}`;

    const [firstCallback, duplicateCallback] = await Promise.all([
      sendSignedWebhook(payload, eventId),
      sendSignedWebhook(payload, eventId)
    ]);
    expect(firstCallback.status).toBe(201);
    expect(duplicateCallback.status).toBe(201);
    expect(
      await context.prisma.notificationProviderCallback.count({
        where: { tenantId: OTHER_TENANT_ID, providerEventId: eventId }
      })
    ).toBe(1);
    expect(
      await context.prisma.notification.findUniqueOrThrow({ where: { id: tenantANotification.id } })
    ).toMatchObject({ status: "SENT" });
    expect(
      await context.prisma.notification.findUniqueOrThrow({ where: { id: tenantBNotification.id } })
    ).toMatchObject({ status: "DELIVERED" });

    await sendSignedWebhook(payload, `evt-${randomUUID()}`, {
      signature: "0".repeat(64)
    }).expect(403);
    await sendSignedWebhook(payload, `evt-${randomUUID()}`, {
      timestamp: Math.floor((Date.now() - 10 * 60_000) / 1000).toString()
    }).expect(403);
  });

  function createNotificationWorker(appContext: E2eAppContext): NotificationsService {
    return new NotificationsService(
      appContext.app.get(AuditService),
      appContext.app.get(ConfigService),
      appContext.app.get(NotificationGatewayService),
      appContext.app.get(NotificationRetryPolicyService),
      appContext.prisma
    );
  }

  function notificationRequestedEvent(idempotencyKey: string): {
    payload: NotificationRequestedEventPayload;
    metadata: NotificationRequestedEventMetadata;
  } {
    const requestId = randomUUID();
    const now = new Date().toISOString();
    return {
      payload: {
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        requestId,
        requestedAt: now,
        kind: "PAYMENT_RECEIVED",
        channel: "IN_APP",
        recipient: { audienceRole: "PARENT" },
        content: {
          templateKey: "payment-received",
          templateVersion: "v1",
          title: "Payment received",
          message: "Payment recorded."
        },
        source: {
          action: "payment.recorded",
          domain: "finance",
          referenceId: "invoice-42",
          referenceType: "invoice"
        }
      },
      metadata: {
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        eventId: randomUUID(),
        tenantId: TENANT_ID,
        occurredAt: now,
        correlationId: requestId,
        idempotencyKey,
        producer: "notification-reliability-e2e"
      }
    };
  }

  async function createDatabaseNotification(
    overrides: Partial<Prisma.NotificationUncheckedCreateInput> = {}
  ) {
    const requestId = randomUUID();
    return context.prisma.notification.create({
      data: {
        tenantId: TENANT_ID,
        title: "Reliability test",
        message: "No external provider is called.",
        channel: "IN_APP",
        status: "PENDING",
        deliveryStatus: "PENDING",
        requestId,
        correlationId: requestId,
        idempotencyKey: `reliability:${requestId}`,
        templateKey: "reliability-test",
        templateVersion: "v1",
        sourceDomain: "test",
        sourceAction: "notification.reliability",
        sourceReferenceType: "test",
        sourceReferenceId: requestId,
        ...overrides
      }
    });
  }

  async function createProcessingAttempt(
    notificationId: string,
    attemptNo: number,
    overrides: Partial<Prisma.NotificationDeliveryAttemptUncheckedCreateInput> = {}
  ) {
    return context.prisma.notificationDeliveryAttempt.create({
      data: {
        tenantId: TENANT_ID,
        notificationId,
        attemptNo,
        channel: "IN_APP",
        provider: "IN_APP",
        status: "PROCESSING",
        startedAt: minutesAgo(3),
        ...overrides
      }
    });
  }

  function sendSignedWebhook(
    payload: NotificationDeliveryEventDto,
    eventId: string,
    overrides: { signature?: string; timestamp?: string } = {}
  ) {
    const timestamp = overrides.timestamp || Math.floor(Date.now() / 1000).toString();
    const signature =
      overrides.signature ||
      createHmac("sha256", notificationWebhookSecret())
        .update(canonicalNotificationWebhookPayload(eventId, timestamp, payload))
        .digest("hex");
    return request(context.app.getHttpServer())
      .post("/api/v1/notifications/delivery-events")
      .set("x-notification-event-id", eventId)
      .set("x-notification-timestamp", timestamp)
      .set("x-notification-signature", `sha256=${signature}`)
      .send(payload);
  }

  function notificationWebhookSecret(): string {
    return context.app
      .get(ConfigService)
      .get<string>("NOTIFICATION_WEBHOOK_SIGNING_SECRET", "")
      .trim();
  }

  function minutesAgo(value: number): Date {
    return new Date(Date.now() - value * 60_000);
  }
});
