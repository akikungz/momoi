import type { CacheModule } from "@momoi/cache";

import type { JsonCacheStore } from "../application/ports";

export class CacheJsonStore implements JsonCacheStore {
	constructor(private readonly cache: CacheModule) {}

	async get<T>(key: string): Promise<T | null> {
		const cached = await this.cache.getCacheValue(key);
		if (!cached) return null;
		return JSON.parse(cached) as T;
	}

	async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
		await this.cache.createCacheKey(key, JSON.stringify(value), ttlSeconds);
	}
}
