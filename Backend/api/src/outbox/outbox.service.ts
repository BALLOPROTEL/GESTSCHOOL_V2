import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type OutboxEvent } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { type OutboxPublishInput } from "./outbox.types";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export type OutboxClaim = {
  event: OutboxEvent;
  leaseToken: string;
  workerId: string;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  async publish(
    input: OutboxPublishInput,
    client: PrismaClientLike = this.prisma
  ): Promise<OutboxEvent | null> {
    try {
      return await client.outboxEvent.create({
        data: {
          tenantId: input.tenantId || null,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          eventType: input.eventType,
          payload: input.payload,
          metadata: input.metadata,
          dedupeKey: input.dedupeKey || null,
          status: "PENDING",
          availableAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        input.dedupeKey
      ) {
        this.logger.debug("Skipped duplicate outbox event.");
        return null;
      }
      throw error;
    }
  }

  async listProcessable(
    limit: number,
    eventTypes?: string[]
  ): Promise<OutboxEvent[]> {
    const now = new Date();
    return this.prisma.outboxEvent.findMany({
      where: {
        eventType:
          eventTypes && eventTypes.length > 0
            ? {
                in: eventTypes
              }
            : undefined,
        availableAt: {
          lte: now
        },
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }]
          }
        ]
      },
      orderBy: [{ createdAt: "asc" }],
      take: Math.max(1, Math.min(limit, 500))
    });
  }

  async claim(
    id: string,
    workerId: string,
    claimTtlMs: number,
    maxAttempts = 6
  ): Promise<OutboxClaim | null> {
    const now = new Date();
    const normalizedMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + claimTtlMs);

    await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        attempts: { gte: normalizedMaxAttempts },
        OR: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }]
          }
        ]
      },
      data: {
        status: "DEAD_LETTER",
        claimedAt: null,
        claimedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: "Outbox processing exhausted the maximum number of attempts.",
        updatedAt: now
      }
    });

    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        attempts: { lt: normalizedMaxAttempts },
        OR: [
          { status: "PENDING", availableAt: { lte: now } },
          {
            status: "PROCESSING",
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }]
          }
        ]
      },
      data: {
        status: "PROCESSING",
        claimedAt: now,
        claimedBy: workerId,
        leaseToken,
        leaseExpiresAt,
        attempts: { increment: 1 },
        updatedAt: now
      }
    });

    if (result.count !== 1) {
      return null;
    }

    const event = await this.prisma.outboxEvent.findFirst({
      where: { id, claimedBy: workerId, leaseToken, status: "PROCESSING" }
    });
    return event ? { event, leaseToken, workerId } : null;
  }

  async markProcessed(claim: OutboxClaim): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id: claim.event.id,
        status: "PROCESSING",
        claimedBy: claim.workerId,
        leaseToken: claim.leaseToken
      },
      data: {
        status: "PROCESSED",
        claimedAt: null,
        claimedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
        processedAt: new Date(),
        lastError: null,
        updatedAt: new Date()
      }
    });
    return result.count === 1;
  }

  async markFailed(
    claim: OutboxClaim,
    error: unknown,
    nextDelayMs: number,
    maxAttempts: number
  ): Promise<boolean> {
    const attempts = claim.event.attempts;
    const permanent = attempts >= maxAttempts;
    const message = this.toErrorMessage(error);

    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id: claim.event.id,
        status: "PROCESSING",
        claimedBy: claim.workerId,
        leaseToken: claim.leaseToken
      },
      data: {
        status: permanent ? "DEAD_LETTER" : "PENDING",
        claimedAt: null,
        claimedBy: null,
        leaseToken: null,
        leaseExpiresAt: null,
        availableAt: permanent ? new Date() : new Date(Date.now() + nextDelayMs),
        lastError: message,
        updatedAt: new Date()
      }
    });
    return result.count === 1;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message
        .replace(/(authorization|bearer|token|secret|password|api[-_ ]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
        .replace(/[A-Za-z0-9+/=_-]{40,}/g, "[redacted]")
        .slice(0, 1000);
    }
    return "Unexpected outbox processing error.";
  }
}
