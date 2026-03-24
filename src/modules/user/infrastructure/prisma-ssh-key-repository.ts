import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import { toPaginationWindow } from "../domain/ssh-key";
import type {
	CreateSSHKeyInput,
	ListSSHKeysInput,
	RemoveSSHKeysInput,
	SSHKeyRepository,
} from "../application/ports";

const SSH_KEY_SELECT = {
	id: true,
	name: true,
	publicKey: true,
	createdAt: true,
	updatedAt: true,
} as const;

export class PrismaSSHKeyRepository implements SSHKeyRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async create(input: CreateSSHKeyInput) {
		return this.prisma.platformSSHKey.create({
			data: {
				ownerId: input.ownerId,
				name: input.name,
				publicKey: input.publicKey,
			},
			select: SSH_KEY_SELECT,
		});
	}

	async countByOwner(ownerId: number) {
		return this.prisma.platformSSHKey.count({
			where: { ownerId },
		});
	}

	async findByOwner(input: ListSSHKeysInput) {
		const { skip, take } = toPaginationWindow(input.pagination);

		return this.prisma.platformSSHKey.findMany({
			where: { ownerId: input.ownerId },
			select: SSH_KEY_SELECT,
			skip,
			take,
			orderBy: { createdAt: "desc" },
		});
	}

	async removeByOwner(input: RemoveSSHKeysInput) {
		const result = await this.prisma.platformSSHKey.deleteMany({
			where: {
				ownerId: input.ownerId,
				id: { in: input.keyIds },
			},
		});

		return result.count;
	}
}
