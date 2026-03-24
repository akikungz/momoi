import { Elysia, t } from "elysia";

import type { AuthMacro } from "@momoi/auth";
import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database";
import { requestModel } from "@momoi/model/request";
import { ErrorResponse } from "@momoi/model/shared/error";
import type { QueueModule } from "@momoi/queue";

import { createRequestUseCases } from ".";

export const requestRoute = (
	prisma: PrismaClient,
	cache: CacheModule,
	auth: AuthMacro,
	queue: QueueModule,
) => {
	const useCases = createRequestUseCases(prisma, cache, queue);

	return new Elysia({ name: "request.route" })
		.use(auth)
		.use(requestModel)
		.guard({ auth: true })
		.group("/requests", (app) =>
			app
				.post(
					"/",
					async ({ user, body, status }) => {
						if (user.role !== "STUDENT") {
							return status(403, {
								status: 403,
								message: "Forbidden: Only students can create requests",
							});
						}

						return useCases.createRequest(user.id, body);
					},
					{
						body: "CreateRequestRequestBody",
						response: {
							200: "CreateRequestResponse",
							403: ErrorResponse,
						},
						detail: {
							summary: "Create a new request",
							description:
								"Students submit an instance request for instructor/admin review",
							tags: ["Requests"],
						},
					},
				)
				.get(
					"/",
					async ({ user, query }) => {
						return useCases.getRequests(user, query);
					},
					{
						query: "GetRequestsRequestQuery",
						response: "GetRequestsResponse",
						detail: {
							summary: "List requests",
							description: "List requests visible to the current user",
							tags: ["Requests"],
						},
					},
				)
				.patch(
					"/:requestId/status",
					async ({ user, params, body }) => {
						return useCases.updateRequestStatus(user, params.requestId, body);
					},
					{
						params: t.Object({
							requestId: t.Number({ description: "Request ID" }),
						}),
						body: "UpdateRequestStatusRequestBody",
						response: {
							200: "UpdateRequestStatusResponse",
						},
						detail: {
							summary: "Act on a request",
							description:
								"Approve, reject, or cancel a request depending on role",
							tags: ["Requests"],
						},
					},
				)
				.get(
					"/:requestId/audit-logs",
					async ({ params, query }) => {
						return useCases.getRequestAuditLogs(
							params.requestId,
							query.page,
							query.pageSize,
						);
					},
					{
						params: t.Object({
							requestId: t.Number({ description: "Request ID" }),
						}),
						query: t.Object({
							page: t.Optional(t.Number({ minimum: 1, default: 1 })),
							pageSize: t.Optional(
								t.Number({ minimum: 1, maximum: 100, default: 10 }),
							),
						}),
						response: "GetRequestAuditLogsResponse",
						detail: {
							summary: "Get request audit logs",
							description: "Retrieve audit log entries for the request",
							tags: ["Requests", "Audit Logs"],
						},
					},
				),
		)
		.group("/extended-requests", (app) =>
			app
				.post(
					"/",
					async ({ user, body, status }) => {
						if (user.role !== "STUDENT") {
							return status(403, {
								status: 403,
								message:
									"Forbidden: Only students can create extended requests",
							});
						}

						return useCases.createExtendedRequest(user.id, body);
					},
					{
						body: "CreateExtendedRequestRequestBody",
						response: {
							200: "CreateExtendedRequestResponse",
							403: ErrorResponse,
						},
						detail: {
							summary: "Create an extended request",
							description:
								"Students request changes related to an existing instance",
							tags: ["Extended Requests"],
						},
					},
				)
				.get(
					"/",
					async ({ user, query }) => {
						return useCases.getExtendedRequests(user, query);
					},
					{
						query: "GetExtendedRequestsRequestQuery",
						response: "GetExtendedRequestsResponse",
						detail: {
							summary: "List extended requests",
							description: "List extended requests visible to the current user",
							tags: ["Extended Requests"],
						},
					},
				)
				.patch(
					"/:extendedRequestId/status",
					async ({ user, params, body }) => {
						return useCases.updateExtendedRequestStatus(
							user,
							params.extendedRequestId,
							body,
						);
					},
					{
						params: t.Object({
							extendedRequestId: t.Number({
								description: "Extended request ID",
							}),
						}),
						body: "UpdateExtendedRequestStatusRequestBody",
						response: {
							200: "UpdateExtendedRequestStatusResponse",
						},
						detail: {
							summary: "Act on an extended request",
							description:
								"Approve, reject, or cancel an extended request depending on role",
							tags: ["Extended Requests"],
						},
					},
				)
				.get(
					"/:extendedRequestId/audit-logs",
					async ({ params, query }) => {
						return useCases.getExtendedRequestAuditLogs(
							params.extendedRequestId,
							query.page,
							query.pageSize,
						);
					},
					{
						params: t.Object({
							extendedRequestId: t.Number({
								description: "Extended request ID",
							}),
						}),
						query: t.Object({
							page: t.Optional(t.Number({ minimum: 1, default: 1 })),
							pageSize: t.Optional(
								t.Number({ minimum: 1, maximum: 100, default: 10 }),
							),
						}),
						response: "GetExtendedRequestAuditLogsResponse",
						detail: {
							summary: "Get extended request audit logs",
							description:
								"Retrieve audit log entries for the extended request",
							tags: ["Extended Requests", "Audit Logs"],
						},
					},
				),
		);
};
