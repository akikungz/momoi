/**
 * Prisma select clauses for Academic-related queries.
 * Centralizes field selection for consistency and reusability.
 */

/**
 * Select clause for instructor mailing list.
 */
export const MAILING_LIST_SELECT = {
	id: true,
	email: true,
	createdAt: true,
	updatedAt: true,
} as const;

/**
 * Select clause for instructor list.
 */
export const INSTRUCTOR_LIST_SELECT = {
	id: true,
	role: true,
	createdAt: true,
	updatedAt: true,
	user: {
		select: {
			name: true,
			email: true,
		},
	},
} as const;

/**
 * Select clause for instructor detail with courses.
 */
export const INSTRUCTOR_DETAIL_SELECT = {
	id: true,
	role: true,
	createdAt: true,
	updatedAt: true,
	user: true,
	courses: true,
} as const;

/**
 * Select clause for course list.
 */
export const COURSE_LIST_SELECT = {
	id: true,
	code: true,
	title: true,
	description: true,
	isActive: true,
	createdAt: true,
	updatedAt: true,
} as const;

/**
 * Select clause for course detail with instructors and semesters.
 */
export const COURSE_DETAIL_INCLUDE = {
	instructors: {
		include: {
			user: true,
		},
	},
	courseOfferings: {
		include: {
			semester: true,
		},
	},
} as const;

/**
 * Select clause for semester list.
 */
export const SEMESTER_LIST_SELECT = {
	id: true,
	name: true,
	startDate: true,
	endDate: true,
	isCurrent: true,
	createdAt: true,
	updatedAt: true,
} as const;

/**
 * Include clause for semester detail with courses.
 */
export const SEMESTER_DETAIL_INCLUDE = {
	courseOfferings: {
		include: {
			course: true,
		},
	},
} as const;
