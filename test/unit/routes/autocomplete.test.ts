import { beforeEach, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { mockAdminAuth, mockOtherAuth, mockStudentAuth } from "@momoi/auth/mock";
import { createMockCache } from "@momoi/cache/mock";
import { createMockPrisma } from "@test/mocks";
import {
  createMockCourse, createMockCourseOffering, createMockPlatformUser,
  createMockPVETemplate, createMockSemester, resetMockFactoryCounters
} from "@test/mocks";

import { autocompleteRoute } from "@momoi/routes/autocomplete";

describe("Autocomplete Route", () => {
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = createMockCache();
  });

  describe("GET /autocomplete/courses", () => {
    it("should return course options", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      const course = createMockCourse({ id: 1 });
      mockPrisma.course.findMany.mockResolvedValueOnce([course]);

      const response = await client.autocomplete.courses.get({ query: {} });

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
      expect(response.data?.[0].id).toBe(course.id);
      expect(response.data?.[0].label).toBe(`[${course.code}] ${course.title}`);
    });

    it("should filter courses by search term", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      const course = createMockCourse({ id: 1, code: "CS101", title: "Intro" });
      mockPrisma.course.findMany.mockResolvedValueOnce([course]);

      const response = await client.autocomplete.courses.get({ query: { search: "CS" } });

      expect(response.status).toBe(200);
      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ code: { contains: "CS", mode: "insensitive" } }),
            ]),
          }),
        })
      );
    });

    it("should respect limit parameter", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      mockPrisma.course.findMany.mockResolvedValueOnce([]);

      await client.autocomplete.courses.get({ query: { limit: 5 } });

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe("GET /autocomplete/semesters", () => {
    it("should return semester options", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      const semester = createMockSemester({ id: 1 });
      mockPrisma.semester.findMany.mockResolvedValueOnce([semester]);

      const response = await client.autocomplete.semesters.get({ query: {} });

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
      expect(response.data?.[0].id).toBe(semester.id);
      expect(response.data?.[0].label).toBe(semester.name);
    });

    it("should filter semesters by search term", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      mockPrisma.semester.findMany.mockResolvedValueOnce([]);

      await client.autocomplete.semesters.get({ query: { search: "Fall" } });

      expect(mockPrisma.semester.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: "Fall", mode: "insensitive" },
          }),
        })
      );
    });
  });

  describe("GET /autocomplete/instructors", () => {
    it("should return instructor options", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      const instructor = createMockPlatformUser({ id: 1, role: "INSTRUCTOR" });
      mockPrisma.platformUser.findMany.mockResolvedValueOnce([
        { ...instructor, user: { name: "Prof", email: "prof@example.com" } },
      ]);

      const response = await client.autocomplete.instructors.get({ query: {} });

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
      expect(response.data?.[0].id).toBe(instructor.id);
      expect(response.data?.[0].label).toBe("Prof (prof@example.com)");
    });

    it("should filter instructors by search term", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      mockPrisma.platformUser.findMany.mockResolvedValueOnce([]);

      await client.autocomplete.instructors.get({ query: { search: "Smith" } });

      expect(mockPrisma.platformUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: ["ADMIN", "INSTRUCTOR"] },
            user: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ name: { contains: "Smith", mode: "insensitive" } }),
              ]),
            }),
          }),
        })
      );
    });
  });

  describe("GET /autocomplete/templates", () => {
    it("should return template options", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      const template = createMockPVETemplate({ id: 1, name: "Ubuntu 22.04" });
      mockPrisma.pVETemplate.findMany.mockResolvedValueOnce([template]);

      const response = await client.autocomplete.templates.get({ query: {} });

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
      expect(response.data?.[0].id).toBe(template.id);
      expect(response.data?.[0].label).toBe("Ubuntu 22.04");
    });
  });

  describe("GET /autocomplete/course-offerings", () => {
    it("should return course offering options", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockAdminAuth));

      const course = createMockCourse({ id: 1, code: "CS101", title: "Intro" });
      const semester = createMockSemester({ id: 1, name: "Fall 2025" });
      const offering = createMockCourseOffering({ id: 1, courseId: course.id, semesterId: semester.id });

      mockPrisma.courseOffering.findMany.mockResolvedValueOnce([
        { ...offering, course: { code: course.code, title: course.title }, semester: { name: semester.name } },
      ]);

      const response = await client.autocomplete["course-offerings"].get({ query: {} });

      expect(response.status).toBe(200);
      expect(response.data).toHaveLength(1);
      expect(response.data?.[0].id).toBe(offering.id);
      expect(response.data?.[0].label).toBe("[CS101] Intro - Fall 2025");
    });
  });

  describe("Authentication", () => {
    it("should return 401 for unauthenticated user", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockOtherAuth));

      const response = await client.autocomplete.courses.get({ query: {} });

      expect(response.status).toBe(401);
    });

    it("should allow student access to autocomplete", async () => {
      const client = treaty(autocompleteRoute(mockPrisma, mockCache, mockStudentAuth));

      mockPrisma.course.findMany.mockResolvedValueOnce([]);

      const response = await client.autocomplete.courses.get({ query: {} });

      expect(response.status).toBe(200);
    });
  });
});
