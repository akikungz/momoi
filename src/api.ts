import { Elysia } from "elysia";

import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { serverTiming } from "@elysiajs/server-timing";

import { authHandler, authMacro, authOpenAPI } from "./auth";
import { CacheModule } from "./cache";
import { prisma } from "./database";
import { env } from "./env";
import { QueueModule } from "./queue";
import { academicRoute } from "./routes/academic";
import { autocompleteRoute } from "./routes/autocomplete";
import { instanceRoute } from "./routes/instance";
import { requestRoute } from "./routes/request";
import { storageRoute } from "./routes/storage";
import { createObjectStorageProvider } from "./storage-provider";
import {
  createTelemetryPlugin,
  emitLog,
  getErrorDetails,
  httpMetrics,
  SeverityNumber,
} from "./telemetry/runtime";
import { userRoute } from "./routes/user";
import { ServiceError } from "./utils/error";

const cache = new CacheModule();
const queue = new QueueModule();
const objectStorage = createObjectStorageProvider();
const requestTelemetry = new WeakMap<
  Request,
  {
    requestStartedAt: number;
    metricAttributes: {
      "http.request.method": string;
      "url.path": string;
    };
  }
>();

const getStatusCode = (status: unknown) =>
  typeof status === "number" ? status : 200;

const getMetricPath = (request: Request, path?: string) => {
  if (path && path.length > 0) {
    return path;
  }

  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
};

export async function shutdownApiResources() {
  const results = await Promise.allSettled([
    queue.closeConnections(),
    cache.disconnect(),
    prisma.$disconnect(),
  ]);

  return {
    queue: results[0],
    cache: results[1],
    prisma: results[2],
  };
}

export const api = new Elysia({
  name: "momoi.api", prefix: "/api", cookie: {
    secure: env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
    sameSite: "lax",
    path: "/",
  }
})
  .use(createTelemetryPlugin())
  .use(
    openapi({
      documentation: {
        info: {
          title: "Momoi API",
          version: "1.0.0",
          description: "API documentation for Momoi platform.",
        },
        tags: [
          { name: "User", description: "User related endpoints" },
          { name: "SSH Keys", description: "Endpoints for managing SSH keys" },
          { name: "Instances", description: "Instance management endpoints" },
          { name: "Academic", description: "Academic related endpoints" },
          { name: "Mailing List", description: "Endpoints for managing mailing lists" },
          { name: "Requests", description: "Instance request management endpoints" },
          { name: "Extended Requests", description: "Extended instance request management endpoints" },
          { name: "Reverse Proxy", description: "Endpoints for managing instance reverse proxies" },
          { name: "Audit Logs", description: "Endpoints for viewing audit history" },
          { name: "Storage", description: "File and folder management endpoints" },
          { name: "File Versions", description: "File versioning endpoints" },
          { name: "File Permissions", description: "File sharing and permission endpoints" },
          { name: "Autocomplete", description: "Autocomplete options for dropdown selections" },
        ],
        ...await authOpenAPI()
      },
    })
  )
  .use(serverTiming())
  .use(
    cors({
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      origin: env.ALLOW_CORS_ORIGINS,
      credentials: true,
      allowedHeaders: ["*"]
    })
  )
  .onRequest(({ request }) => {
    const requestStartedAt = performance.now();
    const metricAttributes = {
      "http.request.method": request.method,
      "url.path": getMetricPath(request),
    };

    requestTelemetry.set(request, {
      requestStartedAt,
      metricAttributes,
    });
    httpMetrics.activeRequests.add(1, metricAttributes);
    emitLog(SeverityNumber.INFO, "INFO", "HTTP request started", metricAttributes);
  })
  .onAfterResponse(({ request, path, set }) => {
    const telemetryState = requestTelemetry.get(request);
    const metricAttributes = telemetryState?.metricAttributes ?? {
      "http.request.method": request.method,
      "url.path": getMetricPath(request, path),
    };
    const requestStartedAt = telemetryState?.requestStartedAt ?? performance.now();
    const durationMs = performance.now() - requestStartedAt;
    const statusCode = getStatusCode(set.status);
    const attributes = {
      ...metricAttributes,
      "http.response.status_code": statusCode,
      "otel.status_code": statusCode >= 500 ? "ERROR" : "OK",
    };
    const routePath = getMetricPath(request, path);

    requestTelemetry.delete(request);

    httpMetrics.recordResult(durationMs, statusCode, metricAttributes);
    httpMetrics.activeRequests.add(-1, metricAttributes);

    emitLog(
      statusCode >= 500 ? SeverityNumber.ERROR : SeverityNumber.INFO,
      statusCode >= 500 ? "ERROR" : "INFO",
      "HTTP request completed",
      {
        ...attributes,
        "http.request.duration_ms": Number(durationMs.toFixed(2)),
        "http.route": routePath,
      }
    );
  })
  .onError(({ error, status }) => {
    const errorDetails = getErrorDetails(error);

    emitLog(SeverityNumber.ERROR, "ERROR", "HTTP request failed", {
      "error.message": errorDetails.message,
      "error.name": errorDetails.name,
      ...(errorDetails.stack ? { "error.stack": errorDetails.stack } : {}),
    });

    if (error instanceof ServiceError) {
      return status(error.status, { status: error.status, message: error.message, data: error.message.startsWith("{") ? JSON.parse(error.message) : undefined });
    }

    if (error instanceof Error) {
      return status(500, { status: 500, message: error.message, data: error.message.startsWith("{") ? JSON.parse(error.message) : undefined });
    }

    return status(500, { status: 500, message: 'An unexpected error occurred.' });
  })
  .use(authHandler)
  .use(userRoute(prisma, cache, authMacro))
  .use(instanceRoute(prisma, cache, authMacro, queue))
  .use(academicRoute(prisma, cache, authMacro))
  .use(requestRoute(prisma, cache, authMacro, queue))
  .use(storageRoute(prisma, cache, authMacro, objectStorage))
  .use(autocompleteRoute(prisma, cache, authMacro));

export type Api = typeof api;
