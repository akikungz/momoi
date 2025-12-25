import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";

import { prisma } from "./database";
import { CacheModule } from "./cache";
import { authHandler, authMacro } from "./auth";

import { userRoute } from "./routes/user";
import { instanceRoute } from "./routes/instance";

const cache = new CacheModule();

export const app = new Elysia({ name: "momoi.api", prefix: "/api" })
  .use(openapi({
    documentation: {
      info: {
        title: "Momoi API",
        version: "1.0.0",
        description: "API documentation for Momoi platform."
      }
    }
  }))
  .use(authHandler)
  .use(userRoute(prisma, cache, authMacro))
  .use(instanceRoute(prisma, cache, authMacro));

export type App = typeof app;
