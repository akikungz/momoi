import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import type { ObjectStorageProvider } from "@momoi/storage-provider";

import { StorageUseCases } from "./application/use-cases";
import { CacheJsonStore } from "./infrastructure/cache-json-store";
import { ObjectStoragePort } from "./infrastructure/object-storage-port";
import { PrismaStorageDataAccess } from "./infrastructure/prisma-storage-data-access";

export function createStorageUseCases(
	prisma: PrismaClient,
	cache: CacheModule,
	objectStorage: ObjectStorageProvider,
) {
	return new StorageUseCases(
		new PrismaStorageDataAccess(prisma),
		new CacheJsonStore(cache),
		new ObjectStoragePort(objectStorage),
	);
}

export * from "./application/use-cases";
