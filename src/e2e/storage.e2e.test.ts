import { beforeEach, describe, expect, it } from "bun:test";

import {
  createMockPlatformFile, createMockPlatformFilePermission, createMockPlatformFileVersion,
  createMockPlatformFolder
} from "@momoi/database/test";

import { setupTestContext } from "./setup";

/**
 * E2E Tests for Storage Routes
 * 
 * These tests verify the complete request/response cycle for storage-related endpoints.
 * Tests are organized by endpoint and role.
 */

describe("E2E: Storage Routes", () => {
  describe("GET /api/storage/files", () => {
    describe("As Admin", () => {
      it("should return paginated list of files", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFiles = [
          createMockPlatformFolder({ platformUserId: 1, name: "Documents" }),
          createMockPlatformFile({ platformUserId: 1, name: "readme.txt" }),
        ];

        mockPrisma.platformFile.count.mockResolvedValueOnce(2);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);

        const response = await client.api.storage.files.get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.values).toHaveLength(2);
        expect(response.data!.totalItems).toBe(2);
        expect(response.data!.currentPage).toBe(1);
        expect(response.data!.pageSize).toBe(10);
      });

      it("should support pagination parameters", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.count.mockResolvedValueOnce(50);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.get({
          query: { page: 3, pageSize: 5 },
        });

        expect(response.status).toBe(200);
        expect(response.data!.currentPage).toBe(3);
        expect(response.data!.pageSize).toBe(5);
        expect(response.data!.totalPages).toBe(10);
      });

      it("should filter by parent folder", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.count.mockResolvedValueOnce(0);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.get({
          query: { parentId: "folder-1" },
        });

        expect(response.status).toBe(200);
        expect(mockPrisma.platformFile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              parentId: "folder-1",
            }),
          })
        );
      });

      it("should filter by file type", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.count.mockResolvedValueOnce(0);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.get({
          query: { type: "FOLDER" },
        });

        expect(response.status).toBe(200);
        expect(mockPrisma.platformFile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              type: "FOLDER",
            }),
          })
        );
      });

      it("should return empty list when no files exist", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.count.mockResolvedValueOnce(0);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.get();

        expect(response.status).toBe(200);
        expect(response.data!.values).toHaveLength(0);
        expect(response.data!.totalItems).toBe(0);
      });
    });

    describe("As Student", () => {
      it("should return student's files", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        const mockFiles = [
          createMockPlatformFile({ platformUserId: 3, name: "homework.pdf" }),
        ];

        mockPrisma.platformFile.count.mockResolvedValueOnce(1);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);

        const response = await client.api.storage.files.get();

        expect(response.status).toBe(200);
        expect(response.data!.values).toHaveLength(1);
      });
    });

    describe("As Unauthenticated", () => {
      it("should return 401 Unauthorized", async () => {
        const { client } = setupTestContext("unauthenticated");

        const response = await client.api.storage.files.get();

        expect(response.status).toBe(401);
      });
    });
  });

  describe("GET /api/storage/files/:fileId", () => {
    describe("As Admin", () => {
      it("should return file details with path", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFile = createMockPlatformFile({
          id: "file-1",
          name: "document.txt",
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
            name: "document.txt",
            parentId: null,
          });

        const response = await client.api.storage.files({ fileId: "file-1" }).get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.id).toBe("file-1");
        expect(response.data!.name).toBe("document.txt");
        expect(response.data!.path).toBe("/document.txt");
      });

      it("should return folder with children", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFolder = createMockPlatformFolder({
          id: "folder-1",
          name: "Documents",
          platformUserId: 1,
        });
        const childFile = createMockPlatformFile({
          id: "file-child",
          name: "readme.txt",
          parentId: "folder-1",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({
            platformUserId: 1,
            isPublic: false,
            platformFilePermissions: [],
          })
          .mockResolvedValueOnce({
            ...mockFolder,
            children: [childFile],
            platformFileVersions: [],
            platformFilePermissions: [],
          })
          .mockResolvedValueOnce({
            name: "Documents",
            parentId: null,
          });

        const response = await client.api.storage.files({ fileId: "folder-1" }).get();

        expect(response.status).toBe(200);
        expect(response.data!.type).toBe("FOLDER");
        expect(response.data!.children).toHaveLength(1);
      });

      it("should return 404 for non-existent file", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce(null);

        const response = await client.api.storage.files({ fileId: "nonexistent" }).get();

        expect(response.status).toBe(404);
      });
    });

    describe("Access Control", () => {
      it("should allow access to public files", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        const mockFile = createMockPlatformFile({
          id: "public-file",
          name: "public.txt",
          platformUserId: 1, // Owner is admin
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
            name: "public.txt",
            parentId: null,
          });

        const response = await client.api.storage.files({ fileId: "public-file" }).get();

        expect(response.status).toBe(200);
        expect(response.data!.name).toBe("public.txt");
      });

      it("should deny access to private files from other users", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
          platformUserId: 1, // Admin's file
          isPublic: false,
          platformFilePermissions: [],
        });

        const response = await client.api.storage.files({ fileId: "private-file" }).get();

        expect(response.status).toBe(403);
      });
    });
  });

  describe("POST /api/storage/files", () => {
    describe("As Admin", () => {
      it("should create a new file", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFile = createMockPlatformFile({
          id: "new-file",
          name: "new-document.txt",
          platformUserId: 1,
        });

        mockPrisma.platformFile.create.mockResolvedValueOnce(mockFile);

        const response = await client.api.storage.files.post({
          name: "new-document.txt",
          type: "FILE",
        });

        expect(response.status).toBe(200);
        expect(response.data!.name).toBe("new-document.txt");
        expect(response.data!.type).toBe("FILE");
      });

      it("should create a new folder", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFolder = createMockPlatformFolder({
          id: "new-folder",
          name: "New Project",
          platformUserId: 1,
        });

        mockPrisma.platformFile.create.mockResolvedValueOnce(mockFolder);

        const response = await client.api.storage.files.post({
          name: "New Project",
          type: "FOLDER",
        });

        expect(response.status).toBe(200);
        expect(response.data!.name).toBe("New Project");
        expect(response.data!.type).toBe("FOLDER");
      });

      it("should create file in parent folder", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const parentFolder = createMockPlatformFolder({
          id: "parent-folder",
          platformUserId: 1,
        });
        const mockFile = createMockPlatformFile({
          id: "new-file",
          name: "nested.txt",
          parentId: "parent-folder",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce(parentFolder);
        mockPrisma.platformFile.create.mockResolvedValueOnce(mockFile);

        const response = await client.api.storage.files.post({
          name: "nested.txt",
          type: "FILE",
          parentId: "parent-folder",
        });

        expect(response.status).toBe(200);
        expect(response.data!.parentId).toBe("parent-folder");
      });

      it("should create public file", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFile = createMockPlatformFile({
          id: "public-file",
          name: "shared.txt",
          isPublic: true,
          platformUserId: 1,
        });

        mockPrisma.platformFile.create.mockResolvedValueOnce(mockFile);

        const response = await client.api.storage.files.post({
          name: "shared.txt",
          type: "FILE",
          isPublic: true,
        });

        expect(response.status).toBe(200);
        expect(response.data!.isPublic).toBe(true);
      });

      it("should return 404 when parent folder not found", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce(null);

        const response = await client.api.storage.files.post({
          name: "test.txt",
          type: "FILE",
          parentId: "nonexistent-folder",
        });

        expect(response.status).toBe(404);
      });
    });

    describe("As Student", () => {
      it("should return 403 Forbidden when creating files", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files.post({
          name: "assignment.pdf",
          type: "FILE",
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot create files");
      });
    });
  });

  describe("PATCH /api/storage/files/:fileId", () => {
    describe("As Admin", () => {
      it("should update file name", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFile = createMockPlatformFile({
          id: "file-1",
          name: "renamed.txt",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformFile.update.mockResolvedValueOnce(mockFile);

        const response = await client.api.storage.files({ fileId: "file-1" }).patch({
          name: "renamed.txt",
        });

        expect(response.status).toBe(200);
        expect(response.data!.name).toBe("renamed.txt");
      });

      it("should update file visibility", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFile = createMockPlatformFile({
          id: "file-1",
          isPublic: true,
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformFile.update.mockResolvedValueOnce(mockFile);

        const response = await client.api.storage.files({ fileId: "file-1" }).patch({
          isPublic: true,
        });

        expect(response.status).toBe(200);
        expect(response.data!.isPublic).toBe(true);
      });

      it("should return 403 when not owner", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 999 });

        const response = await client.api.storage.files({ fileId: "file-1" }).patch({
          name: "unauthorized.txt",
        });

        expect(response.status).toBe(403);
      });
    });
  });

  describe("DELETE /api/storage/files/:fileId", () => {
    describe("As Admin", () => {
      it("should delete file", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFile = createMockPlatformFile({
          id: "file-1",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({ platformUserId: 1 })
          .mockResolvedValueOnce(mockFile);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);
        mockPrisma.platformFile.delete.mockResolvedValueOnce(mockFile);

        const response = await client.api.storage.files({ fileId: "file-1" }).delete();

        expect(response.status).toBe(200);
        expect(response.data!.success).toBe(true);
        expect(response.data!.deletedCount).toBe(1);
      });

      it("should delete folder with children", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFolder = createMockPlatformFolder({
          id: "folder-1",
          platformUserId: 1,
        });
        const childFile = createMockPlatformFile({
          id: "child-file",
          parentId: "folder-1",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({ platformUserId: 1 })
          .mockResolvedValueOnce(mockFolder);
        mockPrisma.platformFile.findMany
          .mockResolvedValueOnce([childFile])
          .mockResolvedValueOnce([]);
        mockPrisma.platformFile.delete.mockResolvedValueOnce(mockFolder);

        const response = await client.api.storage.files({ fileId: "folder-1" }).delete();

        expect(response.status).toBe(200);
        expect(response.data!.deletedCount).toBe(2);
      });
    });
  });

  describe("POST /api/storage/files/:fileId/move", () => {
    describe("As Admin", () => {
      it("should move file to another folder", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const targetFolder = createMockPlatformFolder({
          id: "target-folder",
          platformUserId: 1,
        });
        const movedFile = createMockPlatformFile({
          id: "file-1",
          parentId: "target-folder",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({ platformUserId: 1 })
          .mockResolvedValueOnce(targetFolder);
        mockPrisma.platformFile.update.mockResolvedValueOnce(movedFile);

        const response = await client.api.storage.files({ fileId: "file-1" }).move.post({
          targetParentId: "target-folder",
        });

        expect(response.status).toBe(200);
        expect(response.data!.parentId).toBe("target-folder");
      });

      it("should move file to root", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const movedFile = createMockPlatformFile({
          id: "file-1",
          parentId: null,
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformFile.update.mockResolvedValueOnce(movedFile);

        const response = await client.api.storage.files({ fileId: "file-1" }).move.post({
          targetParentId: null,
        });

        expect(response.status).toBe(200);
        expect(response.data!.parentId).toBeNull();
      });
    });
  });

  describe("POST /api/storage/files/:fileId/copy", () => {
    describe("As Admin", () => {
      it("should copy file", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const sourceFile = createMockPlatformFile({
          id: "source-file",
          name: "original.txt",
          platformUserId: 1,
        });
        const copiedFile = createMockPlatformFile({
          id: "copied-file",
          name: "original.txt (Copy)",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({
            platformUserId: 1,
            isPublic: false,
            platformFilePermissions: [],
          })
          .mockResolvedValueOnce(sourceFile);
        mockPrisma.platformFile.create.mockResolvedValueOnce(copiedFile);

        const response = await client.api.storage.files({ fileId: "source-file" }).copy.post({
          targetParentId: null,
        });

        expect(response.status).toBe(200);
        expect(response.data!.id).toBe("copied-file");
      });

      it("should copy with custom name", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const sourceFile = createMockPlatformFile({
          id: "source-file",
          name: "original.txt",
          platformUserId: 1,
        });
        const copiedFile = createMockPlatformFile({
          id: "copied-file",
          name: "custom-copy.txt",
          platformUserId: 1,
        });

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({
            platformUserId: 1,
            isPublic: false,
            platformFilePermissions: [],
          })
          .mockResolvedValueOnce(sourceFile);
        mockPrisma.platformFile.create.mockResolvedValueOnce(copiedFile);

        const response = await client.api.storage.files({ fileId: "source-file" }).copy.post({
          targetParentId: null,
          newName: "custom-copy.txt",
        });

        expect(response.status).toBe(200);
        expect(response.data!.name).toBe("custom-copy.txt");
      });
    });
  });

  describe("File Versions - /api/storage/files/:fileId/versions", () => {
    describe("GET versions", () => {
      it("should list file versions", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const versions = [
          createMockPlatformFileVersion({ platformFileId: "file-1", versionNumber: 2 }),
          createMockPlatformFileVersion({ platformFileId: "file-1", versionNumber: 1 }),
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

        const response = await client.api.storage.files({ fileId: "file-1" }).versions.get();

        expect(response.status).toBe(200);
        expect(response.data!.values).toHaveLength(2);
        expect(response.data!.totalItems).toBe(2);
      });
    });

    describe("POST versions", () => {
      it("should create new version", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({
            platformUserId: 1,
            isPublic: false,
            platformFilePermissions: [],
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

        const response = await client.api.storage.files({ fileId: "file-1" }).versions.post({
          sizeBytes: 2048,
          storagePath: "/storage/file-1/v2",
        });

        expect(response.status).toBe(200);
        expect(response.data!.versionNumber).toBe(2);
      });
    });

    describe("DELETE versions/:versionId", () => {
      it("should delete version", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce({ platformFileId: "file-1" });
        mockPrisma.platformFileVersion.delete.mockResolvedValueOnce({});

        const response = await client.api.storage.files({ fileId: "file-1" }).versions({ versionId: 1 }).delete();

        expect(response.status).toBe(200);
        expect(response.data!.success).toBe(true);
      });
    });
  });

  describe("File Permissions - /api/storage/files/:fileId/permissions", () => {
    describe("GET permissions", () => {
      it("should list file permissions", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const permissions = [
          {
            id: 1,
            platformUserId: 2,
            permission: "VIEWER",
            platformUser: {
              id: 2,
              user: { name: "Instructor User", email: "instructor@test.com" },
            },
          },
        ];

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformFilePermission.findMany.mockResolvedValueOnce(permissions);

        const response = await client.api.storage.files({ fileId: "file-1" }).permissions.get();

        expect(response.status).toBe(200);
        expect(response.data).toHaveLength(1);
        expect(response.data![0].permission).toBe("VIEWER");
      });
    });

    describe("POST permissions", () => {
      it("should add permission", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
          id: 2,
          user: { name: "Target User", email: "target@test.com" },
        });
        mockPrisma.platformFilePermission.create.mockResolvedValueOnce({
          id: 1,
          platformUserId: 2,
          permission: "EDITOR",
        });

        const response = await client.api.storage.files({ fileId: "file-1" }).permissions.post({
          platformUserId: 2,
          permission: "EDITOR",
        });

        expect(response.status).toBe(200);
        expect(response.data!.platformUserId).toBe(2);
        expect(response.data!.permission).toBe("EDITOR");
      });
    });

    describe("PATCH permissions/:permissionId", () => {
      it("should update permission", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({ platformFileId: "file-1" });
        mockPrisma.platformFilePermission.update.mockResolvedValueOnce({
          id: 1,
          platformUserId: 2,
          permission: "OWNER",
          platformUser: {
            id: 2,
            user: { name: "User", email: "user@test.com" },
          },
        });

        const response = await client.api.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).patch({
          permission: "OWNER",
        });

        expect(response.status).toBe(200);
        expect(response.data!.permission).toBe("OWNER");
      });
    });

    describe("DELETE permissions/:permissionId", () => {
      it("should remove permission", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.findUnique.mockResolvedValueOnce({ platformUserId: 1 });
        mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({ platformFileId: "file-1" });
        mockPrisma.platformFilePermission.delete.mockResolvedValueOnce({});

        const response = await client.api.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).delete();

        expect(response.status).toBe(200);
        expect(response.data!.success).toBe(true);
      });
    });
  });

  describe("GET /api/storage/files/search", () => {
    describe("As Admin", () => {
      it("should search files by name", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockFiles = [
          createMockPlatformFile({ id: "file-1", name: "report.pdf", platformUserId: 1 }),
          createMockPlatformFile({ id: "file-2", name: "annual-report.pdf", platformUserId: 1 }),
        ];

        mockPrisma.platformFile.count.mockResolvedValueOnce(2);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce(mockFiles);
        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({ name: "report.pdf", parentId: null })
          .mockResolvedValueOnce({ name: "annual-report.pdf", parentId: null });

        const response = await client.api.storage.files.search.get({
          query: { query: "report" },
        });

        expect(response.status).toBe(200);
        expect(response.data!.values).toHaveLength(2);
        expect(response.data!.values[0]).toHaveProperty("path");
      });

      it("should filter search by type", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.count.mockResolvedValueOnce(0);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.search.get({
          query: { query: "test", type: "FOLDER" },
        });

        expect(response.status).toBe(200);
        expect(mockPrisma.platformFile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              type: "FOLDER",
            }),
          })
        );
      });

      it("should return empty results for no matches", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.platformFile.count.mockResolvedValueOnce(0);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.search.get({
          query: { query: "nonexistent" },
        });

        expect(response.status).toBe(200);
        expect(response.data!.values).toHaveLength(0);
        expect(response.data!.totalItems).toBe(0);
      });
    });
  });

  describe("Student Role Restrictions", () => {
    describe("File Management - Forbidden", () => {
      it("should return 403 when student updates files", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).patch({
          name: "updated.txt",
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot update files");
      });

      it("should return 403 when student deletes files", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).delete();

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot delete files");
      });

      it("should return 403 when student moves files", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).move.post({
          targetParentId: "folder-1",
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot move files");
      });

      it("should return 403 when student copies files", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).copy.post({
          targetParentId: null,
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot copy files");
      });
    });

    describe("File Versions - Forbidden", () => {
      it("should return 403 when student creates file versions", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).versions.post({
          sizeBytes: 1024,
          storagePath: "/storage/v2",
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot create file versions");
      });

      it("should return 403 when student deletes file versions", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).versions({ versionId: 1 }).delete();

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot delete file versions");
      });
    });

    describe("File Permissions - Forbidden", () => {
      it("should return 403 when student adds file permissions", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).permissions.post({
          platformUserId: 2,
          permission: "VIEWER",
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot add file permissions");
      });

      it("should return 403 when student updates file permissions", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).patch({
          permission: "EDITOR",
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot update file permissions");
      });

      it("should return 403 when student removes file permissions", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.storage.files({ fileId: "file-1" }).permissions({ permissionId: 1 }).delete();

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message", "Forbidden: Students cannot remove file permissions");
      });
    });

    describe("Read-Only Access - Allowed", () => {
      it("should allow student to list files", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        mockPrisma.platformFile.count.mockResolvedValueOnce(0);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.get();

        expect(response.status).toBe(200);
      });

      it("should allow student to search files", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        mockPrisma.platformFile.count.mockResolvedValueOnce(0);
        mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files.search.get({
          query: { query: "test" },
        });

        expect(response.status).toBe(200);
      });

      it("should allow student to view public files", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        const mockFile = createMockPlatformFile({
          id: "file-1",
          name: "public.txt",
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
            name: "public.txt",
            parentId: null,
          });

        const response = await client.api.storage.files({ fileId: "file-1" }).get();

        expect(response.status).toBe(200);
      });

      it("should allow student to view file versions of public files", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        mockPrisma.platformFile.findUnique
          .mockResolvedValueOnce({
            platformUserId: 1,
            isPublic: true,
            platformFilePermissions: [],
          })
          .mockResolvedValueOnce({ type: "FILE" });
        mockPrisma.platformFileVersion.count.mockResolvedValueOnce(0);
        mockPrisma.platformFileVersion.findMany.mockResolvedValueOnce([]);

        const response = await client.api.storage.files({ fileId: "file-1" }).versions.get();

        expect(response.status).toBe(200);
      });
    });
  });
});
