import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import pino, { type Logger, type LoggerOptions, transport } from "pino";
import { Counter, Histogram } from "prom-client";
import { metricsRegistry } from "@momoi/metrics/registry";

// ============================================================================
// Log Metrics for Prometheus
// ============================================================================

/**
 * Counter for total log entries by level
 */
export const logEntriesTotal = new Counter({
  name: "log_entries_total",
  help: "Total number of log entries by level",
  labelNames: ["level", "service"],
  registers: [metricsRegistry],
});

/**
 * Counter for error logs with additional context
 */
export const logErrorsTotal = new Counter({
  name: "log_errors_total",
  help: "Total number of error log entries",
  labelNames: ["level", "service", "error_type"],
  registers: [metricsRegistry],
});

/**
 * Histogram for log processing duration
 */
export const logProcessingDuration = new Histogram({
  name: "log_processing_duration_seconds",
  help: "Time taken to process and ship logs",
  labelNames: ["transport", "level"],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [metricsRegistry],
});

// ============================================================================
// Environment Configuration
// ============================================================================

interface LogConfig {
  level: string;
  format: "json" | "plain";
  pretty: boolean;
  serviceName: string;
  lokiUrl?: string;
  lokiLabels?: Record<string, string>;
}

function getLogConfig(): LogConfig {
  return {
    level: process.env.LOG_LEVEL || "info",
    format: (process.env.LOG_FORMAT as "json" | "plain") || "json",
    pretty: process.env.LOG_PRETTY === "true",
    serviceName: process.env.OTEL_SERVICE_NAME || "momoi",
    lokiUrl: process.env.LOKI_URL,
    lokiLabels: {
      app: process.env.OTEL_SERVICE_NAME || "momoi",
      env: process.env.NODE_ENV || "development",
    },
  };
}

const config = getLogConfig();

// ============================================================================
// Transport Configuration
// ============================================================================

/**
 * Build pino transports based on configuration
 */
function buildTransports() {
  const targets: pino.TransportTargetOptions[] = [];

  // Always add console transport
  if (config.pretty && process.env.NODE_ENV !== "production") {
    targets.push({
      target: "pino-pretty",
      level: config.level,
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    });
  } else {
    targets.push({
      target: "pino/file",
      level: config.level,
      options: { destination: 1 }, // stdout
    });
  }

  // Add Loki transport if configured
  if (config.lokiUrl) {
    targets.push({
      target: "pino-loki",
      level: config.level,
      options: {
        host: config.lokiUrl,
        labels: config.lokiLabels,
        batching: true,
        interval: 5, // seconds
        replaceTimestamp: false,
        // Include trace context in Loki labels for correlation
        propsToLabels: ["traceId", "spanId", "level"],
      },
    });
  }

  return targets;
}

// ============================================================================
// OpenTelemetry Integration
// ============================================================================

/**
 * Get current OpenTelemetry trace context
 */
function getTraceContext(): {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
} {
  const activeSpan = trace.getSpan(context.active());
  if (!activeSpan) return {};

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

/**
 * Add span event for log entries (for trace correlation in observability tools)
 */
function addLogToSpan(level: string, msg: string, extra?: object) {
  const activeSpan = trace.getSpan(context.active());
  if (!activeSpan) return;

  activeSpan.addEvent("log", {
    "log.level": level,
    "log.message": msg,
    ...extra,
  });

  // Mark span as error if log level is error or fatal
  if (level === "error" || level === "fatal") {
    activeSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: msg,
    });
  }
}

// ============================================================================
// Custom Logger with Metrics Integration
// ============================================================================

/**
 * Create a custom pino logger with integrated metrics and telemetry
 */
function createLogger(): Logger {
  const targets = buildTransports();

  const loggerOptions: LoggerOptions = {
    level: config.level,
    base: {
      service: config.serviceName,
      env: process.env.NODE_ENV || "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      // Inject trace context into every log entry
      log: (object) => {
        const traceContext = getTraceContext();
        return {
          ...object,
          ...traceContext,
        };
      },
    },
    // Custom serializers for common objects
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers?.host,
          "user-agent": req.headers?.["user-agent"],
          "x-request-id": req.headers?.["x-request-id"],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
    // Hook to increment metrics on each log entry
    hooks: {
      logMethod(inputArgs, method, level) {
        const levelLabel = pino.levels.labels[level] || "unknown";

        // Increment log metrics
        logEntriesTotal.labels(levelLabel, config.serviceName).inc();

        // Track error types
        if (levelLabel === "error" || levelLabel === "fatal") {
          const firstArg = inputArgs[0] as Record<string, unknown> | undefined;
          const errorType =
            typeof firstArg === "object" &&
              firstArg !== null &&
              "err" in firstArg &&
              typeof firstArg.err === "object" &&
              firstArg.err !== null &&
              "name" in firstArg.err
              ? String(firstArg.err.name)
              : "UnknownError";
          logErrorsTotal
            .labels(levelLabel, config.serviceName, errorType)
            .inc();
        }

        // Add log to active span for trace correlation
        const msg =
          typeof inputArgs[0] === "string"
            ? inputArgs[0]
            : typeof inputArgs[1] === "string"
              ? inputArgs[1]
              : "";
        const extra =
          typeof inputArgs[0] === "object" && inputArgs[0] !== null
            ? (inputArgs[0] as Record<string, unknown>)
            : undefined;
        addLogToSpan(levelLabel, msg, extra);

        return method.apply(this, inputArgs);
      },
    },
  };

  // In test environment, use minimal logging
  if (process.env.NODE_ENV === "test") {
    return pino({
      ...loggerOptions,
      level: "silent",
    });
  }

  // Create transport if we have targets
  if (targets.length > 0) {
    const pinoTransport = transport({
      targets,
    });
    return pino(loggerOptions, pinoTransport);
  }

  return pino(loggerOptions);
}

// ============================================================================
// Exported Logger and Utilities
// ============================================================================

export const logger = createLogger();

/**
 * Create a child logger with additional context
 * Useful for request-scoped logging
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

/**
 * Create a request-scoped logger with trace context and request ID
 */
export function createRequestLogger(
  requestId: string,
  additionalContext?: Record<string, unknown>
): Logger {
  const traceContext = getTraceContext();
  return logger.child({
    requestId,
    ...traceContext,
    ...additionalContext,
  });
}

/**
 * Log with explicit trace context (useful for async operations)
 */
export function logWithTrace(
  level: pino.Level,
  msg: string,
  extra?: Record<string, unknown>
) {
  const traceContext = getTraceContext();
  logger[level]({ ...extra, ...traceContext }, msg);
}

/**
 * Utility to measure and log operation duration
 */
export function measureOperation<T>(
  operationName: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now();
  const result = fn();

  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - start;
      logger.debug(
        { operation: operationName, durationMs: duration.toFixed(2) },
        `Operation completed: ${operationName}`
      );
    });
  }

  const duration = performance.now() - start;
  logger.debug(
    { operation: operationName, durationMs: duration.toFixed(2) },
    `Operation completed: ${operationName}`
  );
  return result;
}

// Export types
export type { Logger } from "pino";
