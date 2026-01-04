import {
  PrismaClientKnownRequestError
} from "@momoi/database/prisma/generated/internal/prismaNamespace";

export class ServiceError extends Error {
  constructor(public readonly message: string, public readonly status: number) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Options for handlePrismaError
 */
export interface HandlePrismaErrorOptions {
  /** Custom message for P2025 (not found) errors. Defaults to 'Resource not found.' */
  notFoundMessage?: string;
  /** Custom message for P2002 (duplicate) errors. Defaults to 'Duplicate resource.' */
  duplicateMessage?: string;
}

/**
 * Centralized error handler for Prisma operations.
 * Converts Prisma errors to ServiceError with appropriate status codes.
 * 
 * @param error - The caught error
 * @param context - Description of the operation for error message (e.g., "while creating the instance")
 * @param options - Optional custom error messages
 * @throws ServiceError - Always throws, never returns
 */
export function handlePrismaError(
  error: unknown,
  context: string,
  options: HandlePrismaErrorOptions = {}
): never {
  const {
    notFoundMessage = 'Resource not found.',
    duplicateMessage = 'Duplicate resource.'
  } = options;

  // Re-throw ServiceError as-is
  if (error instanceof ServiceError) {
    throw error;
  }

  // Handle known Prisma errors
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2025':
        throw new ServiceError(notFoundMessage, 404);
      case 'P2002':
        throw new ServiceError(duplicateMessage, 409);
      default:
        throw new ServiceError(`Database error: ${error.message}`, 500);
    }
  }

  // Handle unexpected errors
  throw new ServiceError(`An unexpected error occurred ${context}.`, 500);
}

