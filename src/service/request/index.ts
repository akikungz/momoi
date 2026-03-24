import { Static } from "elysia";

import {
    ApprovalActionStatus, CreateExtendedRequestRequestBody, CreateExtendedRequestResponse,
    CreateRequestRequestBody, CreateRequestResponse, GetExtendedRequestAuditLogsResponse,
    GetExtendedRequestsRequestQuery, GetExtendedRequestsResponse, GetRequestAuditLogsResponse,
    GetRequestsRequestQuery, GetRequestsResponse, UpdateExtendedRequestStatusRequestBody,
    UpdateExtendedRequestStatusResponse, UpdateRequestStatusRequestBody, UpdateRequestStatusResponse
} from "@momoi/model/request";
import { QueueModule } from "@momoi/queue";
import {
    recordQueueJobEnqueued,
    recordRequestOperation,
} from "../../telemetry/runtime";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

import { mapExtendedRequest, mapRequest } from "./mappers";
import { EXTENDED_REQUEST_SELECT, REQUEST_SELECT } from "./selects";
import { buildExtendedRequestFilter, buildRequestFilter, CurrentUser } from "./types";

export class RequestService {
    constructor(
        private prisma: PrismaClient,
        private cache: CacheModule,
        private queue: QueueModule
    ) { }

    // ==================== Standard Requests ====================

    public async createRequest(userId: number, body: Static<typeof CreateRequestRequestBody>): Promise<Static<typeof CreateRequestResponse>> {
        try {
            const request = await this.prisma.request.create({
                data: {
                    title: body.title,
                    description: body.description,
                    courseOfferingId: body.courseOfferingId,
                    pveTemplateId: body.pveTemplateId,
                    cpus: body.cpus,
                    memoryMB: body.memoryMB,
                    diskGB: body.diskGB,
                    requesterId: userId,
                },
                select: REQUEST_SELECT,
            });

            await this.invalidateRequestCaches(userId);
            recordRequestOperation("create", {
                "request.type": "standard",
            });

            return mapRequest(request);
        } catch (error: unknown) {
            handlePrismaError(error, 'while creating the request', { notFoundMessage: 'Related resource not found for request creation.' });
        }
    }

    public async getRequests(user: CurrentUser, query: Static<typeof GetRequestsRequestQuery>): Promise<Static<typeof GetRequestsResponse>> {
        const { where, pagination } = buildRequestFilter(user, query);

        const [totalItems, items] = await Promise.all([
            this.prisma.request.count({ where }),
            this.prisma.request.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
                select: REQUEST_SELECT,
            })
        ]);

        return {
            values: items.map(item => mapRequest(item)),
            totalItems,
            totalPages: Math.ceil(totalItems / pagination.take),
            currentPage: pagination.page,
            pageSize: pagination.take,
        };
    }

    public async updateRequestStatus(user: CurrentUser, requestId: number, body: Static<typeof UpdateRequestStatusRequestBody>): Promise<Static<typeof UpdateRequestStatusResponse>> {
        const request = await this.prisma.request.findUnique({
            where: { id: requestId },
            include: {
                courseOffering: {
                    include: {
                        course: {
                            select: {
                                code: true,
                                title: true,
                                instructors: { select: { id: true } },
                            }
                        },
                        semester: { select: { name: true } },
                    }
                },
            }
        });

        if (!request) {
            throw new ServiceError('Request not found.', 404);
        }

        if (request.status !== 'PENDING') {
            throw new ServiceError('Request has already been processed.', 400);
        }

        const isAdmin = user.role === 'ADMIN';
        const isRequester = request.requesterId === user.id;
        const isInstructorForCourse = request.courseOffering?.course.instructors.some(instr => instr.id === user.id) ?? false;

        if (body.status === 'CANCELLED') {
            if (!isRequester) {
                throw new ServiceError('Only the requester can cancel this request.', 403);
            }
        } else {
            if (!isAdmin && !(user.role === 'INSTRUCTOR' && isInstructorForCourse)) {
                throw new ServiceError('You are not authorized to act on this request.', 403);
            }
        }

        const [updated] = await this.prisma.$transaction([
            this.prisma.request.update({
                where: { id: requestId },
                data: {
                    status: body.status,
                    reason: body.reason,
                    reviewerId: body.status === 'CANCELLED'
                        ? request.reviewerId ?? undefined
                        : user.id,
                },
                select: REQUEST_SELECT,
            }),
            this.prisma.requestAuditLog.create({
                data: {
                    requestId,
                    action: body.status,
                    performedById: user.id,
                    notes: body.reason,
                }
            })
        ]);
        recordRequestOperation("status_update", {
            "request.type": "standard",
            "request.status": updated.status,
            "user.role": user.role,
        });

        if (updated.status === "APPROVED") {
            const instance = await this.prisma.instance.create({
                data: {
                    courseOfferingId: request.courseOfferingId,
                    pveTemplateId: request.pveTemplateId,
                    cpus: request.cpus,
                    memoryMB: request.memoryMB,
                    diskGB: request.diskGB,
                    platformUserId: request.requesterId,
                },
            });

            console.info(`Request ${request.id} approved, created instance ${instance.id}, enqueueing provisioning job.`);

            await this.queue.provisionInstanceQueue.add(
                'provision',
                { instanceId: instance.id, userId: request.requesterId }
            );
            recordQueueJobEnqueued("provision-instance", "provision", {
                "app.operation": "approve_request",
            });
        }

        await Promise.all([
            this.invalidateRequestCaches(request.requesterId),
            this.cache.deleteCacheByPattern(`request:${requestId}:audit-logs:*`),
        ]);

        return mapRequest(updated);
    }

    // ==================== Extended Requests ====================

    public async createExtendedRequest(userId: number, body: Static<typeof CreateExtendedRequestRequestBody>): Promise<Static<typeof CreateExtendedRequestResponse>> {
        const targetInstance = await this.prisma.instance.findUnique({
            where: { id: body.targetInstanceId },
            select: {
                platformUserId: true,
                courseOffering: {
                    select: {
                        semester: {
                            select: { id: true, endDate: true },
                        }
                    }
                }
            },
        });

        if (!targetInstance || targetInstance.platformUserId !== userId) {
            throw new ServiceError('Instance not found or not owned by the user.', 404);
        }

        const currentSemesterEndDate = targetInstance.courseOffering?.semester?.endDate;
        if (!currentSemesterEndDate) {
            throw new ServiceError('Unable to determine current semester for the instance.', 400);
        }

        const nextSemester = await this.prisma.semester.findFirst({
            where: { startDate: { gte: currentSemesterEndDate } },
            orderBy: { startDate: 'asc' },
        });

        if (!nextSemester) {
            throw new ServiceError('No upcoming semester found for this extended request.', 404);
        }

        try {
            const extendedRequest = await this.prisma.extendedRequest.create({
                data: {
                    title: body.title,
                    description: body.description,
                    targetInstanceId: body.targetInstanceId,
                    requesterId: userId,
                    nextSemesterId: nextSemester.id,
                },
                select: EXTENDED_REQUEST_SELECT,
            });

            await this.invalidateExtendedRequestCaches(userId);
            recordRequestOperation("create", {
                "request.type": "extended",
            });

            return mapExtendedRequest(extendedRequest);
        } catch (error: unknown) {
            handlePrismaError(error, 'while creating the extended request', { notFoundMessage: 'Related resource not found for extended request creation.' });
        }
    }

    public async getExtendedRequests(user: CurrentUser, query: Static<typeof GetExtendedRequestsRequestQuery>): Promise<Static<typeof GetExtendedRequestsResponse>> {
        const { where, pagination } = buildExtendedRequestFilter(user, query);

        const [totalItems, items] = await Promise.all([
            this.prisma.extendedRequest.count({ where }),
            this.prisma.extendedRequest.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
                select: EXTENDED_REQUEST_SELECT,
            })
        ]);

        return {
            values: items.map(item => mapExtendedRequest(item)),
            totalItems,
            totalPages: Math.ceil(totalItems / pagination.take),
            currentPage: pagination.page,
            pageSize: pagination.take,
        };
    }

    public async updateExtendedRequestStatus(user: CurrentUser, extendedRequestId: number, body: Static<typeof UpdateExtendedRequestStatusRequestBody>): Promise<Static<typeof UpdateExtendedRequestStatusResponse>> {
        const extendedRequest = await this.prisma.extendedRequest.findUnique({
            where: { id: extendedRequestId },
            include: {
                targetInstance: {
                    include: {
                        courseOffering: {
                            include: {
                                course: {
                                    select: {
                                        code: true,
                                        title: true,
                                        instructors: { select: { id: true } },
                                    }
                                },
                                semester: { select: { name: true } },
                            }
                        },
                    },
                },
            },
        });

        if (!extendedRequest) {
            throw new ServiceError('Extended request not found.', 404);
        }

        if (extendedRequest.status !== 'PENDING') {
            throw new ServiceError('Extended request has already been processed.', 400);
        }

        const isAdmin = user.role === 'ADMIN';
        const isRequester = extendedRequest.requesterId === user.id;
        const isInstructorForCourse = extendedRequest.targetInstance?.courseOffering?.course.instructors.some(instr => instr.id === user.id) ?? false;

        if (body.status === 'CANCELLED') {
            if (!isRequester) {
                throw new ServiceError('Only the requester can cancel this extended request.', 403);
            }
        } else {
            if (!isAdmin && !(user.role === 'INSTRUCTOR' && isInstructorForCourse)) {
                throw new ServiceError('You are not authorized to act on this extended request.', 403);
            }
        }

        const [updated] = await this.prisma.$transaction([
            this.prisma.extendedRequest.update({
                where: { id: extendedRequestId },
                data: {
                    status: body.status,
                    reason: body.reason,
                    reviewerId: body.status === 'CANCELLED'
                        ? extendedRequest.reviewerId ?? undefined
                        : user.id,
                },
                select: EXTENDED_REQUEST_SELECT,
            }),
            this.prisma.extendedRequestAuditLog.create({
                data: {
                    extendedRequestId,
                    action: body.status,
                    performedById: user.id,
                    notes: body.reason,
                }
            })
        ]);
        recordRequestOperation("status_update", {
            "request.type": "extended",
            "request.status": updated.status,
            "user.role": user.role,
        });

        if (updated.status === ApprovalActionStatus.APPROVED) {
            // TODO: Apply semester into the target instance
        }

        await Promise.all([
            this.invalidateExtendedRequestCaches(extendedRequest.requesterId),
            this.cache.deleteCacheByPattern(`extended-request:${extendedRequestId}:audit-logs:*`),
        ]);

        return mapExtendedRequest(updated);
    }

    // ==================== Cache Management ====================

    private async invalidateRequestCaches(userId: number) {
        // No longer cache request lists due to frequent queue updates
        // Only invalidate audit log cache
        await this.cache.deleteCacheByPattern(`request:*:audit-logs:*`);
    }

    private async invalidateExtendedRequestCaches(userId: number) {
        // No longer cache extended request lists due to frequent queue updates
        // Only invalidate audit log cache
        await this.cache.deleteCacheByPattern(`extended-request:*:audit-logs:*`);
    }

    // ==================== Audit Logs ====================

    public async getRequestAuditLogs(
        requestId: number,
        page: number = 1,
        pageSize: number = 10
    ): Promise<Static<typeof GetRequestAuditLogsResponse>> {
        try {
            const skip = (page - 1) * pageSize;
            const cacheKey = `request:${requestId}:audit-logs:page:${page}:size:${pageSize}`;

            const cached = await this.cache.getCacheValue(cacheKey);
            if (cached) return JSON.parse(cached);

            const request = await this.prisma.request.findUnique({
                where: { id: requestId },
                select: { id: true },
            });

            if (!request) {
                throw new ServiceError('Request not found.', 404);
            }

            const [totalItems, logs] = await Promise.all([
                this.prisma.requestAuditLog.count({ where: { requestId } }),
                this.prisma.requestAuditLog.findMany({
                    where: { requestId },
                    skip,
                    take: pageSize,
                    orderBy: { timestamp: 'desc' },
                    select: {
                        id: true,
                        action: true,
                        performedBy: {
                            select: {
                                id: true,
                                user: { select: { name: true, email: true } },
                            },
                        },
                        timestamp: true,
                        notes: true,
                    },
                }),
            ]);

            const response = {
                values: logs.map(log => ({
                    id: log.id,
                    action: log.action,
                    performedBy: {
                        id: log.performedBy.id,
                        name: log.performedBy.user.name,
                        email: log.performedBy.user.email,
                    },
                    timestamp: log.timestamp,
                    notes: log.notes ?? undefined,
                })),
                currentPage: page,
                pageSize,
                totalItems,
                totalPages: Math.ceil(totalItems / pageSize),
            };

            await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
            return response;
        } catch (error: unknown) {
            handlePrismaError(error, 'while retrieving request audit logs', { notFoundMessage: 'Request not found.' });
        }
    }

    public async getExtendedRequestAuditLogs(
        extendedRequestId: number,
        page: number = 1,
        pageSize: number = 10
    ): Promise<Static<typeof GetExtendedRequestAuditLogsResponse>> {
        try {
            const skip = (page - 1) * pageSize;
            const cacheKey = `extended-request:${extendedRequestId}:audit-logs:page:${page}:size:${pageSize}`;

            const cached = await this.cache.getCacheValue(cacheKey);
            if (cached) return JSON.parse(cached);

            const extendedRequest = await this.prisma.extendedRequest.findUnique({
                where: { id: extendedRequestId },
                select: { id: true },
            });

            if (!extendedRequest) {
                throw new ServiceError('Extended request not found.', 404);
            }

            const [totalItems, logs] = await Promise.all([
                this.prisma.extendedRequestAuditLog.count({ where: { extendedRequestId } }),
                this.prisma.extendedRequestAuditLog.findMany({
                    where: { extendedRequestId },
                    skip,
                    take: pageSize,
                    orderBy: { timestamp: 'desc' },
                    select: {
                        id: true,
                        action: true,
                        performedBy: {
                            select: {
                                id: true,
                                user: { select: { name: true, email: true } },
                            },
                        },
                        timestamp: true,
                        notes: true,
                    },
                }),
            ]);

            const response = {
                values: logs.map(log => ({
                    id: log.id,
                    action: log.action,
                    performedBy: {
                        id: log.performedBy.id,
                        name: log.performedBy.user.name,
                        email: log.performedBy.user.email,
                    },
                    timestamp: log.timestamp,
                    notes: log.notes ?? undefined,
                })),
                currentPage: page,
                pageSize,
                totalItems,
                totalPages: Math.ceil(totalItems / pageSize),
            };

            await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
            return response;
        } catch (error: unknown) {
            handlePrismaError(error, 'while retrieving extended request audit logs', { notFoundMessage: 'Extended request not found.' });
        }
    }
}

// Re-export for convenience
export * from "./selects";
export * from "./mappers";
export * from "./types";
