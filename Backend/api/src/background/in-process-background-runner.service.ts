import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BackgroundTasksService } from "./background-tasks.service";

@Injectable()
export class InProcessBackgroundRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InProcessBackgroundRunnerService.name);
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly backgroundTasks: BackgroundTasksService,
    private readonly configService: ConfigService
  ) {}

  onModuleInit(): void {
    if (!this.booleanConfig("OUTBOX_IN_PROCESS_ENABLED", false)) {
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
      void this.runTick(batchSize);
    }, intervalMs);
    this.timer.unref?.();

    void this.runTick(batchSize);
    this.logger.log(
      `In-process outbox runner started for Render free mode (${intervalMs}ms, batch ${batchSize}).`
    );
  }

  onModuleDestroy(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  private async runTick(batchSize: number): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
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
      const message = error instanceof Error ? error.message : "Unexpected in-process outbox error";
      this.logger.error(message);
    } finally {
      this.isRunning = false;
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
