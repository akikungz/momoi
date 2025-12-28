import { beforeEach, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import {
  mockAdminAuth, mockInstructorAuth, mockOtherAuth, mockStudentAuth
} from "@momoi/auth/mock";
import { MockCache } from "@momoi/cache/mock";
import {
  createMockPlatformFile, createMockPlatformFilePermission, createMockPlatformFileVersion,
  createMockPlatformFolder, createMockPrisma
} from "@momoi/database/test";

import { storageRoute } from "../storage";

describe("Storage Route - Admin", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  describe("GET /storage/files", () => {
    it("should list files for the user", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFiles = [
        createMockPlatformFolder({ platformUserId: 1 }),
        createMockPlatformFile({ platformUserId: 1 }),
      ];

      mockPrisma.platformFile.count.mockResolvedValueOnce(2);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);

      const response = await client.storage.files.get();

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("values");
      expect(response.data!.values).toHaveLength(2);
      expect(response.data).toHaveProperty("totalItems", 2);
    });

    it("should support pagination", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      mockPrisma.platformFile.count.mockResolvedValueOnce(25);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

      const response = await client.storage.files.get({
        query: { page: 2, pageSize: 5 },
      });

      expect(response.status).toBe(200);
      expect(response.data!.currentPage).toBe(2);
      expect(response.data!.pageSize).toBe(5);
    });

    it("should filter by parent folder", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      mockPrisma.platformFile.count.mockResolvedValueOnce(0);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

      const response = await client.storage.files.get({
        query: { parentId: "folder-1" },
      });

      expect(response.status).toBe(200);
    });
  });

  describe("GET /storage/files/:fileId", () => {
    it("should get file details", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFile = createMockPlatformFile({
        id: "file-1",
        name: "test.txt",
        platformUserId: 1,
      });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: 1,
          isPublic: false,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({
          ...mockFile,
          children: [],
          platformFileVersions: [],
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({
          name: "test.txt",
          parentId: null,
        });

      const response = await client.storage.files({ fileId: "file-1" }).get();

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("id", "file-1");
      expect(response.data).toHaveProperty("name", "test.txt");
      expect(response.data).toHaveProperty("path");
    });
  });

  describe("POST /storage/files", () => {
    it("should create a file", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFile = createMockPlatformFile({
        id: "new-file",
        name: "new.txt",
        platformUserId: 1,
      });

      mockPrisma.platformFile.create.mockResolvedValueOnce(mockFile);

      const response = await client.storage.files.post({
        name: "new.txt",
        type: "FILE",
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("name", "new.txt");
      expect(response.data).toHaveProperty("type", "FILE");
    });

    it("should create a folder", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFolder = createMockPlatformFolder({
        id: "new-folder",
        name: "New Folder",
        platformUserId: 1,
      });

      mockPrisma.platformFile.create.mockResolvedValueOnce(mockFolder);

      const response = await client.storage.files.post({
        name: "New Folder",
        type: "FOLDER",
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("type", "FOLDER");
    });
  });

  describe("PATCH /storage/files/:fileId", () => {
    it("should update file metadata", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFile = createMockPlatformFile({
        id: "file-1",
        name: "updated.txt",
        platformUserId: 1,
      });

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
      mockPrisma.platformFile.update.mockResolvedValueOnce(mockFile);

      const response = await client.storage.files({ fileId: "file-1" }).patch({
        name: "updated.txt",
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("name", "updated.txt");
    });
  });

  describe("DELETE /storage/files/:fileId", () => {
    it("should delete a file", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFile = createMockPlatformFile({ id: "file-1", platformUserId: 1 });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({ platformUserId: 1 })
        .mockResolvedValueOnce(mockFile);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);
      mockPrisma.platformFile.delete.mockResolvedValueOnce(mockFile);

      const response = await client.storage.files({ fileId: "file-1" }).delete();

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("success", true);
      expect(response.data).toHaveProperty("deletedCount", 1);
    });
  });

  describe("POST /storage/files/:fileId/move", () => {
    it("should move a file", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFile = createMockPlatformFile({
        id: "file-1",
        parentId: "folder-target",
        platformUserId: 1,
      });
      const targetFolder = createMockPlatformFolder({
        id: "folder-target",
        platformUserId: 1,
      });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({ platformUserId: 1 })
        .mockResolvedValueOnce(targetFolder);
      mockPrisma.platformFile.update.mockResolvedValueOnce(mockFile);

      const response = await client.storage.files({ fileId: "file-1" }).move.post({
        targetParentId: "folder-target",
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("parentId", "folder-target");
    });
  });

  describe("POST /storage/files/:fileId/copy", () => {
    it("should copy a file", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFile = createMockPlatformFile({
        id: "original",
        name: "original.txt",
        platformUserId: 1,
      });
      const copiedFile = createMockPlatformFile({
        id: "copy",
        name: "original.txt (Copy)",
        platformUserId: 1,
      });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: 1,
          isPublic: false,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce(mockFile);
      mockPrisma.platformFile.create.mockResolvedValueOnce(copiedFile);

      const response = await client.storage.files({ fileId: "original" }).copy.post({
        targetParentId: null,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("id", "copy");
    });
  });

  describe("GET /storage/files/:fileId/versions", () => {
    it("should list file versions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const versions = [
        createMockPlatformFileVersion({ versionNumber: 2 }),
        createMockPlatformFileVersion({ versionNumber: 1 }),
      ];

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: 1,
          isPublic: false,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({ type: "FILE" });
      mockPrisma.platformFileVersion.count.mockResolvedValueOnce(2);
      mockPrisma.platformFileVersion.findMany.mockResolvedValueOnce(versions);

      const response = await client.storage.files({ fileId: "file-1" }).versions.get();

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("values");
      expect(response.data!.values).toHaveLength(2);
    });
  });

  describe("POST /storage/files/:fileId/versions", () => {
    it("should create a new version", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: 1,
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

      const response = await client.storage.files({ fileId: "file-1" }).versions.post({
        sizeBytes: 2048,
        storagePath: "/storage/file-1/v2",
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("versionNumber", 2);
    });
  });

  describe("DELETE /storage/files/:fileId/versions/:versionId", () => {
    it("should delete a version", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
      mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce({ platformFileId: "file-1" });
      mockPrisma.platformFileVersion.delete.mockResolvedValueOnce({});

      const response = await client.storage.files({ fileId: "file-1" }).versions({ versionId: 1 }).delete();

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("success", true);
    });
  });

  describe("GET /storage/files/:fileId/permissions", () => {
    it("should list file permissions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

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

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
      mockPrisma.platformFilePermission.findMany.mockResolvedValueOnce(permissions);

      const response = await client.storage.files({ fileId: "file-1" }).permissions.get();

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
      expect(response.data![0]).toHaveProperty("permission", "VIEWER");
    });
  });

  describe("POST /storage/files/:fileId/permissions", () => {
    it("should add a permission", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
      mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
        id: 2,
        user: { name: "Target User", email: "target@test.com" },
      });
      mockPrisma.platformFilePermission.create.mockResolvedValueOnce({
        id: 1,
        platformUserId: 2,
        permission: "VIEWER",
      });

      const response = await client.storage.files({ fileId: "file-1" }).permissions.post({
        platformUserId: 2,
        permission: "VIEWER",
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("platformUserId", 2);
      expect(response.data).toHaveProperty("permission", "VIEWER");
    });
  });

  describe("PATCH /storage/files/:fileId/permissions/:permissionId", () => {
    it("should update a permission", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
      mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({ platformFileId: "file-1" });
      mockPrisma.platformFilePermission.update.mockResolvedValueOnce({
        id: 1,
        platformUserId: 2,
        permission: "EDITOR",
        platformUser: {
          id: 2,
          user: { name: "User", email: "user@test.com" },
        },
      });

      const response = await client.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).patch({
        permission: "EDITOR",
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("permission", "EDITOR");
    });
  });

  describe("DELETE /storage/files/:fileId/permissions/:permissionId", () => {
    it("should remove a permission", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
      mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({ platformFileId: "file-1" });
      mockPrisma.platformFilePermission.delete.mockResolvedValueOnce({});

      const response = await client.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).delete();

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("success", true);
    });
  });

  describe("GET /storage/files/search", () => {
    it("should search files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockAdminAuth));

      const mockFiles = [
        createMockPlatformFile({ id: "file-1", name: "document.txt", platformUserId: 1 }),
      ];

      mockPrisma.platformFile.count.mockResolvedValueOnce(1);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);
      mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ name: "document.txt", parentId: null });

      const response = await client.storage.files.search.get({
        query: { query: "document" },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("values");
      expect(response.data!.values).toHaveLength(1);
      expect(response.data!.values[0]).toHaveProperty("path");
    });
  });
});

describe("Storage Route - Student", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  describe("Read-only access", () => {
    it("should list student's own files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const mockFiles = [
        createMockPlatformFile({ platformUserId: 3 }),
      ];

      mockPrisma.platformFile.count.mockResolvedValueOnce(1);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);

      const response = await client.storage.files.get();

      expect(response.status).toBe(200);
      expect(response.data!.values).toHaveLength(1);
    });

    it("should get file details", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const mockFile = createMockPlatformFile({
        id: "file-1",
        name: "shared.txt",
        platformUserId: 1,
        isPublic: true,
      });

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: 1,
          isPublic: true,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({
          ...mockFile,
          children: [],
          platformFileVersions: [],
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({
          name: "shared.txt",
          parentId: null,
        });

      const response = await client.storage.files({ fileId: "file-1" }).get();

      expect(response.status).toBe(200);
    });

    it("should search files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      mockPrisma.platformFile.count.mockResolvedValueOnce(0);
      mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

      const response = await client.storage.files.search.get({
        query: { query: "test" },
      });

      expect(response.status).toBe(200);
    });

    it("should view file versions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      mockPrisma.platformFile.findUnique
        .mockResolvedValueOnce({
          platformUserId: 1,
          isPublic: true,
          platformFilePermissions: [],
        })
        .mockResolvedValueOnce({ type: "FILE" });
      mockPrisma.platformFileVersion.count.mockResolvedValueOnce(0);
      mockPrisma.platformFileVersion.findMany.mockResolvedValueOnce([]);

      const response = await client.storage.files({ fileId: "file-1" }).versions.get();

      expect(response.status).toBe(200);
    });
  });

  describe("Forbidden operations", () => {
    it("should return 403 when creating files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files.post({
        name: "homework.txt",
        type: "FILE",
      });

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot create files");
    });

    it("should return 403 when updating files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).patch({
        name: "updated.txt",
      });

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot update files");
    });

    it("should return 403 when deleting files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).delete();

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot delete files");
    });

    it("should return 403 when moving files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).move.post({
        targetParentId: "folder-1",
      });

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot move files");
    });

    it("should return 403 when copying files", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).copy.post({
        targetParentId: null,
      });

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot copy files");
    });

    it("should return 403 when creating file versions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).versions.post({
        sizeBytes: 1024,
        storagePath: "/storage/v2",
      });

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot create file versions");
    });

    it("should return 403 when deleting file versions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).versions({ versionId: 1 }).delete();

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot delete file versions");
    });

    it("should return 403 when adding file permissions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).permissions.post({
        platformUserId: 2,
        permission: "VIEWER",
      });

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot add file permissions");
    });

    it("should return 403 when updating file permissions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).patch({
        permission: "EDITOR",
      });

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot update file permissions");
    });

    it("should return 403 when removing file permissions", async () => {
      const client = treaty(storageRoute(mockPrisma, mockCache as any, mockStudentAuth));

      const response = await client.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).delete();

      expect(response.status).toBe(403);
      expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot remove file permissions");
    });
  });
});

describe("Storage Route - Unauthenticated", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  it("should return 401 for listing files", async () => {
    const client = treaty(storageRoute(mockPrisma, mockCache as any, mockOtherAuth));

    const response = await client.storage.files.get();

    expect(response.status).toBe(401);
  });

  it("should return 401 for creating files", async () => {
    const client = treaty(storageRoute(mockPrisma, mockCache as any, mockOtherAuth));

    const response = await client.storage.files.post({
      name: "test.txt",
      type: "FILE",
    });

    expect(response.status).toBe(401);
  });
});
