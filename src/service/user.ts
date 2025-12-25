import { Static } from 'elysia';

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

import { getSSHKeyData, getSSHKeyResponse } from '@momoi/model/user';

export class UserService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
  ) { }

  async addSSHKey(userId: number, name: string, publicKey: string): Promise<Static<typeof getSSHKeyData>> {
    return this.prisma.platformSSHKey.create({
      data: {
        ownerId: userId,
        name,
        publicKey,
      },
    });
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
    return this.prisma.platformSSHKey.deleteMany({
      where: {
        id: {
          in: keyIds,
        },
        ownerId: userId,
      },
    }).then(result => result.count);
  }
}
