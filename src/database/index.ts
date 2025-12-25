import { PrismaLibSql } from "@prisma/adapter-libsql";

import { env } from "@momoi/env";

import { PrismaClient } from "./prisma/generated/client";

/**
 * Main Prisma client instance for the application.
 * 
 * For testing, use the mock utilities from "@momoi/database/test" instead.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: env.POSTGRES_URL,
  })
});

/**
 * Create a new Prisma client instance.
 * Useful for testing or when you need a separate connection.
 */
export function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaLibSql({
      url: env.POSTGRES_URL,
    })
  });
}

// Re-export Prisma types for convenience
export type { PrismaClient } from "./prisma/generated/client";
export * from "./prisma/generated/enums";
