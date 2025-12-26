import { beforeEach, describe, expect, it } from 'bun:test';

import { MockCache } from '@momoi/cache/mock';
import {
  PrismaClientKnownRequestError
} from '@momoi/database/prisma/generated/internal/prismaNamespace';
import { createMockPrisma } from '@momoi/database/test';
import {
  createMockCourse, createMockCourseOffering, createMockInstance, createMockPlatformUser,
  createMockPVETemplate, createMockRequest, resetMockFactoryCounters
} from '@momoi/database/test/mock-factory';

import { RequestService } from '../request';

describe("RequestService", () => {
  let mockPrisma: any;
  let mockCache: MockCache;
  let requestService: RequestService;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
    requestService = new RequestService(mockPrisma, mockCache as any);
  });

  it("creates request as student", async () => {
    const requester = createMockPlatformUser({ id: 10, role: "STUDENT" });
    const course = createMockCourse({ id: 1 });
    const courseOffering = createMockCourseOffering({ id: 1, courseId: course.id, semesterId: 1 });
    const template = createMockPVETemplate({ id: 5, name: "Ubuntu" });
    const createBody = {
      title: "Need VM",
      description: "For lab",
      courseOfferingId: courseOffering.id,
      pveTemplateId: template.id,
      cpus: 2,
      memoryMB: 2048,
      diskGB: 30,
    };

    mockPrisma.request.create.mockResolvedValueOnce({
      id: 99,
      title: createBody.title,
      description: createBody.description,
      status: "PENDING",
      reason: null,
      cpus: createBody.cpus,
      memoryMB: createBody.memoryMB,
      diskGB: createBody.diskGB,
      requesterId: requester.id,
      reviewerId: null,
      courseOffering: {
        course: { code: course.code, title: course.title },
        semester: { name: "Fall" },
      },
      pveTemplate: { name: template.name },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await requestService.createRequest(requester.id, createBody as any);

    expect(result.id).toBe(99);
    expect(result.courseOffering?.courseCode).toBe(course.code);
    expect(result.templateName).toBe(template.name);
  });

  it("rejects cancel by non-requester", async () => {
    const requestRecord = createMockRequest({ id: 7, requesterId: 1 });
    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: "CS101", title: "Test", instructors: [{ id: 2 }] },
        semester: { name: "Fall" },
      },
    });

    const instructorUser = { id: 2, role: "INSTRUCTOR" as const };

    await expect(requestService.updateRequestStatus(instructorUser, requestRecord.id, {
      status: "CANCELLED",
      reason: "nope",
    } as any)).rejects.toThrow('Only the requester can cancel this request.');
  });

  it("requester can cancel pending request", async () => {
    const requestRecord = createMockRequest({ id: 9, requesterId: 4 });
    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: "CS101", title: "Test", instructors: [{ id: 2 }] },
        semester: { name: "Fall" },
      },
    });

    mockPrisma.request.update.mockResolvedValueOnce({
      ...requestRecord,
      status: "CANCELLED",
      reviewerId: null,
      courseOffering: {
        course: { code: "CS101", title: "Test" },
        semester: { name: "Fall" },
      },
      pveTemplate: { name: "Ubuntu" },
    });

    mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

    const result = await requestService.updateRequestStatus({ id: 4, role: "STUDENT" }, requestRecord.id, {
      status: "CANCELLED",
      reason: "cancel",
    } as any);

    expect(result.status).toBe("CANCELLED");
    expect(result.reviewerId).toBeUndefined();
  });

  it("instructor cannot act on non-course request", async () => {
    const requestRecord = createMockRequest({ id: 10, requesterId: 3 });
    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: "CS102", title: "Other", instructors: [{ id: 99 }] },
        semester: { name: "Fall" },
      },
    });

    await expect(requestService.updateRequestStatus({ id: 2, role: "INSTRUCTOR" }, requestRecord.id, {
      status: "APPROVED",
      reason: "no",
    } as any)).rejects.toThrow('You are not authorized to act on this request.');
  });

  it("admin can approve any request", async () => {
    const requestRecord = createMockRequest({ id: 11, requesterId: 3 });
    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: "CS103", title: "Admin", instructors: [{ id: 99 }] },
        semester: { name: "Fall" },
      },
    });

    mockPrisma.request.update.mockResolvedValueOnce({
      ...requestRecord,
      status: "APPROVED",
      reviewerId: 1,
      courseOffering: {
        course: { code: "CS103", title: "Admin" },
        semester: { name: "Fall" },
      },
      pveTemplate: { name: "Ubuntu" },
    });

    mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

    const result = await requestService.updateRequestStatus({ id: 1, role: "ADMIN" }, requestRecord.id, {
      status: "APPROVED",
      reason: "ok",
    } as any);

    expect(result.status).toBe("APPROVED");
    expect(result.reviewerId).toBe(1);
  });

  it("allows instructor to approve when teaching course", async () => {
    const requestRecord = createMockRequest({ id: 8, requesterId: 3 });
    const course = createMockCourse({ id: 1 });
    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: course.code, title: course.title, instructors: [{ id: 2 }] },
        semester: { name: "Fall" },
      },
    });

    mockPrisma.request.update.mockResolvedValueOnce({
      ...requestRecord,
      status: "APPROVED",
      reviewerId: 2,
      courseOffering: {
        course: { code: course.code, title: course.title },
        semester: { name: "Fall" },
      },
      pveTemplate: { name: "Ubuntu" },
    });

    mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

    const instructorUser = { id: 2, role: "INSTRUCTOR" as const };

    const result = await requestService.updateRequestStatus(instructorUser, requestRecord.id, {
      status: "APPROVED",
      reason: "ok",
    } as any);

    expect(result.status).toBe("APPROVED");
    expect(mockPrisma.request.update).toHaveBeenCalled();
    expect(mockPrisma.requestAuditLog.create).toHaveBeenCalled();
  });

  it("throws when related resource missing on create", async () => {
    const error = new PrismaClientKnownRequestError("missing", { code: "P2025", clientVersion: "0.0.1" });
    mockPrisma.request.create.mockRejectedValueOnce(error);

    await expect(requestService.createRequest(1, {
      title: "x",
      courseOfferingId: 1,
      pveTemplateId: 1,
      cpus: 1,
      memoryMB: 1,
      diskGB: 1,
    } as any)).rejects.toThrow('Related resource not found for request creation.');
  });

  it("creates extended request when student owns instance", async () => {
    const ownerId = 5;
    const instance = createMockInstance({ id: 22, platformUserId: ownerId });
    mockPrisma.instance.findUnique.mockResolvedValueOnce({ platformUserId: instance.platformUserId });

    mockPrisma.extendedRequest.create.mockResolvedValueOnce({
      id: 30,
      title: "Extend",
      description: "more time",
      status: "PENDING",
      reason: null,
      targetInstanceId: instance.id,
      requesterId: ownerId,
      reviewerId: null,
      targetInstance: {
        id: instance.id,
        courseOffering: {
          course: { code: "CS201", title: "Systems" },
          semester: { name: "Fall" },
        }
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await requestService.createExtendedRequest(ownerId, {
      title: "Extend",
      description: "more time",
      targetInstanceId: instance.id,
    } as any);

    expect(result.id).toBe(30);
    expect(result.targetInstanceId).toBe(instance.id);
  });

  it("rejects extended request when not owner", async () => {
    mockPrisma.instance.findUnique.mockResolvedValueOnce({ platformUserId: 999 });

    await expect(requestService.createExtendedRequest(5, {
      title: "Extend",
      description: "more time",
      targetInstanceId: 22,
    } as any)).rejects.toThrow('Instance not found or not owned by the user.');
  });

  it("instructor can approve extended request for their course", async () => {
    const extendedRequest = {
      id: 41,
      title: "Extend",
      description: "desc",
      status: "PENDING" as const,
      reason: null,
      targetInstanceId: 22,
      requesterId: 3,
      reviewerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
      ...extendedRequest,
      targetInstance: {
        courseOffering: {
          course: { code: "CS202", title: "Algo", instructors: [{ id: 2 }] },
          semester: { name: "Fall" },
        },
      },
    });

    mockPrisma.extendedRequest.update.mockResolvedValueOnce({
      ...extendedRequest,
      status: "APPROVED",
      reviewerId: 2,
      targetInstance: {
        courseOffering: {
          course: { code: "CS202", title: "Algo" },
          semester: { name: "Fall" },
        },
      },
    });

    mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

    const result = await requestService.updateExtendedRequestStatus({ id: 2, role: "INSTRUCTOR" }, extendedRequest.id, {
      status: "APPROVED",
      reason: "ok",
    } as any);

    expect(result.status).toBe("APPROVED");
    expect(result.reviewerId).toBe(2);
  });

  it("requester can cancel extended request", async () => {
    const extendedRequest = {
      id: 42,
      title: "Extend",
      description: "desc",
      status: "PENDING" as const,
      reason: null,
      targetInstanceId: 22,
      requesterId: 7,
      reviewerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
      ...extendedRequest,
      targetInstance: {
        courseOffering: {
          course: { code: "CS203", title: "DB", instructors: [{ id: 2 }] },
          semester: { name: "Fall" },
        },
      },
    });

    mockPrisma.extendedRequest.update.mockResolvedValueOnce({
      ...extendedRequest,
      status: "CANCELLED",
      reviewerId: null,
      targetInstance: {
        courseOffering: {
          course: { code: "CS203", title: "DB" },
          semester: { name: "Fall" },
        },
      },
    });

    mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

    const result = await requestService.updateExtendedRequestStatus({ id: 7, role: "STUDENT" }, extendedRequest.id, {
      status: "CANCELLED",
      reason: "cancel",
    } as any);

    expect(result.status).toBe("CANCELLED");
    expect(result.reviewerId).toBeUndefined();
  });

  it("admin can approve extended request", async () => {
    const extendedRequest = {
      id: 43,
      title: "Extend",
      description: "desc",
      status: "PENDING" as const,
      reason: null,
      targetInstanceId: 22,
      requesterId: 7,
      reviewerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
      ...extendedRequest,
      targetInstance: {
        courseOffering: {
          course: { code: "CS204", title: "ML", instructors: [{ id: 99 }] },
          semester: { name: "Fall" },
        },
      },
    });

    mockPrisma.extendedRequest.update.mockResolvedValueOnce({
      ...extendedRequest,
      status: "APPROVED",
      reviewerId: 1,
      targetInstance: {
        courseOffering: {
          course: { code: "CS204", title: "ML" },
          semester: { name: "Fall" },
        },
      },
    });

    mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

    const result = await requestService.updateExtendedRequestStatus({ id: 1, role: "ADMIN" }, extendedRequest.id, {
      status: "APPROVED",
      reason: "ok",
    } as any);

    expect(result.status).toBe("APPROVED");
    expect(result.reviewerId).toBe(1);
  });
});