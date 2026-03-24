import { describe, expect, it } from "bun:test";

import {
	createMockCourse,
	createMockCourseOffering,
	createMockPlatformUser,
	createMockPVETemplate,
	createMockSemester,
} from "@test/mocks";

import { setupTestContext } from "@test/e2e/setup";

/**
 * E2E Tests for Autocomplete Routes
 */
describe("E2E: Autocomplete Routes", () => {
	describe("GET /api/autocomplete/courses", () => {
		it("should return course options", async () => {
			const { client, mockPrisma } = setupTestContext("admin");

			const course = createMockCourse({ id: 1, code: "CS101", title: "Intro" });
			mockPrisma.course.findMany.mockResolvedValueOnce([course]);

			const response = await client.api.autocomplete.courses.get();

			expect(response.status).toBe(200);
			expect(response.data).toHaveLength(1);
			expect(response.data?.[0].label).toBe("[CS101] Intro");
		});
	});

	describe("GET /api/autocomplete/semesters", () => {
		it("should return semester options", async () => {
			const { client, mockPrisma } = setupTestContext("admin");

			const semester = createMockSemester({ id: 1, name: "Fall 2025" });
			mockPrisma.semester.findMany.mockResolvedValueOnce([semester]);

			const response = await client.api.autocomplete.semesters.get();

			expect(response.status).toBe(200);
			expect(response.data).toHaveLength(1);
			expect(response.data?.[0].label).toBe("Fall 2025");
		});
	});

	describe("GET /api/autocomplete/instructors", () => {
		it("should return instructor options", async () => {
			const { client, mockPrisma } = setupTestContext("admin");

			const instructor = createMockPlatformUser({ id: 1, role: "INSTRUCTOR" });
			mockPrisma.platformUser.findMany.mockResolvedValueOnce([
				{ ...instructor, user: { name: "Prof", email: "prof@example.com" } },
			]);

			const response = await client.api.autocomplete.instructors.get();

			expect(response.status).toBe(200);
			expect(response.data).toHaveLength(1);
			expect(response.data?.[0].label).toBe("Prof (prof@example.com)");
		});
	});

	describe("GET /api/autocomplete/templates", () => {
		it("should return template options", async () => {
			const { client, mockPrisma } = setupTestContext("admin");

			const template = createMockPVETemplate({ id: 1, name: "Ubuntu 22.04" });
			mockPrisma.pVETemplate.findMany.mockResolvedValueOnce([template]);

			const response = await client.api.autocomplete.templates.get();

			expect(response.status).toBe(200);
			expect(response.data).toHaveLength(1);
			expect(response.data?.[0].label).toBe("Ubuntu 22.04");
		});
	});

	describe("GET /api/autocomplete/course-offerings", () => {
		it("should return course offering options", async () => {
			const { client, mockPrisma } = setupTestContext("admin");

			const course = createMockCourse({ id: 1, code: "CS101", title: "Intro" });
			const semester = createMockSemester({ id: 1, name: "Fall 2025" });
			const offering = createMockCourseOffering({
				id: 1,
				courseId: course.id,
				semesterId: semester.id,
			});

			mockPrisma.courseOffering.findMany.mockResolvedValueOnce([
				{
					...offering,
					course: { code: course.code, title: course.title },
					semester: { name: semester.name },
				},
			]);

			const response = await client.api.autocomplete["course-offerings"].get();

			expect(response.status).toBe(200);
			expect(response.data).toHaveLength(1);
			expect(response.data?.[0].label).toBe("[CS101] Intro - Fall 2025");
		});
	});

	describe("Authentication", () => {
		it("should allow student access", async () => {
			const { client, mockPrisma } = setupTestContext("student");

			mockPrisma.course.findMany.mockResolvedValueOnce([]);

			const response = await client.api.autocomplete.courses.get();

			expect(response.status).toBe(200);
		});

		it("should deny unauthenticated access", async () => {
			const { client } = setupTestContext("unauthenticated");

			const response = await client.api.autocomplete.courses.get();

			expect(response.status).toBe(401);
		});
	});
});
