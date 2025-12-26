import { Static } from 'elysia';

import {
  PrismaClientKnownRequestError
} from '@momoi/database/prisma/generated/internal/prismaNamespace';
import {
  AddCourseRequestBody, AddCourseResponse, AddInstructorMailingListRequestBody,
  AddInstructorMailingListResponse, AddSemesterRequestBody, AddSemesterResponse,
  CourseByIdRequestParams, DeleteSemesterByIdResponse, EditCourseByIdRequestBody,
  EditCourseInstructorRequestBody, EditCourseInstructorResponse, EditCourseSemesterRequestBody,
  EditCourseSemesterResponse, EditInstructorByIdRequestBody, EditInstructorByIdResponse, EditSemesterByIdRequestBody, EditSemesterByIdResponse,
  EditSemesterCourseRequestBody, EditSemesterCourseResponse, GetCourseByIdResponse,
  GetCoursesRequestQuery, GetCoursesResponse, GetInstructorByIdResponse,
  GetInstructorMailingListQuery, GetInstructorMailingListResponse, GetInstructorsRequestQuery,
  GetInstructorsResponse, GetSemesterByIdResponse, GetSemestersRequestQuery, GetSemestersResponse,
  InstructorByIdRequestParams, InstructorMailingListValue, InstructorValue,
  RemoveInstructorMailingListResponse, SemesterByIdRequestParams, SemesterValue
} from '@momoi/model/academic';

import type { CacheModule } from '@momoi/cache';
import type { PrismaClient } from '@momoi/database/prisma/generated/client';

function buildPagination(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}

export class AcademicService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheModule,
  ) { }

  // -------------------- Instructor Mailing List --------------------
  public async getInstructorMailingList(query: Static<typeof GetInstructorMailingListQuery>): Promise<Static<typeof GetInstructorMailingListResponse>> {
    const { page, pageSize, skip, take } = buildPagination(query);
    const cacheKey = `academic:mailing:page:${page}:size:${pageSize}:email:${query.email ?? 'all'}`;

    const cached = await this.cache.getCacheValue(cacheKey);
    if (cached) return JSON.parse(cached);

    const where = query.email
      ? { email: { contains: query.email, mode: 'insensitive' as const } }
      : {};

    const [totalItems, values] = await Promise.all([
      this.prisma.instructorSearch.count({ where }),
      this.prisma.instructorSearch.findMany({
        where: {
          ...where,
          havePlatformId: false
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        }
      })
    ]);

    const response: Static<typeof GetInstructorMailingListResponse> = {
      values,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      currentPage: page,
      pageSize,
    };

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
    return response;
  }

  public async addInstructorMailingList(body: Static<typeof AddInstructorMailingListRequestBody>): Promise<Static<typeof AddInstructorMailingListResponse>> {
    try {
      const created = await this.prisma.instructorSearch.create({
        data: {
          email: body.email,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      await this.cache.deleteCacheByPattern('academic:mailing:*');
      return created;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('This email is already in the mailing list.');
        }

        throw new Error(`Database error: ${error.message}`);
      }
      throw new Error('Failed to add instructor mailing list entry.');
    }
  }

  public async removeInstructorMailingList(mailingId: Static<typeof InstructorMailingListValue>['id']): Promise<Static<typeof RemoveInstructorMailingListResponse>> {
    try {
      await this.prisma.instructorSearch.delete({ where: { id: mailingId } });
      await this.cache.deleteCacheByPattern('academic:mailing:*');
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Mailing list entry not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }
      throw new Error('Failed to remove instructor mailing list entry.');
    }
  }

  // -------------------- Instructors --------------------
  public async getInstructors(query: Static<typeof GetInstructorsRequestQuery>): Promise<Static<typeof GetInstructorsResponse>> {
    const { page, pageSize, skip, take } = buildPagination(query);
    const cacheKey = `academic:instructors:page:${page}:size:${pageSize}:name:${query.name ?? 'all'}:email:${query.email ?? 'all'}`;

    const cached = await this.cache.getCacheValue(cacheKey);
    if (cached) return JSON.parse(cached);

    const where = {
      user: {
        name: query.name ? { contains: query.name, mode: 'insensitive' as const } : undefined,
        email: query.email ? { contains: query.email, mode: 'insensitive' as const } : undefined,
      },
    };

    const [totalItems, instructors] = await Promise.all([
      this.prisma.platformUser.count({ where }),
      this.prisma.platformUser.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { name: true, email: true } },
        }
      })
    ]);

    const values: Static<typeof InstructorValue>[] = instructors.map((inst) => ({
      id: inst.id,
      name: inst.user?.name ?? '',
      email: inst.user?.email ?? '',
      role: inst.role,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
    }));

    const response: Static<typeof GetInstructorsResponse> = {
      values,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      currentPage: page,
      pageSize,
    };

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
    return response;
  }

  public async getInstructorById(instructorId: Static<typeof InstructorByIdRequestParams>['instructorId']): Promise<Static<typeof GetInstructorByIdResponse>> {
    const cacheKey = `academic:instructor:${instructorId}`;
    const cached = await this.cache.getCacheValue(cacheKey);
    if (cached) return JSON.parse(cached);

    const instructor = await this.prisma.platformUser.findUnique({
      where: { id: instructorId },
      include: {
        user: true,
        courses: true,
      }
    });

    if (!instructor) {
      throw new Error('Instructor not found.');
    }

    const response: Static<typeof GetInstructorByIdResponse> = {
      id: instructor.id,
      name: instructor.user?.name ?? '',
      email: instructor.user?.email ?? '',
      role: instructor.role,
      courses: instructor.courses.map(course => ({
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description ?? undefined,
        isActive: course.isActive,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      })),
      createdAt: instructor.createdAt,
      updatedAt: instructor.updatedAt,
    };

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
    return response;
  }

  public async editInstructorById(instructorId: number, body: Static<typeof EditInstructorByIdRequestBody>): Promise<Static<typeof EditInstructorByIdResponse>> {
    try {
      const existing = await this.prisma.platformUser.findUnique({
        where: { id: instructorId },
        select: { id: true, courses: { select: { id: true } } },
      });

      if (!existing) {
        throw new Error('Instructor not found.');
      }

      const updated = await this.prisma.platformUser.update({
        where: { id: instructorId },
        data: {
          role: existing.id !== instructorId ? body.role ?? undefined : undefined,
          courses: {
            set: body.courseIds?.map((id) => ({ id })) ?? undefined,
          }
        },
        include: {
          user: true,
          courses: true,
        }
      });

      const affectedCourseIds = new Set([
        ...existing.courses.map((c) => c.id),
        ...updated.courses.map((c) => c.id),
      ]);

      await Promise.all([
        this.cache.deleteCacheByPattern('academic:instructors:*'),
        this.cache.deleteCacheByPattern(`academic:instructor:${instructorId}`),
        ...Array.from(affectedCourseIds).map((courseId) => this.cache.deleteCacheByPattern(`academic:course:${courseId}`)),
      ]);

      return {
        id: updated.id,
        name: updated.user?.name ?? '',
        email: updated.user?.email ?? '',
        role: updated.role,
        courses: updated.courses.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          description: c.description ?? undefined,
          isActive: c.isActive,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Instructor not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('Failed to edit instructor.');
    }
  }

  // -------------------- Courses --------------------
  public async getCourses(query: Static<typeof GetCoursesRequestQuery>): Promise<Static<typeof GetCoursesResponse>> {
    const { page, pageSize, skip, take } = buildPagination(query);
    const cacheKey = `academic:courses:page:${page}:size:${pageSize}:code:${query.code ?? 'all'}:title:${query.title ?? 'all'}`;

    const cached = await this.cache.getCacheValue(cacheKey);
    if (cached) return JSON.parse(cached);

    const where = {
      code: query.code ? { contains: query.code, mode: 'insensitive' as const } : undefined,
      title: query.title ? { contains: query.title, mode: 'insensitive' as const } : undefined,
    };

    const [totalItems, courses] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      })
    ]);

    const response: Static<typeof GetCoursesResponse> = {
      values: courses.map(course => ({
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description ?? undefined,
        isActive: course.isActive,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      })),
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      currentPage: page,
      pageSize,
    };

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
    return response;
  }

  public async getCourseById(courseId: Static<typeof CourseByIdRequestParams>['courseId']): Promise<Static<typeof GetCourseByIdResponse>> {
    const cacheKey = `academic:course:${courseId}`;
    const cached = await this.cache.getCacheValue(cacheKey);
    if (cached) return JSON.parse(cached);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructors: { include: { user: true } },
        courseOfferings: { include: { semester: true } },
      }
    });

    if (!course) {
      throw new Error('Course not found.');
    }

    const semesters: Static<typeof SemesterValue>[] = course.courseOfferings.map((co) => ({
      id: co.semester.id,
      name: co.semester.name,
      startDate: co.semester.startDate,
      endDate: co.semester.endDate,
      isCurrent: co.semester.isCurrent,
      createdAt: co.semester.createdAt,
      updatedAt: co.semester.updatedAt,
    }));

    const instructors: Static<typeof InstructorValue>[] = course.instructors.map((inst) => ({
      id: inst.id,
      name: inst.user?.name ?? '',
      email: inst.user?.email ?? '',
      role: inst.role,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
    }));

    const response: Static<typeof GetCourseByIdResponse> = {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description ?? undefined,
      instructors,
      semesters,
      isActive: course.isActive,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
    return response;
  }

  public async addCourse(body: Static<typeof AddCourseRequestBody>): Promise<Static<typeof AddCourseResponse>> {
    const created = await this.prisma.course.create({
      data: {
        code: body.code,
        title: body.title,
        description: body.description ?? undefined,
      },
    });

    await this.cache.deleteCacheByPattern('academic:courses:*');
    return {
      ...created,
      description: created.description ?? undefined,
    };
  }

  public async editCourseById(courseId: number, body: Static<typeof EditCourseByIdRequestBody>): Promise<Static<typeof AddCourseResponse>> {
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

      await this.cache.deleteCacheByPattern('academic:courses:*');
      await this.cache.deleteCacheByPattern(`academic:course:${courseId}`);
      return {
        ...updated,
        description: updated.description ?? undefined,
      };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Course not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('Failed to edit course.');
    }
  }

  public async editCourseInstructors(courseId: number, body: Static<typeof EditCourseInstructorRequestBody>): Promise<Static<typeof EditCourseInstructorResponse>> {
    try {
      const existing = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { instructors: { select: { id: true } } },
      });

      if (!existing) {
        throw new Error('Course not found.');
      }

      const updated = await this.prisma.course.update({
        where: { id: courseId },
        data: {
          instructors: {
            set: body.instructorIds.map((id) => ({ id })),
          }
        },
        include: {
          instructors: {
            include: { user: true },
          }
        }
      });

      const affectedInstructorIds = new Set([
        ...existing.instructors.map((inst) => inst.id),
        ...body.instructorIds,
      ]);

      await Promise.all([
        this.cache.deleteCacheByPattern('academic:instructors:*'),
        this.cache.deleteCacheByPattern('academic:courses:*'),
        this.cache.deleteCacheByPattern(`academic:course:${courseId}`),
        ...Array.from(affectedInstructorIds).map((id) => this.cache.deleteCacheByPattern(`academic:instructor:${id}`)),
      ]);

      return {
        instructors: updated.instructors.map((inst) => ({
          id: inst.id,
          name: inst.user?.name ?? '',
          email: inst.user?.email ?? '',
          role: inst.role,
          createdAt: inst.createdAt,
          updatedAt: inst.updatedAt,
        }))
      };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Course not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('Failed to update course instructors.');
    }
  }

  public async editCourseSemesters(courseId: number, body: Static<typeof EditCourseSemesterRequestBody>): Promise<Static<typeof EditCourseSemesterResponse>> {
    try {
      const semesters = await this.prisma.semester.findMany({ where: { id: { in: body.semesterIds } } });
      if (semesters.length !== body.semesterIds.length) {
        throw new Error('One or more semesters not found.');
      }

      const existingOfferings = await this.prisma.courseOffering.findMany({
        where: { courseId },
        select: { semesterId: true }
      });
      const existingIds = new Set(existingOfferings.map((co) => co.semesterId));
      const affectedSemesterIds = new Set([...existingIds, ...body.semesterIds]);

      await this.prisma.$transaction([
        this.prisma.courseOffering.deleteMany({
          where: {
            courseId,
            semesterId: { notIn: body.semesterIds },
          }
        }),
        this.prisma.courseOffering.createMany({
          data: body.semesterIds
            .filter((id) => !existingIds.has(id))
            .map((semesterId) => ({ courseId, semesterId })),
        }),
      ]);

      await Promise.all([
        this.cache.deleteCacheByPattern('academic:courses:*'),
        this.cache.deleteCacheByPattern('academic:semesters:*'),
        this.cache.deleteCacheByPattern(`academic:course:${courseId}`),
        ...Array.from(affectedSemesterIds).map((id) => this.cache.deleteCacheByPattern(`academic:semester:${id}`)),
      ]);

      return {
        semesters: semesters.map((semester) => ({
          id: semester.id,
          name: semester.name,
          startDate: semester.startDate,
          endDate: semester.endDate,
          isCurrent: semester.isCurrent,
          createdAt: semester.createdAt,
          updatedAt: semester.updatedAt,
        }))
      };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Course not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('Failed to update course semesters.');
    }
  }

  // -------------------- Semesters --------------------
  public async getSemesters(query: Static<typeof GetSemestersRequestQuery>): Promise<Static<typeof GetSemestersResponse>> {
    const { page, pageSize, skip, take } = buildPagination(query);
    const cacheKey = `academic:semesters:page:${page}:size:${pageSize}:name:${query.name ?? 'all'}:from:${query.dateFrom ?? 'none'}:to:${query.dateTo ?? 'none'}`;

    const cached = await this.cache.getCacheValue(cacheKey);
    if (cached) return JSON.parse(cached);

    const where = {
      name: query.name ? { contains: query.name, mode: 'insensitive' as const } : undefined,
      startDate: query.dateFrom ? { gte: query.dateFrom } : undefined,
      endDate: query.dateTo ? { lte: query.dateTo } : undefined,
    };

    const [totalItems, semesters] = await Promise.all([
      this.prisma.semester.count({ where }),
      this.prisma.semester.findMany({
        where,
        skip,
        take,
        orderBy: { startDate: 'desc' },
      })
    ]);

    const response: Static<typeof GetSemestersResponse> = {
      values: semesters.map((semester) => ({
        id: semester.id,
        name: semester.name,
        startDate: semester.startDate,
        endDate: semester.endDate,
        isCurrent: semester.isCurrent,
        createdAt: semester.createdAt,
        updatedAt: semester.updatedAt,
      })),
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      currentPage: page,
      pageSize,
    };

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
    return response;
  }

  public async getSemesterById(semesterId: Static<typeof SemesterByIdRequestParams>['semesterId']): Promise<Static<typeof GetSemesterByIdResponse>> {
    const cacheKey = `academic:semester:${semesterId}`;
    const cached = await this.cache.getCacheValue(cacheKey);
    if (cached) return JSON.parse(cached);

    const semester = await this.prisma.semester.findUnique({
      where: { id: semesterId },
      include: {
        courseOfferings: { include: { course: true } },
      }
    });

    if (!semester) {
      throw new Error('Semester not found.');
    }

    const courses = semester.courseOfferings.map((co) => co.course).map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description ?? undefined,
      isActive: course.isActive,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    }));

    const response: Static<typeof GetSemesterByIdResponse> = {
      id: semester.id,
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
      isCurrent: semester.isCurrent,
      courses,
      createdAt: semester.createdAt,
      updatedAt: semester.updatedAt,
    };

    await this.cache.createCacheKey(cacheKey, JSON.stringify(response));
    return response;
  }

  public async addSemester(body: Static<typeof AddSemesterRequestBody>): Promise<Static<typeof AddSemesterResponse>> {
    const created = await this.prisma.semester.create({
      data: {
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
      }
    });

    await this.cache.deleteCacheByPattern('academic:semesters:*');
    return created;
  }

  public async editSemesterById(semesterId: number, body: Static<typeof EditSemesterByIdRequestBody>): Promise<Static<typeof EditSemesterByIdResponse>> {
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

      await this.cache.deleteCacheByPattern('academic:semesters:*');
      await this.cache.deleteCacheByPattern(`academic:semester:${semesterId}`);
      return updated;
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Semester not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('Failed to edit semester.');
    }
  }

  public async editSemesterCourses(semesterId: number, body: Static<typeof EditSemesterCourseRequestBody>): Promise<Static<typeof EditSemesterCourseResponse>> {
    try {
      const courses = await this.prisma.course.findMany({ where: { id: { in: body.courseIds } } });
      if (courses.length !== body.courseIds.length) {
        throw new Error('One or more courses not found.');
      }

      const existingOfferings = await this.prisma.courseOffering.findMany({
        where: { semesterId },
        select: { courseId: true }
      });
      const existingIds = new Set(existingOfferings.map((co) => co.courseId));
      const affectedCourseIds = new Set([...existingIds, ...body.courseIds]);

      await this.prisma.$transaction([
        this.prisma.courseOffering.deleteMany({
          where: {
            semesterId,
            courseId: { notIn: body.courseIds },
          }
        }),
        this.prisma.courseOffering.createMany({
          data: body.courseIds
            .filter((id) => !existingIds.has(id))
            .map((courseId) => ({ courseId, semesterId })),
        }),
      ]);

      await Promise.all([
        this.cache.deleteCacheByPattern('academic:courses:*'),
        this.cache.deleteCacheByPattern('academic:semesters:*'),
        this.cache.deleteCacheByPattern(`academic:semester:${semesterId}`),
        ...Array.from(affectedCourseIds).map((id) => this.cache.deleteCacheByPattern(`academic:course:${id}`)),
      ]);

      return {
        courses: courses.map((course) => ({
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description ?? undefined,
          isActive: course.isActive,
          createdAt: course.createdAt,
          updatedAt: course.updatedAt,
        }))
      };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Semester not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('Failed to update semester courses.');
    }
  }

  public async deleteSemesterById(semesterId: number): Promise<Static<typeof DeleteSemesterByIdResponse>> {
    try {
      const courseOfferings = await this.prisma.courseOffering.findMany({
        where: { semesterId },
        select: { courseId: true }
      });
      const affectedCourseIds = new Set(courseOfferings.map((co) => co.courseId));

      await this.prisma.$transaction([
        this.prisma.courseOffering.deleteMany({ where: { semesterId } }),
        this.prisma.semester.delete({ where: { id: semesterId } }),
      ]);

      await Promise.all([
        this.cache.deleteCacheByPattern('academic:semesters:*'),
        this.cache.deleteCacheByPattern('academic:courses:*'),
        this.cache.deleteCacheByPattern(`academic:semester:${semesterId}`),
        ...Array.from(affectedCourseIds).map((id) => this.cache.deleteCacheByPattern(`academic:course:${id}`)),
      ]);

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Semester not found.');
        }

        throw new Error(`Database error: ${error.message}`);
      }

      throw new Error('Failed to delete semester.');
    }
  }
}
