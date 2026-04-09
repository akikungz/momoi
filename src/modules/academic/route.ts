import { Elysia } from "elysia";

import type { AuthMacro } from "@momoi/auth";
import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database";
import { academicModel } from "@momoi/model/academic";

import { createAcademicUseCases } from ".";

export const academicRoute = (
	prisma: PrismaClient,
	cache: CacheModule,
	auth: AuthMacro,
) => {
	const useCases = createAcademicUseCases(prisma, cache);

	return new Elysia({ name: "academic.route", prefix: "/academic" })
		.use(auth)
		.use(academicModel)
		.get(
			"/semesters/current",
			async () => {
				return useCases.getCurrentSemester();
			},
			{
				response: "GetCurrentSemesterResponse",
				detail: {
					summary: "Get current semester",
					description:
						"Retrieve the current semester auto-detected by current date within semester date range",
					tags: ["Academic", "Semesters"],
				},
			},
		)
		.get("/semesters/next", async () => useCases.getNextSemester(), {
			response: "GetNextSemesterResponse",
			detail: {
				summary: "Get next semester",
				description: "Retrieve the next upcoming semester",
				tags: ["Academic", "Semesters"],
			},
		})
		.guard({ auth: true })
		.onBeforeHandle(({ user, status }) => {
			if (user.role !== "ADMIN") {
				return status(403, { status: 403, message: "Forbidden: Admins only" });
			}
		})
		.get(
			"/mailing-list",
			async ({ query }) => useCases.getInstructorMailingList(query),
			{
				query: "GetInstructorMailingListQuery",
				response: "GetInstructorMailingListResponse",
				detail: {
					summary: "Get instructor mailing list",
					description:
						"Retrieve the list of instructor email addresses for mailing purposes",
					tags: ["Academic", "Mailing List"],
				},
			},
		)
		.post(
			"/mailing-list",
			async ({ body }) => useCases.addInstructorMailingList(body),
			{
				body: "AddInstructorMailingListRequestBody",
				response: "AddInstructorMailingListResponse",
				detail: {
					summary: "Add instructor to mailing list",
					description: "Add a new instructor email address to the mailing list",
					tags: ["Academic", "Mailing List"],
				},
			},
		)
		.delete(
			"/mailing-list/:mailingId",
			async ({ params }) =>
				useCases.removeInstructorMailingList(params.mailingId),
			{
				params: "InstructorMailingListByIdRequestParams",
				response: "RemoveInstructorMailingListResponse",
				detail: {
					summary: "Remove instructor from mailing list",
					description:
						"Remove an instructor email address from the mailing list by ID",
					tags: ["Academic", "Mailing List"],
				},
			},
		)
		.get("/instructors", async ({ query }) => useCases.getInstructors(query), {
			query: "GetInstructorsRequestQuery",
			response: "GetInstructorsResponse",
			detail: {
				summary: "Get all instructors",
				description:
					"Retrieve a paginated list of all instructors in the system",
				tags: ["Academic", "Instructors"],
			},
		})
		.get(
			"/instructors/:instructorId",
			async ({ params }) =>
				useCases.getInstructorById(Number(params.instructorId)),
			{
				params: "InstructorByIdRequestParams",
				response: "GetInstructorByIdResponse",
				detail: {
					summary: "Get instructor by ID",
					description:
						"Retrieve detailed information about a specific instructor",
					tags: ["Academic", "Instructors"],
				},
			},
		)
		.patch(
			"/instructors/:instructorId",
			async ({ params, body }) =>
				useCases.editInstructorById(Number(params.instructorId), body),
			{
				params: "InstructorByIdRequestParams",
				body: "EditInstructorByIdRequestBody",
				response: "EditInstructorByIdResponse",
				detail: {
					summary: "Update instructor",
					description: "Update the information of a specific instructor by ID",
					tags: ["Academic", "Instructors"],
				},
			},
		)
		.get("/courses", async ({ query }) => useCases.getCourses(query), {
			query: "GetCoursesRequestQuery",
			response: "GetCoursesResponse",
			detail: {
				summary: "Get all courses",
				description: "Retrieve a paginated list of all courses in the system",
				tags: ["Academic", "Courses"],
			},
		})
		.get(
			"/courses/:courseId",
			async ({ params }) => useCases.getCourseById(params.courseId),
			{
				params: "CourseByIdRequestParams",
				response: "GetCourseByIdResponse",
				detail: {
					summary: "Get course by ID",
					description: "Retrieve detailed information about a specific course",
					tags: ["Academic", "Courses"],
				},
			},
		)
		.post("/courses", async ({ body }) => useCases.addCourse(body), {
			body: "AddCourseRequestBody",
			response: "AddCourseResponse",
			detail: {
				summary: "Create a new course",
				description: "Add a new course to the system",
				tags: ["Academic", "Courses"],
			},
		})
		.patch(
			"/courses/:courseId",
			async ({ params, body }) =>
				useCases.editCourseById(params.courseId, body),
			{
				params: "CourseByIdRequestParams",
				body: "EditCourseByIdRequestBody",
				response: "AddCourseResponse",
				detail: {
					summary: "Update course",
					description: "Update the information of a specific course by ID",
					tags: ["Academic", "Courses"],
				},
			},
		)
		.patch(
			"/courses/:courseId/instructors",
			async ({ params, body }) =>
				useCases.editCourseInstructors(params.courseId, body),
			{
				params: "CourseByIdRequestParams",
				body: "EditCourseInstructorRequestBody",
				response: "EditCourseInstructorResponse",
				detail: {
					summary: "Update course instructors",
					description: "Assign or update instructors for a specific course",
					tags: ["Academic", "Courses"],
				},
			},
		)
		.patch(
			"/courses/:courseId/semesters",
			async ({ params, body }) =>
				useCases.editCourseSemesters(params.courseId, body),
			{
				params: "CourseByIdRequestParams",
				body: "EditCourseSemesterRequestBody",
				response: "EditCourseSemesterResponse",
				detail: {
					summary: "Update course semesters",
					description: "Assign or update semesters for a specific course",
					tags: ["Academic", "Courses"],
				},
			},
		)
		.get("/semesters", async ({ query }) => useCases.getSemesters(query), {
			query: "GetSemestersRequestQuery",
			response: "GetSemestersResponse",
			detail: {
				summary: "Get all semesters",
				description: "Retrieve a paginated list of all semesters in the system",
				tags: ["Academic", "Semesters"],
			},
		})
		.get(
			"/semesters/:semesterId",
			async ({ params }) => useCases.getSemesterById(params.semesterId),
			{
				params: "SemesterByIdRequestParams",
				response: "GetSemesterByIdResponse",
				detail: {
					summary: "Get semester by ID",
					description:
						"Retrieve detailed information about a specific semester",
					tags: ["Academic", "Semesters"],
				},
			},
		)
		.post("/semesters", async ({ body }) => useCases.addSemester(body), {
			body: "AddSemesterRequestBody",
			response: "AddSemesterResponse",
			detail: {
				summary: "Create a new semester",
				description: "Add a new semester to the system",
				tags: ["Academic", "Semesters"],
			},
		})
		.patch(
			"/semesters/:semesterId",
			async ({ params, body }) =>
				useCases.editSemesterById(params.semesterId, body),
			{
				params: "SemesterByIdRequestParams",
				body: "EditSemesterByIdRequestBody",
				response: "EditSemesterByIdResponse",
				detail: {
					summary: "Update semester",
					description: "Update the information of a specific semester by ID",
					tags: ["Academic", "Semesters"],
				},
			},
		)
		.patch(
			"/semesters/:semesterId/courses",
			async ({ params, body }) =>
				useCases.editSemesterCourses(params.semesterId, body),
			{
				params: "SemesterByIdRequestParams",
				body: "EditSemesterCourseRequestBody",
				response: "EditSemesterCourseResponse",
				detail: {
					summary: "Update semester courses",
					description: "Assign or update courses for a specific semester",
					tags: ["Academic", "Semesters"],
				},
			},
		)
		.delete(
			"/semesters/:semesterId",
			async ({ params }) => useCases.deleteSemesterById(params.semesterId),
			{
				params: "SemesterByIdRequestParams",
				response: "DeleteSemesterByIdResponse",
				detail: {
					summary: "Delete semester",
					description: "Delete a specific semester from the system by ID",
					tags: ["Academic", "Semesters"],
				},
			},
		);
};
