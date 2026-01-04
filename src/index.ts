import { Elysia } from "elysia";
import { api } from "./api";
import { auth } from "./auth";
import { env } from "./env";

// Create root app that mounts both auth and api
const app = new Elysia()
  .mount("/api/auth", auth.handler)
  .use(api);

app.listen(env.PORT, ({ port }) => {
  console.log(`🚀 Server running at http://localhost:${port}/api`);
});
