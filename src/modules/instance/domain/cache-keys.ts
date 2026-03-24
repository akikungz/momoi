import type { Static } from "elysia";

import type { GetInstancesRequestQuery } from "@momoi/model/instance";

export type InstanceFilterType = "user" | "instructor" | "admin";

export interface UserInstanceFilter {
	type: "user";
	userId: number;
}

export interface InstructorInstanceFilter {
	type: "instructor";
	instructorId: number;
}

export interface AdminInstanceFilter {
	type: "admin";
}

export type InstanceFilter =
	| UserInstanceFilter
	| InstructorInstanceFilter
	| AdminInstanceFilter;

export function buildInstanceListCacheKey(
	filter: InstanceFilter,
	query: Static<typeof GetInstancesRequestQuery>,
): string {
	const prefix =
		filter.type === "user"
			? `user:${filter.userId}:instances`
			: filter.type === "instructor"
				? `instructor:${filter.instructorId}:instances`
				: "instances";

	return `${prefix}:page:${query.page ?? 1}:size:${query.pageSize ?? 10}:courseId:${query.courseId ?? "all"}:semesterId:${query.semesterId ?? "all"}`;
}

export const InstanceCacheKeys = {
	detail: (instanceId: number) => `instance:${instanceId}`,
	detailPattern: (instanceId: number) => `instance:${instanceId}`,
	auditLogs: (instanceId: number, page: number, pageSize: number) =>
		`instance:${instanceId}:audit-logs:page:${page}:size:${pageSize}`,
	auditLogsPattern: (instanceId: number) =>
		`instance:${instanceId}:audit-logs:*`,
} as const;
