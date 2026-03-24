import { beforeEach, describe, expect, it } from "bun:test";

import { MockCache } from "@momoi/cache/mock";

describe("MockCache", () => {
	let mockCache: MockCache;

	beforeEach(() => {
		mockCache = new MockCache();
	});

	describe("getCacheValue", () => {
		it("should be defined as a mock function", () => {
			expect(mockCache.getCacheValue).toBeDefined();
			expect(typeof mockCache.getCacheValue).toBe("function");
		});

		it("should return null by default", async () => {
			const result = await mockCache.getCacheValue("test-key");
			expect(result).toBeNull();
		});

		it("should be mockable with custom return value", async () => {
			mockCache.getCacheValue.mockResolvedValueOnce("cached-value");
			const result = await mockCache.getCacheValue("test-key");
			expect(result).toBe("cached-value");
		});

		it("should track calls", async () => {
			await mockCache.getCacheValue("key1");
			await mockCache.getCacheValue("key2");
			expect(mockCache.getCacheValue).toHaveBeenCalledTimes(2);
		});
	});

	describe("createCacheKey", () => {
		it("should be defined as a mock function", () => {
			expect(mockCache.createCacheKey).toBeDefined();
			expect(typeof mockCache.createCacheKey).toBe("function");
		});

		it("should accept key and value parameters", async () => {
			await mockCache.createCacheKey("test-key", "test-value");
			expect(mockCache.createCacheKey).toHaveBeenCalledWith(
				"test-key",
				"test-value",
			);
		});

		it("should track calls", async () => {
			await mockCache.createCacheKey("key1", "value1");
			await mockCache.createCacheKey("key2", "value2");
			expect(mockCache.createCacheKey).toHaveBeenCalledTimes(2);
		});

		it("should be mockable to throw errors", async () => {
			mockCache.createCacheKey.mockRejectedValueOnce(
				new Error("Cache write failed"),
			);

			await expect(mockCache.createCacheKey("key", "value")).rejects.toThrow(
				"Cache write failed",
			);
		});
	});

	describe("deleteCacheByPattern", () => {
		it("should be defined as a mock function", () => {
			expect(mockCache.deleteCacheByPattern).toBeDefined();
			expect(typeof mockCache.deleteCacheByPattern).toBe("function");
		});

		it("should accept pattern parameter", async () => {
			await mockCache.deleteCacheByPattern("user:*");
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith("user:*");
		});

		it("should track calls", async () => {
			await mockCache.deleteCacheByPattern("pattern1");
			await mockCache.deleteCacheByPattern("pattern2");
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledTimes(2);
		});

		it("should be mockable to throw errors", async () => {
			mockCache.deleteCacheByPattern.mockRejectedValueOnce(
				new Error("Delete failed"),
			);

			await expect(mockCache.deleteCacheByPattern("pattern")).rejects.toThrow(
				"Delete failed",
			);
		});
	});

	describe("deleteCacheKey", () => {
		it("should be defined as a mock function", () => {
			expect(mockCache.deleteCacheKey).toBeDefined();
			expect(typeof mockCache.deleteCacheKey).toBe("function");
		});

		it("should accept key parameter", async () => {
			await mockCache.deleteCacheKey("test-key");
			expect(mockCache.deleteCacheKey).toHaveBeenCalledWith("test-key");
		});

		it("should track calls", async () => {
			await mockCache.deleteCacheKey("key1");
			await mockCache.deleteCacheKey("key2");
			expect(mockCache.deleteCacheKey).toHaveBeenCalledTimes(2);
		});

		it("should be mockable to throw errors", async () => {
			mockCache.deleteCacheKey.mockRejectedValueOnce(
				new Error("Delete key failed"),
			);

			await expect(mockCache.deleteCacheKey("key")).rejects.toThrow(
				"Delete key failed",
			);
		});
	});

	describe("disconnect", () => {
		it("should be defined as a mock function", () => {
			expect(mockCache.disconnect).toBeDefined();
			expect(typeof mockCache.disconnect).toBe("function");
		});

		it("should be callable", async () => {
			await mockCache.disconnect();
			expect(mockCache.disconnect).toHaveBeenCalled();
		});

		it("should track calls", async () => {
			await mockCache.disconnect();
			await mockCache.disconnect();
			expect(mockCache.disconnect).toHaveBeenCalledTimes(2);
		});

		it("should be mockable to throw errors", async () => {
			mockCache.disconnect.mockRejectedValueOnce(
				new Error("Disconnect failed"),
			);

			await expect(mockCache.disconnect()).rejects.toThrow("Disconnect failed");
		});
	});

	describe("Mock interactions", () => {
		it("should allow resetting mocks", async () => {
			await mockCache.getCacheValue("key");
			expect(mockCache.getCacheValue).toHaveBeenCalledTimes(1);

			mockCache.getCacheValue.mockReset();

			expect(mockCache.getCacheValue).toHaveBeenCalledTimes(0);
		});

		it("should allow clearing mock calls", async () => {
			await mockCache.getCacheValue("key");
			mockCache.getCacheValue.mockClear();

			expect(mockCache.getCacheValue).toHaveBeenCalledTimes(0);
		});

		it("should support chaining mock responses", async () => {
			mockCache.getCacheValue
				.mockResolvedValueOnce("value1")
				.mockResolvedValueOnce("value2")
				.mockResolvedValueOnce(null);

			expect(await mockCache.getCacheValue("key")).toBe("value1");
			expect(await mockCache.getCacheValue("key")).toBe("value2");
			expect(await mockCache.getCacheValue("key")).toBeNull();
		});
	});
});
