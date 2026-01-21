import { SSHKeyData, SSHKeyListResponse } from "./types";

/**
 * Type for SSH key data returned from Prisma select.
 */
type SSHKeySelectResult = {
    id: number;
    name: string;
    publicKey: string;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Maps a Prisma SSH key record to the API response format.
 */
export function mapSSHKeyToResponse(sshKey: SSHKeySelectResult): SSHKeyData {
    return {
        id: sshKey.id,
        name: sshKey.name,
        publicKey: sshKey.publicKey,
        createdAt: sshKey.createdAt,
        updatedAt: sshKey.updatedAt,
    };
}

/**
 * Maps SSH key query results to paginated response.
 */
export function mapSSHKeysToListResponse(
    values: SSHKeySelectResult[],
    totalItems: number,
    page: number,
    pageSize: number
): SSHKeyListResponse {
    return {
        values: values.map(mapSSHKeyToResponse),
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        pageSize,
    };
}

