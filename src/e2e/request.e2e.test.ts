import { beforeEach, describe, expect, it } from "bun:test";

import {
  createMockCourse, createMockCourseOffering, createMockInstance, createMockPVETemplate,
  createMockRequest, createMockSemester
} from "@momoi/database/test";

import { setupTestContext } from "./setup";

/**
 * E2E Tests for Request Routes
 * 
 * These tests verify the complete request/response cycle for request-related endpoints.
 * Tests cover standard requests and extended requests with different user roles.
 */

describe("E2E: Request Routes", () => {
  // ============================================
  // Standard Requests
  // ============================================
  describe("Standard Requests", () => {
    describe("POST /api/requests", () => {
      describe("As Student", () => {
        it("should create a new request", async () => {
          const { client, mockPrisma } = setupTestContext("student");

          const mockTemplate = createMockPVETemplate({ id: 1 });
          const mockCourseOffering = {
            id: 1,
            courseId: 1,
            semesterId: 1,
            course: createMockCourse({ code: "CS101", title: "Intro to CS" }),
            semester: createMockSemester({ name: "Fall 2024" }),
          };

          mockPrisma.pVETemplate.findUnique.mockResolvedValueOnce(mockTemplate);
          mockPrisma.courseOffering.findUnique.mockResolvedValueOnce(mockCourseOffering);
          mockPrisma.request.create.mockResolvedValueOnce({
            id: 1,
            title: "Request for CS101 VM",
            description: "Need a VM for the course project",
            status: "PENDING",
            requesterId: 3,
            reviewerId: null,
            reason: null,
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
            courseOfferingId: 1,
            pveTemplateId: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            courseOffering: mockCourseOffering,
            pveTemplate: mockTemplate,
          });

          const response = await client.api.requests.post({
            title: "Request for CS101 VM",
            description: "Need a VM for the course project",
            courseOfferingId: 1,
            pveTemplateId: 1,
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
          });

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.id).toBe(1);
          expect(response.data!.title).toBe("Request for CS101 VM");
          expect(response.data!.status).toBe("PENDING");
        });

        it("should validate required fields", async () => {
          const { client } = setupTestContext("student");

          const response = await client.api.requests.post({
            title: "",
            courseOfferingId: 1,
            pveTemplateId: 1,
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
          } as any);

          expect(response.status).not.toBe(200);
        });
      });

      describe("As Admin", () => {
        it("should return 403 Forbidden (only students can create)", async () => {
          const { client } = setupTestContext("admin");

          const response = await client.api.requests.post({
            title: "Test Request",
            courseOfferingId: 1,
            pveTemplateId: 1,
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
          });

          expect(response.status).toBe(403);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden (only students can create)", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.requests.post({
            title: "Test Request",
            courseOfferingId: 1,
            pveTemplateId: 1,
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
          });

          expect(response.status).toBe(403);
        });
      });

      describe("As Unauthenticated", () => {
        it("should return 401 Unauthorized", async () => {
          const { client } = setupTestContext("unauthenticated");

          const response = await client.api.requests.post({
            title: "Test Request",
            courseOfferingId: 1,
            pveTemplateId: 1,
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
          });

          expect(response.status).toBe(401);
        });
      });
    });

    describe("GET /api/requests", () => {
      describe("As Student", () => {
        it("should return student's own requests", async () => {
          const { client, mockPrisma } = setupTestContext("student");

          const mockRequests = [
            {
              id: 1,
              title: "My Request",
              status: "PENDING",
              requesterId: 3, // Student ID
              cpus: 2,
              memoryMB: 2048,
              diskGB: 20,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];

          mockPrisma.request.count.mockResolvedValueOnce(1);
          mockPrisma.request.findMany.mockResolvedValueOnce(mockRequests);

          const response = await client.api.requests.get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.values).toHaveLength(1);
          expect(response.data!.totalItems).toBe(1);
        });
      });

      describe("As Admin", () => {
        it("should return all requests", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.request.count.mockResolvedValueOnce(5);
          mockPrisma.request.findMany.mockResolvedValueOnce([]);

          const response = await client.api.requests.get();

          expect(response.status).toBe(200);
          expect(response.data!.totalItems).toBe(5);
        });

        it("should support filtering by status", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.request.count.mockResolvedValueOnce(2);
          mockPrisma.request.findMany.mockResolvedValueOnce([]);

          const response = await client.api.requests.get({
            query: { status: "PENDING" },
          });

          expect(response.status).toBe(200);
        });
      });

      describe("As Instructor", () => {
        it("should return requests for instructor's courses", async () => {
          const { client, mockPrisma } = setupTestContext("instructor");

          mockPrisma.request.count.mockResolvedValueOnce(3);
          mockPrisma.request.findMany.mockResolvedValueOnce([]);

          const response = await client.api.requests.get();

          expect(response.status).toBe(200);
          expect(response.data!.totalItems).toBe(3);
        });
      });

      describe("As Unauthenticated", () => {
        it("should return 401 Unauthorized", async () => {
          const { client } = setupTestContext("unauthenticated");

          const response = await client.api.requests.get();

          expect(response.status).toBe(401);
        });
      });
    });

    describe("PATCH /api/requests/:requestId/status", () => {
      describe("As Admin", () => {
        it("should approve a request", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.request.findUnique.mockResolvedValueOnce({
            id: 1,
            status: "PENDING",
            requesterId: 3,
          });
          mockPrisma.request.update.mockResolvedValueOnce({
            id: 1,
            title: "Test Request",
            status: "APPROVED",
            requesterId: 3,
            reviewerId: 1, // Admin ID
            reason: "Looks good!",
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

          const response = await client.api.requests({ requestId: 1 }).status.patch({
            status: "APPROVED",
            reason: "Looks good!",
          });

          expect(response.status).toBe(200);
          expect(response.data!.status).toBe("APPROVED");
        });

        it("should reject a request", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.request.findUnique.mockResolvedValueOnce({
            id: 1,
            status: "PENDING",
            requesterId: 3,
          });
          mockPrisma.request.update.mockResolvedValueOnce({
            id: 1,
            title: "Test Request",
            status: "REJECTED",
            requesterId: 3,
            reviewerId: 1,
            reason: "Not enough resources",
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

          const response = await client.api.requests({ requestId: 1 }).status.patch({
            status: "REJECTED",
            reason: "Not enough resources",
          });

          expect(response.status).toBe(200);
          expect(response.data!.status).toBe("REJECTED");
        });
      });

      describe("As Instructor", () => {
        it("should approve a request for their course", async () => {
          const { client, mockPrisma } = setupTestContext("instructor");

          // Service expects courseOffering.course.instructors array with id's
          mockPrisma.request.findUnique.mockResolvedValueOnce({
            id: 1,
            status: "PENDING",
            requesterId: 3,
            courseOfferingId: 1,
            pveTemplateId: 1,
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
            courseOffering: {
              course: {
                code: "CS101",
                title: "Intro to CS",
                instructors: [{ id: 2 }], // Instructor ID matches mock instructor
              },
              semester: { name: "Fall 2024" },
            },
          });
          // Service uses $transaction for update and audit log
          mockPrisma.$transaction.mockResolvedValueOnce([
            {
              id: 1,
              title: "Test Request",
              status: "APPROVED",
              requesterId: 3,
              reviewerId: 2,
              cpus: 2,
              memoryMB: 2048,
              diskGB: 20,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {},
          ]);

          const response = await client.api.requests({ requestId: 1 }).status.patch({
            status: "APPROVED",
          });

          expect(response.status).toBe(200);
        });
      });

      describe("As Student", () => {
        it("should cancel their own request", async () => {
          const { client, mockPrisma } = setupTestContext("student");

          mockPrisma.request.findUnique.mockResolvedValueOnce({
            id: 1,
            status: "PENDING",
            requesterId: 3, // Student's own request
          });
          mockPrisma.request.update.mockResolvedValueOnce({
            id: 1,
            title: "Test Request",
            status: "CANCELLED",
            requesterId: 3,
            reason: "Changed my mind",
            cpus: 2,
            memoryMB: 2048,
            diskGB: 20,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

          const response = await client.api.requests({ requestId: 1 }).status.patch({
            status: "CANCELLED",
            reason: "Changed my mind",
          });

          expect(response.status).toBe(200);
          expect(response.data!.status).toBe("CANCELLED");
        });
      });
    });

    describe("GET /api/requests/:requestId/audit-logs", () => {
      describe("As Admin", () => {
        it("should return request audit logs", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          // Service first verifies request exists
          mockPrisma.request.findUnique.mockResolvedValueOnce({ id: 1 });
          mockPrisma.requestAuditLog.count.mockResolvedValueOnce(2);
          mockPrisma.requestAuditLog.findMany.mockResolvedValueOnce([
            {
              id: 1,
              action: "PENDING",
              requestId: 1,
              timestamp: new Date(),
              notes: "Request created",
              performedBy: {
                id: 3,
                user: {
                  name: "Student User",
                  email: "student@example.com",
                },
              },
            },
            {
              id: 2,
              action: "APPROVED",
              requestId: 1,
              timestamp: new Date(),
              notes: "Request approved",
              performedBy: {
                id: 1,
                user: {
                  name: "Admin User",
                  email: "admin@example.com",
                },
              },
            },
          ]);

          const response = await client.api.requests({ requestId: 1 })["audit-logs"].get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.values).toHaveLength(2);
        });
      });
    });
  });

  // ============================================
  // Extended Requests
  // ============================================
  describe("Extended Requests", () => {
    describe("POST /api/extended-requests", () => {
      describe("As Student", () => {
        it("should create an extended request", async () => {
          const { client, mockPrisma } = setupTestContext("student");

          // Service checks instance ownership and semester info
          mockPrisma.instance.findUnique.mockResolvedValueOnce({
            id: 1,
            platformUserId: 3, // Student's ID matches
            courseOffering: {
              semester: {
                id: 1,
                endDate: new Date("2024-12-15"),
              },
            },
          });
          // Service finds next semester
          mockPrisma.semester.findFirst.mockResolvedValueOnce({
            id: 2,
            name: "Spring 2025",
            startDate: new Date("2025-01-15"),
          });
          mockPrisma.extendedRequest.create.mockResolvedValueOnce({
            id: 1,
            title: "Extend VM for Final Project",
            description: "Need more time for the final project",
            status: "PENDING",
            targetInstanceId: 1,
            requesterId: 3,
            reviewerId: null,
            reason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const response = await client.api["extended-requests"].post({
            title: "Extend VM for Final Project",
            description: "Need more time for the final project",
            targetInstanceId: 1,
          });

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.id).toBe(1);
          expect(response.data!.status).toBe("PENDING");
        });
      });

      describe("As Admin", () => {
        it("should return 403 Forbidden (only students can create)", async () => {
          const { client } = setupTestContext("admin");

          const response = await client.api["extended-requests"].post({
            title: "Test Extended Request",
            targetInstanceId: 1,
          });

          expect(response.status).toBe(403);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden (only students can create)", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api["extended-requests"].post({
            title: "Test Extended Request",
            targetInstanceId: 1,
          });

          expect(response.status).toBe(403);
        });
      });

      describe("As Unauthenticated", () => {
        it("should return 401 Unauthorized", async () => {
          const { client } = setupTestContext("unauthenticated");

          const response = await client.api["extended-requests"].post({
            title: "Test Extended Request",
            targetInstanceId: 1,
          });

          expect(response.status).toBe(401);
        });
      });
    });

    describe("GET /api/extended-requests", () => {
      describe("As Student", () => {
        it("should return student's own extended requests", async () => {
          const { client, mockPrisma } = setupTestContext("student");

          mockPrisma.extendedRequest.count.mockResolvedValueOnce(1);
          mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([
            {
              id: 1,
              title: "My Extended Request",
              status: "PENDING",
              targetInstanceId: 1,
              requesterId: 3,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);

          const response = await client.api["extended-requests"].get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.values).toHaveLength(1);
        });
      });

      describe("As Admin", () => {
        it("should return all extended requests", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.extendedRequest.count.mockResolvedValueOnce(3);
          mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

          const response = await client.api["extended-requests"].get();

          expect(response.status).toBe(200);
          expect(response.data!.totalItems).toBe(3);
        });

        it("should support filtering by instance ID", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.extendedRequest.count.mockResolvedValueOnce(1);
          mockPrisma.extendedRequest.findMany.mockResolvedValueOnce([]);

          const response = await client.api["extended-requests"].get({
            query: { instanceId: 1 },
          });

          expect(response.status).toBe(200);
        });
      });
    });

    describe("PATCH /api/extended-requests/:extendedRequestId/status", () => {
      describe("As Admin", () => {
        it("should approve an extended request", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
            id: 1,
            status: "PENDING",
            requesterId: 3,
            targetInstanceId: 1,
          });
          mockPrisma.extendedRequest.update.mockResolvedValueOnce({
            id: 1,
            title: "Test Extended Request",
            status: "APPROVED",
            targetInstanceId: 1,
            requesterId: 3,
            reviewerId: 1,
            reason: "Approved for extension",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

          const response = await client.api["extended-requests"]({ extendedRequestId: 1 }).status.patch({
            status: "APPROVED",
            reason: "Approved for extension",
          });

          expect(response.status).toBe(200);
          expect(response.data!.status).toBe("APPROVED");
        });

        it("should reject an extended request", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
            id: 1,
            status: "PENDING",
            requesterId: 3,
          });
          mockPrisma.extendedRequest.update.mockResolvedValueOnce({
            id: 1,
            title: "Test Extended Request",
            status: "REJECTED",
            targetInstanceId: 1,
            requesterId: 3,
            reviewerId: 1,
            reason: "No available resources",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

          const response = await client.api["extended-requests"]({ extendedRequestId: 1 }).status.patch({
            status: "REJECTED",
            reason: "No available resources",
          });

          expect(response.status).toBe(200);
          expect(response.data!.status).toBe("REJECTED");
        });
      });

      describe("As Student", () => {
        it("should cancel their own extended request", async () => {
          const { client, mockPrisma } = setupTestContext("student");

          mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
            id: 1,
            status: "PENDING",
            requesterId: 3, // Student's own request
          });
          mockPrisma.extendedRequest.update.mockResolvedValueOnce({
            id: 1,
            title: "Test Extended Request",
            status: "CANCELLED",
            targetInstanceId: 1,
            requesterId: 3,
            reason: "No longer needed",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

          const response = await client.api["extended-requests"]({ extendedRequestId: 1 }).status.patch({
            status: "CANCELLED",
            reason: "No longer needed",
          });

          expect(response.status).toBe(200);
          expect(response.data!.status).toBe("CANCELLED");
        });
      });
    });

    describe("GET /api/extended-requests/:extendedRequestId/audit-logs", () => {
      describe("As Admin", () => {
        it("should return extended request audit logs", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          // Service first verifies extended request exists
          mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({ id: 1 });
          mockPrisma.extendedRequestAuditLog.count.mockResolvedValueOnce(1);
          mockPrisma.extendedRequestAuditLog.findMany.mockResolvedValueOnce([
            {
              id: 1,
              action: "PENDING",
              extendedRequestId: 1,
              timestamp: new Date(),
              notes: "Extended request created",
              performedBy: {
                id: 3,
                user: {
                  name: "Student User",
                  email: "student@example.com",
                },
              },
            },
          ]);

          const response = await client.api["extended-requests"]({ extendedRequestId: 1 })["audit-logs"].get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.values).toHaveLength(1);
        });
      });
    });
  });
});
