import { Elysia } from "elysia";

import { AuthMacro } from "@momoi/auth";
import { CacheModule } from "@momoi/cache";
import { PrismaClient } from "@momoi/database";
import { storageFilesRoute } from "./storage/files";
import { storageVersionsRoute } from "./storage/versions";
import { storagePermissionsRoute } from "./storage/permissions";

export const storageRoute = (
  prisma: PrismaClient,
  cache: CacheModule,
  auth: AuthMacro
) => new Elysia({ name: "storage.route", prefix: "/storage" })
  .use(storageFilesRoute(prisma, cache, auth))
  .use(storageVersionsRoute(prisma, cache, auth))
  .use(storagePermissionsRoute(prisma, cache, auth));
