import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import type { ObjectStorageProvider } from "@momoi/storage-provider";

export interface JsonCacheStore {
	get<T>(key: string): Promise<T | null>;
	set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface StorageDataAccess {
	prisma: PrismaClient;
}

export interface StorageProviderPort {
	provider: ObjectStorageProvider;
}
