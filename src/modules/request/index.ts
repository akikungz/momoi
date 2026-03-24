import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import type { QueueModule } from "@momoi/queue";

import { RequestUseCases } from "./application/use-cases";
import { CacheJsonStore } from "./infrastructure/cache-json-store";
import { PrismaRequestDataAccess } from "./infrastructure/prisma-request-data-access";
import { QueueRequestPort } from "./infrastructure/queue-request-port";
import { RuntimeRequestTelemetry } from "./infrastructure/runtime-request-telemetry";

export function createRequestUseCases(
	prisma: PrismaClient,
	cache: CacheModule,
	queue: QueueModule,
) {
	return new RequestUseCases(
		new PrismaRequestDataAccess(prisma),
		new CacheJsonStore(cache),
		new QueueRequestPort(queue),
		new RuntimeRequestTelemetry(),
	);
}

export * from "./application/use-cases";
export * from "./domain/cache-keys";
