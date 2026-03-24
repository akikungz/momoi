import { beforeEach, describe, expect, it, mock } from "bun:test";

import { MockCache } from "@momoi/cache/mock";
import { StorageService } from "@momoi/service/storage";
import type { ObjectStorageProvider } from "@momoi/storage-provider";
import { createMockPrisma } from "@test/mocks";

describe("StorageService", () => {
	let mockPrisma: any;
	let mockCache: MockCache;
	let objectStorage: ObjectStorageProvider;
	let storageService: StorageService;

	const instructorUser = {
		id: 1,
		role: "INSTRUCTOR" as const,
		email: "instructor@example.com",
	};

	beforeEach(() => {
		mockPrisma = createMockPrisma() as any;
		mockCache = new MockCache();

		objectStorage = {
			kind: "s3",
			enabled: true,
			createObjectKey: mock(
				(ownerId: number, filename?: string) =>
					`user/${ownerId}/${filename ?? "file.bin"}`,
			),
			createUploadUrl: mock(async (objectKey: string) => ({
				objectKey,
				url: `https://storage.example/upload/${encodeURIComponent(objectKey)}`,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000),
			})),
			createDownloadUrl: mock(async (objectKey: string) => ({
				objectKey,
				url: `https://storage.example/download/${encodeURIComponent(objectKey)}`,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000),
			})),
			deleteObject: mock(async () => {}),
		};

		storageService = new StorageService(
			mockPrisma,
			mockCache as any,
			objectStorage,
		);
	});

	it("creates presigned upload url for new file", async () => {
		const result = await storageService.createUploadUrl(instructorUser, {
			filename: "notes.pdf",
			contentType: "application/pdf",
		});

		expect(result.objectKey).toBe("user/1/notes.pdf");
		expect(result.uploadUrl).toContain("https://storage.example/upload/");
		expect(result.expiresAt).toBeInstanceOf(Date);
		expect(objectStorage.createObjectKey).toHaveBeenCalledWith(1, "notes.pdf");
		expect(objectStorage.createUploadUrl).toHaveBeenCalledWith(
			"user/1/notes.pdf",
			"application/pdf",
		);
	});

	it("rejects upload url creation when provider is disabled", async () => {
		storageService = new StorageService(mockPrisma, mockCache as any, {
			...objectStorage,
			kind: "database",
			enabled: false,
		});

		await expect(
			storageService.createUploadUrl(instructorUser, {
				filename: "notes.pdf",
				contentType: "application/pdf",
			}),
		).rejects.toThrow("S3 storage provider is not enabled.");
	});

	it("creates version upload url only for file owner", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-1",
			name: "notes.pdf",
			type: "FILE",
			mimeType: "application/pdf",
			extension: "pdf",
			description: null,
			parentId: null,
			sizeBytes: 123,
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		const result = await storageService.createVersionUploadUrl(
			instructorUser,
			"file-1",
			{
				filename: "notes-v2.pdf",
				contentType: "application/pdf",
			},
		);

		expect(result.objectKey).toBe("user/1/notes-v2.pdf");
		expect(objectStorage.createUploadUrl).toHaveBeenCalled();
	});

	it("creates latest version download url from provider", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-2",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-2-v3",
			},
		});

		const result = await storageService.createDownloadUrl(
			instructorUser,
			"file-2",
		);

		expect(result.objectKey).toBe("objects/file-2-v3");
		expect(result.downloadUrl).toContain("https://storage.example/download/");
		expect(objectStorage.createDownloadUrl).toHaveBeenCalledWith(
			"objects/file-2-v3",
		);
		expect(mockCache.createCacheKey).toHaveBeenCalled();
	});

	it("returns cached latest version download url when available and not expired", async () => {
		const cachedExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-2-cache",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-2-cache-v1",
			},
		});

		mockCache.getCacheValue.mockResolvedValueOnce(
			JSON.stringify({
				url: "https://storage.example/download/cached-url",
				expiresAt: cachedExpiresAt.toISOString(),
			}),
		);

		const result = await storageService.createDownloadUrl(
			instructorUser,
			"file-2-cache",
		);

		expect(result.objectKey).toBe("objects/file-2-cache-v1");
		expect(result.downloadUrl).toBe(
			"https://storage.example/download/cached-url",
		);
		expect(result.expiresAt.toISOString()).toBe(cachedExpiresAt.toISOString());
		expect(objectStorage.createDownloadUrl).not.toHaveBeenCalled();
	});

	it("caches version download url with ttl based on expiresAt", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-5-ttl",
			ownerId: 999,
			visibility: "SHARED",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFilePermission.findFirst.mockResolvedValueOnce({
			permission: "VIEWER",
		});

		mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce({
			id: 11,
			platformFileId: "file-5-ttl",
			storagePath: "objects/file-5-v11",
		});

		await storageService.createVersionDownloadUrl(
			instructorUser,
			"file-5-ttl",
			11,
		);

		expect(mockCache.createCacheKey).toHaveBeenCalled();
		const ttlArg = mockCache.createCacheKey.mock.calls[0][2];
		expect(typeof ttlArg).toBe("number");
		expect(ttlArg).toBeGreaterThan(0);
	});

	it("falls back to storage path when provider is disabled for download", async () => {
		storageService = new StorageService(mockPrisma, mockCache as any, {
			...objectStorage,
			kind: "database",
			enabled: false,
		});

		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-3",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-3-v1",
			},
		});

		const result = await storageService.createDownloadUrl(
			instructorUser,
			"file-3",
		);

		expect(result.objectKey).toBe("objects/file-3-v1");
		expect(result.downloadUrl).toBe("objects/file-3-v1");
		expect(result.expiresAt).toBeInstanceOf(Date);
	});

	it("blocks download url when user has no access", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-4",
			ownerId: 999,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-4-v1",
			},
		});

		mockPrisma.platformFilePermission.findFirst.mockResolvedValueOnce(null);

		await expect(
			storageService.createDownloadUrl(instructorUser, "file-4"),
		).rejects.toThrow("Forbidden: You don't have access to this file.");
	});

	it("creates version download url for permitted user", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-5",
			ownerId: 999,
			visibility: "SHARED",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFilePermission.findFirst.mockResolvedValueOnce({
			permission: "VIEWER",
		});

		mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce({
			id: 10,
			platformFileId: "file-5",
			storagePath: "objects/file-5-v10",
		});

		const result = await storageService.createVersionDownloadUrl(
			instructorUser,
			"file-5",
			10,
		);

		expect(result.objectKey).toBe("objects/file-5-v10");
		expect(objectStorage.createDownloadUrl).toHaveBeenCalledWith(
			"objects/file-5-v10",
		);
	});

	it("deletes version and object key when s3 provider is enabled", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-6",
			name: "file-6",
			type: "FILE",
			mimeType: "text/plain",
			extension: "txt",
			description: null,
			parentId: null,
			sizeBytes: 50,
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce({
			id: 11,
			platformFileId: "file-6",
			storagePath: "objects/file-6-v11",
		});

		mockPrisma.platformFileVersion.findFirst.mockResolvedValueOnce({
			id: 10,
			sizeBytes: 49,
			mimeType: "text/plain",
		});

		const result = await storageService.deleteVersion(
			instructorUser,
			"file-6",
			11,
		);

		expect(result.success).toBe(true);
		expect(mockPrisma.platformFileVersion.delete).toHaveBeenCalledWith({
			where: { id: 11 },
		});
		expect(objectStorage.deleteObject).toHaveBeenCalledWith(
			"objects/file-6-v11",
		);
	});

	it("throws error when file not found", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce(null);

		await expect(
			storageService.createDownloadUrl(instructorUser, "nonexistent"),
		).rejects.toThrow("File or latest version not found.");
	});

	it("throws error when version not found", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-7",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFileVersion.findUnique.mockResolvedValueOnce(null);

		await expect(
			storageService.createVersionDownloadUrl(instructorUser, "file-7", 99),
		).rejects.toThrow("Version not found.");
	});

	it("forbids access to trashed files", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-8",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: new Date(),
			latestVersion: {
				storagePath: "objects/file-8-v1",
			},
		});

		await expect(
			storageService.createDownloadUrl(instructorUser, "file-8"),
		).rejects.toThrow("File or latest version not found.");
	});

	it("forbids access to deleted files", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-9",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: new Date(),
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-9-v1",
			},
		});

		await expect(
			storageService.createDownloadUrl(instructorUser, "file-9"),
		).rejects.toThrow("File or latest version not found.");
	});

	it("allows PUBLIC file download without permission", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-10",
			ownerId: 999,
			visibility: "PUBLIC",
			deletedAt: null,
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-10-v1",
			},
		});

		const result = await storageService.createDownloadUrl(
			instructorUser,
			"file-10",
		);

		expect(result.objectKey).toBe("objects/file-10-v1");
		expect(objectStorage.createDownloadUrl).toHaveBeenCalled();
	});

	it("returns empty results for files search with no matches", async () => {
		mockPrisma.platformFile.count.mockResolvedValueOnce(0);
		mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

		const result = await storageService.searchFiles(instructorUser, {
			query: "nonexistent",
			page: 1,
			pageSize: 10,
		});

		expect(result.values).toHaveLength(0);
		expect(result.totalItems).toBe(0);
	});

	it("gets file detail with metadata", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-11",
			name: "Details Test",
			type: "FILE",
			mimeType: "application/json",
			extension: "json",
			description: "Test file for details",
			parentId: null,
			ownerId: 1,
			sizeBytes: 256,
			visibility: "PRIVATE",
			createdAt: new Date(),
			updatedAt: new Date(),
			trashedAt: null,
			deletedAt: null,
			latestVersion: {
				id: 1,
				versionNumber: 1,
				sizeBytes: 256,
				mimeType: "application/json",
				createdAt: new Date(),
				createdBy: {
					id: 1,
					email: "instructor@example.com",
					profile: { displayName: "Instructor" },
				},
			},
		});

		const result = await storageService.getFileDetail(
			instructorUser,
			"file-11",
		);

		expect(result.id).toBe("file-11");
		expect(result.name).toBe("Details Test");
		expect(result.accessRole).toBe("OWNER");
	});

	it("deletes file as owner", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-12",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFile.update.mockResolvedValueOnce({
			id: "file-12",
			name: "file-12",
			type: "FILE",
			mimeType: "text/plain",
			extension: "txt",
			description: null,
			parentId: null,
			ownerId: 1,
			sizeBytes: 100,
			visibility: "PRIVATE",
			createdAt: new Date(),
			updatedAt: new Date(),
			trashedAt: new Date(),
			deletedAt: null,
		} as any);

		const result = await storageService.deleteFile(instructorUser, "file-12");

		expect(result.id).toBe("file-12");
		expect(mockPrisma.platformFile.update).toHaveBeenCalledWith({
			where: { id: "file-12" },
			data: { trashedAt: expect.any(Date) },
			select: expect.any(Object),
		});
	});

	it("updates file metadata as owner", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-13",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFile.update.mockResolvedValueOnce({
			id: "file-13",
			name: "Updated Name",
			type: "FILE",
			mimeType: "text/plain",
			extension: "txt",
			description: "Updated description",
			parentId: null,
			ownerId: 1,
			sizeBytes: 100,
			visibility: "PRIVATE",
			createdAt: new Date(),
			updatedAt: new Date(),
			trashedAt: null,
			deletedAt: null,
		} as any);

		const result = await storageService.updateFile(instructorUser, "file-13", {
			name: "Updated Name",
			description: "Updated description",
		});

		expect(result.name).toBe("Updated Name");
		expect(result.description).toBe("Updated description");
	});

	it("forbids non-owner from deleting file", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-14",
			ownerId: 999,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFilePermission.findFirst.mockResolvedValueOnce(null);

		await expect(
			storageService.deleteFile(instructorUser, "file-14"),
		).rejects.toThrow("Forbidden");
	});

	it("creates permission for file owner", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-15",
			ownerId: 1,
			visibility: "SHARED",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.account.findUnique.mockResolvedValueOnce({
			id: 2,
			email: "viewer@example.com",
		} as any);

		mockPrisma.platformFilePermission.create.mockResolvedValueOnce({
			id: 1,
			platformFileId: "file-15",
			accountId: 2,
			permission: "VIEWER",
			createdAt: new Date(),
			updatedAt: new Date(),
			account: {
				id: 2,
				email: "viewer@example.com",
				profile: { displayName: "Viewer" },
			},
		} as any);

		const result = await storageService.createPermission(
			instructorUser,
			"file-15",
			{
				email: "viewer@example.com",
				permission: "VIEWER",
			},
		);

		expect(result.permission).toBe("VIEWER");
	});

	it("updates permission as file owner", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-16",
			ownerId: 1,
			visibility: "SHARED",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({
			id: 1,
			platformFileId: "file-16",
		});

		mockPrisma.platformFilePermission.update.mockResolvedValueOnce({
			id: 1,
			permission: "EDITOR",
			account: {
				id: 2,
				email: "editor@example.com",
				profile: { displayName: "Editor" },
			},
		} as any);

		const result = await storageService.updatePermission(
			instructorUser,
			"file-16",
			1,
			{
				permission: "EDITOR",
			},
		);

		expect(result.permission).toBe("EDITOR");
	});

	it("deletes permission as file owner", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-17",
			ownerId: 1,
			visibility: "SHARED",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFilePermission.findUnique.mockResolvedValueOnce({
			id: 1,
			platformFileId: "file-17",
		});

		mockPrisma.platformFilePermission.delete.mockResolvedValueOnce({
			id: 1,
		} as any);

		await storageService.deletePermission(instructorUser, "file-17", 1);

		expect(mockPrisma.platformFilePermission.delete).toHaveBeenCalledWith({
			where: { id: 1 },
		});
	});

	it("blocks students from uploading files", async () => {
		const studentUser = {
			id: 2,
			role: "STUDENT" as const,
			email: "student@example.com",
		};

		await expect(
			storageService.createUploadUrl(studentUser, {
				filename: "student.pdf",
			}),
		).rejects.toThrow("Forbidden: Students cannot manage storage files.");
	});

	it("allows instructors to upload files", async () => {
		const result = await storageService.createUploadUrl(instructorUser, {
			filename: "instructor-notes.pdf",
			contentType: "application/pdf",
		});

		expect(result.objectKey).toContain("user/1/");
		expect(result.uploadUrl).toContain("https://storage.example/upload/");
	});

	it("gets versions list for accessible file", async () => {
		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-18",
			name: "file-18",
			type: "FILE",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFileVersion.findMany.mockResolvedValueOnce([
			{
				id: 1,
				versionNumber: 1,
				sizeBytes: 100,
				mimeType: "text/plain",
				createdAt: new Date(),
				createdBy: {
					id: 1,
					email: "instructor@example.com",
					profile: { displayName: "Instructor" },
				},
			},
			{
				id: 2,
				versionNumber: 2,
				sizeBytes: 120,
				mimeType: "text/plain",
				createdAt: new Date(),
				createdBy: {
					id: 1,
					email: "instructor@example.com",
					profile: { displayName: "Instructor" },
				},
			},
		] as any);

		const result = await storageService.getVersions(instructorUser, "file-18");

		expect(result.values).toHaveLength(2);
		expect(result.values[1].versionNumber).toBe(2);
	});

	it("lists files shared with current user when sharedWithMe is true", async () => {
		mockPrisma.platformFile.count.mockResolvedValueOnce(1);
		mockPrisma.platformFile.findMany.mockResolvedValueOnce([
			{
				id: "shared-1",
				name: "Shared Note",
				type: "FILE",
				mimeType: "text/plain",
				extension: "txt",
				description: null,
				parentId: null,
				ownerId: 2,
				sizeBytes: 42,
				visibility: "SHARED",
				createdAt: new Date(),
				updatedAt: new Date(),
				trashedAt: null,
				deletedAt: null,
			},
		]);

		const result = await storageService.getFiles(instructorUser, {
			page: 1,
			pageSize: 10,
			sharedWithMe: true,
		});

		expect(result.values).toHaveLength(1);
		expect(result.values[0].id).toBe("shared-1");
		expect(mockPrisma.platformFile.count).toHaveBeenCalledWith({
			where: expect.objectContaining({
				ownerId: { not: 1 },
				platformFilePermissions: {
					some: expect.objectContaining({
						AND: expect.any(Array),
					}),
				},
			}),
		});
	});

	it("lists owned files by default when sharedWithMe is not provided", async () => {
		mockPrisma.platformFile.count.mockResolvedValueOnce(0);
		mockPrisma.platformFile.findMany.mockResolvedValueOnce([]);

		await storageService.getFiles(instructorUser, {
			page: 1,
			pageSize: 10,
		});

		expect(mockPrisma.platformFile.count).toHaveBeenCalledWith({
			where: expect.objectContaining({
				ownerId: 1,
			}),
		});
	});
});
