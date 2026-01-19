import { Elysia } from "elysia";
import { api } from "./api";
import { env } from "./env";
import { logger } from "./logger";

// Create root app that mounts both auth and api
const app = new Elysia()
  .onBeforeHandle((c) => {
    const proto = c.request.headers.get("x-forwarded-proto");
    if (proto && proto !== "http") {
      const httpsUrl = c.request.url.replace(/^http:/, "https:");
      // Clone the request with the corrected URL
      const fixedReq = new Request(httpsUrl, c.request);
      // Replace the request inside the context for downstream handlers
      c.request = fixedReq;
    }
  })
  .use(api);

app.listen(env.PORT, ({ port, hostname }) => {
  logger.info(`🚀 Server running at http://${hostname || "localhost"}:${port}/api`);
});
