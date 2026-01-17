import { Elysia, type AnyElysia } from "elysia";
import { api } from "./api";
import { env } from "./env";
import { logger } from "./logger";

// Create root app that mounts both auth and api
const app = new Elysia()
  .derive(({ request }) => {
    // Manually extract the forwarded proto if you need to 
    // use it for logic outside of Better-Auth
    const protocol = request.headers.get('x-forwarded-proto') || env.BETTER_AUTH_URL?.startsWith('https') ? 'https' : 'http';
    logger.info(`Request protocol is ${protocol} but request.url is ${request.url}`);

    if (protocol === "https" && request.url.startsWith("http://")) {
      const httpsURL = request.url.replace("http://", "https://");
      logger.info(`Redirecting to secure URL: ${httpsURL}`);
      request = new Request(httpsURL, request);
    }

    return {
      protocol,
      proto: protocol,
    };
  })
  .use(api);

app.listen(env.PORT, ({ port, hostname }) => {
  logger.info(`🚀 Server running at http://${hostname || "localhost"}:${port}/api`);
});
