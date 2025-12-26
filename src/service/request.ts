import { Static } from 'elysia';

import {
  PrismaClientKnownRequestError
} from '@momoi/database/prisma/generated/internal/prismaNamespace';
import {
  ApprovalActionStatus, CreateExtendedRequestRequestBody, CreateExtendedRequestResponse,
  CreateRequestRequestBody, CreateRequestResponse, GetExtendedRequestsRequestQuery,
  GetExtendedRequestsResponse, GetRequestsRequestQuery, GetRequestsResponse,
  UpdateExtendedRequestStatusRequestBody, UpdateExtendedRequestStatusResponse,
  UpdateRequestStatusRequestBody, UpdateRequestStatusResponse
} from '@momoi/model/request';

import type { CacheModule } from '@momoi/cache';
import type { Prisma, PrismaClient } from '@momoi/database/prisma/generated/client';

type CurrentUser = { id: number, role: "ADMIN" | "INSTRUCTOR" | "STUDENT" };

const requestSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  reason: true,
  cpus: true,
  memoryMB: true,
  diskGB: true,
  requesterId: true,
  reviewerId: true,
  courseOffering: {
    select: {
      course: { select: { code: true, title: true } },
      semester: { select: { name: true } },
    }
  },
  pveTemplate: { select: { name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RequestSelect;

const extendedRequestSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  reason: true,
  targetInstanceId: true,
  requesterId: true,
  reviewerId: true,
  targetInstance: {
    select: {
      id: true,
      courseOffering: {
        select: {
          course: { select: { code: true, title: true } },
          semester: { select: { name: true } },
        }
      },
    }
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ExtendedRequestSelect;

type RequestSelect = typeof requestSelect;
type ExtendedRequestSelect = typeof extendedRequestSelect;

export class RequestService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
  ) { }

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
        select: requestSelect,
      });

      await this.invalidateRequestCaches(userId);

      return this.mapRequest(request);
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Related resource not found for request creation.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while creating the request.');
    }
  }

  public async getRequests(user: CurrentUser, query: Static<typeof GetRequestsRequestQuery>): Promise<Static<typeof GetRequestsResponse>> {
    const { where, pagination } = this.buildRequestFilter(user, query);

    const [totalItems, items] = await Promise.all([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        select: requestSelect,
      })
    ]);

    return {
      values: items.map(item => this.mapRequest(item)),
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
      throw new Error('Request not found.');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Request has already been processed.');
    }

    const isAdmin = user.role === 'ADMIN';
    const isRequester = request.requesterId === user.id;
    const isInstructorForCourse = request.courseOffering?.course.instructors.some(instr => instr.id === user.id) ?? false;

    if (body.status === 'CANCELLED') {
      if (!isRequester) {
        throw new Error('Only the requester can cancel this request.');
      }
    } else {
      if (!isAdmin && !(user.role === 'INSTRUCTOR' && isInstructorForCourse)) {
        throw new Error('You are not authorized to act on this request.');
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
        select: requestSelect,
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

    await this.invalidateRequestCaches(request.requesterId);

    return this.mapRequest(updated);
  }

  public async createExtendedRequest(userId: number, body: Static<typeof CreateExtendedRequestRequestBody>): Promise<Static<typeof CreateExtendedRequestResponse>> {
    const targetInstance = await this.prisma.instance.findUnique({
      where: { id: body.targetInstanceId },
      select: { platformUserId: true },
    });

    if (!targetInstance || targetInstance.platformUserId !== userId) {
      throw new Error('Instance not found or not owned by the user.');
    }

    try {
      const extendedRequest = await this.prisma.extendedRequest.create({
        data: {
          title: body.title,
          description: body.description,
          targetInstanceId: body.targetInstanceId,
          requesterId: userId,
        },
        select: extendedRequestSelect,
      });

      await this.invalidateRequestCaches(userId);

      return this.mapExtendedRequest(extendedRequest);
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Related resource not found for extended request creation.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('An unexpected error occurred while creating the extended request.');
    }
  }

  public async getExtendedRequests(user: CurrentUser, query: Static<typeof GetExtendedRequestsRequestQuery>): Promise<Static<typeof GetExtendedRequestsResponse>> {
    const { where, pagination } = this.buildExtendedRequestFilter(user, query);

    const [totalItems, items] = await Promise.all([
      this.prisma.extendedRequest.count({ where }),
      this.prisma.extendedRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        select: extendedRequestSelect,
      })
    ]);

    return {
      values: items.map(item => this.mapExtendedRequest(item)),
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
      throw new Error('Extended request not found.');
    }

    if (extendedRequest.status !== 'PENDING') {
      throw new Error('Extended request has already been processed.');
    }

    const isAdmin = user.role === 'ADMIN';
    const isRequester = extendedRequest.requesterId === user.id;
    const isInstructorForCourse = extendedRequest.targetInstance?.courseOffering?.course.instructors.some(instr => instr.id === user.id) ?? false;

    if (body.status === 'CANCELLED') {
      if (!isRequester) {
        throw new Error('Only the requester can cancel this extended request.');
      }
    } else {
      if (!isAdmin && !(user.role === 'INSTRUCTOR' && isInstructorForCourse)) {
        throw new Error('You are not authorized to act on this extended request.');
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
        select: extendedRequestSelect,
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

    await this.invalidateRequestCaches(extendedRequest.requesterId);

    return this.mapExtendedRequest(updated);
  }

  private buildRequestFilter(user: CurrentUser, query: Static<typeof GetRequestsRequestQuery>) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

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

    return {
      where,
      pagination: {
        page,
        take: pageSize,
        skip: (page - 1) * pageSize,
      }
    };
  }

  private buildExtendedRequestFilter(user: CurrentUser, query: Static<typeof GetExtendedRequestsRequestQuery>) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

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

    return {
      where,
      pagination: {
        page,
        take: pageSize,
        skip: (page - 1) * pageSize,
      }
    };
  }

  private mapRequest(request: Prisma.RequestGetPayload<{ select: RequestSelect }>): Static<typeof CreateRequestResponse> {
    return {
      id: request.id,
      title: request.title,
      description: request.description ?? undefined,
      status: request.status,
      reason: request.reason ?? undefined,
      courseOffering: request.courseOffering ? {
        courseCode: request.courseOffering.course.code,
        courseTitle: request.courseOffering.course.title,
        semester: request.courseOffering.semester.name,
      } : undefined,
      specs: {
        cpus: request.cpus,
        memoryMB: request.memoryMB,
        diskGB: request.diskGB,
      },
      templateName: request.pveTemplate?.name,
      requesterId: request.requesterId,
      reviewerId: request.reviewerId ?? undefined,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private mapExtendedRequest(extendedRequest: Prisma.ExtendedRequestGetPayload<{ select: ExtendedRequestSelect }>): Static<typeof CreateExtendedRequestResponse> {
    return {
      id: extendedRequest.id,
      title: extendedRequest.title,
      description: extendedRequest.description ?? undefined,
      status: extendedRequest.status,
      reason: extendedRequest.reason ?? undefined,
      targetInstanceId: extendedRequest.targetInstanceId,
      courseOffering: extendedRequest.targetInstance?.courseOffering ? {
        courseCode: extendedRequest.targetInstance.courseOffering.course.code,
        courseTitle: extendedRequest.targetInstance.courseOffering.course.title,
        semester: extendedRequest.targetInstance.courseOffering.semester.name,
      } : undefined,
      requesterId: extendedRequest.requesterId,
      reviewerId: extendedRequest.reviewerId ?? undefined,
      createdAt: extendedRequest.createdAt,
      updatedAt: extendedRequest.updatedAt,
    };
  }

  private async invalidateRequestCaches(userId: number) {
    const pattern = `user:${userId}:requests:*`;
    await this.cache.deleteCacheByPattern(pattern);
  }
}