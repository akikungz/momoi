import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import type { AcademicDataAccess } from "../application/ports";

export class PrismaAcademicDataAccess implements AcademicDataAccess {
	constructor(public readonly prisma: PrismaClient) {}
}
