export interface SSHKey {
	id: number;
	name: string;
	publicKey: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Pagination {
	page: number;
	pageSize: number;
}

export interface PaginatedSSHKeys {
	values: SSHKey[];
	totalItems: number;
	totalPages: number;
	currentPage: number;
	pageSize: number;
}

export function normalizePagination(
	page: number = 1,
	pageSize: number = 10,
): Pagination {
	return {
		page,
		pageSize,
	};
}

export function toPaginationWindow(pagination: Pagination) {
	return {
		skip: (pagination.page - 1) * pagination.pageSize,
		take: pagination.pageSize,
	};
}

export function buildPaginatedSSHKeys(
	values: SSHKey[],
	totalItems: number,
	pagination: Pagination,
): PaginatedSSHKeys {
	return {
		values,
		totalItems,
		totalPages: Math.ceil(totalItems / pagination.pageSize),
		currentPage: pagination.page,
		pageSize: pagination.pageSize,
	};
}
