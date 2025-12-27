import { Static } from 'elysia';

import {
  PrismaClientKnownRequestError
} from '@momoi/database/prisma/generated/internal/prismaNamespace';
import {
  CreateInstanceRequestBody, CreateInstanceResponse, CreateReverseProxyRequestBody,
  CreateReverseProxyResponse, DeleteInstanceResponse, DeleteReverseProxyResponse,
  GetInstanceAuditLogsResponse, GetInstanceResponse, GetInstancesRequestQuery, GetInstancesResponse,
  GetReverseProxiesResponse, PromoteInstanceResponse
} from '@momoi/model/instance';
import { ServiceError } from '@momoi/utils/error';
import { QueueModule } from '@momoi/queue';

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

export class InstanceService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
    private queue: QueueModule
  ) { }

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
        select: {
          id: true,
          courseOffering: {
            select: {
              course: {
                select: {
                  code: true,
                  title: true,
                }
              },
              semester: {
                select: {
                  name: true,
                }
              }
            },
          },
          status: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      // Clear relevant cache entries
      const cacheKeyPattern = `user:${userId}:instances:*`;
      await this.cache.deleteCacheByPattern(cacheKeyPattern);

      // Queue the VM provisioning job (trigger only, worker queries database)
      await this.queue.provisionInstanceQueue.add(
        'provision',
        {
          instanceId: instance.id,
          userId,
        },
        {
          jobId: `provision-${instance.id}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      console.log(`📋 VM provisioning queued for instance ID: ${instance.id}`);

      return {
        id: instance.id,
        courseOffering: instance.courseOffering ? {
          courseCode: instance.courseOffering.course.code,
          courseTitle: instance.courseOffering.course.title,
          semester: instance.courseOffering.semester.name,
        } : undefined,
        status: instance.status,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      }
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Related resource not found.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while creating the instance.', 500);
    }
  }

  public async getInstancesByUser(userId: number, query: Static<typeof GetInstancesRequestQuery>): Promise<Static<typeof GetInstancesResponse>> {
    try {
      const skip = ((query.page ?? 1) - 1) * (query.pageSize ?? 10);
      const take = query.pageSize ?? 10;

      const cacheKey = `user:${userId}:instances:page:${query.page ?? 1}:size:${query.pageSize ?? 10}:courseId:${query.courseId ?? 'all'}:semesterId:${query.semesterId ?? 'all'}`;

      const cachedData = await this.cache.getCacheValue(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const [totalItems, data] = await Promise.all([
        this.prisma.instance.count({
          where: {
            platformUserId: userId,
            courseOffering: {
              courseId: query.courseId ?? undefined,
              semesterId: query.semesterId ?? undefined,
            },
          },
        }),
        this.prisma.instance.findMany({
          where: {
            platformUserId: userId,
            courseOffering: {
              courseId: query.courseId ?? undefined,
              semesterId: query.semesterId ?? undefined,
            },
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            courseOffering: {
              select: {
                course: {
                  select: {
                    code: true,
                    title: true,
                  }
                },
                semester: {
                  select: {
                    name: true,
                  }
                }
              },
            },
            status: true,
            pveVM: {
              select: {
                hostname: true,
                pveNetworkIP: {
                  select: {
                    ipAddress: true,
                  }
                }
              }
            },
            cpus: true,
            memoryMB: true,
            diskGB: true,
            pveTemplate: {
              select: {
                name: true,
              }
            },
            createdAt: true,
            updatedAt: true,
          }
        })
      ]);

      const response: Static<typeof GetInstancesResponse> = {
        values: data.map(instance => ({
          id: instance.id,
          courseOffering: instance.courseOffering ? {
            courseCode: instance.courseOffering.course.code,
            courseTitle: instance.courseOffering.course.title,
            semester: instance.courseOffering.semester.name,
          } : undefined,
          status: instance.status,
          vmDetails: instance.pveVM ? {
            hostname: instance.pveVM.hostname,
            os: instance.pveTemplate?.name ?? 'Unknown',
            ip: instance.pveVM.pveNetworkIP?.ipAddress ?? 'N/A',
            cpus: instance.cpus,
            memoryMB: instance.memoryMB,
            diskGB: instance.diskGB,
          } : undefined,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        })),
        totalItems,
        totalPages: Math.ceil(totalItems / take),
        currentPage: query.page ?? 1,
        pageSize: take,
      };

      await this.cache.createCacheKey(cacheKey, JSON.stringify(response));

      return response;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Related resource not found.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while retrieving instances for the user.', 500);
    }
  }

  public async getInstancesByInstructor(instructorId: number, query: Static<typeof GetInstancesRequestQuery>): Promise<Static<typeof GetInstancesResponse>> {
    try {
      const skip = ((query.page ?? 1) - 1) * (query.pageSize ?? 10);
      const take = query.pageSize ?? 10;

      const cacheKey = `instructor:${instructorId}:instances:page:${query.page ?? 1}:size:${query.pageSize ?? 10}:courseId:${query.courseId ?? 'all'}:semesterId:${query.semesterId ?? 'all'}`;

      const cachedData = await this.cache.getCacheValue(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const [totalItems, data] = await Promise.all([
        this.prisma.instance.count({
          where: {
            courseOffering: {
              course: {
                instructors: {
                  some: { id: instructorId }
                }
              },
              courseId: query.courseId ?? undefined,
              semesterId: query.semesterId ?? undefined,
            },
          },
        }),
        this.prisma.instance.findMany({
          where: {
            courseOffering: {
              course: {
                instructors: {
                  some: { id: instructorId }
                }
              },
              courseId: query.courseId ?? undefined,
              semesterId: query.semesterId ?? undefined,
            },
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            courseOffering: {
              select: {
                course: {
                  select: {
                    code: true,
                    title: true,
                  }
                },
                semester: {
                  select: {
                    name: true,
                  }
                }
              },
            },
            status: true,
            pveVM: {
              select: {
                hostname: true,
                pveNetworkIP: {
                  select: {
                    ipAddress: true,
                  }
                }
              }
            },
            cpus: true,
            memoryMB: true,
            diskGB: true,
            pveTemplate: {
              select: {
                name: true,
              }
            },
            createdAt: true,
            updatedAt: true,
          }
        })
      ]);

      const response: Static<typeof GetInstancesResponse> = {
        values: data.map(instance => ({
          id: instance.id,
          courseOffering: instance.courseOffering ? {
            courseCode: instance.courseOffering.course.code,
            courseTitle: instance.courseOffering.course.title,
            semester: instance.courseOffering.semester.name,
          } : undefined,
          status: instance.status,
          vmDetails: instance.pveVM ? {
            hostname: instance.pveVM.hostname,
            os: instance.pveTemplate?.name ?? 'Unknown',
            ip: instance.pveVM.pveNetworkIP?.ipAddress ?? 'N/A',
            cpus: instance.cpus,
            memoryMB: instance.memoryMB,
            diskGB: instance.diskGB,
          } : undefined,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        })),
        totalItems,
        totalPages: Math.ceil(totalItems / take),
        currentPage: query.page ?? 1,
        pageSize: take,
      };

      await this.cache.createCacheKey(cacheKey, JSON.stringify(response));

      return response;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Related resource not found.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while retrieving instances for the instructor.', 500);
    }
  }

  public async getInstancesByAdmin(query: Static<typeof GetInstancesRequestQuery>): Promise<Static<typeof GetInstancesResponse>> {
    try {
      const skip = ((query.page ?? 1) - 1) * (query.pageSize ?? 10);
      const take = query.pageSize ?? 10;

      const cacheKey = `instances:page:${query.page ?? 1}:size:${query.pageSize ?? 10}:courseId:${query.courseId ?? 'all'}:semesterId:${query.semesterId ?? 'all'}`;

      const cachedData = await this.cache.getCacheValue(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const [totalItems, data] = await Promise.all([
        this.prisma.instance.count({
          where: {
            courseOffering: {
              courseId: query.courseId ?? undefined,
              semesterId: query.semesterId ?? undefined,
            },
          },
        }),
        this.prisma.instance.findMany({
          where: {
            courseOffering: {
              courseId: query.courseId ?? undefined,
              semesterId: query.semesterId ?? undefined,
            },
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            courseOffering: {
              select: {
                course: {
                  select: {
                    code: true,
                    title: true,
                  }
                },
                semester: {
                  select: {
                    name: true,
                  }
                }
              },
            },
            status: true,
            pveVM: {
              select: {
                hostname: true,
                pveNetworkIP: {
                  select: {
                    ipAddress: true,
                  }
                }
              }
            },
            cpus: true,
            memoryMB: true,
            diskGB: true,
            pveTemplate: {
              select: {
                name: true,
              }
            },
            createdAt: true,
            updatedAt: true,
          }
        })
      ]);

      const response: Static<typeof GetInstancesResponse> = {
        values: data.map(instance => ({
          id: instance.id,
          courseOffering: instance.courseOffering ? {
            courseCode: instance.courseOffering.course.code,
            courseTitle: instance.courseOffering.course.title,
            semester: instance.courseOffering.semester.name,
          } : undefined,
          status: instance.status,
          vmDetails: instance.pveVM ? {
            hostname: instance.pveVM.hostname,
            os: instance.pveTemplate?.name ?? 'Unknown',
            ip: instance.pveVM.pveNetworkIP?.ipAddress ?? 'N/A',
            cpus: instance.cpus,
            memoryMB: instance.memoryMB,
            diskGB: instance.diskGB,
          } : undefined,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
        })),
        totalItems,
        totalPages: Math.ceil(totalItems / take),
        currentPage: query.page ?? 1,
        pageSize: take,
      };

      await this.cache.createCacheKey(cacheKey, JSON.stringify(response));

      return response;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Related resource not found.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while retrieving instances.', 500);
    }
  }

  public async getInstanceById(instanceId: number): Promise<Static<typeof GetInstanceResponse>> {
    try {
      const cacheKey = `instance:${instanceId}`;
      const cachedData = await this.cache.getCacheValue(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const instance = await this.prisma.instance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          courseOffering: {
            select: {
              course: {
                select: {
                  code: true,
                  title: true,
                }
              },
              semester: {
                select: {
                  name: true,
                }
              }
            },
          },
          status: true,
          pveVM: {
            select: {
              hostname: true,
              pveNetworkIP: {
                select: {
                  ipAddress: true,
                }
              }
            }
          },
          cpus: true,
          memoryMB: true,
          diskGB: true,
          pveTemplate: {
            select: {
              name: true,
            }
          },
          instanceReverseProxies: {
            select: {
              id: true,
              targetPort: true,
            }
          },
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!instance) {
        throw new ServiceError('Instance not found.', 404);
      }

      const response: Static<typeof GetInstanceResponse> = {
        id: instance.id,
        courseOffering: instance.courseOffering ? {
          courseCode: instance.courseOffering.course.code,
          courseTitle: instance.courseOffering.course.title,
          semester: instance.courseOffering.semester.name,
        } : undefined,
        status: instance.status,
        vmDetails: instance.pveVM ? {
          hostname: instance.pveVM.hostname,
          os: instance.pveTemplate?.name ?? 'Unknown',
          ip: instance.pveVM.pveNetworkIP?.ipAddress ?? 'N/A',
          cpus: instance.cpus,
          memoryMB: instance.memoryMB,
          diskGB: instance.diskGB,
        } : undefined,
        reverseProxy: instance.instanceReverseProxies.map(proxy => ({
          id: proxy.id,
          targetPort: proxy.targetPort,
        })),
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      };

      await this.cache.createCacheKey(cacheKey, JSON.stringify(response));

      return response;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Instance not found.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while retrieving the instance.', 500);
    }
  }

  public async deleteInstance(instanceId: number): Promise<Static<typeof DeleteInstanceResponse>> {
    try {
      // Get the instance details before deleting
      const instance = await this.prisma.instance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          platformUserId: true,
          status: true,
        },
      });

      if (!instance) {
        throw new ServiceError('Instance not found.', 404);
      }

      // Delete the instance from database
      await this.prisma.instance.delete({
        where: { id: instanceId },
      });

      // Clear relevant cache entries
      const cacheKey = `instance:${instanceId}`;
      await this.cache.deleteCacheByPattern(cacheKey);

      // Queue the VM deprovisioning job
      await this.queue.deprovisionInstanceQueue.add(
        'deprovision',
        {
          instanceId,
          userId: instance.platformUserId,
        },
        {
          jobId: `deprovision-${instanceId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      console.log(`📋 VM deprovisioning queued for instance ID: ${instanceId}`);

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }

      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Instance not found.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while deleting the instance.', 500);
    }
  }

  // Reverse Proxy Management
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
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ServiceError('Reverse proxy for this port already exists on this instance.', 409);
        }
        if (error.code === 'P2025') {
          throw new ServiceError('Instance not found.', 404);
        }
        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError('An unexpected error occurred while creating the reverse proxy.', 500);
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
      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError('An unexpected error occurred while retrieving reverse proxies.', 500);
    }
  }

  public async deleteReverseProxy(instanceId: number, proxyId: number): Promise<Static<typeof DeleteReverseProxyResponse>> {
    try {
      await this.prisma.instanceReverseProxy.delete({
        where: {
          id: proxyId,
          instanceId: instanceId,
        },
      });

      // Clear cache for this instance
      await this.cache.deleteCacheByPattern(`instance:${instanceId}`);

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Reverse proxy not found.', 404);
        }
        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while deleting the reverse proxy.', 500);
    }
  }

  // Instance Promotion
  public async promoteInstance(instanceId: number, performedById: number): Promise<Static<typeof PromoteInstanceResponse>> {
    try {
      const instance = await this.prisma.instance.findUnique({
        where: { id: instanceId },
        select: {
          id: true,
          status: true,
        },
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
      await this.cache.deleteCacheByPattern(`instance:${instanceId}`);

      return {
        id: updatedInstance.id,
        status: updatedInstance.status,
        message: 'Instance successfully promoted.',
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }

      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Instance not found.', 404);
        }
        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while promoting the instance.', 500);
    }
  }

  // Audit Logs
  public async getInstanceAuditLogs(
    instanceId: number,
    page: number = 1,
    pageSize: number = 10
  ): Promise<Static<typeof GetInstanceAuditLogsResponse>> {
    try {
      const skip = (page - 1) * pageSize;

      // Verify instance exists
      const instance = await this.prisma.instance.findUnique({
        where: { id: instanceId },
        select: { id: true },
      });

      if (!instance) {
        throw new ServiceError('Instance not found.', 404);
      }

      const [totalItems, logs] = await Promise.all([
        this.prisma.instanceAuditLog.count({
          where: { instanceId },
        }),
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

      const totalPages = Math.ceil(totalItems / pageSize);

      return {
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
        totalPages,
      };
    } catch (error: unknown) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError('An unexpected error occurred while retrieving audit logs.', 500);
    }
  }
}
