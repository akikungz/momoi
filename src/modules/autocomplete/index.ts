import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import { AutocompleteUseCases } from "./application/use-cases";
import { CacheJsonStore } from "./infrastructure/cache-json-store";
import { PrismaAutocompleteDataAccess } from "./infrastructure/prisma-autocomplete-data-access";

export function createAutocompleteUseCases(
	prisma: PrismaClient,
	cache: CacheModule,
) {
	return new AutocompleteUseCases(
		new PrismaAutocompleteDataAccess(prisma),
		new CacheJsonStore(cache),
	);
}

export * from "./application/use-cases";
export * from "./domain/cache-keys";
