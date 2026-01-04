import { Static } from "elysia";

import { GetInstancesRequestQuery } from "@momoi/model/instance";

/**
 * Filter types for getInstance queries
 */
export type InstanceFilterType = 'user' | 'instructor' | 'admin';

/**
 * Filter configuration for user-specific queries
 */
export interface UserInstanceFilter {
    type: 'user';
    userId: number;
}

/**
 * Filter configuration for instructor-specific queries
 */
export interface InstructorInstanceFilter {
    type: 'instructor';
    instructorId: number;
}

/**
 * Filter configuration for admin queries (all instances)
 */
export interface AdminInstanceFilter {
    type: 'admin';
}

/**
 * Union type for all instance filter types
 */
export type InstanceFilter = UserInstanceFilter | InstructorInstanceFilter | AdminInstanceFilter;

/**
 * Standard pagination parameters
 */
export interface PaginationParams {
    page: number;
    pageSize: number;
    skip: number;
    take: number;
}

/**
 * Parses pagination from query parameters with defaults
 */
export function parsePagination(query: Static<typeof GetInstancesRequestQuery>): PaginationParams {
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
 * Generates cache key for instance list queries
 */
export function buildInstanceListCacheKey(
    filter: InstanceFilter,
    query: Static<typeof GetInstancesRequestQuery>
): string {
    const prefix = filter.type === 'user'
        ? `user:${filter.userId}:instances`
        : filter.type === 'instructor'
            ? `instructor:${filter.instructorId}:instances`
            : 'instances';

    return `${prefix}:page:${query.page ?? 1}:size:${query.pageSize ?? 10}:courseId:${query.courseId ?? 'all'}:semesterId:${query.semesterId ?? 'all'}`;
}
