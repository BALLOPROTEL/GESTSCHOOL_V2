import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { OutboxModule } from "../outbox/outbox.module";
import { NotificationRetryPolicyService } from "./notification-retry-policy.service";
import { NotificationWebhookVerifierService } from "./notification-webhook-verifier.service";
import { NotificationGatewayService } from "./notification-gateway.service";
import { NotificationRequestBusService } from "./notification-request-bus.service";
import { NotificationRequestProcessorService } from "./notification-request-processor.service";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [AuditModule, OutboxModule],
  providers: [
    NotificationGatewayService,
    NotificationRetryPolicyService,
    NotificationRequestBusService,
    NotificationRequestProcessorService,
    NotificationWebhookVerifierService,
    NotificationsService
  ],
  exports: [
    NotificationGatewayService,
    NotificationRetryPolicyService,
    NotificationRequestBusService,
    NotificationRequestProcessorService,
    NotificationWebhookVerifierService,
    NotificationsService
  ]
})
export class NotificationsModule {}
