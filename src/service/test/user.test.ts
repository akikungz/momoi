import { beforeEach, describe, expect, it } from 'bun:test';

import { MockCache } from '@momoi/cache/mock';
import {
    PrismaClientKnownRequestError
} from '@momoi/database/prisma/generated/internal/prismaNamespace';
import { createMockPrisma } from '@momoi/database/test';

import { UserService } from '../user';

describe("UserService", () => {
  let mockPrisma: any;
  let mockCache: MockCache;
  let userService: UserService;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
    userService = new UserService(mockPrisma, mockCache as any);
  });

  describe("addSSHKey", () => {
    it("should create a new SSH key", async () => {
      const userId = 1;
      const name = "My SSH Key";
      const publicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...";

      const mockSSHKeyData = {
        id: 1,
        ownerId: userId,
        name,
        publicKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.platformSSHKey.create.mockResolvedValueOnce(mockSSHKeyData);

      const result = await userService.addSSHKey(userId, name, publicKey);

      expect(result.id).toBe(1);
      expect(result.name).toBe(name);
      expect(result.publicKey).toBe(publicKey);
      expect(mockCache.deleteCacheByPattern).toHaveBeenCalled();
    });

    it("should throw error when SSH key with same name already exists (P2002)", async () => {
      const userId = 1;
      const name = "My SSH Key";
      const publicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...";

      const error = new PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "0.0.1" }
      );
      mockPrisma.platformSSHKey.create.mockRejectedValueOnce(error);

      try {
        await userService.addSSHKey(userId, name, publicKey);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("An SSH key with the same name or public key already exists for this user.");
      }
    });

    it("should throw error when user not found (P2025)", async () => {
      const userId = 999;
      const name = "My SSH Key";
      const publicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...";

      const error = new PrismaClientKnownRequestError(
        "Record not found",
        { code: "P2025", clientVersion: "0.0.1" }
      );
      mockPrisma.platformSSHKey.create.mockRejectedValueOnce(error);

      try {
        await userService.addSSHKey(userId, name, publicKey);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("User not found.");
      }
    });

    it("should throw error on unexpected error", async () => {
      const userId = 1;
      const name = "My SSH Key";
      const publicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...";

      mockPrisma.platformSSHKey.create.mockRejectedValueOnce(new Error("Unexpected error"));

      try {
        await userService.addSSHKey(userId, name, publicKey);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("An unexpected error occurred while adding the SSH key.");
      }
    });
  });

  describe("getSSHKeys", () => {
    it("should retrieve SSH keys for a user with pagination", async () => {
      const userId = 1;
      const page = 1;
      const pageSize = 10;

      const mockSSHKeys = [
        {
          id: 1,
          ownerId: userId,
          name: "Key 1",
          publicKey: "ssh-rsa AAAAB3...",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.platformSSHKey.count.mockResolvedValueOnce(1);
      mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce(mockSSHKeys);

      const result = await userService.getSSHKeys(userId, page, pageSize);

      expect(result.values).toHaveLength(1);
      expect(result.values[0].id).toBe(1);
      expect(result.totalItems).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(mockCache.createCacheKey).toHaveBeenCalled();
    });

    it("should return cached data if available", async () => {
      const userId = 1;
      const page = 1;
      const pageSize = 10;

      const cachedData = JSON.stringify({
        values: [
          {
            id: 1,
            ownerId: userId,
            name: "Key 1",
            publicKey: "ssh-rsa AAAAB3...",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      });

      mockCache.getCacheValue.mockResolvedValueOnce(cachedData);

      const result = await userService.getSSHKeys(userId, page, pageSize);

      expect(result.values).toHaveLength(1);
      expect(result.totalItems).toBe(1);
      expect(mockPrisma.platformSSHKey.count).not.toHaveBeenCalled();
    });

    it("should handle pagination with different page and pageSize", async () => {
      const userId = 1;
      const page = 2;
      const pageSize = 5;

      mockPrisma.platformSSHKey.count.mockResolvedValueOnce(15);
      mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce([]);

      const result = await userService.getSSHKeys(userId, page, pageSize);

      expect(result.currentPage).toBe(2);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBe(3);
    });

    it("should use default pagination values", async () => {
      const userId = 1;

      mockPrisma.platformSSHKey.count.mockResolvedValueOnce(0);
      mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce([]);

      const result = await userService.getSSHKeys(userId);

      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  describe("removeSSHKey", () => {
    it("should delete SSH keys for a user", async () => {
      const userId = 1;
      const keyIds = [1, 2];

      mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({ count: 2 });

      const result = await userService.removeSSHKey(userId, keyIds);

      expect(result).toBe(2);
      expect(mockCache.deleteCacheByPattern).toHaveBeenCalled();
    });

    it("should return count of deleted keys", async () => {
      const userId = 1;
      const keyIds = [42];

      mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await userService.removeSSHKey(userId, keyIds);

      expect(result).toBe(1);
    });

    it("should handle zero deleted keys", async () => {
      const userId = 1;
      const keyIds = [999];

      mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await userService.removeSSHKey(userId, keyIds);

      expect(result).toBe(0);
    });

    it("should throw error when SSH key not found (P2025)", async () => {
      const userId = 1;
      const keyIds = [999];

      const error = new PrismaClientKnownRequestError(
        "Record not found",
        { code: "P2025", clientVersion: "0.0.1" }
      );
      mockPrisma.platformSSHKey.deleteMany.mockRejectedValueOnce(error);

      try {
        await userService.removeSSHKey(userId, keyIds);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("One or more SSH keys not found for the user.");
      }
    });

    it("should throw error on database error", async () => {
      const userId = 1;
      const keyIds = [1];

      const error = new PrismaClientKnownRequestError(
        "Database error",
        { code: "P2002", clientVersion: "0.0.1" }
      );
      mockPrisma.platformSSHKey.deleteMany.mockRejectedValueOnce(error);

      try {
        await userService.removeSSHKey(userId, keyIds);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toContain("Database error:");
      }
    });

    it("should throw error on unexpected error", async () => {
      const userId = 1;
      const keyIds = [1];

      mockPrisma.platformSSHKey.deleteMany.mockRejectedValueOnce(new Error("Unexpected error"));

      try {
        await userService.removeSSHKey(userId, keyIds);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("An unexpected error occurred while removing the SSH keys.");
      }
    });
  });
});
