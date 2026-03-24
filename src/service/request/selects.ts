import type { Prisma } from "@momoi/database/prisma/generated/client";

/**
 * Shared select clause for course offering with nested course and semester
 */
export const COURSE_OFFERING_SELECT = {
	course: { select: { code: true, title: true } },
	semester: { select: { name: true } },
} as const;

/**
 * Select clause for standard request queries
 */
export const REQUEST_SELECT = {
	id: true,
	title: true,
	description: true,
	status: true,
	reason: true,
	cpus: true,
	memoryMB: true,
	diskGB: true,
	requesterId: true,
	reviewerId: true,
	courseOffering: {
		select: COURSE_OFFERING_SELECT,
	},
	pveTemplate: { select: { name: true } },
	createdAt: true,
	updatedAt: true,
} satisfies Prisma.RequestSelect;

/**
 * Select clause for extended request queries
 */
export const EXTENDED_REQUEST_SELECT = {
	id: true,
	title: true,
	description: true,
	status: true,
	reason: true,
	targetInstanceId: true,
	requesterId: true,
	reviewerId: true,
	nextSemester: {
		select: {
			id: true,
			name: true,
			startDate: true,
			endDate: true,
		},
	},
	targetInstance: {
		select: {
			id: true,
			courseOffering: {
				select: COURSE_OFFERING_SELECT,
			},
		},
	},
	createdAt: true,
	updatedAt: true,
} satisfies Prisma.ExtendedRequestSelect;

/**
 * Type for request result from Prisma
 */
export type RequestResult = Prisma.RequestGetPayload<{
	select: typeof REQUEST_SELECT;
}>;

/**
 * Type for extended request result from Prisma
 */
export type ExtendedRequestResult = Prisma.ExtendedRequestGetPayload<{
	select: typeof EXTENDED_REQUEST_SELECT;
}>;
