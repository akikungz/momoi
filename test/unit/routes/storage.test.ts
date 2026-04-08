import { beforeEach, describe, expect, it, mock } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { mockAdminAuth, mockStudentAuth } from "@momoi/auth/mock";
import { MockCache } from "@momoi/cache/mock";
import { storageRoute } from "@momoi/routes/storage";
import type { ObjectStorageProvider } from "@momoi/storage-provider";
import { createMockPrisma } from "@test/mocks";

describe("Storage Route", () => {
	let mockPrisma: any;
	let mockCache: MockCache;
	let objectStorage: ObjectStorageProvider;

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
				expiresAt: new Date("2026-01-01T00:00:00.000Z"),
			})),
			createDownloadUrl: mock(async (objectKey: string) => ({
				objectKey,
				url: `https://storage.example/download/${encodeURIComponent(objectKey)}`,
				expiresAt: new Date("2026-01-01T00:00:00.000Z"),
			})),
			deleteObject: mock(async () => {}),
		};
	});

	it("lists owned files", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.count.mockResolvedValueOnce(1);
		mockPrisma.platformFile.findMany.mockResolvedValueOnce([
			{
				id: "file-1",
				name: "Document",
				type: "FILE",
				mimeType: "text/plain",
				extension: "txt",
				description: null,
				parentId: null,
				ownerId: 1,
				sizeBytes: 12,
				visibility: "PRIVATE",
				createdAt: new Date(),
				updatedAt: new Date(),
				trashedAt: null,
				deletedAt: null,
			},
		]);

		const response = await client.storage.files.get({
			query: { page: 1, pageSize: 10 },
		});

		expect(response.status).toBe(200);
		expect(response.data?.values).toHaveLength(1);
		expect(response.data?.values[0].id).toBe("file-1");
	});

	it("lists shared-with-me files when sharedWithMe query is true", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.count.mockResolvedValueOnce(1);
		mockPrisma.platformFile.findMany.mockResolvedValueOnce([
			{
				id: "shared-route-1",
				name: "Shared Route File",
				type: "FILE",
				mimeType: "text/plain",
				extension: "txt",
				description: null,
				parentId: null,
				ownerId: 2,
				sizeBytes: 40,
				visibility: "SHARED",
				createdAt: new Date(),
				updatedAt: new Date(),
				trashedAt: null,
				deletedAt: null,
			},
		]);

		const response = await client.storage.files.get({
			query: { page: 1, pageSize: 10, sharedWithMe: true },
		});

		expect(response.status).toBe(200);
		expect(response.data?.values).toHaveLength(1);
		expect(response.data?.values[0].id).toBe("shared-route-1");
	});

	it("creates upload url via object storage provider", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		const response = await client.storage.files["upload-url"].post({
			filename: "notes.pdf",
			contentType: "application/pdf",
		});

		expect(response.status).toBe(200);
		expect(response.data?.objectKey).toBe("user/1/notes.pdf");
		expect(response.data?.uploadUrl).toContain(
			"https://storage.example/upload/",
		);
	});

	it("creates latest version download url", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-2",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-2-v1",
			},
		});

		const response = await client.storage
			.files({ fileId: "file-2" })
			["download-url"].get();

		expect(response.status).toBe(200);
		expect(response.data?.objectKey).toBe("objects/file-2-v1");
		expect(response.data?.downloadUrl).toContain(
			"https://storage.example/download/",
		);
	});

	it("returns forbidden when download access is denied", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "file-3",
			ownerId: 999,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
			latestVersion: {
				storagePath: "objects/file-3-v1",
			},
		});

		mockPrisma.platformFilePermission.findFirst.mockResolvedValueOnce(null);

		const response = await client.storage
			.files({ fileId: "file-3" })
			["download-url"].get();

		expect(response.status).toBe(403);
	});

	it("blocks student from creating files", async () => {
		const client = treaty(
			storageRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				objectStorage,
			),
		);

		const response = await client.storage.files.post({
			name: "Student file",
			type: "FILE",
			sizeBytes: 10,
		});

		expect(response.status).toBe(403);
	});

	it("returns 404 when file not found", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.findUnique.mockResolvedValueOnce(null);

		const response = await client.storage
			.files({ fileId: "nonexistent" })
			.get();

		expect(response.status).toBe(404);
	});

	it("searches files with query", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.count.mockResolvedValueOnce(1);
		mockPrisma.platformFile.findMany.mockResolvedValueOnce([
			{
				id: "search-1",
				name: "Search Result",
				type: "FILE",
				mimeType: "text/plain",
				extension: "txt",
				description: null,
				parentId: null,
				ownerId: 1,
				sizeBytes: 50,
				visibility: "PRIVATE",
				createdAt: new Date(),
				updatedAt: new Date(),
				trashedAt: null,
				deletedAt: null,
			},
		]);

		const response = await client.storage.files.search.get({
			query: { query: "result", page: 1, pageSize: 10 },
		});

		expect(response.status).toBe(200);
		expect(response.data?.values).toHaveLength(1);
	});

	it("updates file metadata", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "update-1",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFile.update.mockResolvedValueOnce({
			id: "update-1",
			name: "Updated",
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
			trashedAt: null,
			deletedAt: null,
		} as any);

		const response = await client.storage.files({ fileId: "update-1" }).patch({
			name: "Updated",
		});

		expect(response.status).toBe(200);
		expect(response.data?.name).toBe("Updated");
	});

	it("deletes file", async () => {
		const client = treaty(
			storageRoute(mockPrisma, mockCache as any, mockAdminAuth, objectStorage),
		);

		mockPrisma.platformFile.findUnique.mockResolvedValueOnce({
			id: "delete-1",
			ownerId: 1,
			visibility: "PRIVATE",
			deletedAt: null,
			trashedAt: null,
		});

		mockPrisma.platformFile.update.mockResolvedValueOnce({
			id: "delete-1",
			name: "file",
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

		const response = await client.storage
			.files({ fileId: "delete-1" })
			.delete();

		expect(response.status).toBe(200);
		expect(response.data?.id).toBe("delete-1");
	});
});
