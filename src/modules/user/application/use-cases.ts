import { handlePrismaError } from "@momoi/utils/error";

import { buildPaginatedSSHKeys, normalizePagination } from "../domain/ssh-key";
import type {
	CreateSSHKeyInput,
	RemoveSSHKeysInput,
	SSHKeyCache,
	SSHKeyRepository,
} from "./ports";

export class AddSSHKeyUseCase {
	constructor(
		private readonly repository: SSHKeyRepository,
		private readonly cache: SSHKeyCache,
	) {}

	async execute(input: CreateSSHKeyInput) {
		try {
			const sshKey = await this.repository.create(input);
			await this.cache.invalidateOwner(input.ownerId);
			return sshKey;
		} catch (error: unknown) {
			handlePrismaError(error, "while adding the SSH key", {
				notFoundMessage: "User not found.",
				duplicateMessage:
					"An SSH key with the same name or public key already exists for this user.",
			});
		}
	}
}

export class GetSSHKeysUseCase {
	constructor(
		private readonly repository: SSHKeyRepository,
		private readonly cache: SSHKeyCache,
	) {}

	async execute(ownerId: number, page?: number, pageSize?: number) {
		const pagination = normalizePagination(page, pageSize);
		const cached = await this.cache.getList(ownerId, pagination);

		if (cached) {
			return cached;
		}

		const [totalItems, values] = await Promise.all([
			this.repository.countByOwner(ownerId),
			this.repository.findByOwner({ ownerId, pagination }),
		]);

		const response = buildPaginatedSSHKeys(values, totalItems, pagination);
		await this.cache.setList(ownerId, response);

		return response;
	}
}

export class RemoveSSHKeysUseCase {
	constructor(
		private readonly repository: SSHKeyRepository,
		private readonly cache: SSHKeyCache,
	) {}

	async execute(input: RemoveSSHKeysInput) {
		try {
			const deletedCount = await this.repository.removeByOwner(input);
			await this.cache.invalidateOwner(input.ownerId);
			return deletedCount;
		} catch (error: unknown) {
			handlePrismaError(error, "while removing the SSH keys", {
				notFoundMessage: "One or more SSH keys not found for the user.",
			});
		}
	}
}

export class UserSSHKeyUseCases {
	readonly addSSHKey: AddSSHKeyUseCase;
	readonly getSSHKeys: GetSSHKeysUseCase;
	readonly removeSSHKeys: RemoveSSHKeysUseCase;

	constructor(repository: SSHKeyRepository, cache: SSHKeyCache) {
		this.addSSHKey = new AddSSHKeyUseCase(repository, cache);
		this.getSSHKeys = new GetSSHKeysUseCase(repository, cache);
		this.removeSSHKeys = new RemoveSSHKeysUseCase(repository, cache);
	}
}
