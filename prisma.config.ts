import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./src/database/prisma/schema.prisma",
  migrations: {
    path: "./src/database/prisma/migrations",
  },
});
