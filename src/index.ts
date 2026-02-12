import { Elysia } from "elysia";
import { api } from "./api";
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
