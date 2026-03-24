import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import type { StorageDataAccess } from "../application/ports";

export class PrismaStorageDataAccess implements StorageDataAccess {
	constructor(public readonly prisma: PrismaClient) {}
}
