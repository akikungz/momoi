import { Elysia } from "elysia";

import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { serverTiming } from "@elysiajs/server-timing";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

import { authHandler, authMacro } from "./auth";
import { CacheModule } from "./cache";
import { prisma } from "./database";
import { env } from "./env";
import { academicRoute } from "./routes/academic";
import { instanceRoute } from "./routes/instance";
import { requestRoute } from "./routes/request";
import { userRoute } from "./routes/user";
import { ServiceError } from "./utils/error";

const cache = new CacheModule();

export const api = new Elysia({ name: "momoi.api", prefix: "/api" })
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
        ]
      },
    })
  )
  .use(
    opentelemetry({
      serviceName: env.OTEL_SERVICE_NAME,
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
    })
  )
  .onError(({ error, status }) => {
    if (error instanceof ServiceError) {
      return status(error.status, { status: error.status, message: error.message });
    }

    if (error instanceof Error) {
      return status(500, { status: 500, message: error.message });
    }

    return status(500, { status: 500, message: 'An unexpected error occurred.' });
  })
  .use(authHandler)
  .use(userRoute(prisma, cache, authMacro))
  .use(instanceRoute(prisma, cache, authMacro))
  .use(academicRoute(prisma, cache, authMacro))
  .use(requestRoute(prisma, cache, authMacro));

export type Api = typeof api;
