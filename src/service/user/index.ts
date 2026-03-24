import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import { createUserSSHKeyUseCases } from "@momoi/modules/user";

import type { SSHKeyData, SSHKeyListResponse } from "./types";

export class UserService {
	private readonly useCases;

	constructor(prisma: PrismaClient, cache: CacheModule) {
		this.useCases = createUserSSHKeyUseCases(prisma, cache);
	}

	async addSSHKey(
		userId: number,
		name: string,
		publicKey: string,
	): Promise<SSHKeyData> {
		return this.useCases.addSSHKey.execute({
			ownerId: userId,
			name,
			publicKey,
		});
	}

	async getSSHKeys(
		userId: number,
		page: number = 1,
		pageSize: number = 10,
	): Promise<SSHKeyListResponse> {
		return this.useCases.getSSHKeys.execute(userId, page, pageSize);
	}

	async removeSSHKey(userId: number, keyIds: number[]): Promise<number> {
		return this.useCases.removeSSHKeys.execute({
			ownerId: userId,
			keyIds,
		});
	}
}

// Re-export for convenience
export * from "./selects";
export * from "./mappers";
export * from "./types";
