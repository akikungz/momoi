import { Static } from 'elysia';

import {
    PrismaClientKnownRequestError
} from '@momoi/database/prisma/generated/internal/prismaNamespace';
import { addSSHKeyResponse, getSSHKeyData, getSSHKeyResponse } from '@momoi/model/user';

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

export class UserService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
  ) { }

  async addSSHKey(userId: number, name: string, publicKey: string): Promise<Static<typeof addSSHKeyResponse>> {
    try {
      const sshKey = await this.prisma.platformSSHKey.create({
        data: {
          ownerId: userId,
          name,
          publicKey,
        },
      });

      // Clear relevant cache entries
      const cacheKeyPattern = `user:${userId}:sshkeys:*`;
      await this.cache.deleteCacheByPattern(cacheKeyPattern);

      return sshKey;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('An SSH key with the same name or public key already exists for this user.');
        }

        if (error.code === 'P2025') {
          throw new Error('User not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while adding the SSH key.');
    }
  }

  async getSSHKeys(userId: number, page: number = 1, pageSize: number = 10): Promise<Static<typeof getSSHKeyResponse>> {
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Cache key based on userId, page, and pageSize
    const cacheKey = `user:${userId}:sshkeys:page:${page}:size:${pageSize}`;
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
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const response: Static<typeof getSSHKeyResponse> = {
      values,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      currentPage: page,
      pageSize,
    }

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
        }
      });

      // Clear relevant cache entries
      const cacheKeyPattern = `user:${userId}:sshkeys:*`;
      await this.cache.deleteCacheByPattern(cacheKeyPattern);

      return deleteResult.count;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('One or more SSH keys not found for the user.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while removing the SSH keys.');
    }
  }
}
