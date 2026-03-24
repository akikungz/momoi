import type { CacheModule } from "@momoi/cache";

import type { SSHKeyCache } from "../application/ports";
import type { PaginatedSSHKeys, Pagination } from "../domain/ssh-key";

function buildSSHKeyCacheKey(ownerId: number, pagination: Pagination): string {
	return `user:${ownerId}:sshkeys:page:${pagination.page}:size:${pagination.pageSize}`;
}

function buildSSHKeyCachePattern(ownerId: number): string {
	return `user:${ownerId}:sshkeys:*`;
}

export class CacheSSHKeyCache implements SSHKeyCache {
	constructor(private readonly cache: CacheModule) {}

	async getList(ownerId: number, pagination: Pagination) {
		const cached = await this.cache.getCacheValue(
			buildSSHKeyCacheKey(ownerId, pagination),
		);

		if (!cached) {
			return null;
		}

		return JSON.parse(cached) as PaginatedSSHKeys;
	}

	async setList(ownerId: number, response: PaginatedSSHKeys) {
		await this.cache.createCacheKey(
			buildSSHKeyCacheKey(ownerId, {
				page: response.currentPage,
				pageSize: response.pageSize,
			}),
			JSON.stringify(response),
		);
	}

	async invalidateOwner(ownerId: number) {
		await this.cache.deleteCacheByPattern(buildSSHKeyCachePattern(ownerId));
	}
}
