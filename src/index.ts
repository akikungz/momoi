import { Elysia, type AnyElysia } from "elysia";
import { api } from "./api";
import { env } from "./env";
import { logger } from "./logger";

// Create root app that mounts both auth and api
const app = new Elysia()
  .use(api);

app.listen(env.PORT, ({ port, hostname }) => {
  logger.info(`🚀 Server running at http://${hostname || "localhost"}:${port}/api`);
});
