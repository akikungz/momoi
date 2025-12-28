import { beforeEach, describe, expect, it } from "bun:test";

import { MockCache } from "@momoi/cache/mock";
import {
  PrismaClientKnownRequestError
} from "@momoi/database/prisma/generated/internal/prismaNamespace";
import {
  createMockPlatformFile, createMockPlatformFilePermission, createMockPlatformFileVersion,
  createMockPlatformFolder, createMockPrisma
} from "@momoi/database/test";

import { StorageService } from "../storage";

describe("StorageService", () => {
  let mockPrisma: any;
  let mockCache: MockCache;
  let storageService: StorageService;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
    storageService = new StorageService(mockPrisma, mockCache as any);
  });

  describe("listFiles", () => {
    it("should return paginated list of files for a user", async () => {
      const userId = 1;
      const mockFiles = [
        createMockPlatformFolder({ platformUserId: userId }),
        createMockPlatformFile({ platformUserId: userId }),
      ];

      mockPrisma.platformFile.count.mockResolvedValueOnce(2);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);

      const result = await storageService.listFiles(userId, { page: 1, pageSize: 10 });

      expect(result.values).toHaveLength(2);
      expect(result.totalItems).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(mockCache.createCacheKey).toHaveBeenCalled();
    });

    it("should return cached data if available", async () => {
      const userId = 1;
      const cachedData = JSON.stringify({
        values: [createMockPlatformFile({ platformUserId: userId })],
        totalItems: 1,
        totalPages: 1,
        currentPage: 1,
        pageSize: 10,
      });

      mockCache.getCacheValue.mockResolvedValueOnce(cachedData);

      const result = await storageService.listFiles(userId, { page: 1, pageSize: 10 });

      expect(result.values).toHaveLength(1);
      expect(mockPrisma.platformFile.findMany).not.toHaveBeenCalled();
    });

    it("should filter by parent folder", async () => {
      const userId = 1;
      const parentId = "folder-1";

      mockPrisma.platformFile.count.mockResolvedValueOnce(0);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

      await storageService.listFiles(userId, { page: 1, pageSize: 10, parentId });

      expect(mockPrisma.platformFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId,
          }),
        })
      );
    });

    it("should filter by file type", async () => {
      const userId = 1;

      mockPrisma.platformFile.count.mockResolvedValueOnce(0);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

      await storageService.listFiles(userId, { page: 1, pageSize: 10, type: "FILE" });

      expect(mockPrisma.platformFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "FILE",
          }),
        })
      );
    });
  });

  describe("getFile", () => {
    it("should return file details with path", async () => {
      const userId = 1;
      const file = createMockPlatformFile({
        id: "file-1",
        platformUserId: userId,
        name: "test.txt",
      });

      // Mock access check
      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: userId,
          isPublic: false,
          platformFilePermissions: [],
        })
        // Mock main query
        .mockResolvedValueOnce({
          ...file,
          children: [],
          platformFileVersions: [],
          platformFilePermissions: [],
        })
        // Mock path building
        .mockResolvedValueOnce({
          name: "test.txt",
          parentId: null,
        });

      const result = await storageService.getFile(userId, "file-1");

      expect(result.id).toBe("file-1");
      expect(result.name).toBe("test.txt");
      expect(result.path).toBe("/test.txt");
    });

    it("should throw 404 when file not found", async () => {
      const userId = 1;
      mockPrisma.platformFile.findUnique.mockResolvedValueOnce(null);

      try {
        await storageService.getFile(userId, "nonexistent");
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("File not found.");
      }
    });

    it("should throw 403 when user has no access", async () => {
      const userId = 1;
      const file = createMockPlatformFile({ platformUserId: 999 });

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
        platformUserId: 999,
        isPublic: false,
        platformFilePermissions: [],
      });

      try {
        await storageService.getFile(userId, file.id);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("You do not have permission to access this file.");
      }
    });

    it("should allow access to public files", async () => {
      const userId = 1;
      const ownerId = 999;
      const file = createMockPlatformFile({
        id: "public-file",
        platformUserId: ownerId,
        isPublic: true,
        name: "public.txt",
      });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: ownerId,
          isPublic: true,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({
          ...file,
          children: [],
          platformFileVersions: [],
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({
          name: "public.txt",
          parentId: null,
        });

      const result = await storageService.getFile(userId, "public-file");
      expect(result.name).toBe("public.txt");
    });
  });

  describe("createFile", () => {
    it("should create a new file", async () => {
      const userId = 1;
      const mockFile = createMockPlatformFile({
        id: "new-file",
        name: "new.txt",
        platformUserId: userId,
      });

      mockPrisma.platformFile.create.mockResolvedValueOnce(mockFile);

      const result = await storageService.createFile(userId, {
        name: "new.txt",
        type: "FILE",
      });

      expect(result.name).toBe("new.txt");
      expect(result.type).toBe("FILE");
      expect(mockCache.deleteCacheByPattern).toHaveBeenCalled();
    });

    it("should create a folder", async () => {
      const userId = 1;
      const mockFolder = createMockPlatformFolder({
        id: "new-folder",
        name: "New Folder",
        platformUserId: userId,
      });

      mockPrisma.platformFile.create.mockResolvedValueOnce(mockFolder);

      const result = await storageService.createFile(userId, {
        name: "New Folder",
        type: "FOLDER",
      });

      expect(result.name).toBe("New Folder");
      expect(result.type).toBe("FOLDER");
    });

    it("should validate parent folder exists", async () => {
      const userId = 1;

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce(null);

      try {
        await storageService.createFile(userId, {
          name: "test.txt",
          type: "FILE",
          parentId: "nonexistent-folder",
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("Parent folder not found.");
      }
    });

    it("should throw error when parent is not a folder", async () => {
      const userId = 1;
      const parentFile = createMockPlatformFile({ type: "FILE" as any, platformUserId: userId });

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce(parentFile);

      try {
        await storageService.createFile(userId, {
          name: "test.txt",
          type: "FILE",
          parentId: parentFile.id,
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("Parent must be a folder.");
      }
    });

    it("should throw error on duplicate name (P2002)", async () => {
      const userId = 1;
      const error = new PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "0.0.1" }
      );

      mockPrisma.platformFile.create.mockRejectedValueOnce(error);

      try {
        await storageService.createFile(userId, {
          name: "existing.txt",
          type: "FILE",
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("A file with this name already exists in the folder.");
      }
    });
  });

  describe("updateFile", () => {
    it("should update file metadata", async () => {
      const userId = 1;
      const file = createMockPlatformFile({ platformUserId: userId });

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformFile.update.mockResolvedValueOnce({
        ...file,
        name: "updated.txt",
      });

      const result = await storageService.updateFile(userId, file.id, {
        name: "updated.txt",
      });

      expect(result.name).toBe("updated.txt");
      expect(mockCache.deleteCacheByPattern).toHaveBeenCalled();
    });

    it("should throw error when not owner", async () => {
      const userId = 1;
      const file = createMockPlatformFile({ platformUserId: 999 });

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 999 });

      try {
        await storageService.updateFile(userId, file.id, { name: "updated.txt" });
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("You do not have permission to perform this action.");
      }
    });

    it("should prevent moving file into itself", async () => {
      const userId = 1;
      const fileId = "file-1";

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });

      try {
        await storageService.updateFile(userId, fileId, { parentId: fileId });
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("Cannot move a file into itself.");
      }
    });
  });

  describe("deleteFile", () => {
    it("should delete file and return count", async () => {
      const userId = 1;
      const file = createMockPlatformFile({ platformUserId: userId });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({ platformUserId: userId })
        .mockResolvedValueOnce(file);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);
      mockPrisma.platformFile.delete.mockResolvedValueOnce(file);

      const result = await storageService.deleteFile(userId, file.id);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(1);
      expect(mockCache.deleteCacheByPattern).toHaveBeenCalled();
    });

    it("should throw error when not owner", async () => {
      const userId = 1;
      const file = createMockPlatformFile({ platformUserId: 999 });

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 999 });

      try {
        await storageService.deleteFile(userId, file.id);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("You do not have permission to perform this action.");
      }
    });

    it("should throw 404 when file not found", async () => {
      const userId = 1;
      mockPrisma.platformFile.findUnique.mockResolvedValueOnce(null);

      try {
        await storageService.deleteFile(userId, "nonexistent");
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("File not found.");
      }
    });
  });

  describe("moveFile", () => {
    it("should move file to new location", async () => {
      const userId = 1;
      const file = createMockPlatformFile({ platformUserId: userId });
      const targetFolder = createMockPlatformFolder({ id: "target-folder", platformUserId: userId });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({ platformUserId: userId })
        .mockResolvedValueOnce(targetFolder);
      mockPrisma.platformFile.update.mockResolvedValueOnce({
        ...file,
        parentId: targetFolder.id,
      });

      const result = await storageService.moveFile(userId, file.id, {
        targetParentId: targetFolder.id,
      });

      expect(result.parentId).toBe(targetFolder.id);
    });
  });

  describe("copyFile", () => {
    it("should copy file to new location", async () => {
      const userId = 1;
      const file = createMockPlatformFile({
        id: "original",
        name: "original.txt",
        platformUserId: userId
      });
      const copiedFile = createMockPlatformFile({
        id: "copy",
        name: "original.txt (Copy)",
        platformUserId: userId,
      });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: userId,
          isPublic: false,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce(file);
      mockPrisma.platformFile.create.mockResolvedValueOnce(copiedFile);

      const result = await storageService.copyFile(userId, file.id, {
        targetParentId: null,
      });

      expect(result.id).toBe("copy");
    });

    it("should allow custom name for copy", async () => {
      const userId = 1;
      const file = createMockPlatformFile({ platformUserId: userId });
      const copiedFile = createMockPlatformFile({
        name: "custom-copy.txt",
        platformUserId: userId,
      });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: userId,
          isPublic: false,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce(file);
      mockPrisma.platformFile.create.mockResolvedValueOnce(copiedFile);

      const result = await storageService.copyFile(userId, file.id, {
        targetParentId: null,
        newName: "custom-copy.txt",
      });

      expect(result.name).toBe("custom-copy.txt");
    });
  });

  describe("getFileVersions", () => {
    it("should return paginated file versions", async () => {
      const userId = 1;
      const fileId = "file-1";
      const versions = [
        createMockPlatformFileVersion({ platformFileId: fileId, versionNumber: 2 }),
        createMockPlatformFileVersion({ platformFileId: fileId, versionNumber: 1 }),
      ];

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: userId,
          isPublic: false,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({ type: "FILE" });
      mockPrisma.platformFileVersion.count.mockResolvedValueOnce(2);
      mockPrisma.platformFileVersion.findMany.mockResolvedValueOnce(versions);

      const result = await storageService.getFileVersions(userId, fileId);

      expect(result.values).toHaveLength(2);
      expect(result.totalItems).toBe(2);
    });

    it("should throw error for folders", async () => {
      const userId = 1;
      const folderId = "folder-1";

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: userId,
          isPublic: false,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({ type: "FOLDER" });

      try {
        await storageService.getFileVersions(userId, folderId);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("Versions are only available for files.");
      }
    });
  });

  describe("createFileVersion", () => {
    it("should create new version with incremented version number", async () => {
      const userId = 1;
      const fileId = "file-1";

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: userId,
          isPublic: false,
          platformFilePermissions: [{ permission: "EDITOR" }],
        })
        .mockResolvedValueOnce({ type: "FILE" });
      mockPrisma.platformFileVersion.findFirst.mockResolvedValueOnce({ versionNumber: 1 });
      mockPrisma.platformFileVersion.create.mockResolvedValueOnce({
        id: 2,
        versionNumber: 2,
        sizeBytes: 2048,
        createdAt: new Date(),
      });
      mockPrisma.platformFile.update.mockResolvedValueOnce({});

      const result = await storageService.createFileVersion(userId, fileId, {
        sizeBytes: 2048,
        storagePath: "/storage/file-1/v2",
      });

      expect(result.versionNumber).toBe(2);
    });
  });

  describe("deleteFileVersion", () => {
    it("should delete version", async () => {
      const userId = 1;
      const fileId = "file-1";
      const versionId = 1;

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce({ platformFileId: fileId });
      mockPrisma.platformFileVersion.delete.mockResolvedValueOnce({});

      const result = await storageService.deleteFileVersion(userId, fileId, versionId);

      expect(result.success).toBe(true);
    });

    it("should throw error when version belongs to different file", async () => {
      const userId = 1;
      const fileId = "file-1";
      const versionId = 1;

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce({ platformFileId: "other-file" });

      try {
        await storageService.deleteFileVersion(userId, fileId, versionId);
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("Version not found.");
      }
    });
  });

  describe("getFilePermissions", () => {
    it("should return file permissions", async () => {
      const userId = 1;
      const fileId = "file-1";
      const permissions = [
        {
          id: 1,
          platformUserId: 2,
          permission: "VIEWER",
          platformUser: {
            id: 2,
            user: { name: "Other User", email: "other@test.com" },
          },
        },
      ];

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformFilePermission.findMany.mockResolvedValueOnce(permissions);

      const result = await storageService.getFilePermissions(userId, fileId);

      expect(result).toHaveLength(1);
      expect(result[0].platformUserId).toBe(2);
      expect(result[0].permission).toBe("VIEWER");
    });
  });

  describe("addFilePermission", () => {
    it("should add permission for another user", async () => {
      const userId = 1;
      const fileId = "file-1";
      const targetUserId = 2;

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
        id: targetUserId,
        user: { name: "Target User", email: "target@test.com" },
      });
      mockPrisma.platformFilePermission.create.mockResolvedValueOnce({
        id: 1,
        platformUserId: targetUserId,
        permission: "VIEWER",
      });

      const result = await storageService.addFilePermission(userId, fileId, {
        platformUserId: targetUserId,
        permission: "VIEWER",
      });

      expect(result.platformUserId).toBe(targetUserId);
      expect(result.permission).toBe("VIEWER");
    });

    it("should prevent adding permission to self", async () => {
      const userId = 1;
      const fileId = "file-1";

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });

      try {
        await storageService.addFilePermission(userId, fileId, {
          platformUserId: userId,
          permission: "VIEWER",
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("Cannot add permission to yourself.");
      }
    });

    it("should throw error on duplicate permission (P2002)", async () => {
      const userId = 1;
      const fileId = "file-1";
      const targetUserId = 2;

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
        id: targetUserId,
        user: { name: "Target User", email: "target@test.com" },
      });

      const error = new PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "0.0.1" }
      );
      mockPrisma.platformFilePermission.create.mockRejectedValueOnce(error);

      try {
        await storageService.addFilePermission(userId, fileId, {
          platformUserId: targetUserId,
          permission: "VIEWER",
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect((err as Error).message).toBe("This user already has permission for this file.");
      }
    });
  });

  describe("updateFilePermission", () => {
    it("should update permission level", async () => {
      const userId = 1;
      const fileId = "file-1";
      const permissionId = 1;

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({ platformFileId: fileId });
      mockPrisma.platformFilePermission.update.mockResolvedValueOnce({
        id: permissionId,
        platformUserId: 2,
        permission: "EDITOR",
        platformUser: {
          id: 2,
          user: { name: "User", email: "user@test.com" },
        },
      });

      const result = await storageService.updateFilePermission(userId, fileId, permissionId, {
        permission: "EDITOR",
      });

      expect(result.permission).toBe("EDITOR");
    });
  });

  describe("removeFilePermission", () => {
    it("should remove permission", async () => {
      const userId = 1;
      const fileId = "file-1";
      const permissionId = 1;

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: userId });
      mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({ platformFileId: fileId });
      mockPrisma.platformFilePermission.delete.mockResolvedValueOnce({});

      const result = await storageService.removeFilePermission(userId, fileId, permissionId);

      expect(result.success).toBe(true);
    });
  });

  describe("searchFiles", () => {
    it("should search files by name", async () => {
      const userId = 1;
      const mockFiles = [
        createMockPlatformFile({ id: "file-1", name: "document.txt", platformUserId: userId }),
      ];

      mockPrisma.platformFile.count.mockResolvedValueOnce(1);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);
      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ name: "document.txt", parentId: null });

      const result = await storageService.searchFiles(userId, {
        query: "document",
        page: 1,
        pageSize: 10,
      });

      expect(result.values).toHaveLength(1);
      expect(result.values[0].name).toBe("document.txt");
      expect(result.values[0].path).toBe("/document.txt");
    });

    it("should filter search by file type", async () => {
      const userId = 1;

      mockPrisma.platformFile.count.mockResolvedValueOnce(0);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

      await storageService.searchFiles(userId, {
        query: "test",
        type: "FOLDER",
        page: 1,
        pageSize: 10,
      });

      expect(mockPrisma.platformFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: "FOLDER",
          }),
        })
      );
    });
  });
});
