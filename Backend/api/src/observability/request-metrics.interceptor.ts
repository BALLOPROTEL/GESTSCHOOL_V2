import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor
} from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";

import { RequestMetricsService } from "./request-metrics.service";

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestMetricsInterceptor.name);

  constructor(private readonly requestMetrics: RequestMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      requestId?: string;
      route?: { path?: string };
      user?: { tenantId?: string };
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const startedAt = process.hrtime.bigint();
    const route = request.originalUrl || request.route?.path || "unknown";

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        this.requestMetrics.recordRequest({
          method: request.method || "UNKNOWN",
          route,
          statusCode: response.statusCode || 200,
          durationMs
        });
        this.logger.log({
          event: "http_request_completed",
          requestId: request.requestId || "unknown",
          tenantId: this.safeTenantId(request.user?.tenantId),
          method: (request.method || "UNKNOWN").toUpperCase(),
          route: this.requestMetrics.normalizeRoute(route),
          statusCode: response.statusCode || 200,
          durationMs: Number(durationMs.toFixed(2))
        });
      })
    );
  }

  private safeTenantId(value?: string): string | undefined {
    return value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : undefined;
  }
}
