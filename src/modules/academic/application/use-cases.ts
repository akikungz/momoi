import type { Static } from "elysia";

import type {
	AddCourseRequestBody,
	AddInstructorMailingListRequestBody,
	AddSemesterRequestBody,
	AddSemesterResponse,
	EditCourseByIdRequestBody,
	EditCourseInstructorRequestBody,
	EditCourseInstructorResponse,
	EditCourseSemesterRequestBody,
	EditCourseSemesterResponse,
	EditInstructorByIdRequestBody,
	EditSemesterByIdRequestBody,
	EditSemesterCourseRequestBody,
	EditSemesterCourseResponse,
	GetCoursesRequestQuery,
	GetCurrentSemesterResponse,
	GetInstructorMailingListQuery,
	GetInstructorsRequestQuery,
	GetSemestersRequestQuery,
} from "@momoi/model/academic";
import {
	createPaginatedResponse,
	mapCourse,
	mapCourseDetail,
	mapInstructor,
	mapInstructorDetail,
	mapMailingListEntry,
	mapSemester,
	mapSemesterDetail,
} from "@momoi/service/academic/mappers";
import {
	COURSE_DETAIL_INCLUDE,
	INSTRUCTOR_DETAIL_SELECT,
	INSTRUCTOR_LIST_SELECT,
	MAILING_LIST_SELECT,
	SEMESTER_DETAIL_INCLUDE,
} from "@momoi/service/academic/selects";
import type {
	Course,
	CourseDetailResponse,
	CourseListResponse,
	CurrentSemesterResponse,
	InstructorDetailResponse,
	InstructorListResponse,
	MailingListEntry,
	MailingListResponse,
	Semester,
	SemesterDetailResponse,
	SemesterListResponse,
} from "@momoi/service/academic/types";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";
import { parsePagination } from "@momoi/utils/pagination";

import type { AcademicDataAccess, JsonCacheStore } from "./ports";
import { AcademicCacheKeys } from "../domain/cache-keys";

export class AcademicUseCases {
	constructor(
		private readonly dataAccess: AcademicDataAccess,
		private readonly cache: JsonCacheStore,
	) {}

	async getInstructorMailingList(
		query: Static<typeof GetInstructorMailingListQuery>,
	): Promise<MailingListResponse> {
		const { page, pageSize, skip, take } = parsePagination(query);
		const cacheKey = AcademicCacheKeys.mailingList(page, pageSize, query.email);
		const cached = await this.cache.get<MailingListResponse>(cacheKey);
		if (cached) return cached;

		const where = query.email
			? {
					email: { contains: query.email, mode: "insensitive" as const },
					havePlatformId: false,
				}
			: { havePlatformId: false };

		const [totalItems, entries] = await Promise.all([
			this.dataAccess.prisma.instructorSearch.count({ where }),
			this.dataAccess.prisma.instructorSearch.findMany({
				where,
				skip,
				take,
				orderBy: { createdAt: "desc" },
				select: MAILING_LIST_SELECT,
			}),
		]);

		const response = createPaginatedResponse(
			entries.map(mapMailingListEntry),
			totalItems,
			page,
			pageSize,
		);

		await this.cache.set(cacheKey, response);
		return response;
	}

	async addInstructorMailingList(
		body: Static<typeof AddInstructorMailingListRequestBody>,
	): Promise<MailingListEntry> {
		try {
			const created = await this.dataAccess.prisma.instructorSearch.create({
				data: { email: body.email },
				select: MAILING_LIST_SELECT,
			});

			await this.cache.invalidate(AcademicCacheKeys.mailingListPattern());
			return mapMailingListEntry(created);
		} catch (error: unknown) {
			handlePrismaError(error, "while adding instructor mailing list entry", {
				duplicateMessage: "This email is already in the mailing list.",
			});
		}
	}

	async removeInstructorMailingList(
		mailingId: number,
	): Promise<{ success: boolean }> {
		try {
			await this.dataAccess.prisma.instructorSearch.delete({
				where: { id: mailingId },
			});
			await this.cache.invalidate(AcademicCacheKeys.mailingListPattern());
			return { success: true };
		} catch (error: unknown) {
			handlePrismaError(error, "while removing instructor mailing list entry", {
				notFoundMessage: "Mailing list entry not found.",
			});
		}
	}

	async getInstructors(
		query: Static<typeof GetInstructorsRequestQuery>,
	): Promise<InstructorListResponse> {
		const { page, pageSize, skip, take } = parsePagination(query);
		const cacheKey = AcademicCacheKeys.instructorList(
			page,
			pageSize,
			query.name,
			query.email,
		);
		const cached = await this.cache.get<InstructorListResponse>(cacheKey);
		if (cached) return cached;

		// biome-ignore lint/suspicious/noExplicitAny: Dynamic where clause construction
		const where: any = { role: { not: "STUDENT" } };

		if (query.name || query.email) {
			where.user = {};
			if (query.name) {
				where.user.name = {
					contains: query.name,
					mode: "insensitive" as const,
				};
			}
			if (query.email) {
				where.user.email = {
					contains: query.email,
					mode: "insensitive" as const,
				};
			}
		}

		const [totalItems, instructors] = await Promise.all([
			this.dataAccess.prisma.platformUser.count({ where }),
			this.dataAccess.prisma.platformUser.findMany({
				where,
				skip,
				take,
				orderBy: { createdAt: "desc" },
				select: INSTRUCTOR_LIST_SELECT,
			}),
		]);

		const response = createPaginatedResponse(
			instructors.map(mapInstructor),
			totalItems,
			page,
			pageSize,
		);

		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	async getInstructorById(
		instructorId: number,
	): Promise<InstructorDetailResponse> {
		const cacheKey = AcademicCacheKeys.instructorDetail(instructorId);
		const cached = await this.cache.get<InstructorDetailResponse>(cacheKey);
		if (cached) return cached;

		const instructor = await this.dataAccess.prisma.platformUser.findUnique({
			where: { id: instructorId },
			select: INSTRUCTOR_DETAIL_SELECT,
		});

		if (!instructor) {
			throw new ServiceError("Instructor not found.", 404);
		}

		const response = mapInstructorDetail(instructor);
		await this.cache.set(cacheKey, response);
		return response;
	}

	async editInstructorById(
		instructorId: number,
		body: Static<typeof EditInstructorByIdRequestBody>,
	): Promise<InstructorDetailResponse> {
		const existing = await this.dataAccess.prisma.platformUser.findUnique({
			where: { id: instructorId },
			select: { id: true, courses: { select: { id: true } } },
		});

		if (!existing) {
			throw new ServiceError("Instructor not found.", 404);
		}

		try {
			const updated = await this.dataAccess.prisma.platformUser.update({
				where: { id: instructorId },
				data: {
					role: body.role ?? undefined,
					courses: {
						set: body.courseIds?.map((id) => ({ id })) ?? undefined,
					},
				},
				select: INSTRUCTOR_DETAIL_SELECT,
			});

			const affectedCourseIds = new Set([
				...existing.courses.map((course) => course.id),
				...updated.courses.map((course) => course.id),
			]);

			await Promise.all([
				this.cache.invalidate(AcademicCacheKeys.instructorListPattern()),
				this.cache.invalidate(AcademicCacheKeys.instructorDetail(instructorId)),
				this.cache.invalidate(AcademicCacheKeys.autocompleteInstructors()),
				...Array.from(affectedCourseIds).map((courseId) =>
					this.cache.invalidate(AcademicCacheKeys.courseDetail(courseId)),
				),
			]);

			return mapInstructorDetail(updated);
		} catch (error: unknown) {
			handlePrismaError(error, "while editing instructor", {
				notFoundMessage: "Instructor not found.",
			});
		}
	}

	async getCourses(
		query: Static<typeof GetCoursesRequestQuery>,
	): Promise<CourseListResponse> {
		const { page, pageSize, skip, take } = parsePagination(query);
		const cacheKey = AcademicCacheKeys.courseList(
			page,
			pageSize,
			query.code,
			query.title,
		);
		const cached = await this.cache.get<CourseListResponse>(cacheKey);
		if (cached) return cached;

		const where = {
			code: query.code
				? { contains: query.code, mode: "insensitive" as const }
				: undefined,
			title: query.title
				? { contains: query.title, mode: "insensitive" as const }
				: undefined,
		};

		const [totalItems, courses] = await Promise.all([
			this.dataAccess.prisma.course.count({ where }),
			this.dataAccess.prisma.course.findMany({
				where,
				skip,
				take,
				orderBy: { createdAt: "desc" },
			}),
		]);

		const response = createPaginatedResponse(
			courses.map(mapCourse),
			totalItems,
			page,
			pageSize,
		);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	async getCourseById(courseId: number): Promise<CourseDetailResponse> {
		const cacheKey = AcademicCacheKeys.courseDetail(courseId);
		const cached = await this.cache.get<CourseDetailResponse>(cacheKey);
		if (cached) return cached;

		const course = await this.dataAccess.prisma.course.findUnique({
			where: { id: courseId },
			include: COURSE_DETAIL_INCLUDE,
		});

		if (!course) {
			throw new ServiceError("Course not found.", 404);
		}

		const response = mapCourseDetail(course);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	async addCourse(body: Static<typeof AddCourseRequestBody>): Promise<Course> {
		const created = await this.dataAccess.prisma.course.create({
			data: {
				code: body.code,
				title: body.title,
				description: body.description ?? undefined,
			},
		});

		await Promise.all([
			this.cache.invalidate(AcademicCacheKeys.courseListPattern()),
			this.cache.invalidate(AcademicCacheKeys.autocompleteCourses()),
			this.cache.invalidate(AcademicCacheKeys.autocompleteOfferings()),
		]);

		return mapCourse(created);
	}

	async editCourseById(
		courseId: number,
		body: Static<typeof EditCourseByIdRequestBody>,
	): Promise<Course> {
		try {
			const updated = await this.dataAccess.prisma.course.update({
				where: { id: courseId },
				data: {
					code: body.code ?? undefined,
					title: body.title ?? undefined,
					description: body.description ?? undefined,
					isActive: body.isActive ?? undefined,
				},
			});

			await Promise.all([
				this.cache.invalidate(AcademicCacheKeys.courseListPattern()),
				this.cache.invalidate(AcademicCacheKeys.courseDetail(courseId)),
				this.cache.invalidate(AcademicCacheKeys.autocompleteCourses()),
				this.cache.invalidate(AcademicCacheKeys.autocompleteOfferings()),
			]);

			return mapCourse(updated);
		} catch (error: unknown) {
			handlePrismaError(error, "while editing course", {
				notFoundMessage: "Course not found.",
			});
		}
	}

	async editCourseInstructors(
		courseId: number,
		body: Static<typeof EditCourseInstructorRequestBody>,
	): Promise<Static<typeof EditCourseInstructorResponse>> {
		const existing = await this.dataAccess.prisma.course.findUnique({
			where: { id: courseId },
			select: { instructors: { select: { id: true } } },
		});

		if (!existing) {
			throw new ServiceError("Course not found.", 404);
		}

		try {
			const updated = await this.dataAccess.prisma.course.update({
				where: { id: courseId },
				data: {
					instructors: {
						set: body.instructorIds.map((id) => ({ id })),
					},
				},
				include: {
					instructors: {
						include: { user: true },
					},
				},
			});

			const affectedInstructorIds = new Set([
				...existing.instructors.map((inst) => inst.id),
				...body.instructorIds,
			]);

			await Promise.all([
				this.cache.invalidate(AcademicCacheKeys.instructorListPattern()),
				this.cache.invalidate(AcademicCacheKeys.courseListPattern()),
				this.cache.invalidate(AcademicCacheKeys.courseDetail(courseId)),
				this.cache.invalidate(AcademicCacheKeys.autocompleteInstructors()),
				...Array.from(affectedInstructorIds).map((id) =>
					this.cache.invalidate(AcademicCacheKeys.instructorDetail(id)),
				),
			]);

			return {
				instructors: updated.instructors.map(mapInstructor),
			};
		} catch (error: unknown) {
			handlePrismaError(error, "while updating course instructors", {
				notFoundMessage: "Course not found.",
			});
		}
	}

	async editCourseSemesters(
		courseId: number,
		body: Static<typeof EditCourseSemesterRequestBody>,
	): Promise<Static<typeof EditCourseSemesterResponse>> {
		const semesters = await this.dataAccess.prisma.semester.findMany({
			where: { id: { in: body.semesterIds } },
		});

		if (semesters.length !== body.semesterIds.length) {
			throw new ServiceError("One or more semesters not found.", 404);
		}

		try {
			const existingOfferings =
				await this.dataAccess.prisma.courseOffering.findMany({
					where: { courseId },
					select: { semesterId: true },
				});
			const existingIds = new Set(
				existingOfferings.map((offering) => offering.semesterId),
			);
			const affectedSemesterIds = new Set([
				...existingIds,
				...body.semesterIds,
			]);

			await this.dataAccess.prisma.$transaction([
				this.dataAccess.prisma.courseOffering.deleteMany({
					where: {
						courseId,
						semesterId: { notIn: body.semesterIds },
					},
				}),
				this.dataAccess.prisma.courseOffering.createMany({
					data: body.semesterIds
						.filter((id) => !existingIds.has(id))
						.map((semesterId) => ({ courseId, semesterId })),
				}),
			]);

			await Promise.all([
				this.cache.invalidate(AcademicCacheKeys.courseListPattern()),
				this.cache.invalidate(AcademicCacheKeys.semesterListPattern()),
				this.cache.invalidate(AcademicCacheKeys.courseDetail(courseId)),
				this.cache.invalidate(AcademicCacheKeys.autocompleteOfferings()),
				...Array.from(affectedSemesterIds).map((id) =>
					this.cache.invalidate(AcademicCacheKeys.semesterDetail(id)),
				),
			]);

			return {
				semesters: semesters.map(mapSemester),
			};
		} catch (error: unknown) {
			handlePrismaError(error, "while updating course semesters", {
				notFoundMessage: "Course not found.",
			});
		}
	}

	async getSemesters(
		query: Static<typeof GetSemestersRequestQuery>,
	): Promise<SemesterListResponse> {
		const { page, pageSize, skip, take } = parsePagination(query);
		const cacheKey = AcademicCacheKeys.semesterList(
			page,
			pageSize,
			query.name,
			query.dateFrom,
			query.dateTo,
		);
		const cached = await this.cache.get<SemesterListResponse>(cacheKey);
		if (cached) return cached;

		const where = {
			name: query.name
				? { contains: query.name, mode: "insensitive" as const }
				: undefined,
			startDate: query.dateFrom ? { gte: query.dateFrom } : undefined,
			endDate: query.dateTo ? { lte: query.dateTo } : undefined,
		};

		const [totalItems, semesters] = await Promise.all([
			this.dataAccess.prisma.semester.count({ where }),
			this.dataAccess.prisma.semester.findMany({
				where,
				skip,
				take,
				orderBy: { startDate: "desc" },
			}),
		]);

		const response = createPaginatedResponse(
			semesters.map(mapSemester),
			totalItems,
			page,
			pageSize,
		);

		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	async getSemesterById(semesterId: number): Promise<SemesterDetailResponse> {
		const cacheKey = AcademicCacheKeys.semesterDetail(semesterId);
		const cached = await this.cache.get<SemesterDetailResponse>(cacheKey);
		if (cached) return cached;

		const semester = await this.dataAccess.prisma.semester.findUnique({
			where: { id: semesterId },
			include: SEMESTER_DETAIL_INCLUDE,
		});

		if (!semester) {
			throw new ServiceError("Semester not found.", 404);
		}

		const response = mapSemesterDetail(semester);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	async getCurrentSemester(): Promise<CurrentSemesterResponse> {
		const cacheKey = AcademicCacheKeys.semesterCurrent();
		const cached = await this.cache.get<
			Static<typeof GetCurrentSemesterResponse> | "null"
		>(cacheKey);
		if (cached !== null) {
			return cached === "null" ? null : cached;
		}

		const semester = await this.dataAccess.prisma.semester.findFirst({
			where: { isCurrent: true },
		});

		if (!semester) {
			await this.cache.set(cacheKey, "null", 600);
			return null;
		}

		const response = mapSemester(semester);
		await this.cache.set(cacheKey, response, 600);
		return response;
	}

	async addSemester(
		body: Static<typeof AddSemesterRequestBody>,
	): Promise<Static<typeof AddSemesterResponse>> {
		const created = await this.dataAccess.prisma.semester.create({
			data: {
				name: body.name,
				startDate: body.startDate,
				endDate: body.endDate,
			},
		});

		await Promise.all([
			this.cache.invalidate(AcademicCacheKeys.semesterListPattern()),
			this.cache.invalidate(AcademicCacheKeys.autocompleteSemesters()),
		]);

		return created;
	}

	async editSemesterById(
		semesterId: number,
		body: Static<typeof EditSemesterByIdRequestBody>,
	): Promise<Semester> {
		try {
			const updated = await this.dataAccess.prisma.semester.update({
				where: { id: semesterId },
				data: {
					name: body.name ?? undefined,
					startDate: body.startDate ?? undefined,
					endDate: body.endDate ?? undefined,
					isCurrent: body.isCurrent ?? undefined,
				},
			});

			if (updated.isCurrent) {
				await this.dataAccess.prisma.semester.updateMany({
					where: { id: { not: semesterId }, isCurrent: true },
					data: { isCurrent: false },
				});

				await this.cache.invalidate(AcademicCacheKeys.semesterCurrent());
			}

			await Promise.all([
				this.cache.invalidate(AcademicCacheKeys.semesterListPattern()),
				this.cache.invalidate(AcademicCacheKeys.semesterDetail(semesterId)),
				this.cache.invalidate(AcademicCacheKeys.autocompleteSemesters()),
				this.cache.invalidate(AcademicCacheKeys.autocompleteOfferings()),
			]);

			return mapSemester(updated);
		} catch (error: unknown) {
			handlePrismaError(error, "while editing semester", {
				notFoundMessage: "Semester not found.",
			});
		}
	}

	async editSemesterCourses(
		semesterId: number,
		body: Static<typeof EditSemesterCourseRequestBody>,
	): Promise<Static<typeof EditSemesterCourseResponse>> {
		const courses = await this.dataAccess.prisma.course.findMany({
			where: { id: { in: body.courseIds } },
		});

		if (courses.length !== body.courseIds.length) {
			throw new ServiceError("One or more courses not found.", 404);
		}

		try {
			const existingOfferings =
				await this.dataAccess.prisma.courseOffering.findMany({
					where: { semesterId },
					select: { courseId: true },
				});
			const existingIds = new Set(
				existingOfferings.map((offering) => offering.courseId),
			);
			const affectedCourseIds = new Set([...existingIds, ...body.courseIds]);

			await this.dataAccess.prisma.$transaction([
				this.dataAccess.prisma.courseOffering.deleteMany({
					where: {
						semesterId,
						courseId: { notIn: body.courseIds },
					},
				}),
				this.dataAccess.prisma.courseOffering.createMany({
					data: body.courseIds
						.filter((id) => !existingIds.has(id))
						.map((courseId) => ({ courseId, semesterId })),
				}),
			]);

			await Promise.all([
				this.cache.invalidate(AcademicCacheKeys.courseListPattern()),
				this.cache.invalidate(AcademicCacheKeys.semesterListPattern()),
				this.cache.invalidate(AcademicCacheKeys.semesterDetail(semesterId)),
				this.cache.invalidate(AcademicCacheKeys.autocompleteOfferings()),
				...Array.from(affectedCourseIds).map((id) =>
					this.cache.invalidate(AcademicCacheKeys.courseDetail(id)),
				),
			]);

			return {
				courses: courses.map(mapCourse),
			};
		} catch (error: unknown) {
			handlePrismaError(error, "while updating semester courses", {
				notFoundMessage: "Semester not found.",
			});
		}
	}

	async deleteSemesterById(semesterId: number): Promise<{ success: boolean }> {
		try {
			const courseOfferings =
				await this.dataAccess.prisma.courseOffering.findMany({
					where: { semesterId },
					select: { courseId: true },
				});
			const affectedCourseIds = new Set(
				courseOfferings.map((offering) => offering.courseId),
			);

			await this.dataAccess.prisma.$transaction([
				this.dataAccess.prisma.courseOffering.deleteMany({
					where: { semesterId },
				}),
				this.dataAccess.prisma.semester.delete({ where: { id: semesterId } }),
			]);

			await Promise.all([
				this.cache.invalidate(AcademicCacheKeys.semesterListPattern()),
				this.cache.invalidate(AcademicCacheKeys.courseListPattern()),
				this.cache.invalidate(AcademicCacheKeys.semesterDetail(semesterId)),
				this.cache.invalidate(AcademicCacheKeys.autocompleteSemesters()),
				this.cache.invalidate(AcademicCacheKeys.autocompleteOfferings()),
				...Array.from(affectedCourseIds).map((id) =>
					this.cache.invalidate(AcademicCacheKeys.courseDetail(id)),
				),
			]);

			return { success: true };
		} catch (error: unknown) {
			handlePrismaError(error, "while deleting semester", {
				notFoundMessage: "Semester not found.",
			});
		}
	}
}
