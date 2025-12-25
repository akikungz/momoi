import { Static } from 'elysia';

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

import { PrismaClientKnownRequestError } from '@momoi/database/prisma/generated/internal/prismaNamespace';

import {
  CreateInstanceRequestBody,
  CreateInstanceResponse,
  DeleteInstanceResponse,
  GetInstanceResponse,
  GetInstancesRequestQuery,
  GetInstancesResponse,
} from "@momoi/model/instance";

export class InstanceService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
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
          throw new Error('Related resource not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while creating the instance.');
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
          throw new Error('Related resource not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while retrieving instances for the user.');
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
          throw new Error('Related resource not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while retrieving instances for the instructor.');
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
          throw new Error('Related resource not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while retrieving instances.');
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
        throw new Error('Instance not found.');
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
          throw new Error('Instance not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while retrieving the instance.');
    }
  }

  public async deleteInstance(instanceId: number): Promise<Static<typeof DeleteInstanceResponse>> {
    try {
      await this.prisma.instance.delete({
        where: { id: instanceId },
      });

      // Clear relevant cache entries
      const cacheKey = `instance:${instanceId}`;
      await this.cache.deleteCacheByPattern(cacheKey);

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Instance not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while deleting the instance.');
    }
  }
}
