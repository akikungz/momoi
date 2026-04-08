import type { Static } from "elysia";

import type {
	CopyStorageFileRequestBody,
	CreateStorageFilePermissionRequestBody,
	CreateStorageFileRequestBody,
	CreateStorageUploadUrlRequestBody,
	GetStorageFilePermissionsResponse,
	GetStorageFilesRequestQuery,
	SearchStorageFilesRequestQuery,
	StorageDownloadUrlResponse,
	StorageFileDetailResponse,
	StorageFileListResponse,
	StorageFilePermissionItem,
	StorageUploadUrlResponse,
	UpdateStorageFilePermissionRequestBody,
	UpdateStorageFileRequestBody,
	UserRole,
} from "@momoi/model/storage";
import {
	recordStorageBytes,
	recordStorageDownloadUrlCacheResult,
	recordStorageOperation,
} from "@momoi/telemetry/runtime";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";
import {
	buildPaginationResponse,
	parsePagination,
} from "@momoi/utils/pagination";

import type {
	JsonCacheStore,
	StorageDataAccess,
	StorageProviderPort,
} from "./ports";
import type { CurrentStorageUser } from "@momoi/service/storage";

const FILE_SELECT = {
	id: true,
	name: true,
	type: true,
	mimeType: true,
	extension: true,
	description: true,
	ownerId: true,
	sizeBytes: true,
	createdAt: true,
	updatedAt: true,
	trashedAt: true,
	deletedAt: true,
} as const;

const FILE_PERMISSION_SELECT = {
	id: true,
	platformFileId: true,
	platformUserId: true,
	email: true,
	permission: true,
	canReshare: true,
	expiresAt: true,
	grantedById: true,
	createdAt: true,
	updatedAt: true,
} as const;

const DOWNLOAD_URL_CACHE_PREFIX = "storage:download-url";
const DOWNLOAD_URL_CACHE_SAFETY_BUFFER_SECONDS = 30;

type CachedDownloadUrl = {
	url: string;
	expiresAt: string;
};

type PlatformFileVisibility = "PRIVATE" | "SHARED" | "PUBLIC";
type PlatformFileViewerRole = "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";

export class StorageUseCases {
	constructor(
		private readonly dataAccess: StorageDataAccess,
		private readonly cache: JsonCacheStore,
		private readonly objectStoragePort: StorageProviderPort,
	) {}

	private get objectStorage() {
		return this.objectStoragePort.provider;
	}

	private get prismaUnsafe() {
		return this.dataAccess.prisma as unknown as Record<string, any>;
	}

	private unsupportedFeature(feature: string): never {
		throw new ServiceError(
			`${feature} is not available in the current database schema.`,
			501,
		);
	}

	public async getFiles(
		user: CurrentStorageUser,
		query: Static<typeof GetStorageFilesRequestQuery>,
	): Promise<Static<typeof StorageFileListResponse>> {
		const pagination = parsePagination(query);

		const now = new Date();
		const where: Record<string, unknown> = {
			type: query.type ?? undefined,
			trashedAt: null,
			deletedAt: null,
		};

		if (query.parentId) {
			where.parentId = query.parentId;
		}

		if (query.sharedWithMe) {
			where.ownerId = { not: user.id };
			where.platformFilePermissions = {
				some: {
					AND: [
						{
							OR: [{ platformUserId: user.id }, { email: user.email }],
						},
						{
							OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
						},
					],
				},
			};
		} else {
			where.ownerId = user.id;
		}

		let totalItems = 0;
		let rows: any[] = [];

		try {
			[totalItems, rows] = await Promise.all([
				this.dataAccess.prisma.platformFile.count({ where: where as any }),
				this.dataAccess.prisma.platformFile.findMany({
					where: where as any,
					select: FILE_SELECT,
					orderBy: [{ type: "asc" }, { name: "asc" }],
					skip: pagination.skip,
					take: pagination.take,
				}),
			]);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (message.includes("Unknown argument `parentId`")) {
				this.unsupportedFeature("Folder hierarchy");
			}
			if (message.includes("Unknown argument `platformFilePermissions`")) {
				this.unsupportedFeature("File sharing");
			}
			throw error;
		}

		return {
			values: rows.map((row) => this.mapFileItem(row)),
			...buildPaginationResponse(
				totalItems,
				pagination.page,
				pagination.pageSize,
			),
		};
	}

	public async searchFiles(
		user: CurrentStorageUser,
		query: Static<typeof SearchStorageFilesRequestQuery>,
	): Promise<Static<typeof StorageFileListResponse>> {
		const pagination = parsePagination(query);

		const where = {
			ownerId: user.id,
			type: query.type ?? undefined,
			trashedAt: null,
			deletedAt: null,
			name: {
				contains: query.query,
				mode: "insensitive" as const,
			},
		};

		const [totalItems, rows] = await Promise.all([
			this.dataAccess.prisma.platformFile.count({ where }),
			this.dataAccess.prisma.platformFile.findMany({
				where,
				select: FILE_SELECT,
				orderBy: [{ type: "asc" }, { name: "asc" }],
				skip: pagination.skip,
				take: pagination.take,
			}),
		]);

		return {
			values: rows.map((row) => this.mapFileItem(row)),
			...buildPaginationResponse(
				totalItems,
				pagination.page,
				pagination.pageSize,
			),
		};
	}

	public async getFileDetail(
		user: CurrentStorageUser,
		fileId: string,
	): Promise<Static<typeof StorageFileDetailResponse>> {
		const file = await this.dataAccess.prisma.platformFile.findUnique({
			where: { id: fileId },
			select: FILE_SELECT,
		});

		if (!file || file.deletedAt || file.trashedAt) {
			throw new ServiceError("File not found.", 404);
		}

		const accessRole = await this.getAccessRole(
			user,
			file.id,
			file.ownerId,
			(file as { visibility?: PlatformFileVisibility }).visibility ?? "PRIVATE",
		);
		if (!accessRole) {
			throw new ServiceError(
				"Forbidden: You don't have access to this file.",
				403,
			);
		}

		return {
			...this.mapFileItem(file),
			accessRole,
		};
	}

	public async createFile(
		user: CurrentStorageUser,
		body: Static<typeof CreateStorageFileRequestBody>,
	) {
		this.assertCanMutateStorage(user.role);

		try {
			if (body.parentId) {
				this.unsupportedFeature("Folder hierarchy");
			}

			const created = await this.dataAccess.prisma.$transaction(async (tx) => {
				const file = await tx.platformFile.create({
					data: {
						name: body.name,
						type: body.type,
						mimeType: body.mimeType,
						extension: body.extension,
						description: body.description,
						ownerId: user.id,
						sizeBytes: body.type === "FILE" ? (body.sizeBytes ?? 0) : 0,
					},
					select: FILE_SELECT,
				});



				return file;
			});

			return this.mapFileItem(created);
		} catch (error: unknown) {
			handlePrismaError(error, "while creating a storage file", {
				duplicateMessage: "A file/folder with the same name already exists.",
			});
		}
	}

	public async updateFile(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof UpdateStorageFileRequestBody>,
	) {
		this.assertCanMutateStorage(user.role);

		const file = await this.requireOwnedFile(user.id, fileId);

		const updated = await this.dataAccess.prisma.platformFile.update({
			where: { id: file.id },
			data: {
				name: body.name,
				description: body.description,
			},
			select: FILE_SELECT,
		});

		return this.mapFileItem(updated);
	}

	public async deleteFile(user: CurrentStorageUser, fileId: string) {
		this.assertCanMutateStorage(user.role);

		const file = await this.requireOwnedFile(user.id, fileId);

		const updated = await this.dataAccess.prisma.platformFile.update({
			where: { id: file.id },
			data: {
				trashedAt: new Date(),
			},
			select: FILE_SELECT,
		});

		return this.mapFileItem(updated);
	}

	public async moveFile(
		user: CurrentStorageUser,
		fileId: string,
		parentId?: string,
	) {
		this.assertCanMutateStorage(user.role);

		if (parentId) {
			this.unsupportedFeature("Folder hierarchy");
		}

		const file = await this.requireOwnedFile(user.id, fileId);

		const moved = await this.dataAccess.prisma.platformFile.update({
			where: { id: file.id },
			data: {},
			select: FILE_SELECT,
		});

		return this.mapFileItem(moved);
	}

	public async copyFile(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof CopyStorageFileRequestBody>,
	) {
		this.assertCanMutateStorage(user.role);

		const source = await this.requireOwnedFile(user.id, fileId);

		if (body.parentId) {
			this.unsupportedFeature("Folder hierarchy");
		}

		const copied = await this.dataAccess.prisma.$transaction(async (tx) => {
			const newFile = await tx.platformFile.create({
				data: {
					name: body.name ?? `${source.name} (copy)`,
					type: source.type,
					mimeType: source.mimeType,
					extension: source.extension,
					description: source.description,
					ownerId: user.id,
					sizeBytes: source.sizeBytes,
				},
				select: FILE_SELECT,
			});



			return newFile;
		});

		return this.mapFileItem(copied);
	}





	public async createUploadUrl(
		user: CurrentStorageUser,
		body: Static<typeof CreateStorageUploadUrlRequestBody>,
	): Promise<Static<typeof StorageUploadUrlResponse>> {
		this.assertCanMutateStorage(user.role);

		if (!this.objectStorage.enabled) {
			throw new ServiceError("S3 storage provider is not enabled.", 400);
		}

		const objectKey = this.objectStorage.createObjectKey(
			user.id,
			body.filename,
		);
		const presigned = await this.objectStorage.createUploadUrl(
			objectKey,
			body.contentType,
		);
		recordStorageOperation("create_upload_url", {
			"storage.upload.kind": "file",
		});

		return {
			objectKey: presigned.objectKey,
			uploadUrl: presigned.url,
			expiresAt: presigned.expiresAt,
		};
	}



	public async createDownloadUrl(
		user: CurrentStorageUser,
		fileId: string,
	): Promise<Static<typeof StorageDownloadUrlResponse>> {
		const file = await this.dataAccess.prisma.platformFile.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				ownerId: true,
				deletedAt: true,
				trashedAt: true,
				latestVersionId: true,
				latestVersion: {
					select: {
						storagePath: true,
					},
				},
			},
		});

		const fileWithLegacy = file as
			| ({
					id: string;
					ownerId: number;
					deletedAt: Date | null;
					trashedAt: Date | null;
					latestVersionId: number | null;
				} & {
					visibility?: PlatformFileVisibility;
					latestVersion?: { storagePath?: string | null } | null;
				})
			| null;

		if (
			!fileWithLegacy ||
			fileWithLegacy.deletedAt ||
			fileWithLegacy.trashedAt
		) {
			throw new ServiceError("File or latest version not found.", 404);
		}

		const storagePath = fileWithLegacy.latestVersion?.storagePath ?? null;

		if (!storagePath) {
			throw new ServiceError("File not found.", 404);
		}

		const accessRole = await this.getAccessRole(
			user,
			fileWithLegacy.id,
			fileWithLegacy.ownerId,
			fileWithLegacy.visibility ?? "PRIVATE",
		);
		if (!accessRole) {
			throw new ServiceError(
				"Forbidden: You don't have access to this file.",
				403,
			);
		}

		if (!this.objectStorage.enabled) {
			recordStorageOperation("create_download_url", {
				"storage.download.kind": "file",
				"storage.source": "local",
			});
			return {
				objectKey: storagePath,
				downloadUrl: storagePath,
				expiresAt: new Date(Date.now() + 5 * 60 * 1000),
			};
		}

		const presigned = await this.getOrCreateCachedDownloadUrl(storagePath);
		recordStorageOperation("create_download_url", {
			"storage.download.kind": "file",
			"storage.source": "object_storage",
		});
		return {
			objectKey: presigned.objectKey,
			downloadUrl: presigned.url,
			expiresAt: presigned.expiresAt,
		};
	}





	public async getPermissions(
		user: CurrentStorageUser,
		fileId: string,
	): Promise<Static<typeof GetStorageFilePermissionsResponse>> {
		if (!this.prismaUnsafe.platformFilePermission) {
			this.unsupportedFeature("File permissions");
		}

		await this.requireOwnedFile(user.id, fileId);

		const permissions =
			await this.prismaUnsafe.platformFilePermission.findMany({
				where: { platformFileId: fileId },
				select: FILE_PERMISSION_SELECT,
				orderBy: { createdAt: "desc" },
			});

		return {
			values: permissions.map((p: any) => this.mapPermissionItem(p)),
		};
	}

	public async createPermission(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof CreateStorageFilePermissionRequestBody>,
	): Promise<Static<typeof StorageFilePermissionItem>> {
		if (!this.prismaUnsafe.platformFilePermission) {
			this.unsupportedFeature("File permissions");
		}

		await this.requireOwnedFile(user.id, fileId);

		if (!body.platformUserId && !body.email) {
			throw new ServiceError(
				"Either platformUserId or email must be provided.",
				400,
			);
		}

		if (body.platformUserId && body.email) {
			throw new ServiceError(
				"Provide either platformUserId or email, not both.",
				400,
			);
		}

		try {
			const created =
				await this.prismaUnsafe.platformFilePermission.create({
					data: {
						platformFileId: fileId,
						platformUserId: body.platformUserId,
						email: body.email,
						permission: body.permission as PlatformFileViewerRole,
						canReshare: body.canReshare ?? false,
						expiresAt: body.expiresAt,
						grantedById: user.id,
					},
					select: FILE_PERMISSION_SELECT,
				});

			return this.mapPermissionItem(created);
		} catch (error: unknown) {
			handlePrismaError(error, "while creating file permission", {
				duplicateMessage: "Permission already exists for this target.",
			});
		}
	}

	public async updatePermission(
		user: CurrentStorageUser,
		fileId: string,
		permissionId: number,
		body: Static<typeof UpdateStorageFilePermissionRequestBody>,
	): Promise<Static<typeof StorageFilePermissionItem>> {
		if (!this.prismaUnsafe.platformFilePermission) {
			this.unsupportedFeature("File permissions");
		}

		await this.requireOwnedFile(user.id, fileId);

		const existing =
			await this.prismaUnsafe.platformFilePermission.findUnique({
				where: { id: permissionId },
				select: { id: true, platformFileId: true },
			});

		if (!existing || existing.platformFileId !== fileId) {
			throw new ServiceError("Permission not found.", 404);
		}

		const updated = await this.prismaUnsafe.platformFilePermission.update({
			where: { id: permissionId },
			data: {
				permission: body.permission as PlatformFileViewerRole | undefined,
				canReshare: body.canReshare,
				expiresAt: body.expiresAt,
			},
			select: FILE_PERMISSION_SELECT,
		});

		return this.mapPermissionItem(updated);
	}

	public async deletePermission(
		user: CurrentStorageUser,
		fileId: string,
		permissionId: number,
	) {
		if (!this.prismaUnsafe.platformFilePermission) {
			this.unsupportedFeature("File permissions");
		}

		await this.requireOwnedFile(user.id, fileId);

		const existing =
			await this.prismaUnsafe.platformFilePermission.findUnique({
				where: { id: permissionId },
				select: { id: true, platformFileId: true },
			});

		if (!existing || existing.platformFileId !== fileId) {
			throw new ServiceError("Permission not found.", 404);
		}

		await this.prismaUnsafe.platformFilePermission.delete({
			where: { id: permissionId },
		});

		return { success: true };
	}

	private mapFileItem(file: {
		id: string;
		name: string;
		type: "FILE" | "FOLDER";
		mimeType: string | null;
		extension: string | null;
		description: string | null;
		parentId?: string | null;
		ownerId: number;
		sizeBytes: number;
		visibility?: PlatformFileVisibility;
		createdAt: Date;
		updatedAt: Date;
	}) {
		return {
			id: file.id,
			name: file.name,
			type: file.type,
			mimeType: file.mimeType ?? undefined,
			extension: file.extension ?? undefined,
			description: file.description ?? undefined,
			parentId: file.parentId ?? undefined,
			ownerId: file.ownerId,
			sizeBytes: file.sizeBytes,
			visibility: (file.visibility ?? "PRIVATE") as PlatformFileVisibility,
			createdAt: file.createdAt,
			updatedAt: file.updatedAt,
		};
	}

	private mapPermissionItem(permission: {
		id: number;
		platformFileId: string;
		platformUserId: number | null;
		email: string | null;
		permission: PlatformFileViewerRole;
		canReshare: boolean;
		expiresAt: Date | null;
		grantedById: number | null;
		createdAt: Date;
		updatedAt: Date;
	}): Static<typeof StorageFilePermissionItem> {
		return {
			id: permission.id,
			platformFileId: permission.platformFileId,
			platformUserId: permission.platformUserId ?? undefined,
			email: permission.email ?? undefined,
			permission: permission.permission,
			canReshare: permission.canReshare,
			expiresAt: permission.expiresAt ?? undefined,
			grantedById: permission.grantedById ?? undefined,
			createdAt: permission.createdAt,
			updatedAt: permission.updatedAt,
		};
	}

	private async requireOwnedFile(ownerId: number, fileId: string) {
		const file = await this.dataAccess.prisma.platformFile.findUnique({
			where: { id: fileId },
			select: {
				id: true,
				name: true,
				type: true,
				mimeType: true,
				extension: true,
				description: true,
				sizeBytes: true,
				ownerId: true,
				deletedAt: true,
				trashedAt: true,
			},
		});

		if (!file || file.deletedAt || file.trashedAt) {
			throw new ServiceError("File not found.", 404);
		}

		if (file.ownerId !== ownerId) {
			throw new ServiceError("Forbidden: Owner only.", 403);
		}

		return file;
	}

	private async getAccessRole(
		user: CurrentStorageUser,
		fileId: string,
		ownerId: number,
		visibility: PlatformFileVisibility,
	): Promise<PlatformFileViewerRole | null> {
		if (ownerId === user.id) return "OWNER";

		if (visibility === "PUBLIC") return "VIEWER";

		const permissionDelegate = this.prismaUnsafe.platformFilePermission;
		if (!permissionDelegate) {
			return null;
		}

		const now = new Date();
		const permission = await permissionDelegate.findFirst({
			where: {
				platformFileId: fileId,
				AND: [
					{
						OR: [{ platformUserId: user.id }, { email: user.email }],
					},
					{
						OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
					},
				],
			},
			select: {
				permission: true,
			},
		});

		return (permission?.permission as PlatformFileViewerRole | undefined) ?? null;
	}

	private assertCanMutateStorage(role: UserRole) {
		if (role === "STUDENT") {
			throw new ServiceError(
				"Forbidden: Students cannot manage storage files.",
				403,
			);
		}
	}

	private buildDownloadUrlCacheKey(objectKey: string): string {
		return `${DOWNLOAD_URL_CACHE_PREFIX}:${objectKey}`;
	}

	private async getOrCreateCachedDownloadUrl(objectKey: string) {
		const cacheKey = this.buildDownloadUrlCacheKey(objectKey);

		try {
			const cached = await this.cache.get<CachedDownloadUrl>(cacheKey);
			if (cached) {
				const expiresAt = new Date(cached.expiresAt);
				if (expiresAt.getTime() > Date.now()) {
					recordStorageDownloadUrlCacheResult("hit", {
						"storage.cache.scope": "download_url",
					});
					return {
						objectKey,
						url: cached.url,
						expiresAt,
					};
				}
			}
		} catch (error) {
			console.warn("Failed reading cached presigned download URL", {
				error,
				objectKey,
			});
		}
		recordStorageDownloadUrlCacheResult("miss", {
			"storage.cache.scope": "download_url",
		});

		const presigned = await this.objectStorage.createDownloadUrl(objectKey);

		const ttlSeconds =
			Math.floor((presigned.expiresAt.getTime() - Date.now()) / 1000) -
			DOWNLOAD_URL_CACHE_SAFETY_BUFFER_SECONDS;
		if (ttlSeconds > 0) {
			try {
				const payload: CachedDownloadUrl = {
					url: presigned.url,
					expiresAt: presigned.expiresAt.toISOString(),
				};

				await this.cache.set(cacheKey, payload, ttlSeconds);
			} catch (error) {
				console.warn("Failed writing cached presigned download URL", {
					error,
					objectKey,
				});
			}
		}

		return presigned;
	}
}
