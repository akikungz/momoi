import type {
	Course,
	PlatformUser,
	Semester,
	User,
} from "@momoi/database/prisma/generated/client";

import type { AutocompleteOptionType } from "./types";

// -------------------- Course Mappers --------------------

type CourseBasic = Pick<Course, "id" | "code" | "title">;

/**
 * Maps a course to autocomplete option.
 * Label format: "[code] title"
 */
export function mapCourseOption(course: CourseBasic): AutocompleteOptionType {
	return {
		id: course.id,
		label: `[${course.code}] ${course.title}`,
	};
}

// -------------------- Semester Mappers --------------------

type SemesterBasic = Pick<Semester, "id" | "name">;

/**
 * Maps a semester to autocomplete option.
 * Label format: "name"
 */
export function mapSemesterOption(
	semester: SemesterBasic,
): AutocompleteOptionType {
	return {
		id: semester.id,
		label: semester.name,
	};
}

// -------------------- Instructor Mappers --------------------

type InstructorBasic = Pick<PlatformUser, "id"> & {
	user: Pick<User, "name" | "email"> | null;
};

/**
 * Maps an instructor to autocomplete option.
 * Label format: "name (email)"
 */
export function mapInstructorOption(
	instructor: InstructorBasic,
): AutocompleteOptionType {
	return {
		id: instructor.id,
		label: `${instructor.user?.name ?? "Unknown"} (${instructor.user?.email ?? "no email"})`,
	};
}

// -------------------- Template Mappers --------------------

type TemplateBasic = { id: number; name: string };

/**
 * Maps a template to autocomplete option.
 * Label format: "name"
 */
export function mapTemplateOption(
	template: TemplateBasic,
): AutocompleteOptionType {
	return {
		id: template.id,
		label: template.name,
	};
}

// -------------------- Course Offering Mappers --------------------

type OfferingWithRelations = {
	id: number;
	course: Pick<Course, "code" | "title">;
	semester: Pick<Semester, "name">;
};

/**
 * Maps a course offering to autocomplete option.
 * Label format: "[course code] course title - semester"
 */
export function mapOfferingOption(
	offering: OfferingWithRelations,
): AutocompleteOptionType {
	return {
		id: offering.id,
		label: `[${offering.course.code}] ${offering.course.title} - ${offering.semester.name}`,
	};
}
