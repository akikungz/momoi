import { Static } from "elysia";

import { addSSHKeyResponse, getSSHKeyResponse } from "@momoi/model/user";

/**
 * Response type for SSH key data.
 */
export type SSHKeyData = Static<typeof addSSHKeyResponse>;

/**
 * Response type for paginated SSH keys.
 */
export type SSHKeyListResponse = Static<typeof getSSHKeyResponse>;

/**
 * Build cache key for SSH key list queries.
 */
export function buildSSHKeyCacheKey(
    userId: number,
    page: number,
    pageSize: number
): string {
    return `user:${userId}:sshkeys:page:${page}:size:${pageSize}`;
}

/**
 * Build cache pattern for invalidating all SSH key caches for a user.
 */
export function buildSSHKeyCachePattern(userId: number): string {
    return `user:${userId}:sshkeys:*`;
}

/**
 * Parse pagination parameters with defaults.
 */
export function parsePagination(
    page: number = 1,
    pageSize: number = 10
): { skip: number; take: number; page: number; pageSize: number } {
    return {
        skip: (page - 1) * pageSize,
        take: pageSize,
        page,
        pageSize,
    };
}
