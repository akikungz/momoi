import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import { AcademicUseCases } from "./application/use-cases";
import { CacheJsonStore } from "./infrastructure/cache-json-store";
import { PrismaAcademicDataAccess } from "./infrastructure/prisma-academic-data-access";

export function createAcademicUseCases(
	prisma: PrismaClient,
	cache: CacheModule,
) {
	return new AcademicUseCases(
		new PrismaAcademicDataAccess(prisma),
		new CacheJsonStore(cache),
	);
}

export * from "./application/use-cases";
export * from "./domain/cache-keys";
