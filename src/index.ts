import { Elysia } from "elysia";
import { api } from "./api";
import { env } from "./env";
import { logger } from "./logger";

// Create root app that mounts both auth and api
const app = new Elysia()
  .derive(({ request, set }) => {
    // Manually extract the forwarded proto if you need to 
    // use it for logic outside of Better-Auth
    const protocol = request.headers.get('x-forwarded-proto') || env.BETTER_AUTH_URL?.startsWith('https') ? 'https' : 'http';
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

    return {
      realUrl: `${protocol}://${host}`
    };
  })
  .use(api);

app.listen(env.PORT, ({ port }) => {
  logger.info(`🚀 Server running at http://localhost:${port}/api`);
});
