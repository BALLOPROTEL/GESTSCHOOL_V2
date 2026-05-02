import { Controller, ForbiddenException, Get, Header, Headers } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../infrastructure/redis/redis.service";
import { NOTIFICATION_REQUESTED } from "../notifications/notification-request.contract";
import { RequestMetricsService } from "../observability/request-metrics.service";
import { Public } from "../security/public.decorator";
import { RateLimit } from "../security/rate-limit.decorator";

@ApiTags("monitoring")
@Controller("monitoring")
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly requestMetrics: RequestMetricsService
  ) {}

  @Public()
  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @RateLimit({ bucket: "monitoring-metrics", max: 60, windowMs: 60_000 })
  @ApiOperation({ summary: "Prometheus-like metrics endpoint" })
  async metrics(@Headers("x-metrics-token") tokenHeader?: string): Promise<string> {
    this.assertMetricsToken(tokenHeader);

    const lines: string[] = [];
    lines.push(`# generated_at ${new Date().toISOString()}`);
    lines.push("gestschool_process_uptime_seconds " + process.uptime().toFixed(2));
    lines.push("gestschool_process_heap_used_bytes " + process.memoryUsage().heapUsed);
    lines.push("gestschool_process_rss_bytes " + process.memoryUsage().rss);
    lines.push(`gestschool_redis_up ${this.redisService.isConnected() ? 1 : 0}`);

    try {
      const now = new Date();
      const [
        byStatus,
        byDelivery,
        queueDue,
        outboxByStatus,
        outboxDue,
        notificationAttemptByStatus,
        notificationCallbackCount,
        notificationCallbackByStatus,
        notificationRequestOutboxByStatus,
        oldestNotificationRequest
      ] = await Promise.all([
        this.prisma.notification.groupBy({
          by: ["status"],
          _count: {
            status: true
          }
        }),
        this.prisma.notification.groupBy({
          by: ["deliveryStatus"],
          _count: {
            deliveryStatus: true
          }
        }),
        this.prisma.notification.count({
          where: {
            status: {
              in: ["PENDING", "SCHEDULED"]
            },
            OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
            AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }]
          }
        }),
        this.prisma.outboxEvent.groupBy({
          by: ["status"],
          _count: {
            status: true
          }
        }),
        this.prisma.outboxEvent.count({
          where: {
            status: "PENDING",
            availableAt: {
              lte: now
            }
          }
        }),
        this.prisma.notificationDeliveryAttempt.groupBy({
          by: ["status"],
          _count: {
            status: true
          }
        }),
        this.prisma.notificationProviderCallback.count(),
        this.prisma.notificationProviderCallback.groupBy({
          by: ["eventStatus"],
          _count: {
            eventStatus: true
          }
        }),
        this.prisma.outboxEvent.groupBy({
          by: ["status"],
          where: {
            eventType: NOTIFICATION_REQUESTED,
            availableAt: {
              lte: now
            }
          },
          _count: {
            status: true
          }
        }),
        this.prisma.outboxEvent.findFirst({
          where: {
            eventType: NOTIFICATION_REQUESTED,
            status: "PENDING",
            availableAt: {
              lte: now
            }
          },
          orderBy: [{ createdAt: "asc" }],
          select: {
            createdAt: true
          }
        })
      ]);

      for (const row of byStatus) {
        lines.push(
          `gestschool_notifications_total{status="${this.escapeLabel(row.status)}"} ${row._count.status}`
        );
      }

      for (const row of byDelivery) {
        lines.push(
          `gestschool_notifications_delivery_total{delivery_status="${this.escapeLabel(
            row.deliveryStatus
          )}"} ${row._count.deliveryStatus}`
        );
      }

      lines.push(`gestschool_notifications_queue_due_total ${queueDue}`);
      for (const row of outboxByStatus) {
        lines.push(
          `gestschool_outbox_events_total{status="${this.escapeLabel(row.status)}"} ${row._count.status}`
        );
      }
      lines.push(`gestschool_outbox_events_due_total ${outboxDue}`);
      for (const row of notificationAttemptByStatus) {
        lines.push(
          `gestschool_notification_delivery_attempts_total{status="${this.escapeLabel(
            row.status
          )}"} ${row._count.status}`
        );
      }
      lines.push(`gestschool_notification_provider_callbacks_total ${notificationCallbackCount}`);
      for (const row of notificationCallbackByStatus) {
        lines.push(
          `gestschool_notification_provider_callbacks_total{event_status="${this.escapeLabel(
            row.eventStatus
          )}"} ${row._count.eventStatus}`
        );
      }
      const notificationOutboxLagSeconds = oldestNotificationRequest
        ? Math.max(0, (now.getTime() - oldestNotificationRequest.createdAt.getTime()) / 1000)
        : 0;
      let notificationRequestOutboxDue = 0;
      const notificationRequestOutboxTotals = new Map(
        notificationRequestOutboxByStatus.map((row) => [row.status, row._count.status])
      );
      for (const status of ["PENDING", "PROCESSING", "FAILED", "PROCESSED"]) {
        const count = notificationRequestOutboxTotals.get(status) ?? 0;
        if (status === "PENDING") {
          notificationRequestOutboxDue = count;
        }
        lines.push(
          `gestschool_notification_requests_outbox_total{status="${this.escapeLabel(
            status
          )}"} ${count}`
        );
      }
      lines.push(`gestschool_notification_requests_outbox_due_total ${notificationRequestOutboxDue}`);
      lines.push(
        `gestschool_notification_requests_outbox_lag_seconds_max ${notificationOutboxLagSeconds.toFixed(
          2
        )}`
      );

      const requestMetrics = this.requestMetrics.snapshot();
      for (const row of requestMetrics.total) {
        lines.push(
          `gestschool_http_requests_total{method="${this.escapeLabel(
            row.method
          )}",route="${this.escapeLabel(row.route)}",status_code="${row.statusCode}"} ${row.count}`
        );
      }
      for (const row of requestMetrics.duration) {
        lines.push(
          `gestschool_http_request_duration_ms_sum{method="${this.escapeLabel(
            row.method
          )}",route="${this.escapeLabel(row.route)}",status_code="${row.statusCode}"} ${row.totalMs}`
        );
        lines.push(
          `gestschool_http_request_duration_ms_max{method="${this.escapeLabel(
            row.method
          )}",route="${this.escapeLabel(row.route)}",status_code="${row.statusCode}"} ${row.maxMs}`
        );
      }
      lines.push("gestschool_metrics_collection_error 0");
    } catch {
      lines.push("gestschool_metrics_collection_error 1");
    }

    return `${lines.join("\n")}\n`;
  }

  @Public()
  @Get("providers")
  @RateLimit({ bucket: "monitoring-provider-checks", max: 30, windowMs: 60_000 })
  @ApiOperation({ summary: "Provider configuration checks without exposing secrets" })
  providerChecks(@Headers("x-metrics-token") tokenHeader?: string): Record<string, unknown> {
    this.assertMetricsToken(tokenHeader);

    const storageProvider = this.providerValue("STORAGE_PROVIDER", "FILE_STORAGE_DRIVER", "LOCAL");
    const emailProvider = this.providerValue(
      "NOTIFICATIONS_EMAIL_PROVIDER",
      "NOTIFY_EMAIL_PROVIDER",
      "MOCK"
    );
    const smsProvider = this.providerValue(
      "NOTIFICATIONS_SMS_PROVIDER",
      "NOTIFY_SMS_PROVIDER",
      "MOCK"
    );
    const paymentProvider = this.configService.get<string>("PAYMENT_PROVIDER", "mock").trim().toLowerCase();
    const paydunyaMode = this.configService.get<string>("PAYDUNYA_MODE", "sandbox").trim().toLowerCase();
    const smsDryRun = this.resolveSmsDryRun();

    return {
      generatedAt: new Date().toISOString(),
      renderFreeMode: {
        inProcessOutboxEnabled: this.booleanConfig("OUTBOX_IN_PROCESS_ENABLED", false),
        notificationWorkerEnabled: this.booleanConfig("NOTIFICATIONS_WORKER_ENABLED", false),
        batchSize: this.numberConfig("OUTBOX_BATCH_SIZE", 10)
      },
      storage: {
        provider: storageProvider,
        enabled: storageProvider === "SUPABASE",
        required: {
          SUPABASE_URL: this.hasConfig("SUPABASE_URL"),
          SUPABASE_SERVICE_ROLE_KEY: this.hasConfig("SUPABASE_SERVICE_ROLE_KEY"),
          SUPABASE_STORAGE_BUCKET_DOCUMENTS: this.hasConfig("SUPABASE_STORAGE_BUCKET_DOCUMENTS"),
          SUPABASE_STORAGE_BUCKET_RECEIPTS: this.hasConfig("SUPABASE_STORAGE_BUCKET_RECEIPTS"),
          SUPABASE_STORAGE_BUCKET_REPORT_CARDS: this.hasConfig("SUPABASE_STORAGE_BUCKET_REPORT_CARDS"),
          SUPABASE_STORAGE_BUCKET_AVATARS: this.hasConfig("SUPABASE_STORAGE_BUCKET_AVATARS")
        }
      },
      notifications: {
        email: {
          provider: emailProvider,
          enabled: emailProvider === "BREVO",
          required: {
            BREVO_API_KEY: this.hasConfig("BREVO_API_KEY"),
            BREVO_SENDER_EMAIL: this.hasConfig("BREVO_SENDER_EMAIL"),
            BREVO_SENDER_NAME: this.hasConfig("BREVO_SENDER_NAME")
          },
          testEmailConfigured: this.hasConfig("NOTIFICATION_TEST_EMAIL")
        },
        sms: {
          provider: smsProvider,
          enabled: smsProvider === "BREVO",
          dryRun: smsDryRun,
          realSmsAllowed: !smsDryRun,
          required: {
            BREVO_API_KEY: this.hasConfig("BREVO_API_KEY"),
            BREVO_SMS_SENDER: this.hasConfig("BREVO_SMS_SENDER")
          },
          testPhoneConfigured: this.hasConfig("NOTIFICATION_TEST_PHONE")
        }
      },
      payments: {
        provider: paymentProvider.toUpperCase(),
        enabled: paymentProvider === "paydunya",
        mode: paydunyaMode,
        sandboxOnly: paydunyaMode === "sandbox",
        required: {
          PAYDUNYA_MASTER_KEY: this.hasConfig("PAYDUNYA_MASTER_KEY"),
          PAYDUNYA_PUBLIC_KEY: this.hasConfig("PAYDUNYA_PUBLIC_KEY"),
          PAYDUNYA_PRIVATE_KEY: this.hasConfig("PAYDUNYA_PRIVATE_KEY"),
          PAYDUNYA_TOKEN: this.hasConfig("PAYDUNYA_TOKEN"),
          PAYDUNYA_CALLBACK_URL: this.hasConfig("PAYDUNYA_CALLBACK_URL"),
          PAYDUNYA_RETURN_URL: this.hasConfig("PAYDUNYA_RETURN_URL"),
          PAYDUNYA_CANCEL_URL: this.hasConfig("PAYDUNYA_CANCEL_URL")
        }
      }
    };
  }

  private assertMetricsToken(tokenHeader?: string): void {
    const expectedToken = this.configService.get<string>("MONITORING_METRICS_TOKEN", "").trim();
    const nodeEnv = this.configService.get<string>("NODE_ENV", "development").trim().toLowerCase();
    if (!expectedToken) {
      if (nodeEnv === "production") {
        throw new ForbiddenException("Metrics endpoint is disabled.");
      }
      return;
    }
    if (!tokenHeader || tokenHeader.trim() !== expectedToken) {
      throw new ForbiddenException("Invalid metrics token.");
    }
  }

  private providerValue(primaryKey: string, fallbackKey: string, fallback: string): string {
    return this.configService
      .get<string>(primaryKey, this.configService.get<string>(fallbackKey, fallback))
      .trim()
      .toUpperCase();
  }

  private hasConfig(key: string): boolean {
    return this.configService.get<string>(key, "").trim().length > 0;
  }

  private booleanConfig(key: string, fallback: boolean): boolean {
    const value = this.configService.get<string>(key, fallback ? "true" : "false").trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes";
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key, String(fallback)));
    return Number.isFinite(value) ? value : fallback;
  }

  private resolveSmsDryRun(): boolean {
    const allowRealSms = this.configService.get<string>("ALLOW_REAL_SMS", "false").trim().toLowerCase();
    if (allowRealSms !== "true") {
      return true;
    }

    const dryRun = this.configService
      .get<string>(
        "BREVO_SMS_DRY_RUN",
        this.configService.get<string>("NOTIFICATIONS_SMS_DRY_RUN", "true")
      )
      .trim()
      .toLowerCase();
    return dryRun !== "false";
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}
