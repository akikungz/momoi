import { app } from './app';
import { env } from './env';

app.listen(env.PORT, ({ port }) => {
  console.log(`🚀 Server running at http://localhost:${port}/api`);
});
