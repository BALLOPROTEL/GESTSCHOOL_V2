import { Injectable } from "@nestjs/common";

type RequestMetricSnapshot = {
  total: Array<{
    method: string;
    route: string;
    statusCode: number;
    count: number;
  }>;
  duration: Array<{
    method: string;
    route: string;
    statusCode: number;
    count: number;
    totalMs: number;
    maxMs: number;
  }>;
  operations: Array<{
    operation: string;
    result: string;
    count: number;
  }>;
};

type Aggregate = {
  count: number;
  totalMs: number;
  maxMs: number;
};

@Injectable()
export class RequestMetricsService {
  private readonly aggregates = new Map<string, Aggregate>();
  private readonly operations = new Map<string, number>();

  recordRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    const key = this.keyOf(input.method, input.route, input.statusCode);
    const current = this.aggregates.get(key) || { count: 0, totalMs: 0, maxMs: 0 };

    current.count += 1;
    current.totalMs += input.durationMs;
    current.maxMs = Math.max(current.maxMs, input.durationMs);
    this.aggregates.set(key, current);
  }

  recordOperation(operation: string, result: string): void {
    const key = `${this.safeLabel(operation)}|${this.safeLabel(result)}`;
    this.operations.set(key, (this.operations.get(key) || 0) + 1);
  }

  normalizeRoute(route: string): string {
    const path = (route || "unknown").split("?")[0].slice(0, 180);
    return path
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
      .replace(/\/\d+(?=\/|$)/g, "/:id");
  }

  snapshot(): RequestMetricSnapshot {
    const total: RequestMetricSnapshot["total"] = [];
    const duration: RequestMetricSnapshot["duration"] = [];

    for (const [key, aggregate] of this.aggregates.entries()) {
      const [method, route, rawStatusCode] = key.split("|");
      const statusCode = Number(rawStatusCode);

      total.push({
        method,
        route,
        statusCode,
        count: aggregate.count
      });
      duration.push({
        method,
        route,
        statusCode,
        count: aggregate.count,
        totalMs: Number(aggregate.totalMs.toFixed(2)),
        maxMs: Number(aggregate.maxMs.toFixed(2))
      });
    }

    const operations = [...this.operations.entries()].map(([key, count]) => {
      const [operation, result] = key.split("|");
      return { operation, result, count };
    });

    return { total, duration, operations };
  }

  private keyOf(method: string, route: string, statusCode: number): string {
    return [method.toUpperCase(), this.normalizeRoute(route), statusCode].join("|");
  }

  private safeLabel(value: string): string {
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9_.-]{1,64}$/.test(normalized) ? normalized : "invalid";
  }
}
