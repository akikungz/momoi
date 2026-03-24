import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import type { InstanceDataAccess } from "../application/ports";

export class PrismaInstanceDataAccess implements InstanceDataAccess {
	constructor(public readonly prisma: PrismaClient) {}
}
