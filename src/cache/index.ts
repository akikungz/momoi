import { Redis } from "ioredis";

import { env } from "@momoi/env";
import { setDependencyAvailability } from "../telemetry/runtime";

export class CacheModule {
  public client: Redis | undefined;
  private cacheAvailable = true;
  private availabilityWarningShown = false;

  constructor() {
    if (env.REDIS_URL) {
      this.client = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      this.client.on("error", (error) => {
        this.markUnavailable("Redis cache is unavailable. Continuing without cache.", error);
      });
    }
  }

  private markUnavailable(message: string, error?: unknown) {
    this.cacheAvailable = false;
    setDependencyAvailability("cache", false);

    if (!this.availabilityWarningShown) {
      this.availabilityWarningShown = true;
      console.warn(message, error);
    }
  }

  private async ensureClientReady() {
    if (!this.client || !this.cacheAvailable) {
      return false;
    }

    if (this.client.status === "ready") {
      setDependencyAvailability("cache", true);
      return true;
    }

    try {
      if (this.client.status === "wait") {
        await this.client.connect();
      }

      const ready = String(this.client.status) === "ready";
      setDependencyAvailability("cache", ready);
      return ready;
    } catch (error) {
      this.markUnavailable("Failed to connect to Redis cache. Continuing without cache.", error);
      return false;
    }
  }

  public async disconnect() {
    if (this.client) {
      await this.client.quit();
    }
  }

  public async createCacheKey(key: string, value: string, ttlSeconds: number = 300) {
    if (!(await this.ensureClientReady())) return;

    try {
      await this.client!.set(key, value, "EX", ttlSeconds);
    } catch (error) {
      this.markUnavailable("Failed to write to Redis cache. Continuing without cache.", error);
    }
  }

  public async getCacheValue(key: string): Promise<string | null> {
    if (!(await this.ensureClientReady())) return null;

    try {
      return await this.client!.get(key);
    } catch (error) {
      this.markUnavailable("Failed to read from Redis cache. Continuing without cache.", error);
      return null;
    }
  }

  public async deleteCacheKey(key: string) {
    if (!(await this.ensureClientReady())) return;

    try {
      await this.client!.del(key);
    } catch (error) {
      this.markUnavailable("Failed to delete Redis cache key. Continuing without cache.", error);
    }
  }

  public async deleteCacheByPattern(pattern: string) {
    if (!(await this.ensureClientReady())) return;

    try {
      const stream = this.client!.scanStream({
        match: pattern,
        count: 100,
      });

      stream.on("data", (keys: string[]) => {
        if (keys.length) {
          const pipeline = this.client!.pipeline();
          keys.forEach((key) => {
            pipeline.del(key);
          });
          pipeline.exec().catch((error) => {
            this.markUnavailable("Failed to delete Redis cache keys by pattern. Continuing without cache.", error);
          });
        }
      });

      stream.on("error", (error) => {
        this.markUnavailable("Failed to scan Redis cache keys by pattern. Continuing without cache.", error);
      });
    } catch (error) {
      this.markUnavailable("Failed to invalidate Redis cache by pattern. Continuing without cache.", error);
    }
  }

  public async flushAll() {
    if (!(await this.ensureClientReady())) return;

    try {
      await this.client!.flushall();
    } catch (error) {
      this.markUnavailable("Failed to flush Redis cache. Continuing without cache.", error);
    }
  }

  public async getClient(): Promise<Redis | undefined> {
    return this.client;
  }

  public closeClient(): void {
    if (this.client) {
      this.client.quit();
    }
  }
}
