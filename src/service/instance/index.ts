import { Static } from "elysia";

import {
    CreateInstanceRequestBody, CreateInstanceResponse, CreateReverseProxyRequestBody,
    CreateReverseProxyResponse, DeleteInstanceResponse, DeleteReverseProxyResponse,
    GetInstanceAuditLogsResponse, GetInstanceResponse, GetInstancesRequestQuery,
    GetInstancesResponse, GetReverseProxiesResponse, PromoteInstanceResponse,
    ReprovisionInstanceResponse
} from "@momoi/model/instance";
import { QueueModule } from "@momoi/queue";
import {
    recordInstanceOperation,
    recordQueueJobEnqueued,
} from "../../telemetry/runtime";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

import { mapInstanceCreateToResponse, mapInstanceToDetail, mapInstancesToResponse } from "./mappers";
import { INSTANCE_CREATE_SELECT, INSTANCE_DETAIL_SELECT, INSTANCE_LIST_SELECT } from "./selects";
import { buildInstanceListCacheKey, InstanceFilter, parsePagination } from "./types";

export class InstanceService {
    constructor(
        private prisma: PrismaClient,
        private cache: CacheModule,
        private queue: QueueModule
    ) { }

    // ==================== Instance Creation ====================

    public async createInstanceByInstructor(userId: number, body: Static<typeof CreateInstanceRequestBody>): Promise<Static<typeof CreateInstanceResponse>> {
        try {
            const instance = await this.prisma.instance.create({
                data: {
                    pveTemplateId: body.pveTemplateId,
                    courseOfferingId: body.courseOfferingId,
                    cpus: body.cpus,
                    memoryMB: body.memoryMB,
                    diskGB: body.diskGB,
                    platformUserId: userId,
                },
                select: INSTANCE_CREATE_SELECT,
            });

            // Queue the VM provisioning job
            await this.queue.provisionInstanceQueue.add(
                'provision',
                { instanceId: instance.id, userId },
                { jobId: `provision-${instance.id}`, removeOnComplete: true, removeOnFail: false }
            );
            recordQueueJobEnqueued("provision-instance", "provision", {
                "app.operation": "create_instance",
            });
            recordInstanceOperation("create", {
                "user.role": "INSTRUCTOR",
            });

            console.info('📋 VM provisioning queued', { instanceId: instance.id });

            return mapInstanceCreateToResponse(instance);
        } catch (error: unknown) {
            handlePrismaError(error, 'while creating the instance', { notFoundMessage: 'Related resource not found.' });
        }
    }

    // ==================== Instance Queries (Consolidated) ====================

    /**
     * Unified method to get instances with different filter strategies.
     * Replaces getInstancesByUser, getInstancesByInstructor, getInstancesByAdmin
     */
    private async getInstances(
        filter: InstanceFilter,
        query: Static<typeof GetInstancesRequestQuery>
    ): Promise<Static<typeof GetInstancesResponse>> {
        try {
            const { page, pageSize, skip, take } = parsePagination(query);

            // Build where clause based on filter type
            const whereClause = this.buildInstanceWhereClause(filter, query);

            // Execute query
            const [totalItems, data] = await Promise.all([
                this.prisma.instance.count({ where: whereClause }),
                this.prisma.instance.findMany({
                    where: whereClause,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    select: INSTANCE_LIST_SELECT,
                })
            ]);

            const response = mapInstancesToResponse(data, totalItems, page, pageSize);

            return response;
        } catch (error: unknown) {
            const context = filter.type === 'user'
                ? 'while retrieving instances for the user'
                : filter.type === 'instructor'
                    ? 'while retrieving instances for the instructor'
                    : 'while retrieving instances';
            handlePrismaError(error, context, { notFoundMessage: 'Related resource not found.' });
        }
    }

    /**
     * Builds Prisma where clause based on filter type
     */
    private buildInstanceWhereClause(
        filter: InstanceFilter,
        query: Static<typeof GetInstancesRequestQuery>
    ) {
        const courseFilter = {
            courseId: query.courseId ?? undefined,
            semesterId: query.semesterId ?? undefined,
        };

        // Base filter to exclude deleted instances
        const baseFilter = {
            status: { not: 'DELETED' as const },
        };

        switch (filter.type) {
            case 'user':
                return {
                    ...baseFilter,
                    platformUserId: filter.userId,
                    courseOffering: courseFilter,
                };
            case 'instructor':
                return {
                    ...baseFilter,
                    courseOffering: {
                        course: {
                            instructors: {
                                some: { id: filter.instructorId }
                            }
                        },
                        ...courseFilter,
                    },
                };
            case 'admin':
                return {
                    ...baseFilter,
                    courseOffering: courseFilter,
                };
        }
    }

    // Public wrapper methods for backward compatibility
    public async getInstancesByUser(userId: number, query: Static<typeof GetInstancesRequestQuery>): Promise<Static<typeof GetInstancesResponse>> {
        return this.getInstances({ type: 'user', userId }, query);
    }

    public async getInstancesByInstructor(instructorId: number, query: Static<typeof GetInstancesRequestQuery>): Promise<Static<typeof GetInstancesResponse>> {
        return this.getInstances({ type: 'instructor', instructorId }, query);
    }

    public async getInstancesByAdmin(query: Static<typeof GetInstancesRequestQuery>): Promise<Static<typeof GetInstancesResponse>> {
        return this.getInstances({ type: 'admin' }, query);
    }

    // ==================== Single Instance Operations ====================

    public async getInstanceById(instanceId: number): Promise<Static<typeof GetInstanceResponse>> {
        const cacheKey = `instance:${instanceId}`;

        // Cache should be best-effort; fall back to DB if cache read/parse fails.
        try {
            const cachedData = await this.cache.getCacheValue(cacheKey);
            if (cachedData) {
                try {
                    return JSON.parse(cachedData);
                } catch (cacheParseError: unknown) {
                    console.warn('Failed to parse cached instance data. Invalidating cache key.', { instanceId, cacheParseError });
                    await this.cache.deleteCacheByPattern(cacheKey);
                }
            }
        } catch (cacheReadError: unknown) {
            console.warn('Failed to read instance from cache. Falling back to database.', { instanceId, cacheReadError });
        }

        try {
            const instance = await this.prisma.instance.findUnique({
                where: { id: instanceId },
                select: INSTANCE_DETAIL_SELECT,
            });

            if (!instance) {
                throw new ServiceError('Instance not found.', 404);
            }

            const response = mapInstanceToDetail(instance);

            // Cache write failures should not fail the request.
            try {
                await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
            } catch (cacheWriteError: unknown) {
                console.warn('Failed to cache instance response.', { instanceId, cacheWriteError });
            }

            return response;
        } catch (error: unknown) {
            console.error('Failed to retrieve instance by id.', { instanceId, err: error });
            handlePrismaError(error, 'while retrieving the instance', { notFoundMessage: 'Instance not found.' });
        }
    }

    public async deleteInstance(instanceId: number): Promise<Static<typeof DeleteInstanceResponse>> {
        try {
            // Get the instance details before deleting
            const instance = await this.prisma.instance.findUnique({
                where: { id: instanceId },
                select: { id: true, platformUserId: true, status: true, pveVMId: true },
            });

            if (!instance) {
                throw new ServiceError('Instance not found.', 404);
            }

            // If instance has a VM assigned, queue deprovisioning (don't delete yet)
            if (instance.pveVMId) {
                // Mark instance as pending deletion
                await this.prisma.instance.update({
                    where: { id: instanceId },
                    data: { status: 'DELETED', provisionStatus: 'QUEUED' },
                });

                // Queue the VM deprovisioning job (worker will handle final cleanup)
                await this.queue.deprovisionInstanceQueue.add(
                    'deprovision',
                    { instanceId, userId: instance.platformUserId },
                    { jobId: `deprovision-${instanceId}`, removeOnComplete: true, removeOnFail: false }
                );
                recordQueueJobEnqueued("deprovision-instance", "deprovision", {
                    "app.operation": "delete_instance",
                });
                recordInstanceOperation("delete_queued", {
                    "instance.has_vm": true,
                });

                console.info('📋 VM deprovisioning queued', { instanceId });
            } else {
                // No VM assigned, safe to delete immediately
                await this.prisma.instance.delete({ where: { id: instanceId } });
                recordInstanceOperation("delete_completed", {
                    "instance.has_vm": false,
                });
                console.info('🗑️ Instance deleted (no VM)', { instanceId });
            }

            // Clear relevant cache entries
            await this.cache.deleteCacheByPattern(`instance:${instanceId}`);

            return { success: true };
        } catch (error: unknown) {
            handlePrismaError(error, 'while deleting the instance', { notFoundMessage: 'Instance not found.' });
        }
    }

    // ==================== Reverse Proxy Management ====================

    public async createReverseProxy(
        instanceId: number,
        body: Static<typeof CreateReverseProxyRequestBody>
    ): Promise<Static<typeof CreateReverseProxyResponse>> {
        try {
            // Verify instance exists
            const instance = await this.prisma.instance.findUnique({
                where: { id: instanceId },
                select: { id: true },
            });

            if (!instance) {
                throw new ServiceError('Instance not found.', 404);
            }

            const reverseProxy = await this.prisma.instanceReverseProxy.create({
                data: {
                    instanceId,
                    targetPort: body.targetPort,
                    type: body.type,
                    description: body.description,
                },
                select: {
                    id: true,
                    targetPort: true,
                    type: true,
                    description: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            // Clear cache for this instance
            await this.cache.deleteCacheByPattern(`instance:${instanceId}`);

            return {
                id: reverseProxy.id,
                targetPort: reverseProxy.targetPort,
                type: reverseProxy.type,
                description: reverseProxy.description ?? undefined,
                createdAt: reverseProxy.createdAt,
                updatedAt: reverseProxy.updatedAt,
            };
        } catch (error: unknown) {
            handlePrismaError(error, 'while creating the reverse proxy', { notFoundMessage: 'Instance not found.', duplicateMessage: 'Reverse proxy for this port already exists on this instance.' });
        }
    }

    public async getReverseProxies(instanceId: number): Promise<Static<typeof GetReverseProxiesResponse>> {
        try {
            const instance = await this.prisma.instance.findUnique({
                where: { id: instanceId },
                select: {
                    instanceReverseProxies: {
                        select: {
                            id: true,
                            targetPort: true,
                            type: true,
                            description: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });

            if (!instance) {
                throw new ServiceError('Instance not found.', 404);
            }

            return instance.instanceReverseProxies.map(proxy => ({
                id: proxy.id,
                targetPort: proxy.targetPort,
                type: proxy.type,
                description: proxy.description ?? undefined,
                createdAt: proxy.createdAt,
                updatedAt: proxy.updatedAt,
            }));
        } catch (error: unknown) {
            handlePrismaError(error, 'while retrieving reverse proxies', { notFoundMessage: 'Instance not found.' });
        }
    }

    public async deleteReverseProxy(instanceId: number, proxyId: number): Promise<Static<typeof DeleteReverseProxyResponse>> {
        try {
            await this.prisma.instanceReverseProxy.delete({
                where: { id: proxyId, instanceId },
            });

            // Clear cache for this instance
            await this.cache.deleteCacheByPattern(`instance:${instanceId}`);

            return { success: true };
        } catch (error: unknown) {
            handlePrismaError(error, 'while deleting the reverse proxy', { notFoundMessage: 'Reverse proxy not found.' });
        }
    }

    // ==================== Instance Promotion ====================

    public async promoteInstance(instanceId: number, performedById: number): Promise<Static<typeof PromoteInstanceResponse>> {
        try {
            const instance = await this.prisma.instance.findUnique({
                where: { id: instanceId },
                select: { id: true, status: true },
            });

            if (!instance) {
                throw new ServiceError('Instance not found.', 404);
            }

            if (instance.status === 'PROMOTED') {
                throw new ServiceError('Instance is already promoted.', 400);
            }

            if (instance.status !== 'ACTIVE') {
                throw new ServiceError('Only ACTIVE instances can be promoted.', 400);
            }

            const updatedInstance = await this.prisma.instance.update({
                where: { id: instanceId },
                data: { status: 'PROMOTED' },
                select: { id: true, status: true },
            });
            recordInstanceOperation("promote", {
                "user.role": "ADMIN",
            });

            // Create audit log entry
            await this.prisma.instanceAuditLog.create({
                data: {
                    instanceId,
                    action: 'PROMOTED',
                    performedById,
                    notes: 'Instance promoted to long-term/production status',
                },
            });

            // Clear cache for this instance
            await Promise.all([
                this.cache.deleteCacheByPattern(`instance:${instanceId}`),
                this.cache.deleteCacheByPattern(`instance:${instanceId}:audit-logs:*`),
            ]);

            return {
                id: updatedInstance.id,
                status: updatedInstance.status,
                message: 'Instance successfully promoted.',
            };
        } catch (error: unknown) {
            handlePrismaError(error, 'while promoting the instance', { notFoundMessage: 'Instance not found.' });
        }
    }

    // ==================== Re-provision ====================

    public async reprovisionInstance(
        instanceId: number,
        performedById: number,
        userRole: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT'
    ): Promise<Static<typeof ReprovisionInstanceResponse>> {
        try {
            // Get the instance
            const instance = await this.prisma.instance.findUnique({
                where: { id: instanceId },
                select: {
                    id: true,
                    provisionStatus: true,
                    platformUserId: true,
                    status: true,
                },
            });

            if (!instance) {
                throw new ServiceError('Instance not found.', 404);
            }

            // Check ownership: students can only re-provision their own instances
            if (userRole === 'STUDENT' && instance.platformUserId !== performedById) {
                throw new ServiceError('You can only re-provision your own instances.', 403);
            }

            // Check if provisioning failed
            if (instance.provisionStatus !== 'FAILED') {
                throw new ServiceError('Only failed instances can be re-provisioned.', 400);
            }

            // Reset provision status and clear error
            const updatedInstance = await this.prisma.instance.update({
                where: { id: instanceId },
                data: {
                    provisionStatus: 'QUEUED',
                    provisionError: null,
                },
                select: {
                    id: true,
                    provisionStatus: true,
                },
            });

            // Create audit log entry
            await this.prisma.instanceAuditLog.create({
                data: {
                    instanceId,
                    action: 'RE_PROVISIONED',
                    performedById,
                    notes: 'Instance queued for re-provisioning after failure',
                },
            });

            // Clear cache for this instance and audit logs
            await Promise.all([
                this.cache.deleteCacheByPattern(`instance:${instanceId}`),
                this.cache.deleteCacheByPattern(`instance:${instanceId}:audit-logs:*`),
            ]);

            // Queue the VM provisioning job
            await this.queue.provisionInstanceQueue.add(
                'provision',
                { instanceId, userId: instance.platformUserId },
                { jobId: `reprovision-${instanceId}`, removeOnComplete: true, removeOnFail: false }
            );
            recordQueueJobEnqueued("provision-instance", "reprovision", {
                "app.operation": "reprovision_instance",
            });
            recordInstanceOperation("reprovision", {
                "user.role": userRole,
            });

            console.info('📋 VM re-provisioning queued', { instanceId });

            return {
                id: updatedInstance.id,
                provisionStatus: updatedInstance.provisionStatus,
                message: 'Instance successfully queued for re-provisioning.',
            };
        } catch (error: unknown) {
            handlePrismaError(error, 'while re-provisioning the instance', { notFoundMessage: 'Instance not found.' });
        }
    }

    // ==================== Audit Logs ====================

    public async getInstanceAuditLogs(
        instanceId: number,
        page: number = 1,
        pageSize: number = 10
    ): Promise<Static<typeof GetInstanceAuditLogsResponse>> {
        try {
            const skip = (page - 1) * pageSize;
            const cacheKey = `instance:${instanceId}:audit-logs:page:${page}:size:${pageSize}`;

            const cached = await this.cache.getCacheValue(cacheKey);
            if (cached) return JSON.parse(cached);

            // Verify instance exists
            const instance = await this.prisma.instance.findUnique({
                where: { id: instanceId },
                select: { id: true },
            });

            if (!instance) {
                throw new ServiceError('Instance not found.', 404);
            }

            const [totalItems, logs] = await Promise.all([
                this.prisma.instanceAuditLog.count({ where: { instanceId } }),
                this.prisma.instanceAuditLog.findMany({
                    where: { instanceId },
                    skip,
                    take: pageSize,
                    orderBy: { timestamp: 'desc' },
                    select: {
                        id: true,
                        action: true,
                        performedBy: {
                            select: {
                                id: true,
                                user: {
                                    select: {
                                        name: true,
                                        email: true,
                                    },
                                },
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
            handlePrismaError(error, 'while retrieving audit logs', { notFoundMessage: 'Instance not found.' });
        }
    }
}

// Re-export for convenience
export * from "./selects";
export * from "./mappers";
export * from "./types";
