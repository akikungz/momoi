/**
 * Prisma select clauses for User-related queries.
 * Centralizes field selection for consistency and reusability.
 */

/**
 * Select clause for SSH key list/create responses.
 */
export const SSH_KEY_SELECT = {
	id: true,
	name: true,
	publicKey: true,
	createdAt: true,
	updatedAt: true,
} as const;
