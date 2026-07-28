import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { BackgroundTasksService } from "../../src/background/background-tasks.service";
import { InProcessBackgroundRunnerService } from "../../src/background/in-process-background-runner.service";
import { NotificationWorkerService } from "../../src/school-life/notification-worker.service";

const emptyRun = {
  audit: { failedCount: 0, processedCount: 0 },
  notificationRequests: { failedCount: 0, processedCount: 0 },
  notifications: { dispatchedCount: 0 }
};

const configService = (values: Record<string, string>): ConfigService =>
  ({
    get: jest.fn((key: string, defaultValue = "") => values[key] ?? defaultValue)
  }) as unknown as ConfigService;

describe("notification worker runtime modes", () => {
  it("rejects two active background strategies", () => {
    const service = new NotificationWorkerService(
      { runOnce: jest.fn() } as unknown as BackgroundTasksService,
      configService({
        NOTIFICATIONS_WORKER_ENABLED: "true",
        OUTBOX_IN_PROCESS_ENABLED: "true"
      })
    );

    expect(() => service.onModuleInit()).toThrow(
      "NOTIFICATIONS_WORKER_ENABLED and OUTBOX_IN_PROCESS_ENABLED cannot both be enabled."
    );
  });

  it("requires the dedicated worker mode for the production worker role", () => {
    const service = new NotificationWorkerService(
      { runOnce: jest.fn() } as unknown as BackgroundTasksService,
      configService({
        NODE_ENV: "production",
        GESTSCHOOL_PROCESS_ROLE: "worker",
        NOTIFICATIONS_WORKER_ENABLED: "false",
        OUTBOX_IN_PROCESS_ENABLED: "false"
      })
    );

    expect(() => service.onModuleInit()).toThrow(
      "The production worker requires NOTIFICATIONS_WORKER_ENABLED=true and OUTBOX_IN_PROCESS_ENABLED=false."
    );
  });

  it("rejects background processing inside the production API", () => {
    const service = new NotificationWorkerService(
      { runOnce: jest.fn() } as unknown as BackgroundTasksService,
      configService({
        NODE_ENV: "production",
        GESTSCHOOL_PROCESS_ROLE: "api",
        NOTIFICATIONS_WORKER_ENABLED: "true",
        OUTBOX_IN_PROCESS_ENABLED: "false"
      })
    );

    expect(() => service.onModuleInit()).toThrow(
      "Background notification processing must be disabled in the production API."
    );
  });

  it("waits for the active lease-processing tick during shutdown", async () => {
    let resolveRun: ((value: typeof emptyRun) => void) | undefined;
    const runOnce = jest.fn(
      () =>
        new Promise<typeof emptyRun>((resolve) => {
          resolveRun = resolve;
        })
    );
    const service = new NotificationWorkerService(
      { runOnce } as unknown as BackgroundTasksService,
      configService({
        NODE_ENV: "production",
        GESTSCHOOL_PROCESS_ROLE: "worker",
        NOTIFICATIONS_WORKER_ENABLED: "true",
        OUTBOX_IN_PROCESS_ENABLED: "false",
        NOTIFICATIONS_WORKER_INTERVAL_MS: "60000"
      })
    );
    service.onModuleInit();
    await Promise.resolve();

    let stopped = false;
    const shutdown = service.onModuleDestroy().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);

    resolveRun?.(emptyRun);
    await shutdown;
    expect(stopped).toBe(true);
    expect(runOnce).toHaveBeenCalledTimes(1);
  });

  it("redacts provider secrets and recipients from worker error logs", async () => {
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation();
    const service = new NotificationWorkerService(
      {
        runOnce: jest.fn().mockRejectedValue(
          new Error(
            "authorization=private-token recipient@example.test +221770000000"
          )
        )
      } as unknown as BackgroundTasksService,
      configService({
        NOTIFICATIONS_WORKER_ENABLED: "true",
        OUTBOX_IN_PROCESS_ENABLED: "false",
        NOTIFICATIONS_WORKER_INTERVAL_MS: "60000"
      })
    );

    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));
    await service.onModuleDestroy();

    expect(logger).toHaveBeenCalledWith(
      "authorization=[redacted] [redacted-email] [redacted-phone]"
    );
    expect(logger.mock.calls.flat().join(" ")).not.toContain("private-token");
    expect(logger.mock.calls.flat().join(" ")).not.toContain("recipient@example.test");
    expect(logger.mock.calls.flat().join(" ")).not.toContain("+221770000000");
    logger.mockRestore();
  });

  it("rejects the legacy in-process runner in production", () => {
    const service = new InProcessBackgroundRunnerService(
      { runOnce: jest.fn() } as unknown as BackgroundTasksService,
      configService({
        NODE_ENV: "production",
        NOTIFICATIONS_WORKER_ENABLED: "false",
        OUTBOX_IN_PROCESS_ENABLED: "true"
      })
    );

    expect(() => service.onModuleInit()).toThrow(
      "In-process outbox processing is disabled in production."
    );
  });
});
