import { mock } from "bun:test";

export class MockCache {
  getCacheValue = mock(async (key: string): Promise<string | null> => null);
  createCacheKey = mock(async (key: string, value: string) => { });
  deleteCacheByPattern = mock(async (pattern: string) => { });
  deleteCacheKey = mock(async (key: string) => { });
  disconnect = mock(async () => { });
}
