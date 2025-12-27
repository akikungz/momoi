import { api } from "./api";
import { env } from "./env";

api.listen(env.PORT, ({ port }) => {
  console.log(`🚀 Server running at http://localhost:${port}/api`);
});
