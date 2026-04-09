import { Elysia } from "elysia";

import type { AuthMacro } from "@momoi/auth";
import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database";
import { instanceModel } from "@momoi/model/instance";
import { requestModel } from "@momoi/model/request";
import { ErrorResponse } from "@momoi/model/shared/error";
import type { QueueModule } from "@momoi/queue";

import { createRequestUseCases } from "@momoi/modules/request";

import { createInstanceUseCases } from ".";

export const instanceRoute = (
	prisma: PrismaClient,
	cache: CacheModule,
	auth: AuthMacro,
	queue: QueueModule,
) => {
	const instanceUseCases = createInstanceUseCases(prisma, cache, queue);
	const requestUseCases = createRequestUseCases(prisma, cache, queue);

	return new Elysia({ name: "instance.route", prefix: "/instances" })
		.use(auth)
		.use(instanceModel)
		.use(requestModel)
		.guard({ auth: true })
		.post(
			"/",
			async ({ user, body, status }) => {
				if (user.role === "STUDENT")
					return status(403, {
						status: 403,
						message: "Forbidden: Students cannot create instances",
					});
				return instanceUseCases.createInstanceByInstructor(
					user.id,
					user.role,
					body,
				);
			},
			{
				body: "CreateInstanceRequestBody",
				response: {
					200: "CreateInstanceResponse",
					403: ErrorResponse,
				},
				detail: {
					summary: "Create a new instance",
					description: "Create a new instance as an instructor",
					tags: ["Instances"],
				},
			},
		)
		.get(
			"/",
			async ({ user, query }) =>
				instanceUseCases.getInstancesByUser(user.id, query),
			{
				query: "GetInstancesRequestQuery",
				response: "GetInstancesResponse",
				detail: {
					summary: "Get instances for the current user",
					description: "Retrieve all instances created by the current user",
					tags: ["Instances"],
				},
			},
		)
		.get(
			"/admin",
			async ({ query }) => instanceUseCases.getInstancesByAdmin(query),
			{
				query: "GetInstancesRequestQuery",
				response: "GetInstancesResponse",
				detail: {
					summary: "Get all instances (admin)",
					description: "Retrieve all instances in the system",
					tags: ["Instances"],
				},
			},
		)
		.get(
			"/instructor",
			async ({ query, user, status }) => {
				if (user.role === "STUDENT")
					return status(403, {
						status: 403,
						message: "Forbidden: Students cannot view instructor instances",
					});

				return instanceUseCases.getInstancesByInstructor(user.id, query);
			},
			{
				query: "GetInstancesRequestQuery",
				response: {
					200: "GetInstancesResponse",
					403: ErrorResponse,
				},
				detail: {
					summary: "Get instances for a specific instructor",
					description:
						"Retrieve all instances created by a specific instructor",
					tags: ["Instances"],
				},
				guard: {
					auth: {
						roles: ["ADMIN", "INSTRUCTOR"],
					},
				},
			},
		)
		.get(
			"/:instanceId",
			async ({ params }) => instanceUseCases.getInstanceById(params.instanceId),
			{
				params: "GetInstanceRequestParams",
				response: "GetInstanceResponse",
				detail: {
					summary: "Get a specific instance",
					description: "Retrieve details of a specific instance by ID",
					tags: ["Instances"],
				},
			},
		)
		.post(
			"/:instanceId/start",
			async ({ params, user }) =>
				instanceUseCases.startInstance(params.instanceId, user.id),
			{
				params: "InstanceStatusActionRequestParams",
				response: "InstanceStatusActionResponse",
				detail: {
					summary: "Start instance",
					description: "Start a specific instance by ID",
					tags: ["Instances"],
				},
			},
		)
		.post(
			"/:instanceId/stop",
			async ({ params, user }) =>
				instanceUseCases.stopInstance(params.instanceId, user.id),
			{
				params: "InstanceStatusActionRequestParams",
				response: "InstanceStatusActionResponse",
				detail: {
					summary: "Stop instance",
					description: "Stop a specific instance by ID",
					tags: ["Instances"],
				},
			},
		)
		.post(
			"/:instanceId/restart",
			async ({ params, user }) =>
				instanceUseCases.restartInstance(params.instanceId, user.id),
			{
				params: "InstanceStatusActionRequestParams",
				response: "InstanceStatusActionResponse",
				detail: {
					summary: "Restart instance",
					description: "Restart a specific instance by ID",
					tags: ["Instances"],
				},
			},
		)
		.delete(
			"/:instanceId",
			async ({ params }) => instanceUseCases.deleteInstance(params.instanceId),
			{
				params: "DeleteInstanceRequestParams",
				response: "DeleteInstanceResponse",
				detail: {
					summary: "Delete an instance",
					description: "Delete a specific instance by ID",
					tags: ["Instances"],
				},
			},
		)
		.post(
			"/:instanceId/reverse-proxies",
			async ({ params, body }) =>
				instanceUseCases.createReverseProxy(params.instanceId, body),
			{
				params: "InstanceIdParams",
				body: "CreateReverseProxyRequestBody",
				response: "CreateReverseProxyResponse",
				detail: {
					summary: "Create a reverse proxy",
					description: "Create a reverse proxy configuration for the instance",
					tags: ["Instances", "Reverse Proxy"],
				},
			},
		)
		.get(
			"/:instanceId/reverse-proxies",
			async ({ params }) =>
				instanceUseCases.getReverseProxies(params.instanceId),
			{
				params: "InstanceIdParams",
				response: "GetReverseProxiesResponse",
				detail: {
					summary: "Get reverse proxies",
					description:
						"Retrieve all reverse proxy configurations for the instance",
					tags: ["Instances", "Reverse Proxy"],
				},
			},
		)
		.delete(
			"/:instanceId/reverse-proxies/:proxyId",
			async ({ params }) =>
				instanceUseCases.deleteReverseProxy(params.instanceId, params.proxyId),
			{
				params: "DeleteReverseProxyRequestParams",
				response: "DeleteReverseProxyResponse",
				detail: {
					summary: "Delete a reverse proxy",
					description:
						"Delete a specific reverse proxy configuration from the instance",
					tags: ["Instances", "Reverse Proxy"],
				},
			},
		)
		.patch(
			"/:instanceId/promote",
			async ({ user, params, status }) => {
				if (user.role !== "ADMIN") {
					return status(403, {
						status: 403,
						message: "Forbidden: Only admins can promote instances",
					});
				}

				return instanceUseCases.promoteInstance(params.instanceId, user.id);
			},
			{
				params: "PromoteInstanceRequestParams",
				response: {
					200: "PromoteInstanceResponse",
					403: ErrorResponse,
				},
				detail: {
					summary: "Promote instance",
					description: "Promote an instance to long-term/production status",
					tags: ["Instances"],
				},
			},
		)
		.post(
			"/:instanceId/reprovision",
			async ({ user, params }) => {
				return instanceUseCases.reprovisionInstance(
					params.instanceId,
					user.id,
					user.role,
				);
			},
			{
				params: "ReprovisionInstanceRequestParams",
				response: {
					200: "ReprovisionInstanceResponse",
					403: ErrorResponse,
				},
				detail: {
					summary: "Re-provision instance",
					description:
						"Re-provision a failed instance by resetting its provision status and queuing it for provisioning again. Students can only re-provision their own instances.",
					tags: ["Instances"],
				},
			},
		)
		.get(
			"/:instanceId/audit-logs",
			async ({ params, query }) => {
				return instanceUseCases.getInstanceAuditLogs(
					params.instanceId,
					query.page,
					query.pageSize,
				);
			},
			{
				params: "InstanceIdParams",
				query: "AuditLogsQuery",
				response: {
					200: "GetInstanceAuditLogsResponse",
					403: ErrorResponse,
				},
				detail: {
					summary: "Get instance audit logs",
					description: "Retrieve audit log entries for the instance",
					tags: ["Instances", "Audit Logs"],
				},
			},
		)
		.get(
			"/:instanceId/extended-request",
			async ({ user, params, query }) => {
				return requestUseCases.getExtendedRequests(user, {
					...query,
					instanceId: params.instanceId,
				});
			},
			{
				params: "InstanceExtendedRequestParams",
				query: "GetExtendedRequestsRequestQuery",
				response: "GetExtendedRequestsResponse",
				detail: {
					summary: "Get extended requests for an instance",
					description: "Retrieve all extended requests for a specific instance",
					tags: ["Instances", "Extended Requests"],
				},
			},
		)
		.post(
			"/:instanceId/extended-request",
			async ({ user, params, body, status }) => {
				if (user.role !== "STUDENT") {
					return status(403, {
						status: 403,
						message: "Forbidden: Only students can create extended requests",
					});
				}

				return requestUseCases.createExtendedRequest(user.id, {
					...body,
					targetInstanceId: params.instanceId,
				});
			},
			{
				params: "InstanceExtendedRequestParams",
				body: "CreateInstanceExtendedRequestBody",
				response: {
					200: "CreateExtendedRequestResponse",
					403: ErrorResponse,
				},
				detail: {
					summary: "Create an extended request for an instance",
					description:
						"Students request to extend their instance to the next semester",
					tags: ["Instances", "Extended Requests"],
				},
			},
		)
		.get(
			"/:instanceId/monitoring",
			async ({ params }) =>
				instanceUseCases.getInstanceMonitoring(params.instanceId),
			{
				params: "GetInstanceRequestParams",
				response: {
					200: "GetInstanceMonitoringResponse",
					404: ErrorResponse,
					409: ErrorResponse,
					502: ErrorResponse,
					503: ErrorResponse,
					504: ErrorResponse,
				},
				detail: {
					summary: "Get monitoring data for an instance",
					description:
						"Retrieve Prometheus-backed runtime monitoring metrics for a specific instance.",
					tags: ["Instances", "Monitoring"],
				},
			},
		)
};
