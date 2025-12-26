import { beforeEach, describe, expect, it } from 'bun:test';

import { treaty } from '@elysiajs/eden';
import { mockAdminAuth, mockInstructorAuth, mockStudentAuth } from '@momoi/auth/mock';
import { MockCache } from '@momoi/cache/mock';
import { createMockPrisma } from '@momoi/database/test';
import {
  createMockCourse,
  createMockCourseOffering,
  createMockInstance,
  createMockPlatformUser,
  createMockRequest,
  createMockPVETemplate,
  resetMockFactoryCounters
} from '@momoi/database/test/mock-factory';

import { requestRoute } from '../request';

describe("Request Route", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  it("student can create request", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockStudentAuth));

    const course = createMockCourse({ id: 1 });
    const courseOffering = createMockCourseOffering({ id: 1, courseId: course.id, semesterId: 1 });
    const template = createMockPVETemplate({ id: 2, name: "Ubuntu" });
    const created = createMockRequest({
      id: 10,
      requesterId: 3,
      courseOfferingId: courseOffering.id,
      pveTemplateId: template.id,
    });

    mockPrisma.request.create.mockResolvedValueOnce({
      ...created,
      courseOffering: {
        course: { code: course.code, title: course.title },
        semester: { name: "Fall" },
      },
      pveTemplate: { name: template.name },
    });

    const response = await client.requests.post({
      title: created.title,
      description: created.description ?? undefined,
      courseOfferingId: created.courseOfferingId,
      pveTemplateId: created.pveTemplateId,
      cpus: created.cpus,
      memoryMB: created.memoryMB,
      diskGB: created.diskGB,
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.id).toBe(created.id);
    expect(response.data!.courseOffering?.courseCode).toBe(course.code);
  });

  it("instructor can approve request for their course", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    const course = createMockCourse({ id: 1 });
    const requestRecord = createMockRequest({ id: 11, requesterId: 3, courseOfferingId: 1 });

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

    const response = await client.requests({ requestId: requestRecord.id }).status.patch({
      status: "APPROVED",
      reason: "ok",
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.status).toBe("APPROVED");
  });

  it("student cannot create extended request for others instance", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockStudentAuth));

    // Instance is owned by someone else
    mockPrisma.instance.findUnique.mockResolvedValueOnce({ platformUserId: 999 });

    const response = await client['extended-requests'].post({
      title: "Extend",
      description: "more time",
      targetInstanceId: 123,
    });

    expect(response.status).toBe(500);
  });

  it("requester can cancel their request", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockStudentAuth));

    const course = createMockCourse({ id: 1 });
    const requestRecord = createMockRequest({ id: 12, requesterId: 3, courseOfferingId: 1 });

    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: course.code, title: course.title, instructors: [{ id: 2 }] },
        semester: { name: "Fall" },
      },
    });

    mockPrisma.request.update.mockResolvedValueOnce({
      ...requestRecord,
      status: "CANCELLED",
      reviewerId: null,
      courseOffering: {
        course: { code: course.code, title: course.title },
        semester: { name: "Fall" },
      },
      pveTemplate: { name: "Ubuntu" },
    });

    mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

    const response = await client.requests({ requestId: requestRecord.id }).status.patch({
      status: "CANCELLED",
      reason: "cancel",
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.status).toBe("CANCELLED");
  });

  it("instructor cannot act on unrelated course request", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    const requestRecord = createMockRequest({ id: 13, requesterId: 3, courseOfferingId: 1 });
    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: "CS999", title: "Other", instructors: [{ id: 99 }] },
        semester: { name: "Fall" },
      },
    });

    const response = await client.requests({ requestId: requestRecord.id }).status.patch({
      status: "APPROVED",
      reason: "no",
    });

    expect(response.status).toBe(500);
  });

  it("admin can approve any request", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const course = createMockCourse({ id: 1 });
    const requestRecord = createMockRequest({ id: 14, requesterId: 5, courseOfferingId: 1 });

    mockPrisma.request.findUnique.mockResolvedValueOnce({
      ...requestRecord,
      courseOffering: {
        course: { code: course.code, title: course.title, instructors: [{ id: 99 }] },
        semester: { name: "Fall" },
      },
    });

    mockPrisma.request.update.mockResolvedValueOnce({
      ...requestRecord,
      status: "APPROVED",
      reviewerId: 1,
      courseOffering: {
        course: { code: course.code, title: course.title },
        semester: { name: "Fall" },
      },
      pveTemplate: { name: "Ubuntu" },
    });

    mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

    const response = await client.requests({ requestId: requestRecord.id }).status.patch({
      status: "APPROVED",
      reason: "ok",
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.reviewerId).toBe(1);
  });

  it("student can create extended request for own instance", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockStudentAuth));

    const instance = createMockInstance({ id: 50, platformUserId: 3 });
    mockPrisma.instance.findUnique.mockResolvedValueOnce({ platformUserId: instance.platformUserId });

    mockPrisma.extendedRequest.create.mockResolvedValueOnce({
      id: 60,
      title: "Extend",
      description: "need more time",
      status: "PENDING",
      reason: null,
      targetInstanceId: instance.id,
      requesterId: 3,
      reviewerId: null,
      targetInstance: {
        id: instance.id,
        courseOffering: {
          course: { code: "CS301", title: "Net" },
          semester: { name: "Fall" },
        }
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await client['extended-requests'].post({
      title: "Extend",
      description: "need more time",
      targetInstanceId: instance.id,
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.targetInstanceId).toBe(instance.id);
  });

  it("instructor can approve extended request for their course", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    const extendedRequest = createMockRequest({ id: 70, requesterId: 3 });

    mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
      id: extendedRequest.id,
      title: "Extend",
      description: "desc",
      status: "PENDING",
      reason: null,
      targetInstanceId: 80,
      requesterId: extendedRequest.requesterId,
      reviewerId: null,
      targetInstance: {
        courseOffering: {
          course: { code: "CS302", title: "OS", instructors: [{ id: 2 }] },
          semester: { name: "Fall" },
        }
      }
    });

    mockPrisma.extendedRequest.update.mockResolvedValueOnce({
      id: extendedRequest.id,
      title: "Extend",
      description: "desc",
      status: "APPROVED",
      reason: "ok",
      targetInstanceId: 80,
      requesterId: extendedRequest.requesterId,
      reviewerId: 2,
      targetInstance: {
        courseOffering: {
          course: { code: "CS302", title: "OS" },
          semester: { name: "Fall" },
        }
      }
    });

    mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

    const response = await client['extended-requests']({ extendedRequestId: extendedRequest.id }).status.patch({
      status: "APPROVED",
      reason: "ok",
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.status).toBe("APPROVED");
  });

  it("requester can cancel extended request", async () => {
    const client = treaty(requestRoute(mockPrisma, mockCache as any, mockStudentAuth));

    mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
      id: 81,
      title: "Extend",
      description: "desc",
      status: "PENDING",
      reason: null,
      targetInstanceId: 80,
      requesterId: 3,
      reviewerId: null,
      targetInstance: {
        courseOffering: {
          course: { code: "CS303", title: "AI", instructors: [{ id: 2 }] },
          semester: { name: "Fall" },
        }
      }
    });

    mockPrisma.extendedRequest.update.mockResolvedValueOnce({
      id: 81,
      title: "Extend",
      description: "desc",
      status: "CANCELLED",
      reason: "cancel",
      targetInstanceId: 80,
      requesterId: 3,
      reviewerId: null,
      targetInstance: {
        courseOffering: {
          course: { code: "CS303", title: "AI" },
          semester: { name: "Fall" },
        }
      }
    });

    mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

    const response = await client['extended-requests']({ extendedRequestId: 81 }).status.patch({
      status: "CANCELLED",
      reason: "cancel",
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.status).toBe("CANCELLED");
  });
});