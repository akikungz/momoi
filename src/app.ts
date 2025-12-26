import { Elysia } from 'elysia';

import { openapi } from '@elysiajs/openapi';

import { authHandler, authMacro } from './auth';
import { CacheModule } from './cache';
import { prisma } from './database';
import { academicRoute } from './routes/academic';
import { instanceRoute } from './routes/instance';
import { requestRoute } from './routes/request';
import { userRoute } from './routes/user';

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
  .use(instanceRoute(prisma, cache, authMacro))
  .use(academicRoute(prisma, cache, authMacro))
  .use(requestRoute(prisma, cache, authMacro));

export type App = typeof app;
