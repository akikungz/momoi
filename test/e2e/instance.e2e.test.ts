import { beforeEach, describe, expect, it } from "bun:test";

import {
  createMockCourse, createMockCourseOffering, createMockInstance, createMockPVETemplate,
  createMockSemester
} from "@test/mocks";

import { setupTestContext } from "@test/e2e/setup";

/**
 * E2E Tests for Instance Routes
 * 
 * These tests verify the complete request/response cycle for instance-related endpoints.
 * Tests cover CRUD operations, reverse proxy management, promotion, and audit logs.
 */

describe("E2E: Instance Routes", () => {
  describe("POST /api/instances", () => {
    describe("As Admin", () => {
      it("should create a new instance", async () => {
        const { client, mockPrisma, mockQueue } = setupTestContext("admin");
        mockQueue.provisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'provision', data: {} });

        const mockTemplate = createMockPVETemplate({ id: 1 });
        const mockCourse = createMockCourse({ id: 1, code: "CS101", title: "Intro to CS" });
        const mockSemester = createMockSemester({ id: 1, name: "Fall 2024" });
        const mockCourseOffering = createMockCourseOffering({ id: 1, courseId: 1, semesterId: 1 });

        mockPrisma.pVETemplate.findUnique.mockResolvedValueOnce(mockTemplate);
        mockPrisma.courseOffering.findUnique.mockResolvedValueOnce({
          ...mockCourseOffering,
          course: mockCourse,
          semester: mockSemester,
        });
        mockPrisma.instance.create.mockResolvedValueOnce({
          id: 1,
          courseOffering: {
            course: { code: "CS101", title: "Intro to CS" },
            semester: { name: "Fall 2024" }
          },
          status: "PENDING",
          provisionStatus: "QUEUED",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await client.api.instances.post({
          pveTemplateId: 1,
          courseOfferingId: 1,
          cpus: 2,
          memoryMB: 2048,
          diskGB: 20,
        });

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.id).toBe(1);
        expect(response.data!.status).toBe("PENDING");
      });
    });

    describe("As Instructor", () => {
      it("should create a new instance", async () => {
        const { client, mockPrisma, mockQueue } = setupTestContext("instructor");
        mockQueue.provisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'provision', data: {} });

        const mockTemplate = createMockPVETemplate({ id: 1 });

        mockPrisma.pVETemplate.findUnique.mockResolvedValueOnce(mockTemplate);
        mockPrisma.courseOffering.findUnique.mockResolvedValueOnce(null);
        mockPrisma.instance.create.mockResolvedValueOnce({
          id: 1,
          courseOffering: {
            course: { code: "CS101", title: "Intro to CS" },
            semester: { name: "Fall 2024" }
          },
          status: "PENDING",
          provisionStatus: "QUEUED",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await client.api.instances.post({
          pveTemplateId: 1,
          cpus: 2,
          memoryMB: 2048,
          diskGB: 20,
        });

        expect(response.status).toBe(200);
      });
    });

    describe("As Student", () => {
      it("should return 403 Forbidden", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.instances.post({
          pveTemplateId: 1,
          cpus: 2,
          memoryMB: 2048,
          diskGB: 20,
        });

        expect(response.status).toBe(403);
        expect(response.error?.value).toHaveProperty("message");
      });
    });

    describe("As Unauthenticated", () => {
      it("should return 401 Unauthorized", async () => {
        const { client } = setupTestContext("unauthenticated");

        const response = await client.api.instances.post({
          pveTemplateId: 1,
          cpus: 2,
          memoryMB: 2048,
          diskGB: 20,
        });

        expect(response.status).toBe(401);
      });
    });
  });

  describe("GET /api/instances", () => {
    describe("As Admin", () => {
      it("should return paginated instances for the current user", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockInstances = [
          {
            id: 1,
            platformUserId: 1,
            platformUser: {
              id: 1,
              user: {
                name: "Admin User",
                email: "admin@example.com",
              },
            },
            courseOfferingId: 1,
            status: "ACTIVE",
            provisionStatus: "COMPLETED",
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
            courseOffering: {
              course: { code: "CS101", title: "Intro to CS" },
              semester: { name: "Fall 2024" },
            },
            pveVM: null,
            pveTemplate: null,
          },
        ];

        mockPrisma.instance.count.mockResolvedValueOnce(1);
        mockPrisma.instance.findMany.mockResolvedValueOnce(mockInstances);

        const response = await client.api.instances.get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.values).toHaveLength(1);
        expect(response.data!.totalItems).toBe(1);
      });

      it("should support filtering by courseId", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instance.count.mockResolvedValueOnce(0);
        mockPrisma.instance.findMany.mockResolvedValueOnce([]);

        const response = await client.api.instances.get({
          query: { courseId: 1 },
        });

        expect(response.status).toBe(200);
      });

      it("should support filtering by semesterId", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instance.count.mockResolvedValueOnce(0);
        mockPrisma.instance.findMany.mockResolvedValueOnce([]);

        const response = await client.api.instances.get({
          query: { semesterId: 1 },
        });

        expect(response.status).toBe(200);
      });
    });

    describe("As Unauthenticated", () => {
      it("should return 401 Unauthorized", async () => {
        const { client } = setupTestContext("unauthenticated");

        const response = await client.api.instances.get();

        expect(response.status).toBe(401);
      });
    });
  });

  describe("GET /api/instances/admin", () => {
    describe("As Admin", () => {
      it("should return all instances in the system", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instance.count.mockResolvedValueOnce(5);
        mockPrisma.instance.findMany.mockResolvedValueOnce([]);

        const response = await client.api.instances.admin.get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.totalItems).toBe(5);
      });
    });
  });

  describe("GET /api/instances/instructor", () => {
    describe("As Instructor", () => {
      it("should return instructor's instances", async () => {
        const { client, mockPrisma } = setupTestContext("instructor");

        mockPrisma.instance.count.mockResolvedValueOnce(2);
        mockPrisma.instance.findMany.mockResolvedValueOnce([]);

        const response = await client.api.instances.instructor.get();

        expect(response.status).toBe(200);
        expect(response.data!.totalItems).toBe(2);
      });
    });

    describe("As Student", () => {
      it("should return 403 Forbidden", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.instances.instructor.get();

        expect(response.status).toBe(403);
      });
    });
  });

  describe("GET /api/instances/:instanceId", () => {
    describe("As Admin", () => {
      it("should return instance details", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instance.findUnique.mockResolvedValueOnce({
          id: 1,
          platformUserId: 1,
          status: "ACTIVE",
          provisionStatus: "COMPLETED",
          cpus: 2,
          memoryMB: 2048,
          diskGB: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
          courseOffering: {
            course: { code: "CS101", title: "Intro to CS" },
            semester: { name: "Fall 2024" },
          },
          pveVM: {
            hostname: "vm-001",
            status: "RUNNING",
            pveNetworkIP: { ipAddress: "192.168.1.100" },
          },
          pveTemplate: { name: "Ubuntu 22.04" },
          instanceReverseProxies: [],
        });

        const response = await client.api.instances({ instanceId: 1 }).get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.id).toBe(1);
        expect(response.data!.status).toBe("ACTIVE");
      });
    });
  });

  describe("DELETE /api/instances/:instanceId", () => {
    describe("As Admin", () => {
      it("should delete an instance", async () => {
        const { client, mockPrisma, mockQueue } = setupTestContext("admin");
        mockQueue.deprovisionInstanceQueue.add.mockResolvedValueOnce({ id: 'mock-job', name: 'deprovision', data: {} });

        mockPrisma.instance.findUnique.mockResolvedValueOnce({ id: 1, platformUserId: 1, status: "ACTIVE" });
        mockPrisma.instance.delete.mockResolvedValueOnce({
          id: 1,
          platformUserId: 1,
          status: "DELETED",
          courseOffering: {
            course: { code: "CS101", title: "Intro to CS" },
            semester: { name: "Fall 2024" }
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await client.api.instances({ instanceId: 1 }).delete();

        expect(response.status).toBe(200);
        expect(response.data!.success).toBe(true);
      });
    });

    describe("As Unauthenticated", () => {
      it("should return 401 Unauthorized", async () => {
        const { client } = setupTestContext("unauthenticated");

        const response = await client.api.instances({ instanceId: 1 }).delete();

        expect(response.status).toBe(401);
      });
    });
  });

  describe("POST /api/instances/:instanceId/reverse-proxies", () => {
    describe("As Admin", () => {
      it("should create a reverse proxy", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instance.findUnique.mockResolvedValueOnce({
          id: 1,
          status: "ACTIVE",
        });
        mockPrisma.instanceReverseProxy.create.mockResolvedValueOnce({
          id: 1,
          instanceId: 1,
          targetPort: 8080,
          type: "HTTPS",
          description: "Web server",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const response = await client.api.instances({ instanceId: 1 })["reverse-proxies"].post({
          targetPort: 8080,
          type: "HTTPS",
          description: "Web server",
        });

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.targetPort).toBe(8080);
        expect(response.data!.type).toBe("HTTPS");
      });

      it("should validate port range", async () => {
        const { client } = setupTestContext("admin");

        const response = await client.api.instances({ instanceId: 1 })["reverse-proxies"].post({
          targetPort: 70000, // Invalid port
          type: "HTTPS",
        });

        // Should fail validation
        expect(response.status).not.toBe(200);
      });
    });
  });

  describe("GET /api/instances/:instanceId/reverse-proxies", () => {
    describe("As Admin", () => {
      it("should return reverse proxy configurations", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instance.findUnique.mockResolvedValueOnce({
          id: 1,
          instanceReverseProxies: [
            {
              id: 1,
              targetPort: 8080,
              type: "HTTPS",
              description: "Web server",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        });

        const response = await client.api.instances({ instanceId: 1 })["reverse-proxies"].get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(Array.isArray(response.data)).toBe(true);
      });
    });
  });

  describe("DELETE /api/instances/:instanceId/reverse-proxies/:proxyId", () => {
    describe("As Admin", () => {
      it("should delete a reverse proxy", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instanceReverseProxy.findUnique.mockResolvedValueOnce({
          id: 1,
          instanceId: 1,
        });
        mockPrisma.instanceReverseProxy.delete.mockResolvedValueOnce({
          id: 1,
        });

        const response = await client.api.instances({ instanceId: 1 })["reverse-proxies"]({ proxyId: 1 }).delete();

        expect(response.status).toBe(200);
        expect(response.data!.success).toBe(true);
      });
    });
  });

  describe("PATCH /api/instances/:instanceId/promote", () => {
    describe("As Admin", () => {
      it("should promote an instance", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.instance.findUnique.mockResolvedValueOnce({
          id: 1,
          status: "ACTIVE",
        });
        mockPrisma.instance.update.mockResolvedValueOnce({
          id: 1,
          status: "PROMOTED",
        });
        mockPrisma.instanceAuditLog.create.mockResolvedValueOnce({});

        const response = await client.api.instances({ instanceId: 1 }).promote.patch({});

        expect(response.status).toBe(200);
        expect(response.data!.status).toBe("PROMOTED");
      });
    });

    describe("As Instructor", () => {
      it("should return 403 Forbidden", async () => {
        const { client } = setupTestContext("instructor");

        const response = await client.api.instances({ instanceId: 1 }).promote.patch({});

        expect(response.status).toBe(403);
      });
    });

    describe("As Student", () => {
      it("should return 403 Forbidden", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.instances({ instanceId: 1 }).promote.patch({});

        expect(response.status).toBe(403);
      });
    });
  });

  describe("GET /api/instances/:instanceId/audit-logs", () => {
    describe("As Admin", () => {
      it("should return instance audit logs", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        // Mock instance existence check
        mockPrisma.instance.findUnique.mockResolvedValueOnce({
          id: 1,
        });

        mockPrisma.instanceAuditLog.count.mockResolvedValueOnce(1);
        mockPrisma.instanceAuditLog.findMany.mockResolvedValueOnce([
          {
            id: 1,
            action: "CREATED",
            instanceId: 1,
            timestamp: new Date(),
            notes: "Instance created",
            performedBy: {
              id: 1,
              user: {
                name: "Admin User",
                email: "admin@example.com",
              },
            },
          },
        ]);

        const response = await client.api.instances({ instanceId: 1 })["audit-logs"].get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.values).toHaveLength(1);
      });
    });

    describe("As Student", () => {
      it("should return 403 Forbidden", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.instances({ instanceId: 1 })["audit-logs"].get();

        expect(response.status).toBe(403);
      });
    });
  });

  describe("GET /api/instances/:instanceId/extended-request", () => {
    describe("As Admin", () => {
      it("should return extended requests for an instance", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        const mockExtendedRequests = [
          {
            id: 1,
            title: "Extend Instance",
            description: "Need more time",
            status: "PENDING",
            reason: null,
            targetInstanceId: 1,
            requesterId: 3,
            reviewerId: null,
            nextSemester: { id: 2, name: "Fall 2024", startDate: new Date(), endDate: new Date() },
            targetInstance: {
              id: 1,
              courseOffering: {
                course: { code: "CS101", title: "Intro to CS" },
                semester: { name: "Spring 2024" },
              }
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        ];

        mockPrisma.extendedRequest.count.mockResolvedValueOnce(1);
        mockPrisma.extendedRequest.findMany.mockResolvedValueOnce(mockExtendedRequests);

        const response = await client.api.instances({ instanceId: 1 })["extended-request"].get();

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data!.values).toHaveLength(1);
        expect(response.data!.totalItems).toBe(1);
      });

      it("should support pagination and filtering", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.extendedRequest.count.mockResolvedValueOnce(15);
        mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

        const response = await client.api.instances({ instanceId: 1 })["extended-request"].get({
          query: { page: 2, pageSize: 5, status: "PENDING" }
        });

        expect(response.status).toBe(200);
        expect(response.data!.currentPage).toBe(2);
        expect(response.data!.pageSize).toBe(5);
        expect(response.data!.totalPages).toBe(3);
      });
    });

    describe("As Instructor", () => {
      it("should return extended requests for an instance", async () => {
        const { client, mockPrisma } = setupTestContext("instructor");

        mockPrisma.extendedRequest.count.mockResolvedValueOnce(2);
        mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

        const response = await client.api.instances({ instanceId: 1 })["extended-request"].get();

        expect(response.status).toBe(200);
        expect(response.data!.totalItems).toBe(2);
      });
    });

    describe("As Student", () => {
      it("should return extended requests filtered by student's own requests", async () => {
        const { client, mockPrisma } = setupTestContext("student");

        mockPrisma.extendedRequest.count.mockResolvedValueOnce(1);
        mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

        const response = await client.api.instances({ instanceId: 1 })["extended-request"].get();

        expect(response.status).toBe(200);
        expect(response.data!.totalItems).toBe(1);
      });
    });

    describe("As Unauthenticated", () => {
      it("should return 401 Unauthorized", async () => {
        const { client } = setupTestContext("unauthenticated");

        const response = await client.api.instances({ instanceId: 1 })["extended-request"].get();

        expect(response.status).toBe(401);
      });
    });
  });
});