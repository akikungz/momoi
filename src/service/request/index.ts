import type { Static } from "elysia";

import type {
	CreateExtendedRequestRequestBody,
	CreateExtendedRequestResponse,
	CreateRequestRequestBody,
	CreateRequestResponse,
	GetExtendedRequestAuditLogsResponse,
	GetExtendedRequestsRequestQuery,
	GetExtendedRequestsResponse,
	GetRequestAuditLogsResponse,
	GetRequestsRequestQuery,
	GetRequestsResponse,
	UpdateExtendedRequestStatusRequestBody,
	UpdateExtendedRequestStatusResponse,
	UpdateRequestStatusRequestBody,
	UpdateRequestStatusResponse,
} from "@momoi/model/request";

import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import { createRequestUseCases } from "@momoi/modules/request";
import type { QueueModule } from "@momoi/queue";

import type { CurrentUser } from "./types";

export class RequestService {
	private readonly useCases;

	constructor(prisma: PrismaClient, cache: CacheModule, queue: QueueModule) {
		this.useCases = createRequestUseCases(prisma, cache, queue);
	}

	public async createRequest(
		userId: number,
		body: Static<typeof CreateRequestRequestBody>,
	): Promise<Static<typeof CreateRequestResponse>> {
		return this.useCases.createRequest(userId, body);
	}

	public async getRequests(
		user: CurrentUser,
		query: Static<typeof GetRequestsRequestQuery>,
	): Promise<Static<typeof GetRequestsResponse>> {
		return this.useCases.getRequests(user, query);
	}

	public async updateRequestStatus(
		user: CurrentUser,
		requestId: number,
		body: Static<typeof UpdateRequestStatusRequestBody>,
	): Promise<Static<typeof UpdateRequestStatusResponse>> {
		return this.useCases.updateRequestStatus(user, requestId, body);
	}

	public async createExtendedRequest(
		userId: number,
		body: Static<typeof CreateExtendedRequestRequestBody>,
	): Promise<Static<typeof CreateExtendedRequestResponse>> {
		return this.useCases.createExtendedRequest(userId, body);
	}

	public async getExtendedRequests(
		user: CurrentUser,
		query: Static<typeof GetExtendedRequestsRequestQuery>,
	): Promise<Static<typeof GetExtendedRequestsResponse>> {
		return this.useCases.getExtendedRequests(user, query);
	}

	public async updateExtendedRequestStatus(
		user: CurrentUser,
		extendedRequestId: number,
		body: Static<typeof UpdateExtendedRequestStatusRequestBody>,
	): Promise<Static<typeof UpdateExtendedRequestStatusResponse>> {
		return this.useCases.updateExtendedRequestStatus(
			user,
			extendedRequestId,
			body,
		);
	}

	public async getRequestAuditLogs(
		requestId: number,
		page: number = 1,
		pageSize: number = 10,
	): Promise<Static<typeof GetRequestAuditLogsResponse>> {
		return this.useCases.getRequestAuditLogs(requestId, page, pageSize);
	}

	public async getExtendedRequestAuditLogs(
		extendedRequestId: number,
		page: number = 1,
		pageSize: number = 10,
	): Promise<Static<typeof GetExtendedRequestAuditLogsResponse>> {
		return this.useCases.getExtendedRequestAuditLogs(
			extendedRequestId,
			page,
			pageSize,
		);
	}
}

export * from "./selects";
export * from "./mappers";
export * from "./types";
