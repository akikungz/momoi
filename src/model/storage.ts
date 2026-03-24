import { Elysia, t } from "elysia";

import { PaginationRequest, PaginationResponse } from "./shared/pagination";
import { TimestampResponse } from "./shared/timestamp";

export const PlatformFileType = t.Union([
	t.Literal("FILE"),
	t.Literal("FOLDER"),
]);

export const PlatformFileVisibility = t.Union([
	t.Literal("PRIVATE"),
	t.Literal("SHARED"),
	t.Literal("PUBLIC"),
]);

export const PlatformFileViewerRole = t.Union([
	t.Literal("VIEWER"),
	t.Literal("COMMENTER"),
	t.Literal("EDITOR"),
	t.Literal("OWNER"),
]);

export const StorageFileItem = t.Object({
	id: t.String(),
	name: t.String(),
	type: PlatformFileType,
	mimeType: t.Optional(t.String()),
	extension: t.Optional(t.String()),
	description: t.Optional(t.String()),
	parentId: t.Optional(t.String()),
	ownerId: t.Number(),
	sizeBytes: t.Number(),
	visibility: PlatformFileVisibility,
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

export const StorageFileListResponse = t.Object({
	values: t.Array(StorageFileItem),
	...PaginationResponse.properties,
});

export const GetStorageFilesRequestQuery = t.Object({
	...PaginationRequest.properties,
	parentId: t.Optional(t.String()),
	type: t.Optional(PlatformFileType),
	sharedWithMe: t.Optional(t.Boolean()),
});

export const SearchStorageFilesRequestQuery = t.Object({
	...PaginationRequest.properties,
	query: t.String({ minLength: 1 }),
	type: t.Optional(PlatformFileType),
});

export const StorageFileDetailResponse = t.Object({
	...StorageFileItem.properties,
	accessRole: PlatformFileViewerRole,
});

export const CreateStorageFileRequestBody = t.Object({
	name: t.String({ minLength: 1 }),
	type: PlatformFileType,
	parentId: t.Optional(t.String()),
	mimeType: t.Optional(t.String()),
	extension: t.Optional(t.String()),
	description: t.Optional(t.String()),
	visibility: t.Optional(PlatformFileVisibility),
	storagePath: t.Optional(t.String()),
	sizeBytes: t.Optional(t.Number({ minimum: 0 })),
	checksumSha256: t.Optional(t.String()),
});

export const UpdateStorageFileRequestBody = t.Object({
	name: t.Optional(t.String({ minLength: 1 })),
	description: t.Optional(t.String()),
	visibility: t.Optional(PlatformFileVisibility),
});

export const MoveStorageFileRequestBody = t.Object({
	parentId: t.Optional(t.String()),
});

export const CopyStorageFileRequestBody = t.Object({
	parentId: t.Optional(t.String()),
	name: t.Optional(t.String()),
});

export const StorageFileVersionItem = t.Object({
	id: t.Number(),
	platformFileId: t.String(),
	versionNumber: t.Number(),
	sizeBytes: t.Number(),
	mimeType: t.Optional(t.String()),
	storagePath: t.String(),
	checksumSha256: t.Optional(t.String()),
	createdById: t.Optional(t.Number()),
	...TimestampResponse.properties,
});

export const GetStorageFileVersionsResponse = t.Object({
	values: t.Array(StorageFileVersionItem),
});

export const CreateStorageFileVersionRequestBody = t.Object({
	storagePath: t.String({ minLength: 1 }),
	sizeBytes: t.Number({ minimum: 0 }),
	mimeType: t.Optional(t.String()),
	checksumSha256: t.Optional(t.String()),
});

export const CreateStorageUploadUrlRequestBody = t.Object({
	filename: t.Optional(t.String()),
	contentType: t.Optional(t.String()),
});

export const StorageUploadUrlResponse = t.Object({
	objectKey: t.String(),
	uploadUrl: t.String(),
	expiresAt: t.Date(),
});

export const StorageDownloadUrlResponse = t.Object({
	objectKey: t.String(),
	downloadUrl: t.String(),
	expiresAt: t.Date(),
});

export const StorageFilePermissionItem = t.Object({
	id: t.Number(),
	platformFileId: t.String(),
	platformUserId: t.Optional(t.Number()),
	email: t.Optional(t.String()),
	permission: PlatformFileViewerRole,
	canReshare: t.Boolean(),
	expiresAt: t.Optional(t.Date()),
	grantedById: t.Optional(t.Number()),
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

export const GetStorageFilePermissionsResponse = t.Object({
	values: t.Array(StorageFilePermissionItem),
});

export const CreateStorageFilePermissionRequestBody = t.Object({
	platformUserId: t.Optional(t.Number()),
	email: t.Optional(t.String({ format: "email" })),
	permission: PlatformFileViewerRole,
	canReshare: t.Optional(t.Boolean()),
	expiresAt: t.Optional(t.Date()),
});

export const UpdateStorageFilePermissionRequestBody = t.Object({
	permission: t.Optional(PlatformFileViewerRole),
	canReshare: t.Optional(t.Boolean()),
	expiresAt: t.Optional(t.Date()),
});

export const storageModel = new Elysia({ name: "storage.model" })
	.model("StorageFileItem", StorageFileItem)
	.model("StorageFileListResponse", StorageFileListResponse)
	.model("GetStorageFilesRequestQuery", GetStorageFilesRequestQuery)
	.model("SearchStorageFilesRequestQuery", SearchStorageFilesRequestQuery)
	.model("StorageFileDetailResponse", StorageFileDetailResponse)
	.model("CreateStorageFileRequestBody", CreateStorageFileRequestBody)
	.model("UpdateStorageFileRequestBody", UpdateStorageFileRequestBody)
	.model("MoveStorageFileRequestBody", MoveStorageFileRequestBody)
	.model("CopyStorageFileRequestBody", CopyStorageFileRequestBody)
	.model("StorageFileVersionItem", StorageFileVersionItem)
	.model("GetStorageFileVersionsResponse", GetStorageFileVersionsResponse)
	.model(
		"CreateStorageFileVersionRequestBody",
		CreateStorageFileVersionRequestBody,
	)
	.model("CreateStorageUploadUrlRequestBody", CreateStorageUploadUrlRequestBody)
	.model("StorageUploadUrlResponse", StorageUploadUrlResponse)
	.model("StorageDownloadUrlResponse", StorageDownloadUrlResponse)
	.model("StorageFilePermissionItem", StorageFilePermissionItem)
	.model("GetStorageFilePermissionsResponse", GetStorageFilePermissionsResponse)
	.model(
		"CreateStorageFilePermissionRequestBody",
		CreateStorageFilePermissionRequestBody,
	)
	.model(
		"UpdateStorageFilePermissionRequestBody",
		UpdateStorageFilePermissionRequestBody,
	);

export type UserRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";
