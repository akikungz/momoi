import { Static } from "elysia";

import {
    AddFilePermissionRequestBody, AddFilePermissionResponse, CopyFileRequestBody, CopyFileResponse,
    CreateFileRequestBody, CreateFileResponse, CreateFileVersionRequestBody,
    CreateFileVersionResponse, DeleteFileResponse, DeleteFileVersionResponse,
    GetFilePermissionsResponse, GetFileResponse, GetFileVersionsResponse, ListFilesRequestQuery,
    ListFilesResponse, MoveFileRequestBody, MoveFileResponse, RemoveFilePermissionResponse,
    SearchFilesRequestQuery, SearchFilesResponse, UpdateFilePermissionRequestBody,
    UpdateFilePermissionResponse, UpdateFileRequestBody, UpdateFileResponse
} from "@momoi/model/storage";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';
import type { PlatformFileType } from "@momoi/database/prisma/generated/enums";

import { FILE_BASE_SELECT, mapToFileData, PERMISSION_LEVELS, PermissionLevel } from "./types";

export class StorageService {
    constructor(
        private prisma: PrismaClient,
        private cache: CacheModule,
    ) { }

    // ==================== Helper Methods ====================

    private async buildFilePath(fileId: string, visitedIds: Set<string> = new Set()): Promise<string> {
        if (visitedIds.has(fileId)) {
            throw new ServiceError('Circular reference detected in file hierarchy.', 500);
        }
        visitedIds.add(fileId);

        const file = await this.prisma.platformFile.findUnique({
            where: { id: fileId },
            select: { name: true, parentId: true },
        });

        if (!file) return '';
        if (!file.parentId) return `/${file.name}`;

        const parentPath = await this.buildFilePath(file.parentId, visitedIds);
        return `${parentPath}/${file.name}`;
    }

    private async checkFileAccess(
        fileId: string,
        userId: number,
        requiredPermission: PermissionLevel = 'VIEWER'
    ): Promise<boolean> {
        const file = await this.prisma.platformFile.findUnique({
            where: { id: fileId },
            select: {
                platformUserId: true,
                isPublic: true,
                platformFilePermissions: {
                    where: { platformUserId: userId },
                    select: { permission: true },
                },
            },
        });

        if (!file) throw new ServiceError('File not found.', 404);
        if (file.platformUserId === userId) return true;
        if (file.isPublic && requiredPermission === 'VIEWER') return true;

        const permission = file.platformFilePermissions[0];
        if (!permission) return false;

        return PERMISSION_LEVELS[permission.permission as PermissionLevel] >= PERMISSION_LEVELS[requiredPermission];
    }

    private async verifyOwnership(fileId: string, userId: number): Promise<void> {
        const file = await this.prisma.platformFile.findUnique({
            where: { id: fileId },
            select: { platformUserId: true },
        });

        if (!file) throw new ServiceError('File not found.', 404);
        if (file.platformUserId !== userId) {
            throw new ServiceError('You do not have permission to perform this action.', 403);
        }
    }

    private async clearUserFileCache(userId: number): Promise<void> {
        await this.cache.deleteCacheByPattern(`user:${userId}:files:*`);
    }

    // ==================== File CRUD Operations ====================

    async listFiles(userId: number, query: Static<typeof ListFilesRequestQuery>): Promise<Static<typeof ListFilesResponse>> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const skip = (page - 1) * pageSize;

        const cacheKey = `user:${userId}:files:list:page:${page}:size:${pageSize}:parent:${query.parentId ?? 'root'}:type:${query.type ?? 'all'}`;
        const cachedData = await this.cache.getCacheValue(cacheKey);
        if (cachedData) return JSON.parse(cachedData);

        const whereClause = {
            platformUserId: userId,
            parentId: query.parentId === undefined ? null : query.parentId,
            ...(query.type && { type: query.type as PlatformFileType }),
        };

        const [totalItems, files] = await Promise.all([
            this.prisma.platformFile.count({ where: whereClause }),
            this.prisma.platformFile.findMany({
                where: whereClause,
                skip,
                take: pageSize,
                orderBy: [{ type: 'asc' }, { name: 'asc' }],
                select: FILE_BASE_SELECT,
            }),
        ]);

        const response: Static<typeof ListFilesResponse> = {
            values: files.map(mapToFileData),
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
            currentPage: page,
            pageSize,
        };

        await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
        return response;
    }

    async getFile(userId: number, fileId: string): Promise<Static<typeof GetFileResponse>> {
        const hasAccess = await this.checkFileAccess(fileId, userId, 'VIEWER');
        if (!hasAccess) throw new ServiceError('You do not have permission to access this file.', 403);

        const file = await this.prisma.platformFile.findUnique({
            where: { id: fileId },
            select: {
                ...FILE_BASE_SELECT,
                platformUserId: true,
                children: {
                    select: FILE_BASE_SELECT,
                    orderBy: [{ type: 'asc' }, { name: 'asc' }],
                },
                platformFileVersions: {
                    select: { id: true, versionNumber: true, sizeBytes: true, createdAt: true },
                    orderBy: { versionNumber: 'desc' },
                },
                platformFilePermissions: {
                    select: {
                        id: true,
                        platformUserId: true,
                        permission: true,
                        platformUser: {
                            select: { id: true, user: { select: { name: true, email: true } } },
                        },
                    },
                },
            },
        });

        if (!file) throw new ServiceError('File not found.', 404);

        const path = await this.buildFilePath(fileId);
        const isOwner = file.platformUserId === userId;

        return {
            id: file.id,
            name: file.name,
            type: file.type as 'FILE' | 'FOLDER',
            sizeBytes: file.sizeBytes,
            visibility: file.visibility as 'VIEWER' | 'EDITOR' | 'OWNER',
            parentId: file.parentId,
            isPublic: file.isPublic,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
            path,
            children: file.type === 'FOLDER' ? file.children.map(mapToFileData) : undefined,
            versions: file.type === 'FILE' ? file.platformFileVersions.map(v => ({
                id: v.id,
                versionNumber: v.versionNumber,
                sizeBytes: v.sizeBytes,
                createdAt: v.createdAt,
            })) : undefined,
            permissions: isOwner ? file.platformFilePermissions.map(p => ({
                id: p.id,
                platformUserId: p.platformUserId,
                permission: p.permission as 'VIEWER' | 'EDITOR' | 'OWNER',
                user: { id: p.platformUser.id, name: p.platformUser.user.name, email: p.platformUser.user.email },
            })) : undefined,
        };
    }

    async createFile(userId: number, body: Static<typeof CreateFileRequestBody>): Promise<Static<typeof CreateFileResponse>> {
        try {
            if (body.parentId) {
                const parent = await this.prisma.platformFile.findUnique({
                    where: { id: body.parentId },
                    select: { type: true, platformUserId: true },
                });

                if (!parent) throw new ServiceError('Parent folder not found.', 404);
                if (parent.type !== 'FOLDER') throw new ServiceError('Parent must be a folder.', 400);
                if (parent.platformUserId !== userId) throw new ServiceError('You do not have permission to create files in this folder.', 403);
            }

            const file = await this.prisma.platformFile.create({
                data: {
                    name: body.name,
                    type: body.type as PlatformFileType,
                    parentId: body.parentId ?? null,
                    platformUserId: userId,
                    isPublic: body.isPublic ?? false,
                    sizeBytes: 0,
                    visibility: 'OWNER',
                },
                select: FILE_BASE_SELECT,
            });

            await this.clearUserFileCache(userId);
            return mapToFileData(file);
        } catch (error: unknown) {
            handlePrismaError(error, 'while creating the file', {
                notFoundMessage: 'Parent folder not found.',
                duplicateMessage: 'A file with this name already exists in the folder.'
            });
        }
    }

    async updateFile(userId: number, fileId: string, body: Static<typeof UpdateFileRequestBody>): Promise<Static<typeof UpdateFileResponse>> {
        try {
            await this.verifyOwnership(fileId, userId);

            if (body.parentId !== undefined) {
                if (body.parentId === fileId) throw new ServiceError('Cannot move a file into itself.', 400);

                if (body.parentId !== null) {
                    const parent = await this.prisma.platformFile.findUnique({
                        where: { id: body.parentId },
                        select: { type: true, platformUserId: true },
                    });

                    if (!parent) throw new ServiceError('Parent folder not found.', 404);
                    if (parent.type !== 'FOLDER') throw new ServiceError('Parent must be a folder.', 400);
                    if (parent.platformUserId !== userId) throw new ServiceError('You do not have permission to move files to this folder.', 403);
                }
            }

            const file = await this.prisma.platformFile.update({
                where: { id: fileId },
                data: {
                    ...(body.name !== undefined && { name: body.name }),
                    ...(body.parentId !== undefined && { parentId: body.parentId }),
                    ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
                    ...(body.visibility !== undefined && { visibility: body.visibility }),
                },
                select: FILE_BASE_SELECT,
            });

            await this.clearUserFileCache(userId);
            return mapToFileData(file);
        } catch (error: unknown) {
            handlePrismaError(error, 'while updating the file', {
                notFoundMessage: 'File not found.',
                duplicateMessage: 'A file with this name already exists in the target folder.'
            });
        }
    }

    async deleteFile(userId: number, fileId: string): Promise<Static<typeof DeleteFileResponse>> {
        try {
            await this.verifyOwnership(fileId, userId);

            const countDescendants = async (id: string): Promise<number> => {
                const children = await this.prisma.platformFile.findMany({
                    where: { parentId: id },
                    select: { id: true },
                });
                let count = 1;
                for (const child of children) {
                    count += await countDescendants(child.id);
                }
                return count;
            };

            const deletedCount = await countDescendants(fileId);

            await this.prisma.platformFile.delete({ where: { id: fileId } });
            await this.clearUserFileCache(userId);

            return { success: true, deletedCount };
        } catch (error: unknown) {
            handlePrismaError(error, 'while deleting the file', { notFoundMessage: 'File not found.' });
        }
    }

    async moveFile(userId: number, fileId: string, body: Static<typeof MoveFileRequestBody>): Promise<Static<typeof MoveFileResponse>> {
        return this.updateFile(userId, fileId, { parentId: body.targetParentId });
    }

    async copyFile(userId: number, fileId: string, body: Static<typeof CopyFileRequestBody>): Promise<Static<typeof CopyFileResponse>> {
        try {
            const hasAccess = await this.checkFileAccess(fileId, userId, 'VIEWER');
            if (!hasAccess) throw new ServiceError('You do not have permission to copy this file.', 403);

            if (body.targetParentId !== null) {
                const parent = await this.prisma.platformFile.findUnique({
                    where: { id: body.targetParentId },
                    select: { type: true, platformUserId: true },
                });

                if (!parent) throw new ServiceError('Target folder not found.', 404);
                if (parent.type !== 'FOLDER') throw new ServiceError('Target must be a folder.', 400);
                if (parent.platformUserId !== userId) throw new ServiceError('You do not have permission to copy files to this folder.', 403);
            }

            const sourceFile = await this.prisma.platformFile.findUnique({
                where: { id: fileId },
                select: { name: true, type: true, sizeBytes: true, visibility: true, isPublic: true },
            });

            if (!sourceFile) throw new ServiceError('Source file not found.', 404);

            const copyName = body.newName || `${sourceFile.name} (Copy)`;
            const copiedFile = await this.prisma.platformFile.create({
                data: {
                    name: copyName,
                    type: sourceFile.type,
                    sizeBytes: sourceFile.sizeBytes,
                    visibility: 'OWNER',
                    parentId: body.targetParentId,
                    platformUserId: userId,
                    isPublic: false,
                },
                select: FILE_BASE_SELECT,
            });

            await this.clearUserFileCache(userId);
            return mapToFileData(copiedFile);
        } catch (error: unknown) {
            handlePrismaError(error, 'while copying the file', {
                duplicateMessage: 'A file with this name already exists in the target folder.'
            });
        }
    }

    // ==================== File Versions ====================

    async getFileVersions(userId: number, fileId: string, page: number = 1, pageSize: number = 10): Promise<Static<typeof GetFileVersionsResponse>> {
        const hasAccess = await this.checkFileAccess(fileId, userId, 'VIEWER');
        if (!hasAccess) throw new ServiceError('You do not have permission to access this file.', 403);

        const file = await this.prisma.platformFile.findUnique({
            where: { id: fileId },
            select: { type: true },
        });

        if (!file) throw new ServiceError('File not found.', 404);
        if (file.type !== 'FILE') throw new ServiceError('Versions are only available for files.', 400);

        const skip = (page - 1) * pageSize;

        const [totalItems, versions] = await Promise.all([
            this.prisma.platformFileVersion.count({ where: { platformFileId: fileId } }),
            this.prisma.platformFileVersion.findMany({
                where: { platformFileId: fileId },
                skip,
                take: pageSize,
                orderBy: { versionNumber: 'desc' },
                select: { id: true, versionNumber: true, sizeBytes: true, createdAt: true },
            }),
        ]);

        return { values: versions, totalItems, totalPages: Math.ceil(totalItems / pageSize), currentPage: page, pageSize };
    }

    async createFileVersion(userId: number, fileId: string, body: Static<typeof CreateFileVersionRequestBody>): Promise<Static<typeof CreateFileVersionResponse>> {
        try {
            const hasAccess = await this.checkFileAccess(fileId, userId, 'EDITOR');
            if (!hasAccess) throw new ServiceError('You do not have permission to modify this file.', 403);

            const file = await this.prisma.platformFile.findUnique({
                where: { id: fileId },
                select: { type: true },
            });

            if (!file) throw new ServiceError('File not found.', 404);
            if (file.type !== 'FILE') throw new ServiceError('Versions can only be created for files.', 400);

            const latestVersion = await this.prisma.platformFileVersion.findFirst({
                where: { platformFileId: fileId },
                orderBy: { versionNumber: 'desc' },
                select: { versionNumber: true },
            });

            const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

            const version = await this.prisma.platformFileVersion.create({
                data: {
                    platformFileId: fileId,
                    versionNumber: nextVersionNumber,
                    sizeBytes: body.sizeBytes,
                    storagePath: body.storagePath,
                },
                select: { id: true, versionNumber: true, sizeBytes: true, createdAt: true },
            });

            await this.prisma.platformFile.update({
                where: { id: fileId },
                data: { sizeBytes: body.sizeBytes },
            });

            return version;
        } catch (error: unknown) {
            handlePrismaError(error, 'while creating the file version', { notFoundMessage: 'File not found.' });
        }
    }

    async deleteFileVersion(userId: number, fileId: string, versionId: number): Promise<Static<typeof DeleteFileVersionResponse>> {
        try {
            await this.verifyOwnership(fileId, userId);

            const version = await this.prisma.platformFileVersion.findUnique({
                where: { id: versionId },
                select: { platformFileId: true },
            });

            if (!version || version.platformFileId !== fileId) {
                throw new ServiceError('Version not found.', 404);
            }

            await this.prisma.platformFileVersion.delete({ where: { id: versionId } });
            return { success: true };
        } catch (error: unknown) {
            handlePrismaError(error, 'while deleting the file version', { notFoundMessage: 'Version not found.' });
        }
    }

    // ==================== File Permissions ====================

    async getFilePermissions(userId: number, fileId: string): Promise<Static<typeof GetFilePermissionsResponse>> {
        await this.verifyOwnership(fileId, userId);

        const permissions = await this.prisma.platformFilePermission.findMany({
            where: { platformFileId: fileId },
            select: {
                id: true,
                platformUserId: true,
                permission: true,
                platformUser: {
                    select: { id: true, user: { select: { name: true, email: true } } },
                },
            },
        });

        return permissions.map(p => ({
            id: p.id,
            platformUserId: p.platformUserId,
            permission: p.permission as 'VIEWER' | 'EDITOR' | 'OWNER',
            user: { id: p.platformUser.id, name: p.platformUser.user.name, email: p.platformUser.user.email },
        }));
    }

    async addFilePermission(userId: number, fileId: string, body: Static<typeof AddFilePermissionRequestBody>): Promise<Static<typeof AddFilePermissionResponse>> {
        try {
            await this.verifyOwnership(fileId, userId);

            if (body.platformUserId === userId) {
                throw new ServiceError('Cannot add permission to yourself.', 400);
            }

            const targetUser = await this.prisma.platformUser.findUnique({
                where: { id: body.platformUserId },
                select: { id: true, user: { select: { name: true, email: true } } },
            });

            if (!targetUser) throw new ServiceError('User not found.', 404);

            const permission = await this.prisma.platformFilePermission.create({
                data: {
                    platformFileId: fileId,
                    platformUserId: body.platformUserId,
                    permission: body.permission,
                },
                select: { id: true, platformUserId: true, permission: true },
            });

            return {
                id: permission.id,
                platformUserId: permission.platformUserId,
                permission: permission.permission as 'VIEWER' | 'EDITOR' | 'OWNER',
                user: { id: targetUser.id, name: targetUser.user.name, email: targetUser.user.email },
            };
        } catch (error: unknown) {
            handlePrismaError(error, 'while adding the file permission', {
                duplicateMessage: 'This user already has permission for this file.'
            });
        }
    }

    async updateFilePermission(userId: number, fileId: string, permissionId: number, body: Static<typeof UpdateFilePermissionRequestBody>): Promise<Static<typeof UpdateFilePermissionResponse>> {
        try {
            await this.verifyOwnership(fileId, userId);

            const existingPermission = await this.prisma.platformFilePermission.findUnique({
                where: { id: permissionId },
                select: { platformFileId: true },
            });

            if (!existingPermission || existingPermission.platformFileId !== fileId) {
                throw new ServiceError('Permission not found.', 404);
            }

            const permission = await this.prisma.platformFilePermission.update({
                where: { id: permissionId },
                data: { permission: body.permission },
                select: {
                    id: true,
                    platformUserId: true,
                    permission: true,
                    platformUser: {
                        select: { id: true, user: { select: { name: true, email: true } } },
                    },
                },
            });

            return {
                id: permission.id,
                platformUserId: permission.platformUserId,
                permission: permission.permission as 'VIEWER' | 'EDITOR' | 'OWNER',
                user: { id: permission.platformUser.id, name: permission.platformUser.user.name, email: permission.platformUser.user.email },
            };
        } catch (error: unknown) {
            handlePrismaError(error, 'while updating the file permission', { notFoundMessage: 'Permission not found.' });
        }
    }

    async removeFilePermission(userId: number, fileId: string, permissionId: number): Promise<Static<typeof RemoveFilePermissionResponse>> {
        try {
            await this.verifyOwnership(fileId, userId);

            const permission = await this.prisma.platformFilePermission.findUnique({
                where: { id: permissionId },
                select: { platformFileId: true },
            });

            if (!permission || permission.platformFileId !== fileId) {
                throw new ServiceError('Permission not found.', 404);
            }

            await this.prisma.platformFilePermission.delete({ where: { id: permissionId } });
            return { success: true };
        } catch (error: unknown) {
            handlePrismaError(error, 'while removing the file permission', { notFoundMessage: 'Permission not found.' });
        }
    }

    // ==================== Search ====================

    async searchFiles(userId: number, query: Static<typeof SearchFilesRequestQuery>): Promise<Static<typeof SearchFilesResponse>> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const skip = (page - 1) * pageSize;

        const whereClause = {
            platformUserId: userId,
            name: { contains: query.query, mode: 'insensitive' as const },
            ...(query.type && { type: query.type as PlatformFileType }),
        };

        const [totalItems, files] = await Promise.all([
            this.prisma.platformFile.count({ where: whereClause }),
            this.prisma.platformFile.findMany({
                where: whereClause,
                skip,
                take: pageSize,
                orderBy: [{ type: 'asc' }, { name: 'asc' }],
                select: FILE_BASE_SELECT,
            }),
        ]);

        const filesWithPaths = await Promise.all(
            files.map(async (file) => ({
                ...mapToFileData(file),
                path: await this.buildFilePath(file.id),
            }))
        );

        return { values: filesWithPaths, totalItems, totalPages: Math.ceil(totalItems / pageSize), currentPage: page, pageSize };
    }
}

// Re-export for convenience
export * from "./types";
