import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BackgroundTasksService } from "../background/background-tasks.service";
import { allowsProductionSandboxInProcessOutbox } from "../background/production-sandbox-runtime.policy";
import { sanitizeProviderError } from "../notifications/notification-delivery.types";

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private activeTick: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly backgroundTasks: BackgroundTasksService,
    private readonly configService: ConfigService
  ) {}

  onModuleInit(): void {
    const enabled = this.parseBoolean(
      this.configService.get<string>("NOTIFICATIONS_WORKER_ENABLED", "false")
    );
    const inProcessEnabled = this.parseBoolean(
      this.configService.get<string>("OUTBOX_IN_PROCESS_ENABLED", "false")
    );
    this.assertRuntimeMode(enabled, inProcessEnabled);

    if (!enabled) {
      this.logger.log("Background notification worker disabled.");
      return;
    }

    const intervalRaw = Number(
      this.configService.get<string>("NOTIFICATIONS_WORKER_INTERVAL_MS", "15000")
    );
    const intervalMs = Number.isFinite(intervalRaw) && intervalRaw >= 1000 ? intervalRaw : 15000;

    this.timer = setInterval(() => {
      void this.scheduleTick();
    }, intervalMs);
    this.timer.unref?.();

    void this.scheduleTick();
    this.logger.log(`Background notification worker started (${intervalMs}ms).`);
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

  private scheduleTick(): Promise<void> {
    if (this.activeTick) return this.activeTick;
    const scheduledTick = this.runTick().finally(() => {
      if (this.activeTick === scheduledTick) {
        this.activeTick = null;
      }
    });
    this.activeTick = scheduledTick;
    return this.activeTick;
  }

  private async runTick(): Promise<void> {
    try {
      const result = await this.backgroundTasks.runOnce();
      if (result.audit.processedCount > 0 || result.audit.failedCount > 0) {
        this.logger.log(
          `Processed ${result.audit.processedCount} audit outbox event(s), ` +
            `${result.audit.failedCount} failed.`
        );
      }
      if (
        result.notificationRequests.processedCount > 0 ||
        result.notificationRequests.failedCount > 0
      ) {
        this.logger.log(
          `Processed ${result.notificationRequests.processedCount} notification request event(s), ` +
            `${result.notificationRequests.failedCount} failed.`
        );
      }
      if (result.notifications.dispatchedCount > 0) {
        this.logger.log(
          `Dispatched ${result.notifications.dispatchedCount} queued notifications.`
        );
      }
    } catch (error: unknown) {
      this.logger.error(sanitizeProviderError(error));
    }
  }

  private assertRuntimeMode(workerEnabled: boolean, inProcessEnabled: boolean): void {
    if (workerEnabled && inProcessEnabled) {
      throw new Error(
        "NOTIFICATIONS_WORKER_ENABLED and OUTBOX_IN_PROCESS_ENABLED cannot both be enabled."
      );
    }
    const production = this.configService
      .get<string>("NODE_ENV", "development")
      .trim()
      .toLowerCase() === "production";
    if (!production) return;

    const processRole = this.configService
      .get<string>("GESTSCHOOL_PROCESS_ROLE", "")
      .trim()
      .toLowerCase();
    if (processRole === "worker" && (!workerEnabled || inProcessEnabled)) {
      throw new Error(
        "The production worker requires NOTIFICATIONS_WORKER_ENABLED=true and OUTBOX_IN_PROCESS_ENABLED=false."
      );
    }
    if (processRole === "api" && workerEnabled) {
      throw new Error("Background notification processing must be disabled in the production API.");
    }
    if (
      processRole === "api" &&
      inProcessEnabled &&
      !allowsProductionSandboxInProcessOutbox(this.configService)
    ) {
      throw new Error(
        "In-process outbox processing in production is limited to the explicitly confirmed empty single-instance sandbox."
      );
    }
  }

  private parseBoolean(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }
}
