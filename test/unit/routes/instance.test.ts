import { beforeEach, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { mockAdminAuth, mockInstructorAuth, mockStudentAuth } from "@momoi/auth/mock";
import { MockCache } from "@momoi/cache/mock";
import { createMockPrisma } from "@test/mocks";
import {
  createMockCourse, createMockCourseOffering, createMockInstance, createMockPVETemplate,
  createMockPVEVM, createMockSemester, resetMockFactoryCounters
} from "@test/mocks";
import { MockQueueModule } from "@momoi/queue/mock";

import { instanceRoute } from "@momoi/routes/instance";

describe("Instance Route - Admin", () => {
  let mockPrisma: any;
  let mockCache: MockCache;
  let mockQueue: MockQueueModule;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
    mockQueue = new MockQueueModule();
    if (mockQueue.provisionInstanceQueue.add.mockReset) mockQueue.provisionInstanceQueue.add.mockReset();
    if (mockQueue.deprovisionInstanceQueue.add.mockReset) mockQueue.deprovisionInstanceQueue.add.mockReset();
  });

  it("should create a new instance as instructor", async () => {
    mockQueue.provisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'provision', data: {} });
    mockQueue.deprovisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'deprovision', data: {} });
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockInstructorAuth, mockQueue as any));

    const mockInstanceData = createMockInstance({
      platformUserId: 1,
      pveTemplateId: 1,
      courseOfferingId: 1,
    });

    const mockCourse = createMockCourse({ id: 1 });
    const mockSemester = createMockSemester({ id: 1 });
    const mockCourseOffering = createMockCourseOffering({
      id: 1,
      courseId: 1,
      semesterId: 1,
    });

    mockPrisma.instance.create.mockResolvedValueOnce({
      ...mockInstanceData,
      courseOffering: {
        course: {
          code: mockCourse.code,
          title: mockCourse.title,
        },
        semester: {
          name: mockSemester.name,
        },
      },
    });

    const response = await client.instances.post({
      pveTemplateId: 1,
      courseOfferingId: 1,
      cpus: 2,
      memoryMB: 4096,
      diskGB: 50,
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("status");
    expect(response.data).toHaveProperty("createdAt");
    expect(response.data).toHaveProperty("updatedAt");
    expect(response.data).toHaveProperty("courseOffering");
  });

  it("should reject student from creating instance", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    const response = await client.instances.post({
      pveTemplateId: 1,
      courseOfferingId: 1,
      cpus: 2,
      memoryMB: 4096,
      diskGB: 50,
    });

    expect(response.status).toBe(403);
  });

  it("should get instances for user", async () => {
    mockQueue.provisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'provision', data: {} });
    mockQueue.deprovisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'deprovision', data: {} });
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    const mockCourse = createMockCourse({ id: 1 });
    const mockSemester = createMockSemester({ id: 1 });
    const mockTemplate = createMockPVETemplate({ id: 1 });
    const mockVM = createMockPVEVM({ id: 1000 });

    const mockInstances = [
      {
        id: 1,
        courseOffering: {
          course: {
            code: mockCourse.code,
            title: mockCourse.title,
          },
          semester: {
            name: mockSemester.name,
          },
        },
        status: "ACTIVE",
        provisionStatus: "COMPLETED",
        pveVM: {
          hostname: mockVM.hostname,
          status: "RUNNING",
          pveNetworkIP: {
            ipAddress: "192.168.1.100",
          },
        },
        cpus: 2,
        memoryMB: 4096,
        diskGB: 50,
        pveTemplate: {
          name: mockTemplate.name,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockPrisma.instance.count.mockResolvedValueOnce(1);
    mockPrisma.instance.findMany.mockResolvedValueOnce(mockInstances);

    const response = await client.instances.get({
      query: {
        page: 1,
        pageSize: 10,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("values");
    expect(response.data).toHaveProperty("totalItems");
    expect(response.data).toHaveProperty("totalPages");
    expect(response.data).toHaveProperty("currentPage");
    expect(response.data).toHaveProperty("pageSize");
    expect(response.data!.values).toHaveLength(1);
    expect(response.data!.totalItems).toBe(1);
  });

  it("should get instances with pagination", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.instance.count.mockResolvedValueOnce(25);
    mockPrisma.instance.findMany.mockResolvedValueOnce([]);

    const response = await client.instances.get({
      query: {
        page: 2,
        pageSize: 20,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data!.currentPage).toBe(2);
    expect(response.data!.pageSize).toBe(20);
    expect(response.data!.totalPages).toBe(2);
  });

  it("should filter instances by courseId", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.instance.count.mockResolvedValueOnce(1);
    mockPrisma.instance.findMany.mockResolvedValueOnce([]);

    const response = await client.instances.get({
      query: {
        page: 1,
        pageSize: 10,
        courseId: 5,
      },
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.instance.count).toHaveBeenCalled();
    const countCall = mockPrisma.instance.count.mock.calls[0];
    expect(countCall[0].where.courseOffering.courseId).toBe(5);
  });

  it("should filter instances by semesterId", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.instance.count.mockResolvedValueOnce(1);
    mockPrisma.instance.findMany.mockResolvedValueOnce([]);

    const response = await client.instances.get({
      query: {
        page: 1,
        pageSize: 10,
        semesterId: 3,
      },
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.instance.count).toHaveBeenCalled();
    const countCall = mockPrisma.instance.count.mock.calls[0];
    expect(countCall[0].where.courseOffering.semesterId).toBe(3);
  });

  it("should get instances for specific instructor", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    const mockCourse = createMockCourse({ id: 1 });
    const mockSemester = createMockSemester({ id: 1 });

    const mockInstances = [
      {
        id: 1,
        courseOffering: {
          course: {
            code: mockCourse.code,
            title: mockCourse.title,
          },
          semester: {
            name: mockSemester.name,
          },
        },
        status: "ACTIVE",
        provisionStatus: "COMPLETED",
        pveVM: null,
        cpus: 2,
        memoryMB: 4096,
        diskGB: 50,
        pveTemplate: {
          name: "Ubuntu 22.04",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockPrisma.instance.count.mockResolvedValueOnce(1);
    mockPrisma.instance.findMany.mockResolvedValueOnce(mockInstances);

    const response = await client.instances.instructor.get({
      query: {
        page: 1,
        pageSize: 10,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data!.values).toHaveLength(1);
    expect(mockPrisma.instance.count).toHaveBeenCalled();
  });

  it("should get instance by ID", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    const mockCourse = createMockCourse({ id: 1 });
    const mockSemester = createMockSemester({ id: 1 });
    const mockTemplate = createMockPVETemplate({ id: 1 });

    const mockInstanceData = {
      id: 1,
      courseOffering: {
        course: {
          code: mockCourse.code,
          title: mockCourse.title,
        },
        semester: {
          name: mockSemester.name,
        },
      },
      status: "ACTIVE",
      provisionStatus: "COMPLETED",
      pveVM: {
        hostname: "vm-100.local",
        status: "RUNNING",
        pveNetworkIP: {
          ipAddress: "192.168.1.100",
        },
      },
      cpus: 2,
      memoryMB: 4096,
      diskGB: 50,
      pveTemplate: {
        name: mockTemplate.name,
      },
      instanceReverseProxies: [
        {
          id: 1,
          targetPort: 3000,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.instance.findUnique.mockResolvedValueOnce(mockInstanceData);

    const response = await client.instances({ instanceId: 5 }).get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id", 1);
    expect(response.data).toHaveProperty("status", "ACTIVE");
    expect(response.data).toHaveProperty("reverseProxy");
    expect(response.data!.reverseProxy).toHaveLength(1);
    expect(response.data!.reverseProxy[0]).toHaveProperty("targetPort", 3000);
  });

  it("should return error when instance not found", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.instance.findUnique.mockResolvedValueOnce(null);

    const response = await client.instances({ instanceId: 999 }).get();

    // ServiceError with 404 status is now properly preserved
    expect(response.status).toBe(404);
  });

  it("should delete instance", async () => {
    mockQueue.deprovisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'deprovision', data: {} });
    mockQueue.provisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'provision', data: {} });
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.instance.findUnique.mockResolvedValueOnce({
      id: 1,
      platformUserId: 1,
      status: true,
    });
    mockPrisma.instance.delete.mockResolvedValueOnce({ id: 1 });

    const response = await client.instances({ instanceId: 1 }).delete();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("success", true);
    expect(mockPrisma.instance.delete).toHaveBeenCalled();
  });

  it("should get admin instances", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.instance.count.mockResolvedValueOnce(5);
    mockPrisma.instance.findMany.mockResolvedValueOnce([]);

    const response = await client.instances.admin.get({
      query: {
        page: 1,
        pageSize: 10,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data!.totalItems).toBe(5);
  });

  it("should handle cache for get instances", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.instance.count.mockResolvedValueOnce(1);
    mockPrisma.instance.findMany.mockResolvedValueOnce([]);

    const cacheKey = `user:1:instances:page:1:size:10:courseId:all:semesterId:all`;
    const cachedResponse = JSON.stringify({
      values: [],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
      pageSize: 10,
    });

    (mockCache.getCacheValue as any).mockResolvedValueOnce(cachedResponse);
    (mockCache.createCacheKey as any).mockResolvedValueOnce();

    const response = await client.instances.get({
      query: {
        page: 1,
        pageSize: 10,
      },
    });

    expect(response.status).toBe(200);
  });
});

describe("Instance Route - Instructor", () => {
  let mockPrisma: any;
  let mockCache: MockCache;
  let mockQueue: MockQueueModule;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
    mockQueue = new MockQueueModule();
    if (mockQueue.provisionInstanceQueue.add.mockReset) mockQueue.provisionInstanceQueue.add.mockReset();
    if (mockQueue.deprovisionInstanceQueue.add.mockReset) mockQueue.deprovisionInstanceQueue.add.mockReset();
  });

  it("should get own instances", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockInstructorAuth, mockQueue as any));

    mockPrisma.instance.count.mockResolvedValueOnce(2);
    mockPrisma.instance.findMany.mockResolvedValueOnce([]);

    const response = await client.instances.get({
      query: {
        page: 1,
        pageSize: 10,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data!.totalItems).toBe(2);
  });

  it("should create instance as instructor", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockInstructorAuth, mockQueue as any));

    const mockCourse = createMockCourse({ id: 1 });
    const mockSemester = createMockSemester({ id: 1 });

    mockPrisma.instance.create.mockResolvedValueOnce({
      id: 1,
      courseOffering: {
        course: {
          code: mockCourse.code,
          title: mockCourse.title,
        },
        semester: {
          name: mockSemester.name,
        },
      },
      status: "PENDING",
      provisionStatus: "QUEUED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await client.instances.post({
      pveTemplateId: 1,
      courseOfferingId: 1,
      cpus: 4,
      memoryMB: 8192,
      diskGB: 100,
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("courseOffering");
  });
});

describe("Instance Route - Student", () => {
  let mockPrisma: any;
  let mockCache: MockCache;
  let mockQueue: MockQueueModule;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
    mockQueue = new MockQueueModule();
    if (mockQueue.provisionInstanceQueue.add.mockReset) mockQueue.provisionInstanceQueue.add.mockReset();
    if (mockQueue.deprovisionInstanceQueue.add.mockReset) mockQueue.deprovisionInstanceQueue.add.mockReset();
  });

  it("should get own instances", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    mockPrisma.instance.count.mockResolvedValueOnce(1);
    mockPrisma.instance.findMany.mockResolvedValueOnce([]);

    const response = await client.instances.get({
      query: {
        page: 1,
        pageSize: 10,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data!.totalItems).toBe(1);
  });

  it("should not create instance as student", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    const response = await client.instances.post({
      pveTemplateId: 1,
      courseOfferingId: 1,
      cpus: 2,
      memoryMB: 4096,
      diskGB: 50,
    });

    expect(response.status).toBe(403);
  });

  it("should delete own instance", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    mockPrisma.instance.findUnique.mockResolvedValueOnce({
      id: 1,
      platformUserId: 1,
      status: true,
    });
    mockPrisma.instance.delete.mockResolvedValueOnce({ id: 1 });

    const response = await client.instances({ instanceId: 1 }).delete();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("success", true);
  });

  it("should create extended request for own instance", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    const instance = createMockInstance({ id: 50, platformUserId: 3 });
    const currentSemesterEnd = new Date('2024-05-30T00:00:00.000Z');

    mockPrisma.instance.findUnique.mockResolvedValueOnce({
      platformUserId: instance.platformUserId,
      courseOffering: {
        semester: { id: 201, endDate: currentSemesterEnd },
      }
    });

    const nextSemester = { id: 202, name: "Fall 2024", startDate: new Date('2024-08-15T00:00:00.000Z'), endDate: new Date('2024-12-20T00:00:00.000Z') };
    mockPrisma.semester.findFirst.mockResolvedValueOnce(nextSemester);

    mockPrisma.extendedRequest.create.mockResolvedValueOnce({
      id: 60,
      title: "Extend Instance",
      description: "Need more time",
      status: "PENDING",
      reason: null,
      targetInstanceId: instance.id,
      requesterId: 3,
      reviewerId: null,
      nextSemester,
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

    const response = await client.instances({ instanceId: instance.id })['extended-request'].post({
      title: "Extend Instance",
      description: "Need more time",
    });

    expect(response.status).toBe(200);
    expect(response.data).not.toBeNull();
    expect(response.data!.targetInstanceId).toBe(instance.id);
  });

  it("should not create extended request for others instance", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    // Instance is owned by someone else
    mockPrisma.instance.findUnique.mockResolvedValueOnce({ platformUserId: 999 });

    const response = await client.instances({ instanceId: 123 })['extended-request'].post({
      title: "Extend",
      description: "more time",
    });

    expect(response.status).toBe(404);
  });

  it("should get extended requests for own instance", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    const mockExtendedRequests = [
      {
        id: 1,
        title: "Extend Instance",
        description: "Need more time",
        status: "PENDING",
        reason: null,
        targetInstanceId: 50,
        requesterId: 3,
        reviewerId: null,
        nextSemester: { id: 202, name: "Fall 2024", startDate: new Date(), endDate: new Date() },
        targetInstance: {
          id: 50,
          courseOffering: {
            course: { code: "CS301", title: "Net" },
            semester: { name: "Fall" },
          }
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    mockPrisma.extendedRequest.count.mockResolvedValueOnce(1);
    mockPrisma.extendedRequest.findMany.mockResolvedValueOnce(mockExtendedRequests);

    const response = await client.instances({ instanceId: 50 })['extended-request'].get({
      query: { page: 1, pageSize: 10 }
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("values");
    expect(response.data).toHaveProperty("totalItems");
    expect(response.data!.values).toHaveLength(1);
    expect(response.data!.values[0].targetInstanceId).toBe(50);
  });

  it("should get extended requests with pagination", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockStudentAuth, mockQueue as any));

    mockPrisma.extendedRequest.count.mockResolvedValueOnce(25);
    mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

    const response = await client.instances({ instanceId: 50 })['extended-request'].get({
      query: { page: 2, pageSize: 10 }
    });

    expect(response.status).toBe(200);
    expect(response.data!.currentPage).toBe(2);
    expect(response.data!.pageSize).toBe(10);
    expect(response.data!.totalPages).toBe(3);
  });
});

describe("Instance Route - Extended Request Authorization", () => {
  let mockPrisma: any;
  let mockCache: MockCache;
  let mockQueue: MockQueueModule;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
    mockQueue = new MockQueueModule();
  });

  it("should not allow instructor to create extended request (403)", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockInstructorAuth, mockQueue as any));

    const response = await client.instances({ instanceId: 1 })['extended-request'].post({
      title: "Extend",
      description: "more time",
    });

    expect(response.status).toBe(403);
  });

  it("should not allow admin to create extended request (403)", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    const response = await client.instances({ instanceId: 1 })['extended-request'].post({
      title: "Extend",
      description: "more time",
    });

    expect(response.status).toBe(403);
  });

  it("should allow instructor to get extended requests", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockInstructorAuth, mockQueue as any));

    mockPrisma.extendedRequest.count.mockResolvedValueOnce(2);
    mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

    const response = await client.instances({ instanceId: 1 })['extended-request'].get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("values");
    expect(response.data!.totalItems).toBe(2);
  });

  it("should allow admin to get extended requests", async () => {
    const client = treaty(instanceRoute(mockPrisma, mockCache as any, mockAdminAuth, mockQueue as any));

    mockPrisma.extendedRequest.count.mockResolvedValueOnce(5);
    mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

    const response = await client.instances({ instanceId: 1 })['extended-request'].get();

    expect(response.status).toBe(200);
    expect(response.data!.totalItems).toBe(5);
  });
});
