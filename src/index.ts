import { Elysia } from "elysia";
import { env } from "./env";
import {
  emitLog,
  getErrorDetails,
  handleTelemetryRuntimeError,
  SeverityNumber,
  shutdownTelemetry,
  startTelemetry,
  telemetryInfo,
} from "./telemetry/runtime";

await startTelemetry();

const { api, shutdownApiResources } = await import("./api");

// Create root app that mounts both auth and api
const app = new Elysia()
  .use(api);

app.listen(env.PORT, ({ port, hostname }) => {
  emitLog(SeverityNumber.INFO, "INFO", "HTTP server started", {
    "server.address": hostname || "localhost",
    "server.port": port,
    "service.endpoint": `http://${hostname || "localhost"}:${port}/api`,
    "telemetry.endpoint": telemetryInfo.endpoint,
  });

  console.log(`Server is running at http://${hostname || "localhost"}:${port}/api`);
});

let isShuttingDown = false;

async function gracefulShutdown(reason: string, exitCode: number = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  emitLog(SeverityNumber.WARN, "WARN", "Graceful shutdown started", { reason });

  const forceExitTimeout = setTimeout(() => {
    emitLog(SeverityNumber.ERROR, "ERROR", "Graceful shutdown timed out", { reason });
    process.exit(1);
  }, 15_000);

  try {
    await app.stop();
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    emitLog(SeverityNumber.ERROR, "ERROR", "Failed to stop HTTP server cleanly", {
      reason,
      "error.message": errorDetails.message,
      "error.name": errorDetails.name,
      ...(errorDetails.stack ? { "error.stack": errorDetails.stack } : {}),
    });
  }

  const cleanupResults = await shutdownApiResources();

  if (cleanupResults.queue.status === "rejected") {
    const errorDetails = getErrorDetails(cleanupResults.queue.reason);
    emitLog(SeverityNumber.ERROR, "ERROR", "Failed to close queue connections", {
      "error.message": errorDetails.message,
      "error.name": errorDetails.name,
      ...(errorDetails.stack ? { "error.stack": errorDetails.stack } : {}),
    });
  }

  if (cleanupResults.cache.status === "rejected") {
    const errorDetails = getErrorDetails(cleanupResults.cache.reason);
    emitLog(SeverityNumber.ERROR, "ERROR", "Failed to close cache connection", {
      "error.message": errorDetails.message,
      "error.name": errorDetails.name,
      ...(errorDetails.stack ? { "error.stack": errorDetails.stack } : {}),
    });
  }

  if (cleanupResults.prisma.status === "rejected") {
    const errorDetails = getErrorDetails(cleanupResults.prisma.reason);
    emitLog(SeverityNumber.ERROR, "ERROR", "Failed to disconnect Prisma client", {
      "error.message": errorDetails.message,
      "error.name": errorDetails.name,
      ...(errorDetails.stack ? { "error.stack": errorDetails.stack } : {}),
    });
  }

  emitLog(SeverityNumber.INFO, "INFO", "Graceful shutdown completed", { reason });

  try {
    await shutdownTelemetry();
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    console.error("Failed to flush telemetry during shutdown", errorDetails);
  }

  clearTimeout(forceExitTimeout);
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  void (async () => {
    if (await handleTelemetryRuntimeError(error)) {
      return;
    }

    const errorDetails = getErrorDetails(error);
    emitLog(SeverityNumber.ERROR, "ERROR", "Uncaught exception", {
      "error.message": errorDetails.message,
      "error.name": errorDetails.name,
      ...(errorDetails.stack ? { "error.stack": errorDetails.stack } : {}),
    });
    void gracefulShutdown("uncaughtException", 1);
  })();
});

process.on("unhandledRejection", (reason) => {
  void (async () => {
    if (await handleTelemetryRuntimeError(reason)) {
      return;
    }

    const errorDetails = getErrorDetails(reason);
    emitLog(SeverityNumber.ERROR, "ERROR", "Unhandled rejection", {
      "error.message": errorDetails.message,
      "error.name": errorDetails.name,
      ...(errorDetails.stack ? { "error.stack": errorDetails.stack } : {}),
    });
    void gracefulShutdown("unhandledRejection", 1);
  })();
});
