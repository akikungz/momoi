import { Elysia } from "elysia";
import { api } from "./api";
import { env } from "./env";

// Create root app that mounts both auth and api
const app = new Elysia()
  .use(api);

app.listen(env.PORT, ({ port }) => {
  console.log(`🚀 Server running at http://localhost:${port}/api`);
});
