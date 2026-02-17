import { Elysia } from "elysia";

import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { serverTiming } from "@elysiajs/server-timing";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import { authHandler, authMacro, authOpenAPI } from "./auth";
import { CacheModule } from "./cache";
import { prisma } from "./database";
import { env } from "./env";
import { logger } from "./logger";
import { QueueModule } from "./queue";
import { academicRoute } from "./routes/academic";
import { autocompleteRoute } from "./routes/autocomplete";
import { instanceRoute } from "./routes/instance";
import { requestRoute } from "./routes/request";
import { storageRoute } from "./routes/storage";
import { userRoute } from "./routes/user";
import { ServiceError } from "./utils/error";

const cache = new CacheModule();
const queue = new QueueModule();

export const api = new Elysia({
  name: "momoi.api", prefix: "/api", cookie: {
    secure: env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
    sameSite: "lax",
    path: "/",
  }
})
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
  .use(
    opentelemetry({
      serviceName: env.OTEL_SERVICE_NAME,
      instrumentations: [new PgInstrumentation(), new IORedisInstrumentation()],
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
          })
        ),
      ],
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
  .onError(({ error, status }) => {
    if (error instanceof ServiceError) {
      return status(error.status, { status: error.status, message: error.message, data: error.message.startsWith("{") ? JSON.parse(error.message) : undefined });
    }

    if (error instanceof Error) {
      return status(500, { status: 500, message: error.message, data: error.message.startsWith("{") ? JSON.parse(error.message) : undefined });
    }

    return status(500, { status: 500, message: 'An unexpected error occurred.' });
  })
  .trace(({ context, onHandle }) => {
    onHandle(async ({ error, total }) => {
      logger.info({
        timestamp: new Date().toISOString(),
        method: context.request.method,
        route: context.route,
        url: context.request.url,
        status: context.set.status,
        totalTime: `${total} ms`,
        userAgent: context.request.headers.get("user-agent") || "",
      }, "Request handled");

      const err = await error;
      if (err) {
        if (err instanceof Error) {
          logger.error({
            timestamp: new Date().toISOString(),
            method: context.request.method,
            route: context.route,
            url: context.request.url,
            status: context.set.status,
            errorMessage: err.message,
            stack: err.stack,
            userAgent: context.request.headers.get("user-agent") || "",
          }, "Error occurred");

          return;
        }

        logger.error({
          timestamp: new Date().toISOString(),
          method: context.request.method,
          route: context.route,
          url: context.request.url,
          status: context.set.status,
          error: err,
          userAgent: context.request.headers.get("user-agent") || "",
        }, "Unknown error occurred");
      }
    });
  })
  .use(authHandler)
  .use(userRoute(prisma, cache, authMacro))
  .use(instanceRoute(prisma, cache, authMacro, queue))
  .use(academicRoute(prisma, cache, authMacro))
  .use(requestRoute(prisma, cache, authMacro, queue))
  .use(storageRoute(prisma, authMacro))
  .use(autocompleteRoute(prisma, cache, authMacro));

export type Api = typeof api;
