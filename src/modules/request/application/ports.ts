import type { PrismaClient } from "@momoi/database/prisma/generated/client";

export interface JsonCacheStore {
	get<T>(key: string): Promise<T | null>;
	set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
	invalidate(pattern: string): Promise<void>;
}

export interface RequestDataAccess {
	prisma: PrismaClient;
}

export interface RequestQueuePort {
	enqueueProvisionInstance(instanceId: number, userId: number): Promise<void>;
}

export interface RequestTelemetryPort {
	recordRequestOperation(
		operation: string,
		attributes?: Record<string, string>,
	): void;
	recordQueueJobEnqueued(
		queueName: string,
		jobName: string,
		attributes?: Record<string, string>,
	): void;
}
