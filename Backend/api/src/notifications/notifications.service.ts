import { createHash, randomUUID } from "node:crypto";

import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type Notification, type NotificationDeliveryAttempt } from "@prisma/client";

import {
  CreateNotificationDto,
  NotificationDeliveryEventDto,
  UpdateNotificationStatusDto
} from "../school-life/dto/school-life.dto";
import {
  type DeliveryStatus,
  NotificationGatewayService,
  type NotificationChannel
} from "./notification-gateway.service";
import {
  type NotificationRequestedEvent,
  NOTIFICATION_REQUESTED_VERSION,
  type NotificationRequestedEventMetadata,
  type NotificationRequestedEventPayload
} from "./notification-request.contract";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  type NotificationFailureDecision,
  ProviderDispatchError,
  sanitizeProviderError
} from "./notification-delivery.types";
import {
  buildNotificationIdempotencyKey,
  DEFAULT_NOTIFICATION_TEMPLATE_VERSION
} from "./notification-idempotency";
import { NotificationRetryPolicyService } from "./notification-retry-policy.service";
import type { VerifiedNotificationWebhook } from "./notification-webhook-verifier.service";

type NotificationView = {
  id: string;
  tenantId: string;
  studentId?: string;
  audienceRole?: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  targetAddress?: string;
  provider?: string;
  providerMessageId?: string;
  deliveryStatus: string;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  scheduledAt?: string;
  sentAt?: string;
  studentName?: string;
  requestId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  sourceDomain?: string;
  sourceAction?: string;
  templateKey?: string;
  templateVersion: string;
  deliveryOutcomeUnknown: boolean;
  lockedAt?: string;
  leaseExpiresAt?: string;
  replayCount: number;
};

type NotificationWithStudent = Prisma.NotificationGetPayload<{
  include: {
    student: true;
  };
}>;

@Injectable()
export class NotificationsService {
  private readonly workerId = `notifications:${process.pid}:${randomUUID().slice(0, 8)}`;

  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly notificationGateway: NotificationGatewayService,
    private readonly notificationRetryPolicy: NotificationRetryPolicyService,
    private readonly prisma: PrismaService
  ) {}

  async materializeRequestedNotification(
    tenantId: string,
    payload: NotificationRequestedEventPayload,
    metadata: NotificationRequestedEventMetadata
  ): Promise<NotificationView> {
    if (!tenantId) {
      throw new Error("notification.requested event must include a tenantId.");
    }

    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId,
        OR: [
          { requestId: payload.requestId },
          { idempotencyKey: metadata.idempotencyKey }
        ]
      },
      include: {
        student: true
      }
    });

    if (existing) {
      return this.notificationView(existing);
    }

    try {
      const requestEnvelope: NotificationRequestedEvent = {
        payload,
        metadata
      };

      const created = await this.prisma.notification.create({
        data: {
          tenantId,
          studentId: payload.recipient.studentId,
          audienceRole: payload.recipient.audienceRole,
          title: payload.content.title,
          message: payload.content.message,
          channel: payload.channel,
          status: "PENDING",
          targetAddress: payload.recipient.targetAddress,
          provider: payload.channel === "IN_APP" ? "IN_APP" : null,
          providerMessageId: null,
          deliveryStatus: "PENDING",
          attempts: 0,
          lastError: null,
          nextAttemptAt: null,
          deliveredAt: null,
          scheduledAt: payload.schedule?.scheduledAt ? new Date(payload.schedule.scheduledAt) : null,
          requestId: payload.requestId,
          correlationId: metadata.correlationId,
          idempotencyKey: metadata.idempotencyKey,
          templateVersion: payload.content.templateVersion,
          schemaVersion: payload.schemaVersion,
          sourceDomain: payload.source.domain,
          sourceAction: payload.source.action,
          sourceReferenceType: payload.source.referenceType,
          sourceReferenceId: payload.source.referenceId,
          templateKey: payload.content.templateKey,
          requestPayload: requestEnvelope as unknown as Prisma.InputJsonValue,
          updatedAt: new Date()
        },
        include: {
          student: true
        }
      });

      return this.notificationView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const duplicate = await this.prisma.notification.findFirst({
          where: {
            tenantId,
            OR: [
              { requestId: payload.requestId },
              { idempotencyKey: metadata.idempotencyKey }
            ]
          },
          include: {
            student: true
          }
        });
        if (duplicate) {
          return this.notificationView(duplicate);
        }
      }
      throw error;
    }
  }

  async listNotifications(
    tenantId: string,
    filters: {
      status?: string;
      channel?: string;
      audienceRole?: string;
      studentId?: string;
      deliveryStatus?: string;
      provider?: string;
    }
  ): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        status: filters.status,
        channel: filters.channel,
        audienceRole: filters.audienceRole,
        studentId: filters.studentId,
        deliveryStatus: filters.deliveryStatus,
        provider: filters.provider
      },
      include: {
        student: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => this.notificationView(row));
  }

  async createNotification(
    tenantId: string,
    payload: CreateNotificationDto
  ): Promise<NotificationView> {
    if (payload.studentId) {
      await this.requireStudent(tenantId, payload.studentId);
    }

    const requestId = randomUUID();
    const now = new Date();
    const occurredAt = now.toISOString();
    const channel = payload.channel || "IN_APP";
    const targetAddress = payload.targetAddress?.trim() || null;
    const status = "PENDING";
    const manualRequest = {
      tenantId,
      kind: "MANUAL" as const,
      channel,
      recipient: {
        audienceRole: payload.audienceRole || undefined,
        studentId: payload.studentId || undefined,
        targetAddress: targetAddress || undefined
      },
      content: {
        templateKey: "manual",
        templateVersion: DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
        title: payload.title.trim(),
        message: payload.message.trim()
      },
      source: {
        domain: "notifications",
        action: "manual.create",
        referenceType: "notification",
        referenceId: requestId
      },
      requestId,
      idempotencyKey: `manual:${requestId}`
    };
    const idempotencyKey = buildNotificationIdempotencyKey(manualRequest, requestId);
    const requestEnvelope: NotificationRequestedEvent = {
      payload: {
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        requestId,
        requestedAt: occurredAt,
        kind: "MANUAL",
        channel,
        recipient: {
          audienceRole: payload.audienceRole || undefined,
          studentId: payload.studentId || undefined,
          targetAddress: targetAddress || undefined
        },
        content: {
          templateKey: "manual",
          templateVersion: DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
          title: payload.title.trim(),
          message: payload.message.trim(),
          variables: null
        },
        schedule: payload.scheduledAt ? { scheduledAt: payload.scheduledAt } : undefined,
        source: {
          domain: "notifications",
          action: "manual.create",
          referenceType: "notification",
          referenceId: requestId
        }
      },
      metadata: {
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        eventId: requestId,
        tenantId,
        occurredAt,
        correlationId: requestId,
        idempotencyKey,
        producer: "notifications"
      }
    };

    const created = await this.prisma.notification.create({
      data: {
        tenantId,
        studentId: payload.studentId,
        audienceRole: payload.audienceRole,
        title: payload.title.trim(),
        message: payload.message.trim(),
        channel,
        status,
        targetAddress,
        provider: channel === "IN_APP" ? "IN_APP" : null,
        providerMessageId: null,
        deliveryStatus: "PENDING",
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        deliveredAt: null,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        requestId,
        correlationId: requestId,
        idempotencyKey,
        templateVersion: DEFAULT_NOTIFICATION_TEMPLATE_VERSION,
        schemaVersion: NOTIFICATION_REQUESTED_VERSION,
        sourceDomain: "notifications",
        sourceAction: "manual.create",
        sourceReferenceType: "notification",
        sourceReferenceId: requestId,
        templateKey: "manual",
        requestPayload: requestEnvelope as unknown as Prisma.InputJsonValue,
        updatedAt: now
      },
      include: {
        student: true
      }
    });

    return this.notificationView(created);
  }

  async dispatchPendingNotifications(
    tenantId: string,
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.dispatchNotifications({ tenantId }, limit);
  }

  async dispatchPendingNotificationsGlobal(
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.dispatchNotifications({}, limit);
  }

  async recordDeliveryEvent(
    payload: NotificationDeliveryEventDto,
    verified: VerifiedNotificationWebhook
  ): Promise<NotificationView> {
    const where: Prisma.NotificationWhereInput = {
      tenantId: payload.tenantId,
      providerMessageId: payload.providerMessageId.trim(),
      provider: payload.provider.trim().toUpperCase()
    };

    const eventTime = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    const status = payload.status.trim().toUpperCase();
    const normalizedStatus = this.normalizeDeliveryStatus(status);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const matched = await transaction.notification.findFirst({ where });
      if (!matched) {
        throw new NotFoundException("Notification not found for provider event.");
      }

      await transaction.$queryRaw`
        SELECT id
        FROM notifications
        WHERE id = ${matched.id}::uuid
        FOR UPDATE
      `;
      const existing = await transaction.notification.findFirst({
        where: { id: matched.id, tenantId: payload.tenantId },
        include: { student: true }
      });
      if (!existing) {
        throw new NotFoundException("Notification not found for provider event.");
      }

      const callbackStored = await this.persistProviderCallback(
        transaction,
        existing,
        payload,
        normalizedStatus,
        eventTime,
        verified
      );
      if (!callbackStored) {
        return existing;
      }

      const nextStatus = this.deliveryEventTransition(existing.status, normalizedStatus);
      if (!nextStatus) {
        return existing;
      }

      const callbackError = sanitizeProviderError(
        payload.errorMessage || "Provider delivery failed."
      );
      const notification = await transaction.notification.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          deliveryStatus: nextStatus,
          sentAt: existing.sentAt || eventTime,
          deliveredAt: nextStatus === "DELIVERED" ? eventTime : existing.deliveredAt,
          lastError: nextStatus === "FAILED_PERMANENT" ? callbackError : null,
          nextAttemptAt: null,
          lockedAt: null,
          lockedBy: null,
          leaseToken: null,
          leaseExpiresAt: null,
          deliveryOutcomeUnknown: false,
          updatedAt: eventTime
        },
        include: { student: true }
      });

      await transaction.notificationDeliveryAttempt.updateMany({
        where: {
          notificationId: existing.id,
          tenantId: existing.tenantId,
          providerMessageId: existing.providerMessageId || payload.providerMessageId.trim()
        },
        data: {
          status: nextStatus,
          retryable: false,
          outcomeUnknown: false,
          errorMessage: nextStatus === "FAILED_PERMANENT" ? callbackError : null,
          finishedAt: eventTime,
          updatedAt: eventTime
        }
      });

      return notification;
    });

    return this.notificationView(updated);
  }

  async updateNotificationStatus(
    tenantId: string,
    id: string,
    payload: UpdateNotificationStatusDto
  ): Promise<NotificationView> {
    const existing = await this.requireNotification(tenantId, id);

    if (payload.status === "CANCELLED" && existing.status === "PROCESSING") {
      throw new ConflictException("A notification being processed cannot be cancelled.");
    }
    if (
      payload.status === "PENDING" &&
      !["CANCELLED", "FAILED_RETRYABLE"].includes(existing.status)
    ) {
      throw new ConflictException("Only cancelled or retryable notifications can be requeued.");
    }
    if (
      payload.status === "CANCELLED" &&
      !["PENDING", "FAILED_RETRYABLE"].includes(existing.status)
    ) {
      throw new ConflictException("Only pending or retryable notifications can be cancelled.");
    }

    const now = new Date();

    const updated = await this.prisma.notification.update({
      where: { id: existing.id },
      data: {
        status: payload.status,
        deliveryStatus: payload.status,
        cancelledAt: payload.status === "CANCELLED" ? now : null,
        nextAttemptAt: payload.status === "PENDING" ? now : null,
        lastError: payload.status === "PENDING" ? null : existing.lastError,
        lockedAt: null,
        lockedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: now
      },
      include: {
        student: true
      }
    });

    return this.notificationView(updated);
  }

  async replayNotification(
    tenantId: string,
    id: string,
    actorUserId: string,
    reason: string
  ): Promise<NotificationView> {
    const replayReason = reason.trim();
    const now = new Date();
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.notification.findFirst({
        where: { id, tenantId },
        include: { student: true }
      });
      if (!current) {
        throw new NotFoundException("Notification not found.");
      }
      if (!["FAILED_PERMANENT", "DEAD_LETTER"].includes(current.status)) {
        throw new ConflictException("Only permanently failed or dead-letter notifications can be replayed.");
      }

      const replayed = await transaction.notification.update({
        where: { id: current.id },
        data: {
          status: "PENDING",
          deliveryStatus: "PENDING",
          attempts: 0,
          nextAttemptAt: now,
          lastError: null,
          lockedAt: null,
          lockedBy: null,
          leaseToken: null,
          leaseExpiresAt: null,
          deadLetteredAt: null,
          cancelledAt: null,
          deliveryOutcomeUnknown: false,
          replayCount: { increment: 1 },
          lastReplayedAt: now,
          lastReplayedByUserId: actorUserId,
          updatedAt: now
        },
        include: { student: true }
      });

      await this.auditService.recordLog(
        {
          action: "notification.replay",
          payload: {
            previousStatus: current.status,
            reason: replayReason,
            replayCount: replayed.replayCount
          },
          resource: "notification",
          resourceId: current.id,
          tenantId,
          userId: actorUserId
        },
        transaction
      );

      return replayed;
    });

    return this.notificationView(updated);
  }

  private async dispatchNotifications(
    scope: Prisma.NotificationWhereInput,
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    const cappedLimit = Math.max(1, Math.min(limit ?? 100, 500));
    const now = new Date();

    await this.prisma.notification.updateMany({
      where: {
        ...scope,
        status: "PROCESSING",
        attempts: { gte: this.notificationRetryPolicy.maxAttempts() },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }]
      },
      data: {
        status: "DEAD_LETTER",
        deliveryStatus: "DEAD_LETTER",
        deadLetteredAt: now,
        deliveryOutcomeUnknown: true,
        lastError: "Worker lease expired after the maximum number of attempts.",
        lockedAt: null,
        lockedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        updatedAt: now
      }
    });

    const rows = await this.prisma.notification.findMany({
      where: {
        ...scope,
        ...this.claimableNotificationWhere(now)
      },
      orderBy: [{ createdAt: "asc" }],
      take: cappedLimit
    });

    if (rows.length === 0) {
      return {
        dispatchedCount: 0,
        notifications: []
      };
    }

    const updatedRows: NotificationView[] = [];
    for (const row of rows) {
      const claimed = await this.claimNotificationForDispatch(row.id, now, this.workerId);
      if (!claimed) {
        continue;
      }
      const updated = await this.dispatchSingleNotification(claimed);
      updatedRows.push(updated);
    }

    return {
      dispatchedCount: updatedRows.filter((row) =>
        row.status === "SENT" || row.status === "DELIVERED"
      ).length,
      notifications: updatedRows
    };
  }

  private claimableNotificationWhere(now: Date): Prisma.NotificationWhereInput {
    return {
      OR: [
        {
          status: { in: ["PENDING", "FAILED_RETRYABLE"] },
          attempts: { lt: this.notificationRetryPolicy.maxAttempts() },
          AND: [
            { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
            { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }
          ]
        },
        {
          status: "PROCESSING",
          attempts: { lt: this.notificationRetryPolicy.maxAttempts() },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }]
        }
      ]
    };
  }

  private async claimNotificationForDispatch(
    id: string,
    now: Date,
    workerId: string
  ): Promise<NotificationWithStudent | null> {
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + this.notificationDispatchClaimTtlMs());
    const leaseData: Prisma.NotificationUpdateManyMutationInput = {
      status: "PROCESSING",
      deliveryStatus: "PROCESSING",
      lockedAt: now,
      lockedBy: workerId,
      leaseToken,
      leaseExpiresAt,
      lastAttemptAt: now,
      attempts: { increment: 1 },
      updatedAt: now
    };
    let result = await this.prisma.notification.updateMany({
      where: {
        id,
        status: { in: ["PENDING", "FAILED_RETRYABLE"] },
        attempts: { lt: this.notificationRetryPolicy.maxAttempts() },
        AND: [
          { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
          { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }
        ]
      },
      data: leaseData
    });

    if (result.count === 0) {
      result = await this.prisma.notification.updateMany({
        where: {
          id,
          status: "PROCESSING",
          attempts: { lt: this.notificationRetryPolicy.maxAttempts() },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }]
        },
        data: {
          ...leaseData,
          deliveryOutcomeUnknown: true
        }
      });
    }

    if (result.count !== 1) {
      return null;
    }

    await this.prisma.notificationDeliveryAttempt.updateMany({
      where: {
        notificationId: id,
        status: "PROCESSING",
        finishedAt: null
      },
      data: {
        status: "FAILED_RETRYABLE",
        retryable: true,
        outcomeUnknown: true,
        errorMessage: "Previous worker lease expired before a terminal outcome was recorded.",
        finishedAt: now,
        updatedAt: now
      }
    });

    return this.prisma.notification.findFirst({
      where: { id, status: "PROCESSING", lockedBy: workerId, leaseToken },
      include: { student: true }
    });
  }

  private async dispatchSingleNotification(row: NotificationWithStudent): Promise<NotificationView> {
    const now = new Date();
    const channel = this.normalizeNotificationChannel(row.channel);
    const attempt = await this.startDeliveryAttempt(row, channel, now);

    let resolvedTargetAddress: string | null = null;
    try {
      resolvedTargetAddress = await this.resolveNotificationTargetAddress(row, channel);
      const dispatchResult = await this.notificationGateway.dispatch({
        notificationId: row.id,
        tenantId: row.tenantId,
        channel,
        title: row.title,
        message: row.message,
        targetAddress: resolvedTargetAddress || undefined,
        idempotencyKey: row.idempotencyKey,
        attemptNo: row.attempts
      });

      const updated = await this.finalizeSuccessfulDispatch(
        row,
        attempt,
        dispatchResult,
        resolvedTargetAddress,
        now
      );
      return this.notificationView(updated || (await this.requireNotificationWithStudent(row.id)));
    } catch (error: unknown) {
      const normalizedError =
        error instanceof ConflictException
          ? new ProviderDispatchError(error.message, "PERMANENT")
          : error;
      const decision = this.notificationRetryPolicy.decide(normalizedError, row.attempts, now);
      const updated = await this.finalizeFailedDispatch(
        row,
        attempt,
        decision,
        resolvedTargetAddress,
        channel,
        now
      );
      return this.notificationView(updated || (await this.requireNotificationWithStudent(row.id)));
    }
  }

  private async startDeliveryAttempt(
    row: NotificationWithStudent,
    channel: NotificationChannel,
    startedAt: Date
  ): Promise<NotificationDeliveryAttempt> {
    return this.prisma.notificationDeliveryAttempt.create({
      data: {
        tenantId: row.tenantId,
        notificationId: row.id,
        attemptNo: row.attempts,
        channel,
        provider: row.provider || this.defaultProviderName(channel),
        targetAddress: row.targetAddress || null,
        providerMessageId: row.providerMessageId || null,
        status: "PROCESSING",
        errorMessage: null,
        workerId: row.lockedBy,
        leaseToken: row.leaseToken,
        retryable: null,
        outcomeUnknown: false,
        startedAt,
        finishedAt: null,
        updatedAt: startedAt
      }
    });
  }

  private async finalizeSuccessfulDispatch(
    row: NotificationWithStudent,
    attempt: NotificationDeliveryAttempt,
    dispatchResult: Awaited<ReturnType<NotificationGatewayService["dispatch"]>>,
    targetAddress: string | null,
    now: Date
  ): Promise<NotificationWithStudent | null> {
    return this.prisma.$transaction(async (transaction) => {
      const finalized = await transaction.notification.updateMany({
        where: {
          id: row.id,
          status: "PROCESSING",
          lockedBy: row.lockedBy,
          leaseToken: row.leaseToken
        },
        data: {
          status: dispatchResult.deliveryStatus,
          deliveryStatus: dispatchResult.deliveryStatus,
          sentAt: now,
          deliveredAt: dispatchResult.deliveryStatus === "DELIVERED" ? now : row.deliveredAt,
          targetAddress: targetAddress || row.targetAddress,
          provider: dispatchResult.provider,
          providerMessageId: dispatchResult.providerMessageId,
          lastError: null,
          nextAttemptAt: null,
          lockedAt: null,
          lockedBy: null,
          leaseToken: null,
          leaseExpiresAt: null,
          deliveryOutcomeUnknown: false,
          deadLetteredAt: null,
          updatedAt: now
        }
      });

      await transaction.notificationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          provider: dispatchResult.provider,
          providerMessageId: dispatchResult.providerMessageId,
          targetAddress: targetAddress || row.targetAddress,
          status: finalized.count === 1 ? dispatchResult.deliveryStatus : "FAILED_RETRYABLE",
          retryable: finalized.count === 1 ? false : true,
          outcomeUnknown: finalized.count !== 1,
          errorMessage:
            finalized.count === 1 ? null : "Worker lease expired before provider success was persisted.",
          finishedAt: now,
          updatedAt: now
        }
      });

      if (finalized.count !== 1) return null;
      return transaction.notification.findFirst({
        where: { id: row.id },
        include: { student: true }
      });
    });
  }

  private async finalizeFailedDispatch(
    row: NotificationWithStudent,
    attempt: NotificationDeliveryAttempt,
    decision: NotificationFailureDecision,
    targetAddress: string | null,
    channel: NotificationChannel,
    now: Date
  ): Promise<NotificationWithStudent | null> {
    return this.prisma.$transaction(async (transaction) => {
      const finalized = await transaction.notification.updateMany({
        where: {
          id: row.id,
          status: "PROCESSING",
          lockedBy: row.lockedBy,
          leaseToken: row.leaseToken
        },
        data: {
          status: decision.status,
          deliveryStatus: decision.status,
          nextAttemptAt: decision.nextAttemptAt,
          lastError: decision.errorMessage,
          provider: row.provider || this.defaultProviderName(channel),
          targetAddress: targetAddress || row.targetAddress,
          lockedAt: null,
          lockedBy: null,
          leaseToken: null,
          leaseExpiresAt: null,
          deliveryOutcomeUnknown: decision.outcomeUnknown,
          deadLetteredAt: decision.status === "DEAD_LETTER" ? now : null,
          updatedAt: now
        }
      });

      await transaction.notificationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          provider: row.provider || this.defaultProviderName(channel),
          targetAddress: targetAddress || row.targetAddress,
          status: finalized.count === 1 ? decision.status : "FAILED_RETRYABLE",
          retryable: finalized.count === 1 ? decision.retryable : true,
          outcomeUnknown: finalized.count === 1 ? decision.outcomeUnknown : true,
          httpStatus: decision.httpStatus,
          retryAfterAt: decision.retryAfterAt,
          errorMessage:
            finalized.count === 1
              ? decision.errorMessage
              : "Worker lease expired before provider failure was persisted.",
          finishedAt: now,
          updatedAt: now
        }
      });

      if (finalized.count !== 1) return null;
      return transaction.notification.findFirst({
        where: { id: row.id },
        include: { student: true }
      });
    });
  }

  private async persistProviderCallback(
    transaction: Prisma.TransactionClient,
    notification: Pick<Notification, "id" | "tenantId" | "provider" | "providerMessageId">,
    payload: NotificationDeliveryEventDto,
    normalizedStatus: DeliveryStatus,
    occurredAt: Date,
    verified: VerifiedNotificationWebhook
  ): Promise<boolean> {
    const provider = payload.provider.trim().toUpperCase();
    const providerMessageId =
      notification.providerMessageId || payload.providerMessageId.trim();
    const payloadDigest = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const dedupeKey = [notification.tenantId, provider, verified.eventId].join(":");

    const created = await transaction.notificationProviderCallback.createMany({
      data: [
        {
          tenantId: notification.tenantId,
          notificationId: notification.id,
          provider,
          providerMessageId,
          providerEventId: verified.eventId,
          eventStatus: normalizedStatus,
          dedupeKey,
          signatureTimestamp: verified.signatureTimestamp,
          occurredAt,
          errorMessage: payload.errorMessage
            ? sanitizeProviderError(payload.errorMessage)
            : null,
          payload: {
            digest: payloadDigest,
            occurredAt: payload.occurredAt || null,
            provider,
            providerMessageId,
            status: payload.status
          },
          updatedAt: occurredAt
        }
      ],
      skipDuplicates: true
    });
    return created.count === 1;
  }

  private normalizeNotificationChannel(value: string): NotificationChannel {
    const normalized = value.trim().toUpperCase();
    if (normalized === "EMAIL" || normalized === "SMS") {
      return normalized;
    }
    return "IN_APP";
  }

  private defaultProviderName(channel: NotificationChannel): string {
    if (channel === "EMAIL") return "EMAIL_GATEWAY";
    if (channel === "SMS") return "SMS_GATEWAY";
    return "IN_APP";
  }

  private async resolveNotificationTargetAddress(
    row: NotificationWithStudent,
    channel: NotificationChannel
  ): Promise<string | null> {
    if (channel === "IN_APP") {
      return null;
    }

    if (row.targetAddress) {
      const explicit = row.targetAddress.trim();
      if (channel === "EMAIL" && this.isValidEmail(explicit)) return explicit;
      if (channel === "SMS" && this.isValidPhone(explicit)) return explicit;
      throw new ConflictException(`Invalid targetAddress for ${channel} notification.`);
    }

    if (row.student) {
      if (channel === "EMAIL" && row.student.email && this.isValidEmail(row.student.email)) {
        return row.student.email.trim();
      }
      if (channel === "SMS" && row.student.phone && this.isValidPhone(row.student.phone)) {
        return row.student.phone.trim();
      }
    }

    if (row.audienceRole === "PARENT" && row.studentId) {
      const parentAddress = await this.resolveParentAddress(row.tenantId, row.studentId, channel);
      if (parentAddress) {
        return parentAddress;
      }
    }

    if (row.audienceRole) {
      const audienceAddress = await this.resolveAudienceAddress(
        row.tenantId,
        row.audienceRole,
        channel
      );
      if (audienceAddress) {
        return audienceAddress;
      }
    }

    throw new ConflictException(`No deliverable target found for ${channel} notification.`);
  }

  private async resolveParentAddress(
    tenantId: string,
    studentId: string,
    channel: NotificationChannel
  ): Promise<string | null> {
    const links = await this.prisma.parentStudentLink.findMany({
      where: {
        tenantId,
        studentId
      },
      include: {
        parent: true,
        parentProfile: true
      },
      orderBy: [{ isPrimaryContact: "desc" }, { isPrimary: "desc" }, { createdAt: "asc" }]
    });

    for (const link of links) {
      const candidates =
        channel === "EMAIL"
          ? [link.parentProfile?.email, link.parent?.username]
          : [link.parentProfile?.primaryPhone, link.parentProfile?.secondaryPhone, link.parent?.username];
      for (const candidate of candidates) {
        const value = candidate?.trim();
        if (!value) continue;
        if (channel === "EMAIL" && this.isValidEmail(value)) {
          return value;
        }
        if (channel === "SMS" && this.isValidPhone(value)) {
          return value;
        }
      }
    }

    return null;
  }

  private async resolveAudienceAddress(
    tenantId: string,
    audienceRole: string,
    channel: NotificationChannel
  ): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        role: audienceRole,
        isActive: true,
        deletedAt: null
      },
      orderBy: [{ createdAt: "asc" }]
    });

    if (!user?.username) {
      return null;
    }

    const candidate = user.username.trim();
    if (channel === "EMAIL" && this.isValidEmail(candidate)) {
      return candidate;
    }
    if (channel === "SMS" && this.isValidPhone(candidate)) {
      return candidate;
    }
    return null;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private isValidPhone(value: string): boolean {
    return /^\+?[0-9]{8,20}$/.test(value.trim());
  }

  private notificationDispatchClaimTtlMs(): number {
    const raw = Number(
      this.configService.get<string>("NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS", "120")
    );
    if (!Number.isFinite(raw) || raw <= 0) {
      return 120_000;
    }
    return raw * 1000;
  }

  private normalizeDeliveryStatus(value: string): DeliveryStatus {
    const normalized = value.trim().toUpperCase();
    if (normalized === "SENT_TO_PROVIDER") return "SENT";
    if (normalized === "FAILED" || normalized === "UNDELIVERABLE") {
      return "FAILED_PERMANENT";
    }
    if (normalized === "SENT") return "SENT";
    if (normalized === "DELIVERED") return "DELIVERED";
    return "FAILED_PERMANENT";
  }

  private deliveryEventTransition(
    currentStatus: string,
    eventStatus: DeliveryStatus
  ): "SENT" | "DELIVERED" | "FAILED_PERMANENT" | null {
    if (currentStatus === "CANCELLED" || currentStatus === "DELIVERED") {
      return null;
    }
    if (currentStatus === "FAILED_PERMANENT" && eventStatus !== "DELIVERED") {
      return null;
    }
    if (eventStatus === "DELIVERED") return "DELIVERED";
    if (eventStatus === "FAILED_PERMANENT") return "FAILED_PERMANENT";
    if (eventStatus === "SENT") return "SENT";
    return null;
  }

  private async requireStudent(tenantId: string, id: string) {
    const row = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!row) {
      throw new NotFoundException("Student not found.");
    }

    return row;
  }

  private async requireNotification(tenantId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Notification not found.");
    }

    return row;
  }

  private async requireNotificationWithStudent(id: string): Promise<NotificationWithStudent> {
    const row = await this.prisma.notification.findFirst({
      where: { id },
      include: { student: true }
    });
    if (!row) {
      throw new NotFoundException("Notification not found.");
    }
    return row;
  }

  private notificationView(row: NotificationWithStudent): NotificationView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId || undefined,
      audienceRole: row.audienceRole || undefined,
      title: row.title,
      message: row.message,
      channel: row.channel,
      status: row.status,
      targetAddress: row.targetAddress || undefined,
      provider: row.provider || undefined,
      providerMessageId: row.providerMessageId || undefined,
      deliveryStatus: row.deliveryStatus,
      attempts: row.attempts,
      lastError: row.lastError || undefined,
      nextAttemptAt: row.nextAttemptAt?.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString(),
      scheduledAt: row.scheduledAt?.toISOString(),
      sentAt: row.sentAt?.toISOString(),
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      requestId: row.requestId || undefined,
      correlationId: row.correlationId || undefined,
      idempotencyKey: row.idempotencyKey,
      sourceDomain: row.sourceDomain || undefined,
      sourceAction: row.sourceAction || undefined,
      templateKey: row.templateKey || undefined,
      templateVersion: row.templateVersion,
      deliveryOutcomeUnknown: row.deliveryOutcomeUnknown,
      lockedAt: row.lockedAt?.toISOString(),
      leaseExpiresAt: row.leaseExpiresAt?.toISOString(),
      replayCount: row.replayCount
    };
  }
}
