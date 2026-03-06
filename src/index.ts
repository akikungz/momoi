import { Elysia } from "elysia";
import { api, shutdownApiResources } from "./api";
import { env } from "./env";
import { logger } from "./logger";
import { metricsPlugin } from "./metrics";

// Create root app that mounts both auth and api
const app = new Elysia()
  .use(metricsPlugin)
  .use(api);

app.listen(env.PORT, ({ port, hostname }) => {
  logger.info(`🚀 Server running at http://${hostname || "localhost"}:${port}/api`);
});

let isShuttingDown = false;

async function gracefulShutdown(reason: string, exitCode: number = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.warn({ reason }, "Graceful shutdown started");

  const forceExitTimeout = setTimeout(() => {
    logger.error({ reason }, "Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 15_000);

  try {
    await app.stop();
  } catch (error) {
    logger.error({ err: error }, "Failed to stop HTTP server cleanly");
  }

  const cleanupResults = await shutdownApiResources();

  if (cleanupResults.queue.status === "rejected") {
    logger.error({ err: cleanupResults.queue.reason }, "Failed to close queue connections");
  }

  if (cleanupResults.cache.status === "rejected") {
    logger.error({ err: cleanupResults.cache.reason }, "Failed to close cache connection");
  }

  if (cleanupResults.prisma.status === "rejected") {
    logger.error({ err: cleanupResults.prisma.reason }, "Failed to disconnect Prisma client");
  }

  clearTimeout(forceExitTimeout);

  logger.info({ reason }, "Graceful shutdown completed");
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void gracefulShutdown("uncaughtException", 1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection");
  void gracefulShutdown("unhandledRejection", 1);
});
