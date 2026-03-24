import { mock } from "bun:test";

export class MockCache {
	getCacheValue = mock(async (_key: string): Promise<string | null> => null);
	createCacheKey = mock(
		async (_key: string, _value: string, _ttlSeconds?: number) => {},
	);
	deleteCacheByPattern = mock(async (_pattern: string) => {});
	deleteCacheKey = mock(async (_key: string) => {});
	disconnect = mock(async () => {});
}

/**
 * Factory function to create a new MockCache instance
 */
export function createMockCache(): MockCache {
	return new MockCache();
}
