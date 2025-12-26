import { Static } from 'elysia';

import {
  PrismaClientKnownRequestError
} from '@momoi/database/prisma/generated/internal/prismaNamespace';
import {
  ApprovalActionStatus, CreateExtendedRequestRequestBody, CreateExtendedRequestResponse,
  CreateRequestRequestBody, CreateRequestResponse, GetExtendedRequestAuditLogsResponse,
  GetExtendedRequestsRequestQuery, GetExtendedRequestsResponse, GetRequestAuditLogsResponse,
  GetRequestsRequestQuery, GetRequestsResponse, UpdateExtendedRequestStatusRequestBody,
  UpdateExtendedRequestStatusResponse, UpdateRequestStatusRequestBody, UpdateRequestStatusResponse
} from '@momoi/model/request';
import { ServiceError } from '@momoi/utils/error';

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
  nextSemester: {
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
    }
  },
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
          throw new ServiceError('Related resource not found for request creation.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while creating the request.', 500);
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

    if (updated.status === ApprovalActionStatus.APPROVED) {
      // TODO: Trigger instance provisioning workflow
    }

    await this.invalidateRequestCaches(request.requesterId);

    return this.mapRequest(updated);
  }

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
      where: {
        startDate: { gte: currentSemesterEndDate },
      },
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
        select: extendedRequestSelect,
      });

      await this.invalidateRequestCaches(userId);

      return this.mapExtendedRequest(extendedRequest);
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ServiceError('Related resource not found for extended request creation.', 404);
        }

        throw new ServiceError(`Database error: ${error.message}`, 500);
      }

      throw new ServiceError('An unexpected error occurred while creating the extended request.', 500);
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

    if (updated.status === ApprovalActionStatus.APPROVED) {
      // TODO: Apply semester into the target instance
    }

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
      nextSemester: extendedRequest.nextSemester ? {
        id: extendedRequest.nextSemester.id,
        name: extendedRequest.nextSemester.name,
        startDate: extendedRequest.nextSemester.startDate,
        endDate: extendedRequest.nextSemester.endDate,
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

  // Audit Logs
  public async getRequestAuditLogs(
    requestId: number,
    page: number = 1,
    pageSize: number = 10
  ): Promise<Static<typeof GetRequestAuditLogsResponse>> {
    try {
      const skip = (page - 1) * pageSize;

      // Verify request exists
      const request = await this.prisma.request.findUnique({
        where: { id: requestId },
        select: { id: true },
      });

      if (!request) {
        throw new ServiceError('Request not found.', 404);
      }

      const [totalItems, logs] = await Promise.all([
        this.prisma.requestAuditLog.count({
          where: { requestId },
        }),
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

      throw new ServiceError('An unexpected error occurred while retrieving request audit logs.', 500);
    }
  }

  public async getExtendedRequestAuditLogs(
    extendedRequestId: number,
    page: number = 1,
    pageSize: number = 10
  ): Promise<Static<typeof GetExtendedRequestAuditLogsResponse>> {
    try {
      const skip = (page - 1) * pageSize;

      // Verify extended request exists
      const extendedRequest = await this.prisma.extendedRequest.findUnique({
        where: { id: extendedRequestId },
        select: { id: true },
      });

      if (!extendedRequest) {
        throw new ServiceError('Extended request not found.', 404);
      }

      const [totalItems, logs] = await Promise.all([
        this.prisma.extendedRequestAuditLog.count({
          where: { extendedRequestId },
        }),
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

      throw new ServiceError('An unexpected error occurred while retrieving extended request audit logs.', 500);
    }
  }
}