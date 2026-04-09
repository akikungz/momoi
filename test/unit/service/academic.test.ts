import { beforeEach, describe, expect, it } from "bun:test";

import { MockCache } from "@momoi/cache/mock";
import { PrismaClientKnownRequestError } from "@momoi/database/prisma/generated/internal/prismaNamespace";
import {
	createMockCourse,
	createMockPrisma,
	createMockSemester,
	resetMockFactoryCounters,
} from "@test/mocks";

import { AcademicService } from "@momoi/service/academic";

describe("AcademicService", () => {
	let mockPrisma: any;
	let mockCache: MockCache;
	let service: AcademicService;

	beforeEach(() => {
		resetMockFactoryCounters();
		mockPrisma = createMockPrisma() as any;
		mockCache = new MockCache();
		service = new AcademicService(mockPrisma, mockCache as any);
	});

	describe("Instructor mailing list", () => {
		it("should list mailing entries with pagination", async () => {
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.instructorSearch.count.mockResolvedValueOnce(1);
			mockPrisma.instructorSearch.findMany.mockResolvedValueOnce([
				{
					id: 1,
					email: "john@example.com",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			]);

			const result = await service.getInstructorMailingList({
				page: 1,
				pageSize: 10,
			});

			expect(result.totalItems).toBe(1);
			expect(result.values[0].email).toBe("john@example.com");
			expect(mockCache.createCacheKey).toHaveBeenCalled();
		});

		it("should return cached mailing entries when present", async () => {
			const cached = {
				values: [],
				totalItems: 0,
				totalPages: 0,
				currentPage: 1,
				pageSize: 10,
			};
			mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

			const result = await service.getInstructorMailingList({
				page: 1,
				pageSize: 10,
			});

			expect(result.totalItems).toBe(0);
			expect(mockPrisma.instructorSearch.count).not.toHaveBeenCalled();
		});

		it("should add mailing entry and clear cache", async () => {
			const created = {
				id: 1,
				email: "john@example.com",
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockPrisma.instructorSearch.create.mockResolvedValueOnce(created);

			const result = await service.addInstructorMailingList({
				email: created.email,
			});

			expect(result.email).toBe(created.email);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:mailing:*",
			);
		});

		it("should throw on duplicate mailing entry (P2002)", async () => {
			const error = new PrismaClientKnownRequestError("dup", {
				code: "P2002",
				clientVersion: "0.0.1",
			});
			mockPrisma.instructorSearch.create.mockRejectedValueOnce(error);

			await expect(
				service.addInstructorMailingList({ email: "john@example.com" }),
			).rejects.toThrow("This email is already in the mailing list.");
		});

		it("should remove mailing entry and clear cache", async () => {
			mockPrisma.instructorSearch.delete.mockResolvedValueOnce({});

			const result = await service.removeInstructorMailingList(1);

			expect(result.success).toBe(true);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:mailing:*",
			);
		});

		it("should throw error when removing non-existent mailing entry", async () => {
			const error = new PrismaClientKnownRequestError("not found", {
				code: "P2025",
				clientVersion: "0.0.1",
			});
			mockPrisma.instructorSearch.delete.mockRejectedValueOnce(error);

			await expect(service.removeInstructorMailingList(999)).rejects.toThrow(
				"Mailing list entry not found.",
			);
		});
	});

	describe("Instructors", () => {
		it("should list instructors", async () => {
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.platformUser.count.mockResolvedValueOnce(1);
			mockPrisma.platformUser.findMany.mockResolvedValueOnce([
				{
					id: 1,
					role: "INSTRUCTOR",
					createdAt: new Date(),
					updatedAt: new Date(),
					user: { name: "Jane", email: "jane@example.com" },
				},
			]);

			const result = await service.getInstructors({ page: 1, pageSize: 10 });

			expect(result.totalItems).toBe(1);
			expect(result.values[0].name).toBe("Jane");
			expect(mockCache.createCacheKey).toHaveBeenCalled();
		});

		it("should get instructor by id", async () => {
			const course = createMockCourse({ id: 10 });
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
				id: 5,
				role: "INSTRUCTOR",
				createdAt: new Date(),
				updatedAt: new Date(),
				user: { name: "Jane", email: "jane@example.com" },
				courses: [course],
			});

			const result = await service.getInstructorById(5);

			expect(result.id).toBe(5);
			expect(result.courses[0].id).toBe(course.id);
			expect(mockCache.createCacheKey).toHaveBeenCalled();
		});

		it("should return cached instructor when present", async () => {
			const cached = {
				id: 5,
				name: "Jane",
				email: "jane@example.com",
				role: "INSTRUCTOR",
				courses: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

			const result = await service.getInstructorById(5);

			expect(result.id).toBe(5);
			expect(mockPrisma.platformUser.findUnique).not.toHaveBeenCalled();
		});

		it("should throw error when instructor not found", async () => {
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.platformUser.findUnique.mockResolvedValueOnce(null);

			await expect(service.getInstructorById(999)).rejects.toThrow(
				"Instructor not found.",
			);
		});

		it("should edit instructor and clear cache", async () => {
			const course = createMockCourse({ id: 5 });
			mockPrisma.platformUser.findUnique.mockResolvedValueOnce({
				courses: [{ id: course.id }],
			});
			mockPrisma.platformUser.update.mockResolvedValueOnce({
				id: 1,
				role: "ADMIN",
				createdAt: new Date(),
				updatedAt: new Date(),
				user: { name: "Jane", email: "jane@example.com" },
				courses: [course],
			});

			const result = await service.editInstructorById(1, {
				role: "ADMIN",
				courseIds: [5],
			});

			expect(result.role).toBe("ADMIN");
			expect(result.courses[0].id).toBe(course.id);
			expect(mockPrisma.platformUser.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 1 },
					data: expect.objectContaining({
						role: "ADMIN",
					}),
				}),
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:instructors:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:instructor:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:course:5",
			);
		});

		it("should throw error when editing non-existent instructor", async () => {
			mockPrisma.platformUser.findUnique.mockResolvedValueOnce(null);

			await expect(
				service.editInstructorById(999, { role: "ADMIN" }),
			).rejects.toThrow("Instructor not found.");
		});
	});

	describe("Courses", () => {
		it("should list courses", async () => {
			const course = createMockCourse({ id: 1 });
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.course.count.mockResolvedValueOnce(1);
			mockPrisma.course.findMany.mockResolvedValueOnce([course]);

			const result = await service.getCourses({ page: 1, pageSize: 10 });

			expect(result.values[0].id).toBe(course.id);
			expect(result.totalItems).toBe(1);
		});

		it("should get course by id", async () => {
			const course = createMockCourse({ id: 2 });
			const semester = createMockSemester({ id: 3, isCurrent: true });
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.course.findUnique.mockResolvedValueOnce({
				...course,
				instructors: [
					{
						id: 7,
						role: "INSTRUCTOR",
						createdAt: new Date(),
						updatedAt: new Date(),
						userId: "u-1",
						user: { name: "Prof", email: "prof@example.com" },
					},
				],
				courseOfferings: [{ semester }],
			});

			const result = await service.getCourseById(2);

			expect(result.id).toBe(course.id);
			expect(result.semesters[0].id).toBe(semester.id);
			expect(result.instructors[0].name).toBe("Prof");
			expect(mockCache.createCacheKey).toHaveBeenCalled();
		});

		it("should return cached course when present", async () => {
			const cached = {
				id: 2,
				code: "CS101",
				title: "Test",
				description: undefined,
				instructors: [],
				semesters: [],
				isActive: true,
				isProjectBased: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

			const result = await service.getCourseById(2);

			expect(result.id).toBe(2);
			expect(mockPrisma.course.findUnique).not.toHaveBeenCalled();
		});

		it("should throw error when course not found", async () => {
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.course.findUnique.mockResolvedValueOnce(null);

			await expect(service.getCourseById(999)).rejects.toThrow(
				"Course not found.",
			);
		});

		it("should add course and clear cache", async () => {
			const course = createMockCourse({ id: 9 });
			mockPrisma.course.create.mockResolvedValueOnce(course);

			const result = await service.addCourse({
				code: course.code,
				title: course.title,
				description: course.description ?? undefined,
			});

			expect(result.id).toBe(course.id);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:courses:*",
			);
		});

		it("should add project-based course", async () => {
			const course = createMockCourse({ id: 10, isProjectBased: true });
			mockPrisma.course.create.mockResolvedValueOnce(course);

			const result = await service.addCourse({
				code: course.code,
				title: course.title,
				description: course.description ?? undefined,
				isProjectBased: true,
			});

			expect(result.id).toBe(course.id);
			expect(result.isProjectBased).toBe(true);
		});

		it("should edit course instructors", async () => {
			mockPrisma.course.findUnique.mockResolvedValueOnce({
				instructors: [{ id: 2 }],
			});
			mockPrisma.course.update.mockResolvedValueOnce({
				instructors: [
					{
						id: 1,
						role: "INSTRUCTOR",
						createdAt: new Date(),
						updatedAt: new Date(),
						user: { name: "Prof", email: "prof@example.com" },
					},
				],
			});

			const result = await service.editCourseInstructors(1, {
				instructorIds: [1],
			});

			expect(result.instructors[0].email).toBe("prof@example.com");
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:instructors:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:courses:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:course:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:instructor:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:instructor:2",
			);
		});

		it("should edit course by id and clear cache", async () => {
			const course = createMockCourse({ id: 1 });
			mockPrisma.course.update.mockResolvedValueOnce(course);

			const result = await service.editCourseById(1, {
				title: "Updated Title",
			});

			expect(result.id).toBe(course.id);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:courses:*",
			);
		});

		it("should edit course to project-based", async () => {
			const course = createMockCourse({ id: 1, isProjectBased: true });
			mockPrisma.course.update.mockResolvedValueOnce(course);

			const result = await service.editCourseById(1, {
				isProjectBased: true,
			});

			expect(result.id).toBe(course.id);
			expect(result.isProjectBased).toBe(true);
		});

		it("should throw error when editing non-existent course", async () => {
			const error = new PrismaClientKnownRequestError("not found", {
				code: "P2025",
				clientVersion: "0.0.1",
			});
			mockPrisma.course.update.mockRejectedValueOnce(error);

			await expect(
				service.editCourseById(999, { title: "Updated" }),
			).rejects.toThrow("Course not found.");
		});

		it("should edit course semesters", async () => {
			const semesters = [
				createMockSemester({ id: 1 }),
				createMockSemester({ id: 2 }),
			];
			mockPrisma.semester.findMany.mockResolvedValueOnce(semesters);
			mockPrisma.courseOffering.findMany.mockResolvedValueOnce([]);

			const result = await service.editCourseSemesters(1, {
				semesterIds: semesters.map((s) => s.id),
			});

			expect(result.semesters).toHaveLength(2);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:courses:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semesters:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:course:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semester:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semester:2",
			);
		});

		it("should throw error when semester not found in editCourseSemesters", async () => {
			mockPrisma.semester.findMany.mockResolvedValueOnce([
				createMockSemester({ id: 1 }),
			]);

			await expect(
				service.editCourseSemesters(1, { semesterIds: [1, 2] }),
			).rejects.toThrow("One or more semesters not found.");
		});
	});

	describe("Semesters", () => {
			it("should get current semester by current date range", async () => {
				const semester = createMockSemester({ id: 99, isCurrent: true });
				mockCache.getCacheValue.mockResolvedValueOnce(null);
				mockPrisma.semester.findFirst.mockResolvedValueOnce(semester);

				const result = await service.getCurrentSemester();

				expect(result?.id).toBe(99);
				expect(result?.isCurrent).toBe(true);
				expect(mockPrisma.semester.findFirst).toHaveBeenCalledTimes(1);
			});

			it("should auto-detect current semester by date range", async () => {
				const now = new Date();
				const semester = createMockSemester({
					id: 100,
					isCurrent: false,
					startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
					endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
				});

				mockCache.getCacheValue.mockResolvedValueOnce(null);
				mockPrisma.semester.findFirst.mockResolvedValueOnce(semester);

				const result = await service.getCurrentSemester();

				expect(result?.id).toBe(100);
				expect(result?.isCurrent).toBe(true);
				expect(mockPrisma.semester.findFirst).toHaveBeenCalledTimes(1);
			});

		it("should list semesters", async () => {
			const semester = createMockSemester({ id: 1, isCurrent: false });
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.semester.count.mockResolvedValueOnce(1);
			mockPrisma.semester.findMany.mockResolvedValueOnce([semester]);

			const result = await service.getSemesters({ page: 1, pageSize: 10 });

			expect(result.values[0].id).toBe(semester.id);
			expect(result.totalItems).toBe(1);
		});

		it("should get semester by id", async () => {
			const semester = createMockSemester({ id: 2, isCurrent: true });
			const course = createMockCourse({ id: 4 });
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.semester.findUnique.mockResolvedValueOnce({
				...semester,
				courseOfferings: [{ course }],
			});

			const result = await service.getSemesterById(2);

			expect(result.id).toBe(semester.id);
			expect(result.courses[0].id).toBe(course.id);
			expect(mockCache.createCacheKey).toHaveBeenCalled();
		});

		it("should return cached semester when present", async () => {
			const cached = {
				id: 2,
				name: "Fall 2024",
				startDate: new Date(),
				endDate: new Date(),
				isCurrent: true,
				courses: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			mockCache.getCacheValue.mockResolvedValueOnce(JSON.stringify(cached));

			const result = await service.getSemesterById(2);

			expect(result.id).toBe(2);
			expect(mockPrisma.semester.findUnique).not.toHaveBeenCalled();
		});

		it("should throw error when semester not found", async () => {
			mockCache.getCacheValue.mockResolvedValueOnce(null);
			mockPrisma.semester.findUnique.mockResolvedValueOnce(null);

			await expect(service.getSemesterById(999)).rejects.toThrow(
				"Semester not found.",
			);
		});

		it("should add semester and clear cache", async () => {
			const semester = createMockSemester({ id: 5 });
			mockPrisma.semester.create.mockResolvedValueOnce(semester);

			const result = await service.addSemester({
				name: semester.name,
				startDate: semester.startDate,
				endDate: semester.endDate,
			});

			expect(result.id).toBe(semester.id);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semesters:*",
			);
		});

		it("should edit semester by id and clear cache", async () => {
			const semester = createMockSemester({ id: 1 });
			mockPrisma.semester.update.mockResolvedValueOnce(semester);

			const result = await service.editSemesterById(1, {
				name: "Updated Semester",
			});

			expect(result.id).toBe(semester.id);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semesters:*",
			);
		});

		it("should throw error when editing non-existent semester", async () => {
			const error = new PrismaClientKnownRequestError("not found", {
				code: "P2025",
				clientVersion: "0.0.1",
			});
			mockPrisma.semester.update.mockRejectedValueOnce(error);

			await expect(
				service.editSemesterById(999, { name: "Updated" }),
			).rejects.toThrow("Semester not found.");
		});

		it("should edit semester courses", async () => {
			const courses = [
				createMockCourse({ id: 1 }),
				createMockCourse({ id: 2 }),
			];
			mockPrisma.course.findMany.mockResolvedValueOnce(courses);
			mockPrisma.courseOffering.findMany.mockResolvedValueOnce([]);

			const result = await service.editSemesterCourses(1, {
				courseIds: courses.map((c) => c.id),
			});

			expect(result.courses).toHaveLength(2);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:courses:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semester:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:course:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:course:2",
			);
		});

		it("should throw error when course not found in editSemesterCourses", async () => {
			mockPrisma.course.findMany.mockResolvedValueOnce([
				createMockCourse({ id: 1 }),
			]);

			await expect(
				service.editSemesterCourses(1, { courseIds: [1, 2] }),
			).rejects.toThrow("One or more courses not found.");
		});

		it("should delete semester and clear cache", async () => {
			mockPrisma.courseOffering.findMany.mockResolvedValueOnce([
				{ courseId: 1 },
				{ courseId: 2 },
			]);
			mockPrisma.courseOffering.deleteMany.mockResolvedValueOnce({ count: 2 });
			mockPrisma.semester.delete.mockResolvedValueOnce({});

			const result = await service.deleteSemesterById(1);

			expect(result.success).toBe(true);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semesters:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:courses:*",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:semester:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:course:1",
			);
			expect(mockCache.deleteCacheByPattern).toHaveBeenCalledWith(
				"academic:course:2",
			);
		});

		it("should throw error when deleting non-existent semester", async () => {
			const error = new PrismaClientKnownRequestError("not found", {
				code: "P2025",
				clientVersion: "0.0.1",
			});
			mockPrisma.courseOffering.deleteMany.mockResolvedValueOnce({ count: 0 });
			mockPrisma.semester.delete.mockRejectedValueOnce(error);

			await expect(service.deleteSemesterById(999)).rejects.toThrow(
				"Semester not found.",
			);
		});
	});
});
