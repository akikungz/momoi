import { Elysia } from "elysia";
import { Counter, Histogram } from "prom-client";
import { metricsRegistry } from "./registry";

// Re-export registry for use in other modules
export { metricsRegistry } from "./registry";

// Re-export business metrics
export * from "./business";

// Custom metrics for HTTP requests
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

export const httpRequestErrors = new Counter({
  name: "http_request_errors_total",
  help: "Total number of HTTP request errors",
  labelNames: ["method", "route", "status_code", "error_type"],
  registers: [metricsRegistry],
});

// Active connections gauge
export const activeConnections = new Counter({
  name: "http_active_connections",
  help: "Number of active HTTP connections",
  registers: [metricsRegistry],
});

/**
 * Elysia plugin that exposes Prometheus metrics endpoint
 * and collects HTTP request metrics
 */
export const metricsPlugin = new Elysia({ name: "momoi.metrics" })
  // Metrics endpoint
  .get("/metrics", async ({ set }) => {
    set.headers["content-type"] = metricsRegistry.contentType;
    return await metricsRegistry.metrics();
  })
  // Collect request metrics using onAfterHandle
  .onAfterHandle(({ request, set, route }) => {
    const method = request.method;
    const statusCode = typeof set.status === "number" ? set.status : 200;
    const routePath = route || "unknown";

    httpRequestTotal.labels(method, routePath, String(statusCode)).inc();
  })
  // Track request duration
  .trace(({ context, onHandle }) => {
    const start = performance.now();

    onHandle(async ({ error }) => {
      const duration = (performance.now() - start) / 1000; // Convert to seconds
      const method = context.request.method;
      const statusCode =
        typeof context.set.status === "number" ? context.set.status : 200;
      const routePath = context.route || "unknown";

      httpRequestDuration
        .labels(method, routePath, String(statusCode))
        .observe(duration);

      const err = await error;
      if (err) {
        const errorType = err instanceof Error ? err.name : "UnknownError";
        httpRequestErrors
          .labels(method, routePath, String(statusCode), errorType)
          .inc();
      }
    });
  });
