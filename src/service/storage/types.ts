import { Static } from "elysia";

import { FileData } from "@momoi/model/storage";

import type { PlatformFileType } from "@momoi/database/prisma/generated/enums";

/**
 * Common file select fields
 */
export const FILE_BASE_SELECT = {
    id: true,
    name: true,
    type: true,
    sizeBytes: true,
    visibility: true,
    parentId: true,
    isPublic: true,
    createdAt: true,
    updatedAt: true,
} as const;

/**
 * Type for base file result from Prisma
 */
export type FileBaseResult = {
    id: string;
    name: string;
    type: PlatformFileType;
    sizeBytes: number;
    visibility: string;
    parentId: string | null;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Maps prisma file result to FileData response
 */
export function mapToFileData(file: FileBaseResult): Static<typeof FileData> {
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
    };
}

/**
 * Permission levels for access control
 */
export const PERMISSION_LEVELS = {
    'VIEWER': 1,
    'EDITOR': 2,
    'OWNER': 3
} as const;

export type PermissionLevel = keyof typeof PERMISSION_LEVELS;
