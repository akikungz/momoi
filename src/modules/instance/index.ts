import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import type { QueueModule } from "@momoi/queue";

import { InstanceUseCases } from "./application/use-cases";
import { CacheJsonStore } from "./infrastructure/cache-json-store";
import { PrismaInstanceDataAccess } from "./infrastructure/prisma-instance-data-access";
import { QueueInstancePort } from "./infrastructure/queue-instance-port";
import { RuntimeInstanceTelemetry } from "./infrastructure/runtime-instance-telemetry";

export function createInstanceUseCases(
	prisma: PrismaClient,
	cache: CacheModule,
	queue: QueueModule,
) {
	return new InstanceUseCases(
		new PrismaInstanceDataAccess(prisma),
		new CacheJsonStore(cache),
		new QueueInstancePort(queue),
		new RuntimeInstanceTelemetry(),
	);
}

export * from "./application/use-cases";
export * from "./domain/cache-keys";
