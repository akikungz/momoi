import { Elysia, t } from "elysia";

import type { AuthMacro } from "@momoi/auth";
import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database";
import { storageModel } from "@momoi/model/storage";
import { ErrorResponse } from "@momoi/model/shared/error";
import type { ObjectStorageProvider } from "@momoi/storage-provider";

import { createStorageUseCases } from ".";

export const storageRoute = (
	prisma: PrismaClient,
	cache: CacheModule,
	auth: AuthMacro,
	objectStorage: ObjectStorageProvider,
) => {
	const useCases = createStorageUseCases(prisma, cache, objectStorage);

	return new Elysia({ name: "storage.route", prefix: "/storage" })
		.use(auth)
		.use(storageModel)
		.guard({ auth: true })
		.group("/files", (app) =>
			app
				.get("/", async ({ user, query }) => useCases.getFiles(user, query), {
					query: "GetStorageFilesRequestQuery",
					response: {
						200: "StorageFileListResponse",
					},
					detail: {
						summary: "List files",
						description:
							"List owned files by default, or files shared with the current user when sharedWithMe=true",
						tags: ["Storage"],
					},
				})
				.get(
					"/search",
					async ({ user, query }) => useCases.searchFiles(user, query),
					{
						query: "SearchStorageFilesRequestQuery",
						response: {
							200: "StorageFileListResponse",
						},
						detail: {
							summary: "Search owned files",
							description: "Search files and folders owned by the current user",
							tags: ["Storage"],
						},
					},
				)
				.post("/", async ({ user, body }) => useCases.createFile(user, body), {
					body: "CreateStorageFileRequestBody",
					response: {
						200: "StorageFileItem",
						403: ErrorResponse,
					},
					detail: {
						summary: "Create file/folder",
						description: "Create a new file or folder in storage",
						tags: ["Storage"],
					},
				})
				.post(
					"/upload-url",
					async ({ user, body }) => useCases.createUploadUrl(user, body),
					{
						body: "CreateStorageUploadUrlRequestBody",
						response: {
							200: "StorageUploadUrlResponse",
							400: ErrorResponse,
							403: ErrorResponse,
						},
						detail: {
							summary: "Create upload URL",
							description:
								"Generate a presigned upload URL for S3-compatible storage",
							tags: ["Storage"],
						},
					},
				)
				.get(
					"/:fileId",
					async ({ user, params }) =>
						useCases.getFileDetail(user, params.fileId),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						response: {
							200: "StorageFileDetailResponse",
						},
						detail: {
							summary: "Get file detail",
							description: "Get file/folder detail with ACL check",
							tags: ["Storage"],
						},
					},
				)
				.get(
					"/:fileId/download-url",
					async ({ user, params }) =>
						useCases.createDownloadUrl(user, params.fileId),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						response: {
							200: "StorageDownloadUrlResponse",
						},
						detail: {
							summary: "Create latest version download URL",
							description:
								"Generate a signed download URL for the latest file version",
							tags: ["Storage", "File Versions"],
						},
					},
				)
				.patch(
					"/:fileId",
					async ({ user, params, body }) =>
						useCases.updateFile(user, params.fileId, body),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						body: "UpdateStorageFileRequestBody",
						response: {
							200: "StorageFileItem",
						},
						detail: {
							summary: "Update file metadata",
							description: "Rename or update file/folder metadata",
							tags: ["Storage"],
						},
					},
				)
				.delete(
					"/:fileId",
					async ({ user, params }) => useCases.deleteFile(user, params.fileId),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						response: {
							200: "StorageFileItem",
						},
						detail: {
							summary: "Delete file/folder",
							description: "Move file/folder to trash",
							tags: ["Storage"],
						},
					},
				)
				.post(
					"/:fileId/move",
					async ({ user, params, body }) =>
						useCases.moveFile(user, params.fileId, body.parentId),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						body: "MoveStorageFileRequestBody",
						response: {
							200: "StorageFileItem",
						},
						detail: {
							summary: "Move file/folder",
							description: "Move file/folder to another parent folder",
							tags: ["Storage"],
						},
					},
				)
				.post(
					"/:fileId/copy",
					async ({ user, params, body }) =>
						useCases.copyFile(user, params.fileId, body),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						body: "CopyStorageFileRequestBody",
						response: {
							200: "StorageFileItem",
						},
						detail: {
							summary: "Copy file/folder",
							description: "Create a copy of a file/folder",
							tags: ["Storage"],
						},
					},
				)
				.get(
					"/:fileId/versions",
					async ({ user, params }) => useCases.getVersions(user, params.fileId),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						response: {
							200: "GetStorageFileVersionsResponse",
						},
						detail: {
							summary: "List file versions",
							description: "List version history for a file",
							tags: ["Storage", "File Versions"],
						},
					},
				)
				.post(
					"/:fileId/upload-url",
					async ({ user, params, body }) =>
						useCases.createVersionUploadUrl(user, params.fileId, body),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						body: "CreateStorageUploadUrlRequestBody",
						response: {
							200: "StorageUploadUrlResponse",
							400: ErrorResponse,
							403: ErrorResponse,
						},
						detail: {
							summary: "Create file version upload URL",
							description:
								"Generate a presigned upload URL for a new file version",
							tags: ["Storage", "File Versions"],
						},
					},
				)
				.post(
					"/:fileId/versions",
					async ({ user, params, body }) =>
						useCases.createVersion(user, params.fileId, body),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						body: "CreateStorageFileVersionRequestBody",
						response: {
							200: "StorageFileVersionItem",
						},
						detail: {
							summary: "Create file version",
							description: "Create a new version for a file",
							tags: ["Storage", "File Versions"],
						},
					},
				)
				.get(
					"/:fileId/versions/:versionId/download-url",
					async ({ user, params }) =>
						useCases.createVersionDownloadUrl(
							user,
							params.fileId,
							params.versionId,
						),
					{
						params: t.Object({
							fileId: t.String(),
							versionId: t.Number(),
						}),
						response: {
							200: "StorageDownloadUrlResponse",
						},
						detail: {
							summary: "Create file version download URL",
							description:
								"Generate a signed download URL for a specific file version",
							tags: ["Storage", "File Versions"],
						},
					},
				)
				.delete(
					"/:fileId/versions/:versionId",
					async ({ user, params }) =>
						useCases.deleteVersion(user, params.fileId, params.versionId),
					{
						params: t.Object({
							fileId: t.String(),
							versionId: t.Number(),
						}),
						response: {
							200: t.Object({ success: t.Boolean() }),
						},
						detail: {
							summary: "Delete file version",
							description: "Delete a specific file version",
							tags: ["Storage", "File Versions"],
						},
					},
				)
				.get(
					"/:fileId/permissions",
					async ({ user, params }) =>
						useCases.getPermissions(user, params.fileId),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						response: {
							200: "GetStorageFilePermissionsResponse",
						},
						detail: {
							summary: "List file permissions",
							description: "List sharing permissions for a file (owner only)",
							tags: ["Storage", "File Permissions"],
						},
					},
				)
				.post(
					"/:fileId/permissions",
					async ({ user, params, body }) =>
						useCases.createPermission(user, params.fileId, body),
					{
						params: t.Object({
							fileId: t.String(),
						}),
						body: "CreateStorageFilePermissionRequestBody",
						response: {
							200: "StorageFilePermissionItem",
						},
						detail: {
							summary: "Create file permission",
							description: "Share file with a user or email (owner only)",
							tags: ["Storage", "File Permissions"],
						},
					},
				)
				.patch(
					"/:fileId/permissions/:permissionId",
					async ({ user, params, body }) =>
						useCases.updatePermission(
							user,
							params.fileId,
							params.permissionId,
							body,
						),
					{
						params: t.Object({
							fileId: t.String(),
							permissionId: t.Number(),
						}),
						body: "UpdateStorageFilePermissionRequestBody",
						response: {
							200: "StorageFilePermissionItem",
						},
						detail: {
							summary: "Update file permission",
							description: "Update a specific file permission (owner only)",
							tags: ["Storage", "File Permissions"],
						},
					},
				)
				.delete(
					"/:fileId/permissions/:permissionId",
					async ({ user, params }) =>
						useCases.deletePermission(user, params.fileId, params.permissionId),
					{
						params: t.Object({
							fileId: t.String(),
							permissionId: t.Number(),
						}),
						response: {
							200: t.Object({ success: t.Boolean() }),
						},
						detail: {
							summary: "Delete file permission",
							description: "Remove a specific file permission (owner only)",
							tags: ["Storage", "File Permissions"],
						},
					},
				),
		);
};
