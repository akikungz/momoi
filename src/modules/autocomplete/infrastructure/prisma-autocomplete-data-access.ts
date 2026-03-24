import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import type { AutocompleteDataAccess } from "../application/ports";

export class PrismaAutocompleteDataAccess implements AutocompleteDataAccess {
	constructor(public readonly prisma: PrismaClient) {}
}
