import type { PrismaClient } from "@momoi/database/prisma/generated/client";

export interface JsonCacheStore {
	get<T>(key: string): Promise<T | null>;
	set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
	invalidate(pattern: string): Promise<void>;
}

export interface AcademicDataAccess {
	prisma: PrismaClient;
}
