import type { PrismaClient } from "@momoi/database/prisma/generated/client";

export interface JsonCacheStore {
	get<T>(key: string): Promise<T | null>;
	set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
	invalidate(pattern: string): Promise<void>;
}

export interface InstanceDataAccess {
	prisma: PrismaClient;
}

export interface InstanceQueuePort {
	enqueueProvisionInstance(
		instanceId: number,
		userId: number,
		jobId: string,
	): Promise<void>;
	enqueueDeprovisionInstance(
		instanceId: number,
		userId: number,
		jobId: string,
	): Promise<void>;
}

export interface InstanceTelemetryPort {
	recordInstanceOperation(
		operation: string,
		attributes?: Record<string, string | boolean>,
	): void;
	recordQueueJobEnqueued(
		queueName: string,
		jobName: string,
		attributes?: Record<string, string>,
	): void;
}
