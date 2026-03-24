import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import type { RequestDataAccess } from "../application/ports";

export class PrismaRequestDataAccess implements RequestDataAccess {
	constructor(public readonly prisma: PrismaClient) {}
}
