import { env } from "@momoi/env";
import { Redis } from "ioredis";

export class CacheModule {
  public client: Redis | undefined;

  constructor() {
    if (env.REDIS_URL) {
      this.client = new Redis(env.REDIS_URL);
    }
  }

  public async disconnect() {
    if (this.client) {
      await this.client.quit();
    }
  }

  public async createCacheKey(key: string, value: string, ttlSeconds: number = 300) {
    if (!this.client) return;

    await this.client.set(key, value, "EX", ttlSeconds);
  }

  public async getCacheValue(key: string): Promise<string | null> {
    if (!this.client) return null;

    return this.client.get(key);
  }

  public async deleteCacheKey(key: string) {
    if (!this.client) return;

    await this.client.del(key);
  }
}