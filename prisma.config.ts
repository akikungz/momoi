import { defineConfig } from "prisma/config";

import { env } from "@momoi/env";

export default defineConfig({
  schema: "./src/database/prisma/schema.prisma",
  migrations: {
    path: "./src/database/prisma/migrations",
  },
  datasource: {
    url: env.DATABASE_URL,
  }
});
