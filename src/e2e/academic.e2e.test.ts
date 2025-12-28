import { beforeEach, describe, expect, it } from "bun:test";

import {
  createMockCourse, createMockCourseOffering, createMockPlatformUser, createMockSemester
} from "@momoi/database/test";

import { setupTestContext } from "./setup";

/**
 * E2E Tests for Academic Routes
 * 
 * These tests verify the complete request/response cycle for academic-related endpoints.
 * Note: Academic routes are admin-only, so all non-admin roles should get 403 Forbidden.
 */

describe("E2E: Academic Routes", () => {
  // ============================================
  // Instructor Mailing List Endpoints
  // ============================================
  describe("Instructor Mailing List", () => {
    describe("GET /api/academic/mailing-list", () => {
      describe("As Admin", () => {
        it("should return paginated mailing list", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          const mockMailingList = [
            {
              id: 1,
              email: "instructor1@example.com",
              havePlatformId: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 2,
              email: "instructor2@example.com",
              havePlatformId: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];

          mockPrisma.instructorSearch.count.mockResolvedValueOnce(2);
          mockPrisma.instructorSearch.findMany.mockResolvedValueOnce(mockMailingList);

          const response = await client.api.academic["mailing-list"].get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.values).toHaveLength(2);
          expect(response.data!.totalItems).toBe(2);
        });

        it("should support filtering by email", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.instructorSearch.count.mockResolvedValueOnce(1);
          mockPrisma.instructorSearch.findMany.mockResolvedValueOnce([
            {
              id: 1,
              email: "specific@example.com",
              havePlatformId: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);

          const response = await client.api.academic["mailing-list"].get({
            query: { email: "specific" },
          });

          expect(response.status).toBe(200);
          expect(response.data!.values).toHaveLength(1);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic["mailing-list"].get();

          expect(response.status).toBe(403);
        });
      });

      describe("As Student", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("student");

          const response = await client.api.academic["mailing-list"].get();

          expect(response.status).toBe(403);
        });
      });

      describe("As Unauthenticated", () => {
        it("should return 401 Unauthorized", async () => {
          const { client } = setupTestContext("unauthenticated");

          const response = await client.api.academic["mailing-list"].get();

          expect(response.status).toBe(401);
        });
      });
    });

    describe("POST /api/academic/mailing-list", () => {
      describe("As Admin", () => {
        it("should add instructor to mailing list", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.instructorSearch.create.mockResolvedValueOnce({
            id: 1,
            email: "newinstructor@example.com",
            havePlatformId: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const response = await client.api.academic["mailing-list"].post({
            email: "newinstructor@example.com",
          });

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.email).toBe("newinstructor@example.com");
        });

        it("should validate email format", async () => {
          const { client } = setupTestContext("admin");

          const response = await client.api.academic["mailing-list"].post({
            email: "invalid-email",
          });

          expect(response.status).not.toBe(200);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic["mailing-list"].post({
            email: "test@example.com",
          });

          expect(response.status).toBe(403);
        });
      });
    });

    describe("DELETE /api/academic/mailing-list/:mailingId", () => {
      describe("As Admin", () => {
        it("should remove instructor from mailing list", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.instructorSearch.delete.mockResolvedValueOnce({
            id: 1,
            email: "deleted@example.com",
          });

          const response = await client.api.academic["mailing-list"]({ mailingId: 1 }).delete();

          expect(response.status).toBe(200);
          expect(response.data!.success).toBe(true);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic["mailing-list"]({ mailingId: 1 }).delete();

          expect(response.status).toBe(403);
        });
      });
    });
  });

  // ============================================
  // Instructor Endpoints
  // ============================================
  describe("Instructors", () => {
    describe("GET /api/academic/instructors", () => {
      describe("As Admin", () => {
        it("should return paginated instructors", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          const mockInstructors = [
            {
              id: 1,
              userId: "user-1",
              role: "INSTRUCTOR",
              createdAt: new Date(),
              updatedAt: new Date(),
              user: {
                name: "Instructor 1",
                email: "instructor1@example.com",
              },
            },
          ];

          mockPrisma.platformUser.count.mockResolvedValueOnce(1);
          mockPrisma.platformUser.findMany.mockResolvedValueOnce(mockInstructors);

          const response = await client.api.academic.instructors.get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.totalItems).toBe(1);
        });

        it("should support filtering by name", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.platformUser.count.mockResolvedValueOnce(1);
          mockPrisma.platformUser.findMany.mockResolvedValueOnce([]);

          const response = await client.api.academic.instructors.get({
            query: { name: "John" },
          });

          expect(response.status).toBe(200);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic.instructors.get();

          expect(response.status).toBe(403);
        });
      });
    });

    describe("GET /api/academic/instructors/:instructorId", () => {
      describe("As Admin", () => {
        it("should return instructor details with courses", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
            id: 1,
            userId: "user-1",
            role: "INSTRUCTOR",
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              name: "Instructor 1",
              email: "instructor1@example.com",
            },
            courses: [
              createMockCourse({ code: "CS101", title: "Intro to CS" }),
            ],
          });

          const response = await client.api.academic.instructors({ instructorId: 1 }).get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.id).toBe(1);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic.instructors({ instructorId: 1 }).get();

          expect(response.status).toBe(403);
        });
      });
    });

    describe("PATCH /api/academic/instructors/:instructorId", () => {
      describe("As Admin", () => {
        it("should update instructor role", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          // First mock for existence check
          mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
            id: 1,
            courses: [],
          });

          // Then mock for update
          mockPrisma.platformUser.update.mockResolvedValueOnce({
            id: 1,
            userId: "user-1",
            role: "ADMIN",
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              name: "Instructor 1",
              email: "instructor1@example.com",
            },
            courses: [],
          });

          const response = await client.api.academic.instructors({ instructorId: 1 }).patch({
            role: "ADMIN",
          });

          expect(response.status).toBe(200);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic.instructors({ instructorId: 1 }).patch({
            role: "ADMIN",
          });

          expect(response.status).toBe(403);
        });
      });
    });
  });

  // ============================================
  // Course Endpoints
  // ============================================
  describe("Courses", () => {
    describe("GET /api/academic/courses", () => {
      describe("As Admin", () => {
        it("should return paginated courses", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.course.count.mockResolvedValueOnce(2);
          mockPrisma.course.findMany.mockResolvedValueOnce([
            createMockCourse({ id: 1, code: "CS101", title: "Intro to CS" }),
            createMockCourse({ id: 2, code: "CS102", title: "Data Structures" }),
          ]);

          const response = await client.api.academic.courses.get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.values).toHaveLength(2);
          expect(response.data!.totalItems).toBe(2);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic.courses.get();

          expect(response.status).toBe(403);
        });
      });
    });

    describe("GET /api/academic/courses/:courseId", () => {
      describe("As Admin", () => {
        it("should return course details", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          const mockCourse = createMockCourse({ id: 1, code: "CS101", title: "Intro to CS" });
          mockPrisma.course.findUnique.mockResolvedValueOnce({
            ...mockCourse,
            instructors: [],
            courseOfferings: [],
          });

          const response = await client.api.academic.courses({ courseId: 1 }).get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.code).toBe("CS101");
        });
      });
    });

    describe("POST /api/academic/courses", () => {
      describe("As Admin", () => {
        it("should create a new course", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.course.create.mockResolvedValueOnce(
            createMockCourse({ id: 1, code: "CS301", title: "Advanced Algorithms" })
          );

          const response = await client.api.academic.courses.post({
            code: "CS301",
            title: "Advanced Algorithms",
            description: "An advanced course on algorithms",
          });

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.code).toBe("CS301");
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic.courses.post({
            code: "CS301",
            title: "Advanced Algorithms",
          });

          expect(response.status).toBe(403);
        });
      });
    });

    describe("PATCH /api/academic/courses/:courseId", () => {
      describe("As Admin", () => {
        it("should update course details", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.course.update.mockResolvedValueOnce(
            createMockCourse({ id: 1, code: "CS101", title: "Updated Title" })
          );

          const response = await client.api.academic.courses({ courseId: 1 }).patch({
            title: "Updated Title",
          });

          expect(response.status).toBe(200);
        });
      });
    });

    describe("PATCH /api/academic/courses/:courseId/instructors", () => {
      describe("As Admin", () => {
        it("should update course instructors", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          // First mock for existence check
          mockPrisma.course.findUnique.mockResolvedValueOnce({
            id: 1,
            instructors: [],
          });

          // Then mock for update
          mockPrisma.course.update.mockResolvedValueOnce({
            id: 1,
            instructors: [
              {
                id: 1,
                role: "INSTRUCTOR",
                createdAt: new Date(),
                updatedAt: new Date(),
                user: { name: "Instructor 1", email: "inst1@example.com" },
              },
            ],
          });

          const response = await client.api.academic.courses({ courseId: 1 }).instructors.patch({
            instructorIds: [1],
          });

          expect(response.status).toBe(200);
        });
      });
    });

    describe("PATCH /api/academic/courses/:courseId/semesters", () => {
      describe("As Admin", () => {
        it("should update course semesters", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          // Mock semester existence check
          mockPrisma.semester.findMany.mockResolvedValueOnce([
            createMockSemester({ id: 1 }),
          ]);

          // Mock existing offerings check
          mockPrisma.courseOffering.findMany.mockResolvedValueOnce([]);

          // Mock transaction
          mockPrisma.$transaction.mockResolvedValueOnce([]);

          // Mock final query
          mockPrisma.courseOffering.findMany.mockResolvedValueOnce([
            {
              semester: createMockSemester({ id: 1 }),
            },
          ]);

          const response = await client.api.academic.courses({ courseId: 1 }).semesters.patch({
            semesterIds: [1],
          });

          expect(response.status).toBe(200);
        });
      });
    });
  });

  // ============================================
  // Semester Endpoints
  // ============================================
  describe("Semesters", () => {
    describe("GET /api/academic/semesters", () => {
      describe("As Admin", () => {
        it("should return paginated semesters", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.semester.count.mockResolvedValueOnce(2);
          mockPrisma.semester.findMany.mockResolvedValueOnce([
            createMockSemester({ id: 1, name: "Fall 2024" }),
            createMockSemester({ id: 2, name: "Spring 2025" }),
          ]);

          const response = await client.api.academic.semesters.get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.values).toHaveLength(2);
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic.semesters.get();

          expect(response.status).toBe(403);
        });
      });
    });

    describe("GET /api/academic/semesters/:semesterId", () => {
      describe("As Admin", () => {
        it("should return semester details", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          const mockSemester = createMockSemester({ id: 1, name: "Fall 2024" });
          mockPrisma.semester.findUnique.mockResolvedValueOnce({
            ...mockSemester,
            courseOfferings: [],
          });

          const response = await client.api.academic.semesters({ semesterId: 1 }).get();

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.name).toBe("Fall 2024");
        });
      });
    });

    describe("POST /api/academic/semesters", () => {
      describe("As Admin", () => {
        it("should create a new semester", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          const now = new Date();
          const startDate = new Date(now.getFullYear(), 0, 1);
          const endDate = new Date(now.getFullYear(), 5, 30);

          mockPrisma.semester.create.mockResolvedValueOnce({
            id: 1,
            name: "Summer 2025",
            startDate,
            endDate,
            isCurrent: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const response = await client.api.academic.semesters.post({
            name: "Summer 2025",
            startDate,
            endDate,
          });

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();
          expect(response.data!.name).toBe("Summer 2025");
        });
      });

      describe("As Instructor", () => {
        it("should return 403 Forbidden", async () => {
          const { client } = setupTestContext("instructor");

          const response = await client.api.academic.semesters.post({
            name: "Test",
            startDate: new Date(),
            endDate: new Date(),
          });

          expect(response.status).toBe(403);
        });
      });
    });

    describe("PATCH /api/academic/semesters/:semesterId", () => {
      describe("As Admin", () => {
        it("should update semester details", async () => {
          const { client, mockPrisma } = setupTestContext("admin");

          mockPrisma.semester.update.mockResolvedValueOnce(
            createMockSemester({ id: 1, name: "Updated Semester", isCurrent: true })
          );

          const response = await client.api.academic.semesters({ semesterId: 1 }).patch({
            name: "Updated Semester",
            isCurrent: true,
          });

          expect(response.status).toBe(200);
        });
      });
    });
  });
});
