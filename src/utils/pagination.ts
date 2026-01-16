/**
 * Standard pagination parameters used across services
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/**
 * Parses pagination from query parameters with defaults.
 * Ensures consistent pagination behavior across all services.
 * 
 * @param query - Query object containing optional page and pageSize
 * @returns Normalized pagination parameters
 */
export function parsePagination(query: { page?: number; pageSize?: number }): PaginationParams {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * Builds a paginated response object with standard pagination metadata.
 * 
 * @param totalItems - Total number of items
 * @param page - Current page number
 * @param pageSize - Items per page
 * @returns Pagination metadata for response
 */
export function buildPaginationResponse(totalItems: number, page: number, pageSize: number) {
  return {
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
    currentPage: page,
    pageSize,
  };
}
