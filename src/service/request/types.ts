import { Static } from "elysia";

import type { Prisma } from '@momoi/database/prisma/generated/client';
import { GetExtendedRequestsRequestQuery, GetRequestsRequestQuery } from "@momoi/model/request";
import { parsePagination } from "@momoi/utils/pagination";
import type { PaginationParams } from "@momoi/utils/pagination";

export { parsePagination };
export type { PaginationParams };

/**
 * Current user context for authorization
 */
export type CurrentUser = {
    id: number;
    role: "ADMIN" | "INSTRUCTOR" | "STUDENT";
};

/**
 * Builds request filter based on user role and query parameters
 */
export function buildRequestFilter(user: CurrentUser, query: Static<typeof GetRequestsRequestQuery>) {
    const pagination = parsePagination(query);
    const filters: Prisma.RequestWhereInput[] = [];

    if (query.status) filters.push({ status: query.status });

    if (query.courseId || query.semesterId) {
        filters.push({
            courseOffering: {
                courseId: query.courseId ?? undefined,
                semesterId: query.semesterId ?? undefined,
            }
        });
    }

    // Role-based filtering
    if (user.role === 'STUDENT') {
        filters.push({ requesterId: user.id });
    } else if (user.role === 'INSTRUCTOR') {
        filters.push({
            courseOffering: {
                course: {
                    instructors: { some: { id: user.id } },
                },
            }
        });
    }

    const where: Prisma.RequestWhereInput = filters.length ? { AND: filters } : {};

    return { where, pagination };
}

/**
 * Builds extended request filter based on user role and query parameters
 */
export function buildExtendedRequestFilter(user: CurrentUser, query: Static<typeof GetExtendedRequestsRequestQuery>) {
    const pagination = parsePagination(query);
    const filters: Prisma.ExtendedRequestWhereInput[] = [];

    if (query.status) filters.push({ status: query.status });
    if (query.instanceId) filters.push({ targetInstanceId: query.instanceId });

    if (query.courseId || query.semesterId) {
        filters.push({
            targetInstance: {
                courseOffering: {
                    courseId: query.courseId ?? undefined,
                    semesterId: query.semesterId ?? undefined,
                }
            }
        });
    }

    // Role-based filtering
    if (user.role === 'STUDENT') {
        filters.push({ requesterId: user.id });
    } else if (user.role === 'INSTRUCTOR') {
        filters.push({
            targetInstance: {
                courseOffering: {
                    course: {
                        instructors: { some: { id: user.id } }
                    }
                }
            }
        });
    }

    const where: Prisma.ExtendedRequestWhereInput = filters.length ? { AND: filters } : {};

    return { where, pagination };
}
