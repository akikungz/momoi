import type {
	Course as PrismaCourse,
	PlatformUser,
	Semester as PrismaSemester,
	User,
} from "@momoi/database/prisma/generated/client";

import type {
	Course,
	CourseDetailResponse,
	Instructor,
	MailingListEntry,
	Semester,
} from "./types";

function resolveSemesterCurrentByDate(semester: {
	startDate: Date;
	endDate: Date;
	isCurrent?: unknown;
}): boolean {
	if (typeof semester.isCurrent === "boolean") {
		return semester.isCurrent;
	}

	const now = new Date();
	return semester.startDate <= now && semester.endDate >= now;
}

// -------------------- Mailing List Mappers --------------------

/**
 * Type for mailing list entry returned from Prisma select.
 */
type MailingListSelectResult = {
	id: number;
	email: string;
	createdAt: Date;
	updatedAt: Date;
};

/**
 * Maps an InstructorSearch record to mailing list response format.
 */
export function mapMailingListEntry(
	entry: MailingListSelectResult,
): MailingListEntry {
	return {
		id: entry.id,
		email: entry.email,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt,
	};
}

// -------------------- Instructor Mappers --------------------

/**
 * Type for instructor select result (list view).
 */
type InstructorSelectResult = {
	id: number;
	role: "ADMIN" | "INSTRUCTOR" | "STUDENT";
	createdAt: Date;
	updatedAt: Date;
	user: { name: string; email: string } | null;
};

/**
 * Type for instructor select result with courses (detail view).
 */
type InstructorDetailSelectResult = InstructorSelectResult & {
	courses: PrismaCourse[];
};

/**
 * Maps a PlatformUser with User to instructor response format.
 */
export function mapInstructor(instructor: InstructorSelectResult): Instructor {
	return {
		id: instructor.id,
		name: instructor.user?.name ?? "",
		email: instructor.user?.email ?? "",
		role: instructor.role,
		createdAt: instructor.createdAt,
		updatedAt: instructor.updatedAt,
	};
}

/**
 * Maps a PlatformUser with User and Courses to instructor detail response.
 */
export function mapInstructorDetail(instructor: InstructorDetailSelectResult) {
	return {
		id: instructor.id,
		name: instructor.user?.name ?? "",
		email: instructor.user?.email ?? "",
		role: instructor.role,
		courses: instructor.courses.map(mapCourse),
		createdAt: instructor.createdAt,
		updatedAt: instructor.updatedAt,
	};
}

// -------------------- Course Mappers --------------------

/**
 * Maps a Course record to course response format.
 */
export function mapCourse(course: PrismaCourse): Course {
	return {
		id: course.id,
		code: course.code,
		title: course.title,
		description: course.description ?? undefined,
		isActive: course.isActive,
		isProjectBased: course.isProjectBased,
		createdAt: course.createdAt,
		updatedAt: course.updatedAt,
	};
}

type CourseWithRelations = PrismaCourse & {
	instructors: (PlatformUser & { user: User | null })[];
	courseOfferings: { semester: PrismaSemester }[];
};

/**
 * Maps a Course with relations to course detail response.
 */
export function mapCourseDetail(
	course: CourseWithRelations,
): CourseDetailResponse {
	return {
		id: course.id,
		code: course.code,
		title: course.title,
		description: course.description ?? undefined,
		instructors: course.instructors.map(mapInstructor),
		semesters: course.courseOfferings.map((co) => mapSemester(co.semester)),
		isActive: course.isActive,
		isProjectBased: course.isProjectBased,
		createdAt: course.createdAt,
		updatedAt: course.updatedAt,
	};
}

// -------------------- Semester Mappers --------------------

/**
 * Maps a Semester record to semester response format.
 */
export function mapSemester(semester: PrismaSemester): Semester {
	return {
		id: semester.id,
		name: semester.name,
		startDate: semester.startDate,
		endDate: semester.endDate,
		isCurrent: resolveSemesterCurrentByDate(
			semester as PrismaSemester & { isCurrent?: unknown },
		),
		createdAt: semester.createdAt,
		updatedAt: semester.updatedAt,
	};
}

type SemesterWithCourses = PrismaSemester & {
	courseOfferings: { course: PrismaCourse }[];
};

/**
 * Maps a Semester with courses to semester detail response.
 */
export function mapSemesterDetail(semester: SemesterWithCourses) {
	return {
		id: semester.id,
		name: semester.name,
		startDate: semester.startDate,
		endDate: semester.endDate,
		isCurrent: resolveSemesterCurrentByDate(
			semester as SemesterWithCourses & { isCurrent?: unknown },
		),
		courses: semester.courseOfferings.map((co) => mapCourse(co.course)),
		createdAt: semester.createdAt,
		updatedAt: semester.updatedAt,
	};
}

// -------------------- Pagination Mapper --------------------

/**
 * Creates a paginated response wrapper.
 */
export function createPaginatedResponse<T>(
	values: T[],
	totalItems: number,
	page: number,
	pageSize: number,
) {
	return {
		values,
		totalItems,
		totalPages: Math.ceil(totalItems / pageSize),
		currentPage: page,
		pageSize,
	};
}
