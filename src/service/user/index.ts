import { handlePrismaError } from "@momoi/utils/error";

import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import { mapSSHKeyToResponse, mapSSHKeysToListResponse } from "./mappers";
import { SSH_KEY_SELECT } from "./selects";
import {
    buildSSHKeyCacheKey,
    buildSSHKeyCachePattern,
    parsePagination,
    SSHKeyData,
    SSHKeyListResponse,
} from "./types";

export class UserService {
    constructor(
        private prisma: PrismaClient,
        private cache: CacheModule
    ) { }

    async addSSHKey(
        userId: number,
        name: string,
        publicKey: string
    ): Promise<SSHKeyData> {
        try {
            const sshKey = await this.prisma.platformSSHKey.create({
                data: {
                    ownerId: userId,
                    name,
                    publicKey,
                },
                select: SSH_KEY_SELECT,
            });

            // Clear relevant cache entries
            await this.cache.deleteCacheByPattern(buildSSHKeyCachePattern(userId));

            return mapSSHKeyToResponse(sshKey);
        } catch (error: unknown) {
            handlePrismaError(error, "while adding the SSH key", {
                notFoundMessage: "User not found.",
                duplicateMessage:
                    "An SSH key with the same name or public key already exists for this user.",
            });
        }
    }

    async getSSHKeys(
        userId: number,
        page: number = 1,
        pageSize: number = 10
    ): Promise<SSHKeyListResponse> {
        const { skip, take } = parsePagination(page, pageSize);

        // Cache key based on userId, page, and pageSize
        const cacheKey = buildSSHKeyCacheKey(userId, page, pageSize);

        // Try to get from cache
        const cachedData = await this.cache.getCacheValue(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        const [totalItems, values] = await Promise.all([
            this.prisma.platformSSHKey.count({
                where: { ownerId: userId },
            }),
            this.prisma.platformSSHKey.findMany({
                where: { ownerId: userId },
                select: SSH_KEY_SELECT,
                skip,
                take,
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const response = mapSSHKeysToListResponse(values, totalItems, page, pageSize);

        // Store in cache
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response));

        return response;
    }

    async removeSSHKey(userId: number, keyIds: number[]): Promise<number> {
        try {
            const deleteResult = await this.prisma.platformSSHKey.deleteMany({
                where: {
                    ownerId: userId,
                    id: { in: keyIds },
                },
            });

            // Clear relevant cache entries
            await this.cache.deleteCacheByPattern(buildSSHKeyCachePattern(userId));

            return deleteResult.count;
        } catch (error: unknown) {
            handlePrismaError(error, "while removing the SSH keys", {
                notFoundMessage: "One or more SSH keys not found for the user.",
            });
        }
    }
}

// Re-export for convenience
export * from "./selects";
export * from "./mappers";
export * from "./types";
