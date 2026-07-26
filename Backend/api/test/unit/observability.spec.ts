import { lastValueFrom, of } from "rxjs";

import { RequestContextMiddleware } from "../../src/observability/request-context.middleware";
import { RequestMetricsInterceptor } from "../../src/observability/request-metrics.interceptor";
import { RequestMetricsService } from "../../src/observability/request-metrics.service";

describe("observability", () => {
  it("accepts only bounded request IDs safe for structured logs", () => {
    const middleware = new RequestContextMiddleware();
    const response = { setHeader: jest.fn() };
    const request: { header: jest.Mock; requestId?: string } = {
      header: jest.fn().mockReturnValue("unsafe\nforged")
    };

    middleware.use(request, response, jest.fn());

    expect(request).toHaveProperty("requestId");
    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.setHeader).toHaveBeenCalledWith("x-request-id", request.requestId);
  });

  it("normalizes metric routes and records low-cardinality operations", () => {
    const metrics = new RequestMetricsService();
    metrics.recordRequest({
      method: "get",
      route: "/users/123?token=secret",
      statusCode: 200,
      durationMs: 12.5
    });
    metrics.recordOperation("storage_read", "success");

    expect(metrics.snapshot()).toEqual({
      total: [{ method: "GET", route: "/users/:id", statusCode: 200, count: 1 }],
      duration: [
        {
          method: "GET",
          route: "/users/:id",
          statusCode: 200,
          count: 1,
          totalMs: 12.5,
          maxMs: 12.5
        }
      ],
      operations: [{ operation: "storage_read", result: "success", count: 1 }]
    });
  });

  it("logs only a safe request context", async () => {
    const metrics = new RequestMetricsService();
    const interceptor = new RequestMetricsInterceptor(metrics);
    const context = {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => ({
          method: "GET",
          originalUrl:
            "/api/v1/users/00000000-0000-4000-8000-000000000099?secret=value",
          requestId: "request-123",
          user: { tenantId: "not-a-uuid" }
        }),
        getResponse: () => ({ statusCode: 200 })
      })
    };

    await lastValueFrom(interceptor.intercept(context as never, { handle: () => of("ok") }));

    expect(metrics.snapshot().total[0]?.route).toBe("/api/v1/users/:id");
  });
});
