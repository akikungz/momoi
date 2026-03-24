import type { Static } from "elysia";

import type {
	CopyStorageFileRequestBody,
	CreateStorageFilePermissionRequestBody,
	CreateStorageFileRequestBody,
	CreateStorageFileVersionRequestBody,
	CreateStorageUploadUrlRequestBody,
	GetStorageFilePermissionsResponse,
	GetStorageFileVersionsResponse,
	GetStorageFilesRequestQuery,
	SearchStorageFilesRequestQuery,
	StorageDownloadUrlResponse,
	StorageFileDetailResponse,
	StorageFileListResponse,
	StorageFilePermissionItem,
	StorageFileVersionItem,
	StorageUploadUrlResponse,
	UpdateStorageFilePermissionRequestBody,
	UpdateStorageFileRequestBody,
	UserRole,
} from "@momoi/model/storage";

import type { CacheModule } from "@momoi/cache";
import type {
	PlatformFileViewerRole,
	PlatformFileVisibility,
	PrismaClient,
} from "@momoi/database/prisma/generated/client";
import { createStorageUseCases } from "@momoi/modules/storage";
import type { ObjectStorageProvider } from "@momoi/storage-provider";

export interface CurrentStorageUser {
	id: number;
	role: UserRole;
	email: string;
}

export class StorageService {
	private readonly useCases;

	constructor(
		prisma: PrismaClient,
		cache: CacheModule,
		objectStorage: ObjectStorageProvider,
	) {
		this.useCases = createStorageUseCases(prisma, cache, objectStorage);
	}

	public async getFiles(
		user: CurrentStorageUser,
		query: Static<typeof GetStorageFilesRequestQuery>,
	): Promise<Static<typeof StorageFileListResponse>> {
		return this.useCases.getFiles(user, query);
	}

	public async searchFiles(
		user: CurrentStorageUser,
		query: Static<typeof SearchStorageFilesRequestQuery>,
	): Promise<Static<typeof StorageFileListResponse>> {
		return this.useCases.searchFiles(user, query);
	}

	public async getFileDetail(
		user: CurrentStorageUser,
		fileId: string,
	): Promise<Static<typeof StorageFileDetailResponse>> {
		return this.useCases.getFileDetail(user, fileId);
	}

	public async createFile(
		user: CurrentStorageUser,
		body: Static<typeof CreateStorageFileRequestBody>,
	) {
		return this.useCases.createFile(user, body);
	}

	public async updateFile(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof UpdateStorageFileRequestBody>,
	) {
		return this.useCases.updateFile(user, fileId, body);
	}

	public async deleteFile(user: CurrentStorageUser, fileId: string) {
		return this.useCases.deleteFile(user, fileId);
	}

	public async moveFile(
		user: CurrentStorageUser,
		fileId: string,
		parentId?: string,
	) {
		return this.useCases.moveFile(user, fileId, parentId);
	}

	public async copyFile(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof CopyStorageFileRequestBody>,
	) {
		return this.useCases.copyFile(user, fileId, body);
	}

	public async getVersions(
		user: CurrentStorageUser,
		fileId: string,
	): Promise<Static<typeof GetStorageFileVersionsResponse>> {
		return this.useCases.getVersions(user, fileId);
	}

	public async createVersion(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof CreateStorageFileVersionRequestBody>,
	): Promise<Static<typeof StorageFileVersionItem>> {
		return this.useCases.createVersion(user, fileId, body);
	}

	public async createUploadUrl(
		user: CurrentStorageUser,
		body: Static<typeof CreateStorageUploadUrlRequestBody>,
	): Promise<Static<typeof StorageUploadUrlResponse>> {
		return this.useCases.createUploadUrl(user, body);
	}

	public async createVersionUploadUrl(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof CreateStorageUploadUrlRequestBody>,
	): Promise<Static<typeof StorageUploadUrlResponse>> {
		return this.useCases.createVersionUploadUrl(user, fileId, body);
	}

	public async createDownloadUrl(
		user: CurrentStorageUser,
		fileId: string,
	): Promise<Static<typeof StorageDownloadUrlResponse>> {
		return this.useCases.createDownloadUrl(user, fileId);
	}

	public async createVersionDownloadUrl(
		user: CurrentStorageUser,
		fileId: string,
		versionId: number,
	): Promise<Static<typeof StorageDownloadUrlResponse>> {
		return this.useCases.createVersionDownloadUrl(user, fileId, versionId);
	}

	public async deleteVersion(
		user: CurrentStorageUser,
		fileId: string,
		versionId: number,
	) {
		return this.useCases.deleteVersion(user, fileId, versionId);
	}

	public async getPermissions(
		user: CurrentStorageUser,
		fileId: string,
	): Promise<Static<typeof GetStorageFilePermissionsResponse>> {
		return this.useCases.getPermissions(user, fileId);
	}

	public async createPermission(
		user: CurrentStorageUser,
		fileId: string,
		body: Static<typeof CreateStorageFilePermissionRequestBody>,
	): Promise<Static<typeof StorageFilePermissionItem>> {
		return this.useCases.createPermission(user, fileId, body);
	}

	public async updatePermission(
		user: CurrentStorageUser,
		fileId: string,
		permissionId: number,
		body: Static<typeof UpdateStorageFilePermissionRequestBody>,
	): Promise<Static<typeof StorageFilePermissionItem>> {
		return this.useCases.updatePermission(user, fileId, permissionId, body);
	}

	public async deletePermission(
		user: CurrentStorageUser,
		fileId: string,
		permissionId: number,
	) {
		return this.useCases.deletePermission(user, fileId, permissionId);
	}
}

export type { PlatformFileViewerRole, PlatformFileVisibility };
