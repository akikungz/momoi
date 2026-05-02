import type { Static } from "elysia";
import type { ReverseProxyType as PrismaReverseProxyType } from "@momoi/database/prisma/generated/enums";
import type { PVEVMStatus } from "@momoi/database/prisma/generated/enums";

import type {
	CreateInstanceRequestBody,
	CreateInstanceResponse,
	CreateReverseProxyRequestBody,
	CreateReverseProxyResponse,
	DeleteInstanceResponse,
	DeleteReverseProxyResponse,
	GetInstanceAuditLogsResponse,
	GetInstanceMonitoringResponse,
	GetInstanceResponse,
	GetInstancesRequestQuery,
	GetInstancesResponse,
	InstanceStatusActionResponse,
	GetReverseProxiesResponse,
	PromoteInstanceResponse,
	ReprovisionInstanceResponse,
} from "@momoi/model/instance";
import type {
	PrometheusQueryPort,
	PrometheusQueryResponse,
} from "@momoi/modules/monitoring/application/ports";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";
import {
	mapInstanceCreateToResponse,
	mapInstanceToDetail,
	mapInstancesToResponse,
} from "@momoi/service/instance/mappers";
import {
	INSTANCE_CREATE_SELECT,
	INSTANCE_DETAIL_SELECT,
	INSTANCE_LIST_SELECT,
} from "@momoi/service/instance/selects";
import { parsePagination } from "@momoi/utils/pagination";

import { InstanceCacheKeys, type InstanceFilter } from "../domain/cache-keys";
import type {
	InstanceDataAccess,
	InstanceQueuePort,
	InstanceTelemetryPort,
	JsonCacheStore,
} from "./ports";

const INSTANCE_CPU_MAX = 8;
const INSTRUCTOR_INSTANCE_MEMORY_MB_MAX = 8192;
const INSTRUCTOR_INSTANCE_DISK_GB_MAX = 32;

export class InstanceUseCases {
	constructor(
		private readonly dataAccess: InstanceDataAccess,
		private readonly cache: JsonCacheStore,
		private readonly queue: InstanceQueuePort,
		private readonly telemetry: InstanceTelemetryPort,
		private readonly monitoring: PrometheusQueryPort,
	) {}

	public async createInstanceByInstructor(
		userId: number,
		userRole: "ADMIN" | "INSTRUCTOR",
		body: Static<typeof CreateInstanceRequestBody>,
	): Promise<Static<typeof CreateInstanceResponse>> {
		if (body.cpus > INSTANCE_CPU_MAX) {
			throw new ServiceError(
				`Instance vCPU cannot exceed ${INSTANCE_CPU_MAX}.`,
				400,
			);
		}

		if (body.memoryMB > INSTRUCTOR_INSTANCE_MEMORY_MB_MAX) {
			throw new ServiceError(
				`Instance memory cannot exceed ${INSTRUCTOR_INSTANCE_MEMORY_MB_MAX} MB.`,
				400,
			);
		}

		if (body.diskGB > INSTRUCTOR_INSTANCE_DISK_GB_MAX) {
			throw new ServiceError(
				`Instance disk cannot exceed ${INSTRUCTOR_INSTANCE_DISK_GB_MAX} GB.`,
				400,
			);
		}

		try {
			const instance = await this.dataAccess.prisma.instance.create({
				data: {
					pveTemplateId: body.pveTemplateId,
					courseOfferingId: body.courseOfferingId,
					cpus: body.cpus,
					memoryMB: body.memoryMB,
					diskGB: body.diskGB,
					platformUserId: userId,
				},
				select: INSTANCE_CREATE_SELECT,
			});

			await this.queue.enqueueProvisionInstance(
				instance.id,
				userId,
				`provision-${instance.id}`,
			);
			this.telemetry.recordQueueJobEnqueued("provision-instance", "provision", {
				"app.operation": "create_instance",
			});
			this.telemetry.recordInstanceOperation("create", {
				"user.role": userRole,
			});

			console.info("📋 VM provisioning queued", { instanceId: instance.id });

			return mapInstanceCreateToResponse(instance);
		} catch (error: unknown) {
			handlePrismaError(error, "while creating the instance", {
				notFoundMessage: "Related resource not found.",
			});
		}
	}

	public async getInstancesByUser(
		userId: number,
		query: Static<typeof GetInstancesRequestQuery>,
	): Promise<Static<typeof GetInstancesResponse>> {
		return this.getInstances({ type: "user", userId }, query);
	}

	public async getInstancesByInstructor(
		instructorId: number,
		query: Static<typeof GetInstancesRequestQuery>,
	): Promise<Static<typeof GetInstancesResponse>> {
		return this.getInstances({ type: "instructor", instructorId }, query);
	}

	public async getInstancesByAdmin(
		query: Static<typeof GetInstancesRequestQuery>,
	): Promise<Static<typeof GetInstancesResponse>> {
		return this.getInstances({ type: "admin" }, query);
	}

	public async getInstanceById(
		instanceId: number,
	): Promise<Static<typeof GetInstanceResponse>> {
		const cacheKey = InstanceCacheKeys.detail(instanceId);

		try {
			const cachedData =
				await this.cache.get<Static<typeof GetInstanceResponse>>(cacheKey);
			if (cachedData) {
				return cachedData;
			}
		} catch (cacheReadError: unknown) {
			console.warn(
				"Failed to read instance from cache. Falling back to database.",
				{
					instanceId,
					cacheReadError,
				},
			);
		}

		try {
			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: INSTANCE_DETAIL_SELECT,
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			const response = mapInstanceToDetail(instance);

			try {
				await this.cache.set(cacheKey, response);
			} catch (cacheWriteError: unknown) {
				console.warn("Failed to cache instance response.", {
					instanceId,
					cacheWriteError,
				});
			}

			return response;
		} catch (error: unknown) {
			console.error("Failed to retrieve instance by id.", {
				instanceId,
				err: error,
			});
			handlePrismaError(error, "while retrieving the instance", {
				notFoundMessage: "Instance not found.",
			});
		}
	}

	public async deleteInstance(
		instanceId: number,
	): Promise<Static<typeof DeleteInstanceResponse>> {
		try {
			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: { id: true, platformUserId: true, status: true, pveVMId: true },
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			if (instance.pveVMId) {
				await this.dataAccess.prisma.instance.update({
					where: { id: instanceId },
					data: { status: "DELETED", provisionStatus: "QUEUED" },
				});

				await this.queue.enqueueDeprovisionInstance(
					instanceId,
					instance.platformUserId,
					`deprovision-${instanceId}`,
				);
				this.telemetry.recordQueueJobEnqueued(
					"deprovision-instance",
					"deprovision",
					{
						"app.operation": "delete_instance",
					},
				);
				this.telemetry.recordInstanceOperation("delete_queued", {
					"instance.has_vm": true,
				});

				console.info("📋 VM deprovisioning queued", { instanceId });
			} else {
				await this.dataAccess.prisma.instance.delete({
					where: { id: instanceId },
				});
				this.telemetry.recordInstanceOperation("delete_completed", {
					"instance.has_vm": false,
				});
				console.info("🗑️ Instance deleted (no VM)", { instanceId });
			}

			await this.cache.invalidate(InstanceCacheKeys.detailPattern(instanceId));

			return { success: true };
		} catch (error: unknown) {
			handlePrismaError(error, "while deleting the instance", {
				notFoundMessage: "Instance not found.",
			});
		}
	}

	public async getInstanceMonitoring(
		instanceId: number,
	): Promise<Static<typeof GetInstanceMonitoringResponse>> {
		let instance: {
			id: number;
			pveVM: {
				vmId: number;
				hostname: string;
			} | null;
		} | null = null;

		try {
			instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: {
					id: true,
					pveVM: {
						select: {
							vmId: true,
							hostname: true,
						},
					},
				},
			});
		} catch (error: unknown) {
			handlePrismaError(error, "while retrieving instance monitoring", {
				notFoundMessage: "Instance not found.",
			});
		}

		if (!instance) {
			throw new ServiceError("Instance not found.", 404);
		}

		if (!instance.pveVM) {
			throw new ServiceError(
				"Monitoring is unavailable until the instance has an assigned VM.",
				409,
			);
		}

		const pveVM = instance.pveVM;

		const generatedAt = new Date().toISOString();
		const queries = {
			uptimeSeconds: "otelcol_proxmox_vm_uptime_seconds",
			cpuPercent: "otelcol_proxmox_vm_cpu_percent",
			memoryUsedBytes: "otelcol_proxmox_vm_mem_bytes",
			memoryCapacityBytes: "otelcol_proxmox_vm_maxmem_bytes",
		} as const;

		const responses = Object.fromEntries(
			await Promise.all(
				Object.entries(queries).map(async ([key, query]) => [
					key,
					await this.monitoring.query({ query, time: generatedAt }),
				]),
			),
		) as Record<keyof typeof queries, PrometheusQueryResponse>;

		const metrics = Object.fromEntries(
			Object.keys(queries).map((key) => {
				const metricKey = key as keyof typeof queries;
				const sample = this.findVmMetricSample(
					responses[metricKey],
					pveVM.vmId,
					pveVM.hostname,
				);

				return [
					metricKey,
					{
						sample,
						value: this.extractMetricValue(sample),
					},
				];
			}),
		) as Record<
			keyof typeof queries,
			{
				sample: unknown;
				value: number | null;
			}
		>;

		return {
			generatedAt,
			instanceId: instance.id,
			vmId: pveVM.vmId,
			hostname: pveVM.hostname,
			summary: {
				uptimeSeconds: metrics.uptimeSeconds.value,
				cpuPercent: metrics.cpuPercent.value,
				memoryUsedBytes: metrics.memoryUsedBytes.value,
				memoryCapacityBytes: metrics.memoryCapacityBytes.value,
			},
			queries,
			details: {
				uptimeSeconds: metrics.uptimeSeconds.sample,
				cpuPercent: metrics.cpuPercent.sample,
				memoryUsedBytes: metrics.memoryUsedBytes.sample,
				memoryCapacityBytes: metrics.memoryCapacityBytes.sample,
			},
		};
	}

	public async createReverseProxy(
		instanceId: number,
		body: Static<typeof CreateReverseProxyRequestBody>,
	): Promise<Static<typeof CreateReverseProxyResponse>> {
		try {
			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: { id: true },
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			const reverseProxy =
				await this.dataAccess.prisma.instanceReverseProxy.create({
					data: {
						instanceId,
						targetPort: body.targetPort,
						type: this.toPrismaReverseProxyType(body.type),
						description: body.description,
					},
					select: {
						id: true,
						targetPort: true,
						type: true,
						description: true,
						createdAt: true,
						updatedAt: true,
					},
				});

			await this.cache.invalidate(InstanceCacheKeys.detailPattern(instanceId));

			return {
				id: reverseProxy.id,
				targetPort: reverseProxy.targetPort,
				type: reverseProxy.type,
				description: reverseProxy.description ?? undefined,
				createdAt: reverseProxy.createdAt,
				updatedAt: reverseProxy.updatedAt,
			};
		} catch (error: unknown) {
			handlePrismaError(error, "while creating the reverse proxy", {
				notFoundMessage: "Instance not found.",
				duplicateMessage:
					"Reverse proxy for this port already exists on this instance.",
			});
		}
	}

	public async getReverseProxies(
		instanceId: number,
	): Promise<Static<typeof GetReverseProxiesResponse>> {
		try {
			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: {
					instanceReverseProxies: {
						select: {
							id: true,
							targetPort: true,
							type: true,
							description: true,
							createdAt: true,
							updatedAt: true,
						},
						orderBy: { createdAt: "desc" },
					},
				},
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			return instance.instanceReverseProxies.map((proxy) => ({
				id: proxy.id,
				targetPort: proxy.targetPort,
				type: proxy.type,
				description: proxy.description ?? undefined,
				createdAt: proxy.createdAt,
				updatedAt: proxy.updatedAt,
			}));
		} catch (error: unknown) {
			handlePrismaError(error, "while retrieving reverse proxies", {
				notFoundMessage: "Instance not found.",
			});
		}
	}

	public async deleteReverseProxy(
		instanceId: number,
		proxyId: number,
	): Promise<Static<typeof DeleteReverseProxyResponse>> {
		try {
			await this.dataAccess.prisma.instanceReverseProxy.delete({
				where: { id: proxyId, instanceId },
			});

			await this.cache.invalidate(InstanceCacheKeys.detailPattern(instanceId));

			return { success: true };
		} catch (error: unknown) {
			handlePrismaError(error, "while deleting the reverse proxy", {
				notFoundMessage: "Reverse proxy not found.",
			});
		}
	}

	public async startInstance(
		instanceId: number,
		performedById: number,
	): Promise<Static<typeof InstanceStatusActionResponse>> {
		return this.changeInstanceStatus(instanceId, performedById, "start");
	}

	public async stopInstance(
		instanceId: number,
		performedById: number,
	): Promise<Static<typeof InstanceStatusActionResponse>> {
		return this.changeInstanceStatus(instanceId, performedById, "stop");
	}

	public async restartInstance(
		instanceId: number,
		performedById: number,
	): Promise<Static<typeof InstanceStatusActionResponse>> {
		return this.changeInstanceStatus(instanceId, performedById, "restart");
	}

	public async promoteInstance(
		instanceId: number,
		performedById: number,
	): Promise<Static<typeof PromoteInstanceResponse>> {
		try {
			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: { id: true, status: true },
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			if (instance.status === "PROMOTED") {
				throw new ServiceError("Instance is already promoted.", 400);
			}

			if (instance.status !== "ACTIVE") {
				throw new ServiceError("Only ACTIVE instances can be promoted.", 400);
			}

			const updatedInstance = await this.dataAccess.prisma.instance.update({
				where: { id: instanceId },
				data: { status: "PROMOTED" },
				select: { id: true, status: true },
			});
			this.telemetry.recordInstanceOperation("promote", {
				"user.role": "ADMIN",
			});

			await this.dataAccess.prisma.instanceAuditLog.create({
				data: {
					instanceId,
					action: "PROMOTED",
					performedById,
					notes: "Instance promoted to long-term/production status",
				},
			});

			await Promise.all([
				this.cache.invalidate(InstanceCacheKeys.detailPattern(instanceId)),
				this.cache.invalidate(InstanceCacheKeys.auditLogsPattern(instanceId)),
			]);

			return {
				id: updatedInstance.id,
				status: updatedInstance.status,
				message: "Instance successfully promoted.",
			};
		} catch (error: unknown) {
			handlePrismaError(error, "while promoting the instance", {
				notFoundMessage: "Instance not found.",
			});
		}
	}

	public async reprovisionInstance(
		instanceId: number,
		performedById: number,
		userRole: "ADMIN" | "INSTRUCTOR" | "STUDENT",
	): Promise<Static<typeof ReprovisionInstanceResponse>> {
		try {
			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: {
					id: true,
					provisionStatus: true,
					platformUserId: true,
					status: true,
				},
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			if (userRole === "STUDENT" && instance.platformUserId !== performedById) {
				throw new ServiceError(
					"You can only re-provision your own instances.",
					403,
				);
			}

			if (instance.provisionStatus !== "FAILED") {
				throw new ServiceError(
					"Only failed instances can be re-provisioned.",
					400,
				);
			}

			const updatedInstance = await this.dataAccess.prisma.instance.update({
				where: { id: instanceId },
				data: {
					provisionStatus: "QUEUED",
					provisionError: null,
				},
				select: {
					id: true,
					provisionStatus: true,
				},
			});

			await this.dataAccess.prisma.instanceAuditLog.create({
				data: {
					instanceId,
					action: "RE_PROVISIONED",
					performedById,
					notes: "Instance queued for re-provisioning after failure",
				},
			});

			await Promise.all([
				this.cache.invalidate(InstanceCacheKeys.detailPattern(instanceId)),
				this.cache.invalidate(InstanceCacheKeys.auditLogsPattern(instanceId)),
			]);

			await this.queue.enqueueProvisionInstance(
				instanceId,
				instance.platformUserId,
				`reprovision-${instanceId}`,
			);
			this.telemetry.recordQueueJobEnqueued(
				"provision-instance",
				"reprovision",
				{
					"app.operation": "reprovision_instance",
				},
			);
			this.telemetry.recordInstanceOperation("reprovision", {
				"user.role": userRole,
			});

			console.info("📋 VM re-provisioning queued", { instanceId });

			return {
				id: updatedInstance.id,
				provisionStatus: updatedInstance.provisionStatus,
				message: "Instance successfully queued for re-provisioning.",
			};
		} catch (error: unknown) {
			handlePrismaError(error, "while re-provisioning the instance", {
				notFoundMessage: "Instance not found.",
			});
		}
	}

	public async getInstanceAuditLogs(
		instanceId: number,
		page: number = 1,
		pageSize: number = 10,
	): Promise<Static<typeof GetInstanceAuditLogsResponse>> {
		try {
			const skip = (page - 1) * pageSize;
			const cacheKey = InstanceCacheKeys.auditLogs(instanceId, page, pageSize);
			const cached =
				await this.cache.get<Static<typeof GetInstanceAuditLogsResponse>>(
					cacheKey,
				);
			if (cached) return cached;

			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: { id: true },
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			const [totalItems, logs] = await Promise.all([
				this.dataAccess.prisma.instanceAuditLog.count({
					where: { instanceId },
				}),
				this.dataAccess.prisma.instanceAuditLog.findMany({
					where: { instanceId },
					skip,
					take: pageSize,
					orderBy: { timestamp: "desc" },
					select: {
						id: true,
						action: true,
						performedBy: {
							select: {
								id: true,
								user: {
									select: {
										name: true,
										email: true,
									},
								},
							},
						},
						timestamp: true,
						notes: true,
					},
				}),
			]);

			const response = {
				values: logs.map((log) => ({
					id: log.id,
					action: log.action,
					performedBy: {
						id: log.performedBy.id,
						name: log.performedBy.user.name,
						email: log.performedBy.user.email,
					},
					timestamp: log.timestamp,
					notes: log.notes ?? undefined,
				})),
				currentPage: page,
				pageSize,
				totalItems,
				totalPages: Math.ceil(totalItems / pageSize),
			} satisfies Static<typeof GetInstanceAuditLogsResponse>;

			await this.cache.set(cacheKey, response, 600);
			return response;
		} catch (error: unknown) {
			handlePrismaError(error, "while retrieving audit logs", {
				notFoundMessage: "Instance not found.",
			});
		}
	}

	private async getInstances(
		filter: InstanceFilter,
		query: Static<typeof GetInstancesRequestQuery>,
	): Promise<Static<typeof GetInstancesResponse>> {
		try {
			const { page, pageSize, skip, take } = parsePagination(query);
			const whereClause = this.buildInstanceWhereClause(filter, query);

			const [totalItems, data] = await Promise.all([
				this.dataAccess.prisma.instance.count({ where: whereClause }),
				this.dataAccess.prisma.instance.findMany({
					where: whereClause,
					skip,
					take,
					orderBy: { createdAt: "desc" },
					select: INSTANCE_LIST_SELECT,
				}),
			]);

			return mapInstancesToResponse(data, totalItems, page, pageSize);
		} catch (error: unknown) {
			const context =
				filter.type === "user"
					? "while retrieving instances for the user"
					: filter.type === "instructor"
						? "while retrieving instances for the instructor"
						: "while retrieving instances";
			handlePrismaError(error, context, {
				notFoundMessage: "Related resource not found.",
			});
		}
	}

	private buildInstanceWhereClause(
		filter: InstanceFilter,
		query: Static<typeof GetInstancesRequestQuery>,
	) {
		const courseFilter = {
			courseId: query.courseId ?? undefined,
			semesterId: query.semesterId ?? undefined,
		};

		const baseFilter = {
			status: { not: "DELETED" as const },
		};

		switch (filter.type) {
			case "user":
				return {
					...baseFilter,
					platformUserId: filter.userId,
					courseOffering: courseFilter,
				};
			case "instructor":
				return {
					...baseFilter,
					courseOffering: {
						course: {
							instructors: {
								some: { id: filter.instructorId },
							},
						},
						...courseFilter,
					},
				};
			case "admin":
				return {
					...baseFilter,
					courseOffering: courseFilter,
				};
		}
	}

	private findVmMetricSample(
		response: PrometheusQueryResponse,
		vmId: number,
		hostname: string,
	) {
		if (
			response.data.resultType !== "vector" ||
			!Array.isArray(response.data.result)
		) {
			return null;
		}

		const normalizedVmId = String(vmId);

		return (
			response.data.result.find((item) => {
				if (
					typeof item !== "object" ||
					item === null ||
					!("metric" in item) ||
					typeof item.metric !== "object" ||
					item.metric === null
				) {
					return false;
				}

				const metric = item.metric as Record<string, string>;
				const identifierCandidates = [
					metric.id,
					metric.vmid,
					metric.vmId,
					metric.vm_id,
				].filter((value): value is string => Boolean(value));

				if (
					identifierCandidates.some(
						(value) =>
							value === normalizedVmId || value.endsWith(`/${normalizedVmId}`),
					)
				) {
					return true;
				}

				return [metric.name, metric.hostname].some(
					(value) => value === hostname,
				);
			}) ?? null
		);
	}

	private extractMetricValue(sample: unknown) {
		if (
			typeof sample !== "object" ||
			sample === null ||
			!("value" in sample)
		) {
			return null;
		}

		const value = sample.value;
		if (Array.isArray(value) && value.length >= 2) {
			return this.parseMetricNumber(value[1]);
		}

		return this.parseMetricNumber(value);
	}

	private parseMetricNumber(value: unknown) {
		if (typeof value === "number") {
			return Number.isFinite(value) ? value : null;
		}

		if (typeof value === "string") {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}

		return null;
	}

	private async changeInstanceStatus(
		instanceId: number,
		performedById: number,
		action: "start" | "stop" | "restart",
	): Promise<Static<typeof InstanceStatusActionResponse>> {
		try {
			const instance = await this.dataAccess.prisma.instance.findUnique({
				where: { id: instanceId },
				select: {
					id: true,
					status: true,
					pveVM: {
						select: {
							status: true,
						},
					},
				},
			});

			if (!instance) {
				throw new ServiceError("Instance not found.", 404);
			}

			if (instance.status === "DELETED") {
				throw new ServiceError("Deleted instances cannot be updated.", 400);
			}

			if (instance.status === "PENDING") {
				throw new ServiceError(
					"Pending instances cannot be updated yet.",
					400,
				);
			}

			if (!instance.pveVM) {
				throw new ServiceError("Instance VM not found.", 409);
			}

			if (
				instance.pveVM.status !== "RUNNING" &&
				instance.pveVM.status !== "STOPPED" &&
				instance.pveVM.status !== "SUSPENDED"
			) {
				throw new ServiceError(
					`Instance cannot perform ${action} from ${instance.pveVM.status} status.`,
					400,
				);
			}

			const transitions = {
				start: {
					from: ["STOPPED", "SUSPENDED"] as const,
					to: "RUNNING" as const,
					auditAction: "STARTED",
					message: "Instance successfully started.",
					verb: "started",
				},
				stop: {
					from: ["RUNNING"] as const,
					to: "STOPPED" as const,
					auditAction: "STOPPED",
					message: "Instance successfully stopped.",
					verb: "stopped",
				},
				restart: {
					from: ["RUNNING"] as const,
					to: "RUNNING" as const,
					auditAction: "RESTARTED",
					message: "Instance successfully restarted.",
					verb: "restarted",
				},
			} satisfies Record<
				"start" | "stop" | "restart",
				{
					from: readonly ("RUNNING" | "STOPPED" | "SUSPENDED")[];
					to: "RUNNING" | "STOPPED" | "SUSPENDED";
					auditAction: string;
					message: string;
					verb: string;
				}
			>;

			const transition = transitions[action];

			if (!(transition.from as readonly PVEVMStatus[]).includes(instance.pveVM.status)) {
				throw new ServiceError(
					`Instance cannot be ${transition.verb} from ${instance.pveVM.status} status.`,
					400,
				);
			}

			const updatedInstance = await this.dataAccess.prisma.instance.update({
				where: { id: instanceId },
				data: {
					pveVM: {
						update: {
							status: transition.to,
						},
					},
				},
				select: {
					id: true,
					pveVM: {
						select: {
							status: true,
						},
					},
				},
			});

			await this.dataAccess.prisma.instanceAuditLog.create({
				data: {
					instanceId,
					action: transition.auditAction,
					performedById,
					notes: `Instance ${action} action requested`,
				},
			});

			await Promise.all([
				this.cache.invalidate(InstanceCacheKeys.detailPattern(instanceId)),
				this.cache.invalidate(InstanceCacheKeys.auditLogsPattern(instanceId)),
			]);

			await this.queue.enqueueToggleInstanceStatus(
				instanceId,
				performedById,
				action.toUpperCase() as "START" | "STOP" | "RESTART",
				`toggle-status-${action}-${instanceId}`,
			);
			this.telemetry.recordQueueJobEnqueued(
				"toggle-instance-status",
				"toggle-status",
				{
					"app.operation": `change_instance_status_${action}`,
				},
			);

			this.telemetry.recordInstanceOperation(action);

			return {
				id: updatedInstance.id,
				status: updatedInstance.pveVM?.status ?? transition.to,
				message: transition.message,
			};
		} catch (error: unknown) {
			handlePrismaError(error, `while trying to ${action} the instance`, {
				notFoundMessage: "Instance not found.",
			});
		}
	}

	private toPrismaReverseProxyType(type: string): PrismaReverseProxyType {
		return type === "HTTPS" ? "HTTP" : (type as PrismaReverseProxyType);
	}
}
