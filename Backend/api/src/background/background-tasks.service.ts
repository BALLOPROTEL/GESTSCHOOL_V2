import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuditOutboxProcessorService } from "../audit/audit.outbox-processor.service";
import { NotificationRequestProcessorService } from "../notifications/notification-request-processor.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class BackgroundTasksService {
  constructor(
    private readonly auditOutboxProcessor: AuditOutboxProcessorService,
    private readonly configService: ConfigService,
    private readonly notificationRequestProcessor: NotificationRequestProcessorService,
    private readonly notificationsService: NotificationsService
  ) {}

  async runOnce(options?: { batchSize?: number }): Promise<{
    audit: Awaited<ReturnType<AuditOutboxProcessorService["processPendingEvents"]>>;
    notifications: Awaited<ReturnType<NotificationsService["dispatchPendingNotificationsGlobal"]>>;
    notificationRequests: Awaited<
      ReturnType<NotificationRequestProcessorService["processPendingEvents"]>
    >;
  }> {
    const batchSize = options?.batchSize;
    const audit = await this.auditOutboxProcessor.processPendingEvents(batchSize);
    const notificationRequests =
      await this.notificationRequestProcessor.processPendingEvents(batchSize);
    const notifications = await this.notificationsService.dispatchPendingNotificationsGlobal(
      batchSize ?? this.notificationBatchSize()
    );

    return {
      audit,
      notifications,
      notificationRequests
    };
  }

  private notificationBatchSize(): number {
    const raw = Number(this.configService.get<string>("NOTIFICATIONS_WORKER_BATCH_SIZE", "80"));
    return Number.isFinite(raw) && raw > 0 ? raw : 80;
  }
}
