import type { Static } from "elysia";

import type {
	CreateExtendedRequestResponse,
	CreateRequestResponse,
} from "@momoi/model/request";

import type { ExtendedRequestResult, RequestResult } from "./selects";

/**
 * Maps course offering to API response format
 */
function mapCourseOffering(
	courseOffering: {
		course: { code: string; title: string };
		semester: { name: string };
	} | null,
): { courseCode: string; courseTitle: string; semester: string } | undefined {
	if (!courseOffering) return undefined;
	return {
		courseCode: courseOffering.course.code,
		courseTitle: courseOffering.course.title,
		semester: courseOffering.semester.name,
	};
}

/**
 * Maps a request from Prisma result to response format
 */
export function mapRequest(
	request: RequestResult,
): Static<typeof CreateRequestResponse> {
	return {
		id: request.id,
		title: request.title,
		description: request.description ?? undefined,
		status: request.status,
		reason: request.reason ?? undefined,
		courseOffering: mapCourseOffering(request.courseOffering),
		specs: {
			cpus: request.cpus,
			memoryMB: request.memoryMB,
			diskGB: request.diskGB,
		},
		templateName: request.pveTemplate?.name,
		requesterId: request.requesterId,
		reviewerId: request.reviewerId ?? undefined,
		createdAt: request.createdAt,
		updatedAt: request.updatedAt,
	};
}

/**
 * Maps an extended request from Prisma result to response format
 */
export function mapExtendedRequest(
	extendedRequest: ExtendedRequestResult,
): Static<typeof CreateExtendedRequestResponse> {
	return {
		id: extendedRequest.id,
		title: extendedRequest.title,
		description: extendedRequest.description ?? undefined,
		status: extendedRequest.status,
		reason: extendedRequest.reason ?? undefined,
		targetInstance: {
			id: extendedRequest.targetInstanceId,
			hostname: extendedRequest.targetInstance?.pveVM?.hostname ?? "N/A",
		},
		courseOffering: mapCourseOffering(
			extendedRequest.targetInstance?.courseOffering ?? null,
		),
		nextSemester: extendedRequest.nextSemester
			? {
				id: extendedRequest.nextSemester.id,
				name: extendedRequest.nextSemester.name,
				startDate: extendedRequest.nextSemester.startDate,
				endDate: extendedRequest.nextSemester.endDate,
			}
			: undefined,
		requester: {
			id: extendedRequest.requesterId,
			name: extendedRequest.requester.user.name,
			email: extendedRequest.requester.user.email,
		},
		reviewerId: extendedRequest.reviewerId ?? undefined,
		createdAt: extendedRequest.createdAt,
		updatedAt: extendedRequest.updatedAt,
	};
}
