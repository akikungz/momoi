import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import { UserSSHKeyUseCases } from "./application/use-cases";
import { CacheSSHKeyCache } from "./infrastructure/cache-ssh-key-cache";
import { PrismaSSHKeyRepository } from "./infrastructure/prisma-ssh-key-repository";

export function createUserSSHKeyUseCases(
	prisma: PrismaClient,
	cache: CacheModule,
) {
	const repository = new PrismaSSHKeyRepository(prisma);
	const sshKeyCache = new CacheSSHKeyCache(cache);

	return new UserSSHKeyUseCases(repository, sshKeyCache);
}

export * from "./application/ports";
export * from "./application/use-cases";
export * from "./domain/ssh-key";
