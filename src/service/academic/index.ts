import { Static } from "elysia";

import {
    AddCourseRequestBody,
    AddCourseResponse,
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
    GetInstructorMailingListQuery,
    GetInstructorsRequestQuery,
    GetSemestersRequestQuery,
} from "@momoi/model/academic";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";
import { parsePagination } from "@momoi/utils/pagination";

import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";

import {
    createPaginatedResponse,
    mapCourse,
    mapCourseDetail,
    mapInstructor,
    mapInstructorDetail,
    mapMailingListEntry,
    mapSemester,
    mapSemesterDetail,
} from "./mappers";
import {
    COURSE_DETAIL_INCLUDE,
    INSTRUCTOR_DETAIL_SELECT,
    INSTRUCTOR_LIST_SELECT,
    MAILING_LIST_SELECT,
    SEMESTER_DETAIL_INCLUDE,
} from "./selects";
import {
    AcademicCacheKeys,
    Course,
    CourseDetailResponse,
    CourseListResponse,
    CurrentSemesterResponse,
    Instructor,
    InstructorDetailResponse,
    InstructorListResponse,
    MailingListEntry,
    MailingListResponse,
    Semester,
    SemesterDetailResponse,
    SemesterListResponse,
} from "./types";

export class AcademicService {
    constructor(
        private prisma: PrismaClient,
        private cache: CacheModule
    ) { }

    // -------------------- Instructor Mailing List --------------------

    public async getInstructorMailingList(
        query: Static<typeof GetInstructorMailingListQuery>
    ): Promise<MailingListResponse> {
        const { page, pageSize, skip, take } = parsePagination(query);
        const cacheKey = AcademicCacheKeys.mailingList(page, pageSize, query.email);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const where = query.email
            ? { email: { contains: query.email, mode: "insensitive" as const }, havePlatformId: false }
            : { havePlatformId: false };

        const [totalItems, entries] = await Promise.all([
            this.prisma.instructorSearch.count({ where }),
            this.prisma.instructorSearch.findMany({
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
            pageSize
        );

        await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
        return response;
    }

    public async addInstructorMailingList(
        body: Static<typeof AddInstructorMailingListRequestBody>
    ): Promise<MailingListEntry> {
        try {
            const created = await this.prisma.instructorSearch.create({
                data: { email: body.email },
                select: MAILING_LIST_SELECT,
            });

            await this.cache.deleteCacheByPattern(AcademicCacheKeys.mailingListPattern());
            return mapMailingListEntry(created);
        } catch (error: unknown) {
            handlePrismaError(error, "while adding instructor mailing list entry", {
                duplicateMessage: "This email is already in the mailing list.",
            });
        }
    }

    public async removeInstructorMailingList(mailingId: number): Promise<{ success: boolean }> {
        try {
            await this.prisma.instructorSearch.delete({ where: { id: mailingId } });
            await this.cache.deleteCacheByPattern(AcademicCacheKeys.mailingListPattern());
            return { success: true };
        } catch (error: unknown) {
            handlePrismaError(error, "while removing instructor mailing list entry", {
                notFoundMessage: "Mailing list entry not found.",
            });
        }
    }

    // -------------------- Instructors --------------------

    public async getInstructors(
        query: Static<typeof GetInstructorsRequestQuery>
    ): Promise<InstructorListResponse> {
        const { page, pageSize, skip, take } = parsePagination(query);
        const cacheKey = AcademicCacheKeys.instructorList(page, pageSize, query.name, query.email);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const where: any = { role: { not: "STUDENT" } };

        if (query.name || query.email) {
            where.user = {};
            if (query.name) {
                where.user.name = { contains: query.name, mode: "insensitive" as const };
            }
            if (query.email) {
                where.user.email = { contains: query.email, mode: "insensitive" as const };
            }
        }

        const [totalItems, instructors] = await Promise.all([
            this.prisma.platformUser.count({ where }),
            this.prisma.platformUser.findMany({
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
            pageSize
        );

        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    public async getInstructorById(instructorId: number): Promise<InstructorDetailResponse> {
        const cacheKey = AcademicCacheKeys.instructorDetail(instructorId);
        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const instructor = await this.prisma.platformUser.findUnique({
            where: { id: instructorId },
            select: INSTRUCTOR_DETAIL_SELECT,
        });

        if (!instructor) {
            throw new ServiceError("Instructor not found.", 404);
        }

        const response = mapInstructorDetail(instructor);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
        return response;
    }

    public async editInstructorById(
        instructorId: number,
        body: Static<typeof EditInstructorByIdRequestBody>
    ): Promise<InstructorDetailResponse> {
        const existing = await this.prisma.platformUser.findUnique({
            where: { id: instructorId },
            select: { id: true, courses: { select: { id: true } } },
        });

        if (!existing) {
            throw new ServiceError("Instructor not found.", 404);
        }

        try {
            const updated = await this.prisma.platformUser.update({
                where: { id: instructorId },
                data: {
                    role: existing.id !== instructorId ? body.role ?? undefined : undefined,
                    courses: {
                        set: body.courseIds?.map((id) => ({ id })) ?? undefined,
                    },
                },
                select: INSTRUCTOR_DETAIL_SELECT,
            });

            const affectedCourseIds = new Set([
                ...existing.courses.map((c) => c.id),
                ...updated.courses.map((c) => c.id),
            ]);

            await Promise.all([
                this.cache.deleteCacheByPattern(AcademicCacheKeys.instructorListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.instructorDetail(instructorId)),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteInstructors()),
                ...Array.from(affectedCourseIds).map((courseId) =>
                    this.cache.deleteCacheByPattern(AcademicCacheKeys.courseDetail(courseId))
                ),
            ]);

            return mapInstructorDetail(updated);
        } catch (error: unknown) {
            handlePrismaError(error, "while editing instructor", {
                notFoundMessage: "Instructor not found.",
            });
        }
    }

    // -------------------- Courses --------------------

    public async getCourses(
        query: Static<typeof GetCoursesRequestQuery>
    ): Promise<CourseListResponse> {
        const { page, pageSize, skip, take } = parsePagination(query);
        const cacheKey = AcademicCacheKeys.courseList(page, pageSize, query.code, query.title);

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const where = {
            code: query.code ? { contains: query.code, mode: "insensitive" as const } : undefined,
            title: query.title ? { contains: query.title, mode: "insensitive" as const } : undefined,
        };

        const [totalItems, courses] = await Promise.all([
            this.prisma.course.count({ where }),
            this.prisma.course.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const response = createPaginatedResponse(courses.map(mapCourse), totalItems, page, pageSize);

        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    public async getCourseById(courseId: number): Promise<CourseDetailResponse> {
        const cacheKey = AcademicCacheKeys.courseDetail(courseId);
        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: COURSE_DETAIL_INCLUDE,
        });

        if (!course) {
            throw new ServiceError("Course not found.", 404);
        }

        const response = mapCourseDetail(course);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    public async addCourse(body: Static<typeof AddCourseRequestBody>): Promise<Course> {
        const created = await this.prisma.course.create({
            data: {
                code: body.code,
                title: body.title,
                description: body.description ?? undefined,
            },
        });

        await Promise.all([
            this.cache.deleteCacheByPattern(AcademicCacheKeys.courseListPattern()),
            this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteCourses()),
            this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteOfferings()),
        ]);

        return mapCourse(created);
    }

    public async editCourseById(
        courseId: number,
        body: Static<typeof EditCourseByIdRequestBody>
    ): Promise<Course> {
        try {
            const updated = await this.prisma.course.update({
                where: { id: courseId },
                data: {
                    code: body.code ?? undefined,
                    title: body.title ?? undefined,
                    description: body.description ?? undefined,
                    isActive: body.isActive ?? undefined,
                },
            });

            await Promise.all([
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseDetail(courseId)),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteCourses()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteOfferings()),
            ]);

            return mapCourse(updated);
        } catch (error: unknown) {
            handlePrismaError(error, "while editing course", {
                notFoundMessage: "Course not found.",
            });
        }
    }

    public async editCourseInstructors(
        courseId: number,
        body: Static<typeof EditCourseInstructorRequestBody>
    ): Promise<Static<typeof EditCourseInstructorResponse>> {
        const existing = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { instructors: { select: { id: true } } },
        });

        if (!existing) {
            throw new ServiceError("Course not found.", 404);
        }

        try {
            const updated = await this.prisma.course.update({
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
                this.cache.deleteCacheByPattern(AcademicCacheKeys.instructorListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseDetail(courseId)),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteInstructors()),
                ...Array.from(affectedInstructorIds).map((id) =>
                    this.cache.deleteCacheByPattern(AcademicCacheKeys.instructorDetail(id))
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

    public async editCourseSemesters(
        courseId: number,
        body: Static<typeof EditCourseSemesterRequestBody>
    ): Promise<Static<typeof EditCourseSemesterResponse>> {
        const semesters = await this.prisma.semester.findMany({
            where: { id: { in: body.semesterIds } },
        });

        if (semesters.length !== body.semesterIds.length) {
            throw new ServiceError("One or more semesters not found.", 404);
        }

        try {
            const existingOfferings = await this.prisma.courseOffering.findMany({
                where: { courseId },
                select: { semesterId: true },
            });
            const existingIds = new Set(existingOfferings.map((co) => co.semesterId));
            const affectedSemesterIds = new Set([...existingIds, ...body.semesterIds]);

            await this.prisma.$transaction([
                this.prisma.courseOffering.deleteMany({
                    where: {
                        courseId,
                        semesterId: { notIn: body.semesterIds },
                    },
                }),
                this.prisma.courseOffering.createMany({
                    data: body.semesterIds
                        .filter((id) => !existingIds.has(id))
                        .map((semesterId) => ({ courseId, semesterId })),
                }),
            ]);

            await Promise.all([
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseDetail(courseId)),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteOfferings()),
                ...Array.from(affectedSemesterIds).map((id) =>
                    this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterDetail(id))
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

    // -------------------- Semesters --------------------

    public async getSemesters(
        query: Static<typeof GetSemestersRequestQuery>
    ): Promise<SemesterListResponse> {
        const { page, pageSize, skip, take } = parsePagination(query);
        const cacheKey = AcademicCacheKeys.semesterList(
            page,
            pageSize,
            query.name,
            query.dateFrom,
            query.dateTo
        );

        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const where = {
            name: query.name ? { contains: query.name, mode: "insensitive" as const } : undefined,
            startDate: query.dateFrom ? { gte: query.dateFrom } : undefined,
            endDate: query.dateTo ? { lte: query.dateTo } : undefined,
        };

        const [totalItems, semesters] = await Promise.all([
            this.prisma.semester.count({ where }),
            this.prisma.semester.findMany({
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
            pageSize
        );

        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    public async getSemesterById(semesterId: number): Promise<SemesterDetailResponse> {
        const cacheKey = AcademicCacheKeys.semesterDetail(semesterId);
        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) return JSON.parse(cached);

        const semester = await this.prisma.semester.findUnique({
            where: { id: semesterId },
            include: SEMESTER_DETAIL_INCLUDE,
        });

        if (!semester) {
            throw new ServiceError("Semester not found.", 404);
        }

        const response = mapSemesterDetail(semester);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    public async getCurrentSemester(): Promise<CurrentSemesterResponse> {
        const cacheKey = AcademicCacheKeys.semesterCurrent();
        const cached = await this.cache.getCacheValue(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            return parsed === "null" ? null : parsed;
        }

        const semester = await this.prisma.semester.findFirst({
            where: { isCurrent: true },
        });

        if (!semester) {
            await this.cache.createCacheKey(cacheKey, JSON.stringify(null), 600);
            return null;
        }

        const response = mapSemester(semester);
        await this.cache.createCacheKey(cacheKey, JSON.stringify(response), 600);
        return response;
    }

    public async addSemester(
        body: Static<typeof AddSemesterRequestBody>
    ): Promise<Static<typeof AddSemesterResponse>> {
        const created = await this.prisma.semester.create({
            data: {
                name: body.name,
                startDate: body.startDate,
                endDate: body.endDate,
            },
        });

        await Promise.all([
            this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterListPattern()),
            this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteSemesters()),
        ]);

        return created;
    }

    public async editSemesterById(
        semesterId: number,
        body: Static<typeof EditSemesterByIdRequestBody>
    ): Promise<Semester> {
        try {
            const updated = await this.prisma.semester.update({
                where: { id: semesterId },
                data: {
                    name: body.name ?? undefined,
                    startDate: body.startDate ?? undefined,
                    endDate: body.endDate ?? undefined,
                    isCurrent: body.isCurrent ?? undefined,
                },
            });

            if (updated.isCurrent) {
                await this.prisma.semester.updateMany({
                    where: { id: { not: semesterId }, isCurrent: true },
                    data: { isCurrent: false },
                });

                await this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterCurrent());
            }

            await Promise.all([
                this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterDetail(semesterId)),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteSemesters()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteOfferings()),
            ]);

            return mapSemester(updated);
        } catch (error: unknown) {
            handlePrismaError(error, "while editing semester", {
                notFoundMessage: "Semester not found.",
            });
        }
    }

    public async editSemesterCourses(
        semesterId: number,
        body: Static<typeof EditSemesterCourseRequestBody>
    ): Promise<Static<typeof EditSemesterCourseResponse>> {
        const courses = await this.prisma.course.findMany({
            where: { id: { in: body.courseIds } },
        });

        if (courses.length !== body.courseIds.length) {
            throw new ServiceError("One or more courses not found.", 404);
        }

        try {
            const existingOfferings = await this.prisma.courseOffering.findMany({
                where: { semesterId },
                select: { courseId: true },
            });
            const existingIds = new Set(existingOfferings.map((co) => co.courseId));
            const affectedCourseIds = new Set([...existingIds, ...body.courseIds]);

            await this.prisma.$transaction([
                this.prisma.courseOffering.deleteMany({
                    where: {
                        semesterId,
                        courseId: { notIn: body.courseIds },
                    },
                }),
                this.prisma.courseOffering.createMany({
                    data: body.courseIds
                        .filter((id) => !existingIds.has(id))
                        .map((courseId) => ({ courseId, semesterId })),
                }),
            ]);

            await Promise.all([
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterDetail(semesterId)),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteOfferings()),
                ...Array.from(affectedCourseIds).map((id) =>
                    this.cache.deleteCacheByPattern(AcademicCacheKeys.courseDetail(id))
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

    public async deleteSemesterById(semesterId: number): Promise<{ success: boolean }> {
        try {
            const courseOfferings = await this.prisma.courseOffering.findMany({
                where: { semesterId },
                select: { courseId: true },
            });
            const affectedCourseIds = new Set(courseOfferings.map((co) => co.courseId));

            await this.prisma.$transaction([
                this.prisma.courseOffering.deleteMany({ where: { semesterId } }),
                this.prisma.semester.delete({ where: { id: semesterId } }),
            ]);

            await Promise.all([
                this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.courseListPattern()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.semesterDetail(semesterId)),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteSemesters()),
                this.cache.deleteCacheByPattern(AcademicCacheKeys.autocompleteOfferings()),
                ...Array.from(affectedCourseIds).map((id) =>
                    this.cache.deleteCacheByPattern(AcademicCacheKeys.courseDetail(id))
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

// Re-export for convenience
export * from "./selects";
export * from "./mappers";
export * from "./types";
