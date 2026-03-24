import type { PaginatedSSHKeys, Pagination, SSHKey } from "../domain/ssh-key";

export interface CreateSSHKeyInput {
	ownerId: number;
	name: string;
	publicKey: string;
}

export interface ListSSHKeysInput {
	ownerId: number;
	pagination: Pagination;
}

export interface RemoveSSHKeysInput {
	ownerId: number;
	keyIds: number[];
}

export interface SSHKeyRepository {
	create(input: CreateSSHKeyInput): Promise<SSHKey>;
	countByOwner(ownerId: number): Promise<number>;
	findByOwner(input: ListSSHKeysInput): Promise<SSHKey[]>;
	removeByOwner(input: RemoveSSHKeysInput): Promise<number>;
}

export interface SSHKeyCache {
	getList(
		ownerId: number,
		pagination: Pagination,
	): Promise<PaginatedSSHKeys | null>;
	setList(ownerId: number, response: PaginatedSSHKeys): Promise<void>;
	invalidateOwner(ownerId: number): Promise<void>;
}
