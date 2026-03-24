import { Static } from "elysia";

import {
  CopyStorageFileRequestBody,
  CreateStorageUploadUrlRequestBody,
  CreateStorageFilePermissionRequestBody,
  CreateStorageFileRequestBody,
  CreateStorageFileVersionRequestBody,
  GetStorageFilesRequestQuery,
  GetStorageFilePermissionsResponse,
  GetStorageFileVersionsResponse,
  SearchStorageFilesRequestQuery,
  StorageFileDetailResponse,
  StorageDownloadUrlResponse,
  StorageFileListResponse,
  StorageFilePermissionItem,
  StorageUploadUrlResponse,
  StorageFileVersionItem,
  UpdateStorageFilePermissionRequestBody,
  UpdateStorageFileRequestBody,
  UserRole,
} from "@momoi/model/storage";
import { buildPaginationResponse, parsePagination } from "@momoi/utils/pagination";
import {
  recordStorageBytes,
  recordStorageDownloadUrlCacheResult,
  recordStorageOperation,
} from "../../telemetry/runtime";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";
import type { ObjectStorageProvider } from "@momoi/storage-provider";

import type { CacheModule } from "@momoi/cache";
import type {
  PlatformFileViewerRole,
  PlatformFileVisibility,
  PrismaClient,
} from "@momoi/database/prisma/generated/client";

export interface CurrentStorageUser {
  id: number;
  role: UserRole;
  email: string;
}

const FILE_SELECT = {
  id: true,
  name: true,
  type: true,
  mimeType: true,
  extension: true,
  description: true,
  parentId: true,
  ownerId: true,
  sizeBytes: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  trashedAt: true,
  deletedAt: true,
} as const;

const FILE_VERSION_SELECT = {
  id: true,
  platformFileId: true,
  versionNumber: true,
  sizeBytes: true,
  mimeType: true,
  storagePath: true,
  checksumSha256: true,
  createdById: true,
  createdAt: true,
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

export class StorageService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
    private objectStorage: ObjectStorageProvider,
  ) { }

  public async getFiles(
    user: CurrentStorageUser,
    query: Static<typeof GetStorageFilesRequestQuery>,
  ): Promise<Static<typeof StorageFileListResponse>> {
    const pagination = parsePagination(query);
    const now = new Date();

    const baseWhere = {
      parentId: query.parentId ?? null,
      type: query.type ?? undefined,
      trashedAt: null,
      deletedAt: null,
    };

    const where = query.sharedWithMe
      ? {
        ...baseWhere,
        ownerId: { not: user.id },
        platformFilePermissions: {
          some: {
            AND: [
              {
                OR: [
                  { platformUserId: user.id },
                  { email: user.email },
                ],
              },
              {
                OR: [
                  { expiresAt: null },
                  { expiresAt: { gt: now } },
                ],
              },
            ],
          },
        },
      }
      : {
        ...baseWhere,
        ownerId: user.id,
      };

    const [totalItems, rows] = await Promise.all([
      this.prisma.platformFile.count({ where }),
      this.prisma.platformFile.findMany({
        where,
        select: FILE_SELECT,
        orderBy: [
          { type: "asc" },
          { name: "asc" },
        ],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    return {
      values: rows.map((row) => this.mapFileItem(row)),
      ...buildPaginationResponse(totalItems, pagination.page, pagination.pageSize),
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
      this.prisma.platformFile.count({ where }),
      this.prisma.platformFile.findMany({
        where,
        select: FILE_SELECT,
        orderBy: [
          { type: "asc" },
          { name: "asc" },
        ],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    return {
      values: rows.map((row) => this.mapFileItem(row)),
      ...buildPaginationResponse(totalItems, pagination.page, pagination.pageSize),
    };
  }

  public async getFileDetail(user: CurrentStorageUser, fileId: string): Promise<Static<typeof StorageFileDetailResponse>> {
    const file = await this.prisma.platformFile.findUnique({
      where: { id: fileId },
      select: FILE_SELECT,
    });

    if (!file || file.deletedAt || file.trashedAt) {
      throw new ServiceError("File not found.", 404);
    }

    const accessRole = await this.getAccessRole(user, file.id, file.ownerId, file.visibility);
    if (!accessRole) {
      throw new ServiceError("Forbidden: You don't have access to this file.", 403);
    }

    return {
      ...this.mapFileItem(file),
      accessRole,
    };
  }

  public async createFile(user: CurrentStorageUser, body: Static<typeof CreateStorageFileRequestBody>) {
    this.assertCanMutateStorage(user.role);

    try {
      if (body.parentId) {
        const parent = await this.prisma.platformFile.findUnique({
          where: { id: body.parentId },
          select: { id: true, ownerId: true, type: true, deletedAt: true, trashedAt: true },
        });

        if (!parent || parent.deletedAt || parent.trashedAt) {
          throw new ServiceError("Parent folder not found.", 404);
        }

        if (parent.ownerId !== user.id) {
          throw new ServiceError("Forbidden: You can only create files in your own folders.", 403);
        }

        if (parent.type !== "FOLDER") {
          throw new ServiceError("Parent must be a folder.", 400);
        }
      }

      const created = await this.prisma.$transaction(async (tx) => {
        const file = await tx.platformFile.create({
          data: {
            name: body.name,
            type: body.type,
            mimeType: body.mimeType,
            extension: body.extension,
            description: body.description,
            ownerId: user.id,
            parentId: body.parentId,
            visibility: body.visibility ?? "PRIVATE",
            sizeBytes: body.type === "FILE" ? (body.sizeBytes ?? 0) : 0,
          },
          select: FILE_SELECT,
        });

        if (body.type === "FILE" && body.storagePath) {
          const version = await tx.platformFileVersion.create({
            data: {
              platformFileId: file.id,
              versionNumber: 1,
              storagePath: body.storagePath,
              sizeBytes: body.sizeBytes ?? 0,
              mimeType: body.mimeType,
              checksumSha256: body.checksumSha256,
              createdById: user.id,
            },
            select: { id: true },
          });

          await tx.platformFile.update({
            where: { id: file.id },
            data: { latestVersionId: version.id },
          });
        }

        return file;
      });

      recordStorageOperation("create_file", {
        "storage.file.type": created.type,
        "storage.visibility": created.visibility,
      });

      return this.mapFileItem(created);
    } catch (error: unknown) {
      handlePrismaError(error, "while creating a storage file", {
        duplicateMessage: "A file/folder with the same name already exists.",
      });
    }
  }

  public async updateFile(user: CurrentStorageUser, fileId: string, body: Static<typeof UpdateStorageFileRequestBody>) {
    this.assertCanMutateStorage(user.role);

    const file = await this.requireOwnedFile(user.id, fileId);

    const updated = await this.prisma.platformFile.update({
      where: { id: file.id },
      data: {
        name: body.name,
        description: body.description,
        visibility: body.visibility as PlatformFileVisibility | undefined,
      },
      select: FILE_SELECT,
    });

    return this.mapFileItem(updated);
  }

  public async deleteFile(user: CurrentStorageUser, fileId: string) {
    this.assertCanMutateStorage(user.role);

    const file = await this.requireOwnedFile(user.id, fileId);

    const updated = await this.prisma.platformFile.update({
      where: { id: file.id },
      data: {
        trashedAt: new Date(),
      },
      select: FILE_SELECT,
    });

    return this.mapFileItem(updated);
  }

  public async moveFile(user: CurrentStorageUser, fileId: string, parentId?: string) {
    this.assertCanMutateStorage(user.role);

    const file = await this.requireOwnedFile(user.id, fileId);

    if (parentId) {
      const targetParent = await this.prisma.platformFile.findUnique({
        where: { id: parentId },
        select: { id: true, ownerId: true, type: true, deletedAt: true, trashedAt: true },
      });

      if (!targetParent || targetParent.deletedAt || targetParent.trashedAt) {
        throw new ServiceError("Target folder not found.", 404);
      }

      if (targetParent.ownerId !== user.id) {
        throw new ServiceError("Forbidden: You can only move files into your own folders.", 403);
      }

      if (targetParent.type !== "FOLDER") {
        throw new ServiceError("Target parent must be a folder.", 400);
      }

      if (targetParent.id === file.id) {
        throw new ServiceError("Cannot move a file/folder into itself.", 400);
      }
    }

    const moved = await this.prisma.platformFile.update({
      where: { id: file.id },
      data: { parentId: parentId ?? null },
      select: FILE_SELECT,
    });

    return this.mapFileItem(moved);
  }

  public async copyFile(user: CurrentStorageUser, fileId: string, body: Static<typeof CopyStorageFileRequestBody>) {
    this.assertCanMutateStorage(user.role);

    const source = await this.requireOwnedFile(user.id, fileId);

    if (body.parentId) {
      const targetParent = await this.prisma.platformFile.findUnique({
        where: { id: body.parentId },
        select: { id: true, ownerId: true, type: true, deletedAt: true, trashedAt: true },
      });

      if (!targetParent || targetParent.deletedAt || targetParent.trashedAt) {
        throw new ServiceError("Target folder not found.", 404);
      }

      if (targetParent.ownerId !== user.id) {
        throw new ServiceError("Forbidden: You can only copy files into your own folders.", 403);
      }

      if (targetParent.type !== "FOLDER") {
        throw new ServiceError("Target parent must be a folder.", 400);
      }
    }

    const copied = await this.prisma.$transaction(async (tx) => {
      const newFile = await tx.platformFile.create({
        data: {
          name: body.name ?? `${source.name} (copy)`,
          type: source.type,
          mimeType: source.mimeType,
          extension: source.extension,
          description: source.description,
          ownerId: user.id,
          parentId: body.parentId ?? source.parentId,
          visibility: source.visibility,
          sizeBytes: source.sizeBytes,
        },
        select: FILE_SELECT,
      });

      if (source.type === "FILE") {
        const latestVersion = await tx.platformFileVersion.findFirst({
          where: { platformFileId: source.id },
          orderBy: { versionNumber: "desc" },
          select: FILE_VERSION_SELECT,
        });

        if (latestVersion) {
          const copiedVersion = await tx.platformFileVersion.create({
            data: {
              platformFileId: newFile.id,
              versionNumber: 1,
              sizeBytes: latestVersion.sizeBytes,
              mimeType: latestVersion.mimeType,
              storagePath: latestVersion.storagePath,
              checksumSha256: latestVersion.checksumSha256,
              createdById: user.id,
            },
            select: { id: true },
          });

          await tx.platformFile.update({
            where: { id: newFile.id },
            data: { latestVersionId: copiedVersion.id },
          });
        }
      }

      return newFile;
    });

    return this.mapFileItem(copied);
  }

  public async getVersions(user: CurrentStorageUser, fileId: string): Promise<Static<typeof GetStorageFileVersionsResponse>> {
    const file = await this.prisma.platformFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        type: true,
        ownerId: true,
        visibility: true,
        deletedAt: true,
        trashedAt: true,
      },
    });

    if (!file || file.deletedAt || file.trashedAt) {
      throw new ServiceError("File not found.", 404);
    }

    if (file.type !== "FILE") {
      throw new ServiceError("Only files have versions.", 400);
    }

    const accessRole = await this.getAccessRole(user, file.id, file.ownerId, file.visibility);
    if (!accessRole) {
      throw new ServiceError("Forbidden: You don't have access to this file.", 403);
    }

    const versions = await this.prisma.platformFileVersion.findMany({
      where: { platformFileId: file.id },
      select: FILE_VERSION_SELECT,
      orderBy: { versionNumber: "desc" },
    });

    return {
      values: versions.map((v) => this.mapVersionItem(v)),
    };
  }

  public async createVersion(user: CurrentStorageUser, fileId: string, body: Static<typeof CreateStorageFileVersionRequestBody>): Promise<Static<typeof StorageFileVersionItem>> {
    this.assertCanMutateStorage(user.role);

    const file = await this.requireOwnedFile(user.id, fileId);
    if (file.type !== "FILE") {
      throw new ServiceError("Only files can have versions.", 400);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.platformFileVersion.findFirst({
        where: { platformFileId: file.id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });

      const version = await tx.platformFileVersion.create({
        data: {
          platformFileId: file.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          storagePath: body.storagePath,
          sizeBytes: body.sizeBytes,
          mimeType: body.mimeType,
          checksumSha256: body.checksumSha256,
          createdById: user.id,
        },
        select: FILE_VERSION_SELECT,
      });

      await tx.platformFile.update({
        where: { id: file.id },
        data: {
          latestVersionId: version.id,
          sizeBytes: body.sizeBytes,
          mimeType: body.mimeType,
        },
      });

      return version;
    });
    recordStorageOperation("create_version", {
      "storage.file.kind": "versioned",
    });
    recordStorageBytes(body.sizeBytes, {
      "storage.operation": "create_version",
    });

    return this.mapVersionItem(created);
  }

  public async createUploadUrl(
    user: CurrentStorageUser,
    body: Static<typeof CreateStorageUploadUrlRequestBody>,
  ): Promise<Static<typeof StorageUploadUrlResponse>> {
    this.assertCanMutateStorage(user.role);

    if (!this.objectStorage.enabled) {
      throw new ServiceError("S3 storage provider is not enabled.", 400);
    }

    const objectKey = this.objectStorage.createObjectKey(user.id, body.filename);
    const presigned = await this.objectStorage.createUploadUrl(objectKey, body.contentType);
    recordStorageOperation("create_upload_url", {
      "storage.upload.kind": "file",
    });

    return {
      objectKey: presigned.objectKey,
      uploadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
    };
  }

  public async createVersionUploadUrl(
    user: CurrentStorageUser,
    fileId: string,
    body: Static<typeof CreateStorageUploadUrlRequestBody>,
  ): Promise<Static<typeof StorageUploadUrlResponse>> {
    this.assertCanMutateStorage(user.role);
    await this.requireOwnedFile(user.id, fileId);

    if (!this.objectStorage.enabled) {
      throw new ServiceError("S3 storage provider is not enabled.", 400);
    }

    const objectKey = this.objectStorage.createObjectKey(user.id, body.filename);
    const presigned = await this.objectStorage.createUploadUrl(objectKey, body.contentType);
    recordStorageOperation("create_upload_url", {
      "storage.upload.kind": "version",
      "storage.file.id": fileId,
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
    const file = await this.prisma.platformFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        ownerId: true,
        visibility: true,
        deletedAt: true,
        trashedAt: true,
        latestVersion: {
          select: {
            storagePath: true,
          },
        },
      },
    });

    if (!file || file.deletedAt || file.trashedAt || !file.latestVersion?.storagePath) {
      throw new ServiceError("File or latest version not found.", 404);
    }

    const accessRole = await this.getAccessRole(user, file.id, file.ownerId, file.visibility);
    if (!accessRole) {
      throw new ServiceError("Forbidden: You don't have access to this file.", 403);
    }

    if (!this.objectStorage.enabled) {
      recordStorageOperation("create_download_url", {
        "storage.download.kind": "file",
        "storage.source": "local",
      });
      return {
        objectKey: file.latestVersion.storagePath,
        downloadUrl: file.latestVersion.storagePath,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }

    const presigned = await this.getOrCreateCachedDownloadUrl(file.latestVersion.storagePath);
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

  public async createVersionDownloadUrl(
    user: CurrentStorageUser,
    fileId: string,
    versionId: number,
  ): Promise<Static<typeof StorageDownloadUrlResponse>> {
    const file = await this.prisma.platformFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        ownerId: true,
        visibility: true,
        deletedAt: true,
        trashedAt: true,
      },
    });

    if (!file || file.deletedAt || file.trashedAt) {
      throw new ServiceError("File not found.", 404);
    }

    const accessRole = await this.getAccessRole(user, file.id, file.ownerId, file.visibility);
    if (!accessRole) {
      throw new ServiceError("Forbidden: You don't have access to this file.", 403);
    }

    const version = await this.prisma.platformFileVersion.findUnique({
      where: { id: versionId },
      select: { id: true, platformFileId: true, storagePath: true },
    });

    if (!version || version.platformFileId !== file.id) {
      throw new ServiceError("Version not found.", 404);
    }

    if (!this.objectStorage.enabled) {
      recordStorageOperation("create_download_url", {
        "storage.download.kind": "version",
        "storage.source": "local",
      });
      return {
        objectKey: version.storagePath,
        downloadUrl: version.storagePath,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      };
    }

    const presigned = await this.getOrCreateCachedDownloadUrl(version.storagePath);
    recordStorageOperation("create_download_url", {
      "storage.download.kind": "version",
      "storage.source": "object_storage",
    });
    return {
      objectKey: presigned.objectKey,
      downloadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
    };
  }

  public async deleteVersion(user: CurrentStorageUser, fileId: string, versionId: number) {
    this.assertCanMutateStorage(user.role);

    const file = await this.requireOwnedFile(user.id, fileId);
    if (file.type !== "FILE") {
      throw new ServiceError("Only files can have versions.", 400);
    }

    let deletedObjectKey: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const version = await tx.platformFileVersion.findUnique({
        where: { id: versionId },
        select: { id: true, platformFileId: true, storagePath: true },
      });

      if (!version || version.platformFileId !== file.id) {
        throw new ServiceError("Version not found.", 404);
      }

      deletedObjectKey = version.storagePath;

      await tx.platformFileVersion.delete({ where: { id: version.id } });

      const latest = await tx.platformFileVersion.findFirst({
        where: { platformFileId: file.id },
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          sizeBytes: true,
          mimeType: true,
        },
      });

      await tx.platformFile.update({
        where: { id: file.id },
        data: {
          latestVersionId: latest?.id ?? null,
          sizeBytes: latest?.sizeBytes ?? 0,
          mimeType: latest?.mimeType ?? null,
        },
      });
    });

    if (this.objectStorage.enabled && deletedObjectKey) {
      try {
        await this.objectStorage.deleteObject(deletedObjectKey);
        await this.cache.deleteCacheKey(this.buildDownloadUrlCacheKey(deletedObjectKey));
      } catch (error) {
        console.warn("Failed to delete object from S3-compatible storage after version delete", { error, objectKey: deletedObjectKey });
      }
    }

    return { success: true };
  }

  public async getPermissions(user: CurrentStorageUser, fileId: string): Promise<Static<typeof GetStorageFilePermissionsResponse>> {
    await this.requireOwnedFile(user.id, fileId);

    const permissions = await this.prisma.platformFilePermission.findMany({
      where: { platformFileId: fileId },
      select: FILE_PERMISSION_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return {
      values: permissions.map((p) => this.mapPermissionItem(p)),
    };
  }

  public async createPermission(user: CurrentStorageUser, fileId: string, body: Static<typeof CreateStorageFilePermissionRequestBody>): Promise<Static<typeof StorageFilePermissionItem>> {
    await this.requireOwnedFile(user.id, fileId);

    if (!body.platformUserId && !body.email) {
      throw new ServiceError("Either platformUserId or email must be provided.", 400);
    }

    if (body.platformUserId && body.email) {
      throw new ServiceError("Provide either platformUserId or email, not both.", 400);
    }

    try {
      const created = await this.prisma.platformFilePermission.create({
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
    await this.requireOwnedFile(user.id, fileId);

    const existing = await this.prisma.platformFilePermission.findUnique({
      where: { id: permissionId },
      select: { id: true, platformFileId: true },
    });

    if (!existing || existing.platformFileId !== fileId) {
      throw new ServiceError("Permission not found.", 404);
    }

    const updated = await this.prisma.platformFilePermission.update({
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

  public async deletePermission(user: CurrentStorageUser, fileId: string, permissionId: number) {
    await this.requireOwnedFile(user.id, fileId);

    const existing = await this.prisma.platformFilePermission.findUnique({
      where: { id: permissionId },
      select: { id: true, platformFileId: true },
    });

    if (!existing || existing.platformFileId !== fileId) {
      throw new ServiceError("Permission not found.", 404);
    }

    await this.prisma.platformFilePermission.delete({
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
    parentId: string | null;
    ownerId: number;
    sizeBytes: number;
    visibility: PlatformFileVisibility;
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
      visibility: file.visibility,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  private mapVersionItem(version: {
    id: number;
    platformFileId: string;
    versionNumber: number;
    sizeBytes: number;
    mimeType: string | null;
    storagePath: string;
    checksumSha256: string | null;
    createdById: number | null;
    createdAt: Date;
  }): Static<typeof StorageFileVersionItem> {
    return {
      id: version.id,
      platformFileId: version.platformFileId,
      versionNumber: version.versionNumber,
      sizeBytes: version.sizeBytes,
      mimeType: version.mimeType ?? undefined,
      storagePath: version.storagePath,
      checksumSha256: version.checksumSha256 ?? undefined,
      createdById: version.createdById ?? undefined,
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
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
    const file = await this.prisma.platformFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        name: true,
        type: true,
        mimeType: true,
        extension: true,
        description: true,
        parentId: true,
        sizeBytes: true,
        ownerId: true,
        visibility: true,
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

    const now = new Date();

    const permission = await this.prisma.platformFilePermission.findFirst({
      where: {
        platformFileId: fileId,
        AND: [
          {
            OR: [
              { platformUserId: user.id },
              { email: user.email },
            ],
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
          },
        ],
      },
      select: {
        permission: true,
      },
    });

    return permission?.permission ?? null;
  }

  private assertCanMutateStorage(role: UserRole) {
    if (role === "STUDENT") {
      throw new ServiceError("Forbidden: Students cannot manage storage files.", 403);
    }
  }

  private buildDownloadUrlCacheKey(objectKey: string): string {
    return `${DOWNLOAD_URL_CACHE_PREFIX}:${objectKey}`;
  }

  private async getOrCreateCachedDownloadUrl(objectKey: string) {
    const cacheKey = this.buildDownloadUrlCacheKey(objectKey);

    try {
      const cachedValue = await this.cache.getCacheValue(cacheKey);
      if (cachedValue) {
        const cached = this.parseCachedDownloadUrl(cachedValue);
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
      }
    } catch (error) {
      console.warn("Failed reading cached presigned download URL", { error, objectKey });
    }
    recordStorageDownloadUrlCacheResult("miss", {
      "storage.cache.scope": "download_url",
    });

    const presigned = await this.objectStorage.createDownloadUrl(objectKey);

    const ttlSeconds = Math.floor((presigned.expiresAt.getTime() - Date.now()) / 1000) - DOWNLOAD_URL_CACHE_SAFETY_BUFFER_SECONDS;
    if (ttlSeconds > 0) {
      try {
        const payload: CachedDownloadUrl = {
          url: presigned.url,
          expiresAt: presigned.expiresAt.toISOString(),
        };

        await this.cache.createCacheKey(cacheKey, JSON.stringify(payload), ttlSeconds);
      } catch (error) {
        console.warn("Failed writing cached presigned download URL", { error, objectKey });
      }
    }

    return presigned;
  }

  private parseCachedDownloadUrl(raw: string): CachedDownloadUrl | null {
    try {
      const parsed = JSON.parse(raw) as Partial<CachedDownloadUrl>;
      if (typeof parsed.url !== "string" || typeof parsed.expiresAt !== "string") {
        return null;
      }

      const expiresAt = new Date(parsed.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        return null;
      }

      return {
        url: parsed.url,
        expiresAt: parsed.expiresAt,
      };
    } catch {
      return null;
    }
  }
}
