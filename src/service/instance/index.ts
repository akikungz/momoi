import type { Static } from "elysia";

import type {
	CreateInstanceRequestBody,
	CreateInstanceResponse,
	CreateReverseProxyRequestBody,
	CreateReverseProxyResponse,
	DeleteInstanceResponse,
	DeleteReverseProxyResponse,
	GetInstanceAuditLogsResponse,
	GetInstanceResponse,
	GetInstancesRequestQuery,
	GetInstancesResponse,
	GetReverseProxiesResponse,
	PromoteInstanceResponse,
	ReprovisionInstanceResponse,
} from "@momoi/model/instance";

import type { CacheModule } from "@momoi/cache";
import type { PrismaClient } from "@momoi/database/prisma/generated/client";
import { createInstanceUseCases } from "@momoi/modules/instance";
import type { QueueModule } from "@momoi/queue";

export class InstanceService {
	private readonly useCases;

	constructor(prisma: PrismaClient, cache: CacheModule, queue: QueueModule) {
		this.useCases = createInstanceUseCases(prisma, cache, queue);
	}

	public async createInstanceByInstructor(
		userId: number,
		body: Static<typeof CreateInstanceRequestBody>,
	): Promise<Static<typeof CreateInstanceResponse>> {
		return this.useCases.createInstanceByInstructor(userId, body);
	}

	public async getInstancesByUser(
		userId: number,
		query: Static<typeof GetInstancesRequestQuery>,
	): Promise<Static<typeof GetInstancesResponse>> {
		return this.useCases.getInstancesByUser(userId, query);
	}

	public async getInstancesByInstructor(
		instructorId: number,
		query: Static<typeof GetInstancesRequestQuery>,
	): Promise<Static<typeof GetInstancesResponse>> {
		return this.useCases.getInstancesByInstructor(instructorId, query);
	}

	public async getInstancesByAdmin(
		query: Static<typeof GetInstancesRequestQuery>,
	): Promise<Static<typeof GetInstancesResponse>> {
		return this.useCases.getInstancesByAdmin(query);
	}

	public async getInstanceById(
		instanceId: number,
	): Promise<Static<typeof GetInstanceResponse>> {
		return this.useCases.getInstanceById(instanceId);
	}

	public async deleteInstance(
		instanceId: number,
	): Promise<Static<typeof DeleteInstanceResponse>> {
		return this.useCases.deleteInstance(instanceId);
	}

	public async createReverseProxy(
		instanceId: number,
		body: Static<typeof CreateReverseProxyRequestBody>,
	): Promise<Static<typeof CreateReverseProxyResponse>> {
		return this.useCases.createReverseProxy(instanceId, body);
	}

	public async getReverseProxies(
		instanceId: number,
	): Promise<Static<typeof GetReverseProxiesResponse>> {
		return this.useCases.getReverseProxies(instanceId);
	}

	public async deleteReverseProxy(
		instanceId: number,
		proxyId: number,
	): Promise<Static<typeof DeleteReverseProxyResponse>> {
		return this.useCases.deleteReverseProxy(instanceId, proxyId);
	}

	public async promoteInstance(
		instanceId: number,
		performedById: number,
	): Promise<Static<typeof PromoteInstanceResponse>> {
		return this.useCases.promoteInstance(instanceId, performedById);
	}

	public async reprovisionInstance(
		instanceId: number,
		performedById: number,
		userRole: "ADMIN" | "INSTRUCTOR" | "STUDENT",
	): Promise<Static<typeof ReprovisionInstanceResponse>> {
		return this.useCases.reprovisionInstance(
			instanceId,
			performedById,
			userRole,
		);
	}

	public async getInstanceAuditLogs(
		instanceId: number,
		page: number = 1,
		pageSize: number = 10,
	): Promise<Static<typeof GetInstanceAuditLogsResponse>> {
		return this.useCases.getInstanceAuditLogs(instanceId, page, pageSize);
	}
}

export * from "./selects";
export * from "./mappers";
export * from "./types";
