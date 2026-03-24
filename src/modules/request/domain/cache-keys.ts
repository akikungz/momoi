export const RequestCacheKeys = {
	requestAuditLogs: (requestId: number, page: number, pageSize: number) =>
		`request:${requestId}:audit-logs:page:${page}:size:${pageSize}`,
	requestAuditLogsPattern: (requestId?: number) =>
		requestId ? `request:${requestId}:audit-logs:*` : "request:*:audit-logs:*",

	extendedRequestAuditLogs: (
		extendedRequestId: number,
		page: number,
		pageSize: number,
	) =>
		`extended-request:${extendedRequestId}:audit-logs:page:${page}:size:${pageSize}`,
	extendedRequestAuditLogsPattern: (extendedRequestId?: number) =>
		extendedRequestId
			? `extended-request:${extendedRequestId}:audit-logs:*`
			: "extended-request:*:audit-logs:*",
} as const;
