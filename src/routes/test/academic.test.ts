import { beforeEach, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import {
  mockAdminAuth, mockInstructorAuth, mockOtherAuth, mockStudentAuth
} from "@momoi/auth/mock";
import { MockCache } from "@momoi/cache/mock";
import { createMockPrisma } from "@momoi/database/test";
import {
  createMockCourse, createMockPlatformUser, createMockSemester, resetMockFactoryCounters
} from "@momoi/database/test/mock-factory";

import { academicRoute } from "../academic";

describe("Academic Route", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  it("should list instructor mailing entries", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    mockCache.getCacheValue.mockResolvedValueOnce(null);
    const mailingEntry = { id: 1, email: "prof@example.com", createdAt: new Date(), updatedAt: new Date() };
    mockPrisma.instructorSearch.count.mockResolvedValueOnce(1);
    mockPrisma.instructorSearch.findMany.mockResolvedValueOnce([mailingEntry]);

    const response = await client.academic["mailing-list"].get({
      query: { page: 1, pageSize: 10 },
    });

    expect(response.status).toBe(200);
    expect(response.data?.values).toHaveLength(1);
    expect(response.data?.values[0].email).toBe("prof@example.com");
  });

  it("should return cached instructors list", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const cached = {
      values: [{ id: 1, name: "Cached", email: "cached@example.com", role: "INSTRUCTOR", createdAt: new Date(), updatedAt: new Date() }],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
      pageSize: 10,
    };

    mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

    const response = await client.academic.instructors.get({ query: { page: 1, pageSize: 10 } });

    expect(response.status).toBe(200);
    expect(response.data?.values[0].email).toBe("cached@example.com");
    expect(mockPrisma.platformUser.findMany).not.toHaveBeenCalled();
  });

  it("should add mailing entry", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const created = { id: 9, email: "new@example.com", createdAt: new Date(), updatedAt: new Date() };
    mockPrisma.instructorSearch.create.mockResolvedValueOnce(created);

    const addRes = await client.academic["mailing-list"].post({ email: "new@example.com" });
    expect(addRes.status).toBe(200);
    expect(addRes.data?.id).toBe(9);
  });

  it("should remove mailing entry", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    mockPrisma.instructorSearch.delete.mockResolvedValueOnce({});
    const delRes = await client.academic["mailing-list"]({ mailingId: 9 }).delete();
    expect(delRes.status).toBe(200);
    expect(delRes.data?.success).toBe(true);
  });

  it("should list instructors", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const platformUser = createMockPlatformUser({ id: 1, role: "INSTRUCTOR" });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.platformUser.count.mockResolvedValueOnce(1);
    mockPrisma.platformUser.findMany.mockResolvedValueOnce([
      {
        id: platformUser.id,
        role: platformUser.role,
        createdAt: platformUser.createdAt,
        updatedAt: platformUser.updatedAt,
        user: { name: "Jane", email: "jane@example.com" },
      }
    ]);

    const response = await client.academic.instructors.get({ query: { page: 1, pageSize: 10 } });

    expect(response.status).toBe(200);
    expect(response.data?.values[0].email).toBe("jane@example.com");
  });

  it("should get instructor by id", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const course = createMockCourse({ id: 3 });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
      id: 4,
      role: "INSTRUCTOR",
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { name: "Prof", email: "prof@example.com" },
      courses: [course],
    });

    const getRes = await client.academic.instructors({ instructorId: 4 }).get();
    expect(getRes.status).toBe(200);
    expect(getRes.data?.courses[0].id).toBe(course.id);
  });

  it("should edit instructor", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const course = createMockCourse({ id: 3 });
    mockPrisma.platformUser.findUnique.mockResolvedValueOnce({ courses: [] });
    mockPrisma.platformUser.update.mockResolvedValueOnce({
      id: 4,
      role: "ADMIN",
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { name: "Prof", email: "prof@example.com" },
      courses: [course],
    });

    const editRes = await client.academic.instructors({ instructorId: 4 }).patch({ role: "ADMIN", courseIds: [course.id] });
    expect(editRes.status).toBe(200);
    expect(editRes.data?.role).toBe("ADMIN");
  });

  it("should add a course", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const course = createMockCourse({ id: 10 });
    mockPrisma.course.create.mockResolvedValueOnce(course);

    const response = await client.academic.courses.post({
      code: course.code,
      title: course.title,
      description: course.description ?? undefined,
    });

    expect(response.status).toBe(200);
    expect(response.data?.id).toBe(course.id);
  });

  it("should list courses", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const course = createMockCourse({ id: 11 });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.course.count.mockResolvedValueOnce(1);
    mockPrisma.course.findMany.mockResolvedValueOnce([course]);

    const response = await client.academic.courses.get({ query: { page: 1, pageSize: 5 } });
    expect(response.status).toBe(200);
    expect(response.data?.values[0].id).toBe(course.id);
  });

  it("should get course by id", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const course = createMockCourse({ id: 2 });
    const semester = createMockSemester({ id: 3 });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.course.findUnique.mockResolvedValueOnce({
      ...course,
      instructors: [
        { id: 7, role: "INSTRUCTOR", createdAt: new Date(), updatedAt: new Date(), user: { name: "Prof", email: "prof@example.com" } },
      ],
      courseOfferings: [
        { semester },
      ],
    });

    const response = await client.academic.courses({ courseId: 2 }).get();

    expect(response.status).toBe(200);
    expect(response.data?.id).toBe(2);
    expect(response.data?.semesters[0].id).toBe(semester.id);
    expect(response.data?.instructors[0].email).toBe("prof@example.com");
  });

  it("should return cached course by id", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const cached = {
      id: 2,
      code: "CS200",
      title: "Cached Course",
      description: undefined,
      instructors: [
        { id: 10, name: "Cached Prof", email: "cached@uni.edu", role: "INSTRUCTOR", createdAt: new Date(), updatedAt: new Date() },
      ],
      semesters: [
        { id: 5, name: "Fall", startDate: new Date(), endDate: new Date(), isCurrent: false, createdAt: new Date(), updatedAt: new Date() },
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

    const response = await client.academic.courses({ courseId: 2 }).get();

    expect(response.status).toBe(200);
    expect(response.data?.title).toBe("Cached Course");
    expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
  });

  it("should edit course", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    mockPrisma.course.update.mockResolvedValueOnce(createMockCourse({ id: 1, title: "Updated" }));
    const editRes = await client.academic.courses({ courseId: 1 }).patch({ title: "Updated" });
    expect(editRes.status).toBe(200);
    expect(editRes.data?.title).toBe("Updated");
  });

  it("should edit course instructors", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    mockPrisma.course.findUnique.mockResolvedValueOnce({ instructors: [] });
    mockPrisma.course.update.mockResolvedValueOnce({
      instructors: [
        { id: 1, role: "INSTRUCTOR", createdAt: new Date(), updatedAt: new Date(), user: { name: "Prof", email: "prof@example.com" } },
      ]
    });
    const instRes = await client.academic.courses({ courseId: 1 }).instructors.patch({ instructorIds: [1] });
    expect(instRes.status).toBe(200);
    expect(instRes.data?.instructors[0].id).toBe(1);
  });

  it("should edit course semesters", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const semesters = [createMockSemester({ id: 1 }), createMockSemester({ id: 2 })];
    mockPrisma.semester.findMany.mockResolvedValueOnce(semesters);
    mockPrisma.courseOffering.findMany.mockResolvedValueOnce([]);
    const semRes = await client.academic.courses({ courseId: 1 }).semesters.patch({ semesterIds: semesters.map((s) => s.id) });
    expect(semRes.status).toBe(200);
    expect(semRes.data?.semesters).toHaveLength(2);
  });

  it("should edit semester courses", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const courses = [createMockCourse({ id: 1 }), createMockCourse({ id: 2 })];
    mockPrisma.course.findMany.mockResolvedValueOnce(courses);
    mockPrisma.courseOffering.findMany.mockResolvedValueOnce([]);

    const response = await client.academic.semesters({ semesterId: 1 }).courses.patch({
      courseIds: courses.map((c) => c.id),
    });

    expect(response.status).toBe(200);
    expect(response.data?.courses).toHaveLength(2);
  });

  it("should list semesters", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const sem = createMockSemester({ id: 7, isCurrent: true });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.semester.count.mockResolvedValueOnce(1);
    mockPrisma.semester.findMany.mockResolvedValueOnce([sem]);

    const listRes = await client.academic.semesters.get({ query: { page: 1, pageSize: 10 } });
    expect(listRes.status).toBe(200);
    expect(listRes.data?.values[0].id).toBe(sem.id);
  });

  it("should get semester by id", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const sem = createMockSemester({ id: 8, isCurrent: true });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.semester.findUnique.mockResolvedValueOnce({
      ...sem,
      courseOfferings: [{ course: createMockCourse({ id: 5 }) }],
    });

    const getRes = await client.academic.semesters({ semesterId: sem.id }).get();
    expect(getRes.status).toBe(200);
    expect(getRes.data?.courses[0].id).toBe(5);
  });

  it("should get current semester", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const currentSem = createMockSemester({ id: 11, isCurrent: true });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.semester.findFirst.mockResolvedValueOnce(currentSem);

    const response = await client.academic.semesters.current.get();
    expect(response.status).toBe(200);
    expect(response.data?.isCurrent).toBe(true);
    expect(response.data?.name).toBeDefined();
  });

  it("should get current semester as instructor", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    const currentSem = createMockSemester({ id: 11, isCurrent: true });
    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.semester.findFirst.mockResolvedValueOnce(currentSem);

    const response = await client.academic.semesters.current.get();
    expect(response.status).toBe(200);
    expect(response.data?.isCurrent).toBe(true);
  });

  it("should return cached current semester", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const cached = {
      id: 12,
      name: "Fall 2025",
      startDate: new Date(),
      endDate: new Date(),
      isCurrent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

    const response = await client.academic.semesters.current.get();

    expect(response.status).toBe(200);
    expect(response.data?.name).toBe("Fall 2025");
    expect(response.data?.isCurrent).toBe(true);
    expect(mockPrisma.semester.findFirst).not.toHaveBeenCalled();
  });

  it("should return null when no current semester exists", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    mockCache.getCacheValue.mockResolvedValueOnce(null);
    mockPrisma.semester.findFirst.mockResolvedValueOnce(null);

    const response = await client.academic.semesters.current.get();

    expect(response.status).toBe(200);
    expect(response.data).toBeFalsy();
  });

  it("should add semester", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const sem = createMockSemester({ id: 9, isCurrent: false });
    mockPrisma.semester.create.mockResolvedValueOnce(sem);

    const addRes = await client.academic.semesters.post({ name: sem.name, startDate: sem.startDate, endDate: sem.endDate });
    expect(addRes.status).toBe(200);
    expect(addRes.data?.id).toBe(sem.id);
  });

  it("should edit semester", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const sem = createMockSemester({ id: 10, isCurrent: true });
    mockPrisma.semester.update.mockResolvedValueOnce({ ...sem, name: "Edited" });

    const editRes = await client.academic.semesters({ semesterId: sem.id }).patch({ name: "Edited" });
    expect(editRes.status).toBe(200);
    expect(editRes.data?.name).toBe("Edited");
  });

  it("should return cached semester by id", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const cached = {
      id: 9,
      name: "Spring 2030",
      startDate: new Date(),
      endDate: new Date(),
      isCurrent: false,
      courses: [
        { id: 1, code: "CS101", title: "Intro", description: "", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

    const response = await client.academic.semesters({ semesterId: 9 }).get();

    expect(response.status).toBe(200);
    expect(response.data?.name).toBe("Spring 2030");
    expect(mockPrisma.semester.findUnique).not.toHaveBeenCalled();
  });

  it("should delete semester", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockAdminAuth));

    mockPrisma.courseOffering.findMany.mockResolvedValueOnce([]);
    mockPrisma.courseOffering.deleteMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.semester.delete.mockResolvedValueOnce({});

    const response = await client.academic.semesters({ semesterId: 5 }).delete();

    expect(response.status).toBe(200);
    expect(response.data?.success).toBe(true);
  });

  it("should forbid instructor access", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    const response = await client.academic.courses.get();

    expect(response.status).toBe(403);
  });

  it("should forbid student access", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockStudentAuth));

    const response = await client.academic.courses.get();

    expect(response.status).toBe(403);
  });

  it("should return 401 for unauthorized user", async () => {
    const client = treaty(academicRoute(mockPrisma, mockCache as any, mockOtherAuth));

    const response = await client.academic.courses.get();

    expect(response.status).toBe(401);
  });
});
