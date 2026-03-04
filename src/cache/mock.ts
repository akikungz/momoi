import { mock } from "bun:test";

export class MockCache {
  getCacheValue = mock(async (key: string): Promise<string | null> => null);
  createCacheKey = mock(async (key: string, value: string, ttlSeconds?: number) => { });
  deleteCacheByPattern = mock(async (pattern: string) => { });
  deleteCacheKey = mock(async (key: string) => { });
  disconnect = mock(async () => { });
}

/**
 * Factory function to create a new MockCache instance
 */
export function createMockCache(): MockCache {
  return new MockCache();
}
