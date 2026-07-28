import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { sanitizeProviderError } from "../notifications/notification-delivery.types";
import { BackgroundTasksService } from "./background-tasks.service";

@Injectable()
export class InProcessBackgroundRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InProcessBackgroundRunnerService.name);
  private activeTick: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly backgroundTasks: BackgroundTasksService,
    private readonly configService: ConfigService
  ) {}

  onModuleInit(): void {
    const inProcessEnabled = this.booleanConfig("OUTBOX_IN_PROCESS_ENABLED", false);
    const workerEnabled = this.booleanConfig("NOTIFICATIONS_WORKER_ENABLED", false);
    if (inProcessEnabled && workerEnabled) {
      throw new Error(
        "OUTBOX_IN_PROCESS_ENABLED and NOTIFICATIONS_WORKER_ENABLED cannot both be enabled."
      );
    }
    const production =
      this.configService.get<string>("NODE_ENV", "development").trim().toLowerCase() ===
      "production";
    if (production && inProcessEnabled) {
      throw new Error("In-process outbox processing is disabled in production.");
    }
    if (!inProcessEnabled) {
      this.logger.log("In-process outbox runner disabled.");
      return;
    }

    const intervalMs = this.numberConfig("OUTBOX_POLL_INTERVAL_MS", 30_000, {
      min: 5_000,
      max: 10 * 60_000
    });
    const batchSize = this.numberConfig("OUTBOX_BATCH_SIZE", 10, {
      min: 1,
      max: 50
    });

    this.timer = setInterval(() => {
      void this.scheduleTick(batchSize);
    }, intervalMs);
    this.timer.unref?.();

    void this.scheduleTick(batchSize);
    this.logger.log(
      `In-process outbox runner started for Render free mode (${intervalMs}ms, batch ${batchSize}).`
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.activeTick) {
      await this.activeTick;
    }
  }

  private scheduleTick(batchSize: number): Promise<void> {
    if (this.activeTick) return this.activeTick;
    const scheduledTick = this.runTick(batchSize).finally(() => {
      if (this.activeTick === scheduledTick) {
        this.activeTick = null;
      }
    });
    this.activeTick = scheduledTick;
    return this.activeTick;
  }

  private async runTick(batchSize: number): Promise<void> {
    try {
      const result = await this.backgroundTasks.runOnce({ batchSize });
      const totalProcessed =
        result.audit.processedCount +
        result.notificationRequests.processedCount +
        result.notifications.dispatchedCount;
      const totalFailed = result.audit.failedCount + result.notificationRequests.failedCount;
      if (totalProcessed > 0 || totalFailed > 0) {
        this.logger.log(
          `In-process outbox tick: processed=${totalProcessed}, failed=${totalFailed}.`
        );
      }
    } catch (error: unknown) {
      this.logger.error(sanitizeProviderError(error));
    }
  }

  private booleanConfig(key: string, fallback: boolean): boolean {
    const raw = this.configService.get<string>(key, fallback ? "true" : "false").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  }

  private numberConfig(
    key: string,
    fallback: number,
    options: { min: number; max: number }
  ): number {
    const raw = Number(this.configService.get<string>(key, String(fallback)));
    if (!Number.isFinite(raw)) {
      return fallback;
    }
    return Math.min(Math.max(Math.floor(raw), options.min), options.max);
  }
}
