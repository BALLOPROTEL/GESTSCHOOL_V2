import { Injectable } from "@nestjs/common";
import { type OutboxEvent } from "@prisma/client";

import { OutboxService } from "./outbox.service";

export type OutboxProcessingSummary = {
  claimedCount: number;
  processedCount: number;
  failedCount: number;
};

type ProcessPendingOutboxOptions = {
  claimTtlMs: number;
  eventTypes: string[];
  limit: number;
  maxAttempts: number;
  retryDelayMs(attempt: number): number;
  workerId: string;
  handler(event: OutboxEvent): Promise<void>;
};

@Injectable()
export class OutboxProcessorService {
  constructor(private readonly outboxService: OutboxService) {}

  async processPendingEvents(
    options: ProcessPendingOutboxOptions
  ): Promise<OutboxProcessingSummary> {
    const candidates = await this.outboxService.listProcessable(
      options.limit,
      options.eventTypes
    );

    let claimedCount = 0;
    let processedCount = 0;
    let failedCount = 0;

    for (const event of candidates) {
      const claim = await this.outboxService.claim(
        event.id,
        options.workerId,
        options.claimTtlMs,
        options.maxAttempts
      );
      if (!claim) {
        continue;
      }

      claimedCount += 1;
      try {
        await options.handler(claim.event);
        const finalized = await this.outboxService.markProcessed(claim);
        if (finalized) {
          processedCount += 1;
        }
      } catch (error: unknown) {
        const finalized = await this.outboxService.markFailed(
          claim,
          error,
          options.retryDelayMs(claim.event.attempts),
          options.maxAttempts
        );
        if (finalized) {
          failedCount += 1;
        }
      }
    }

    return {
      claimedCount,
      processedCount,
      failedCount
    };
  }
}
