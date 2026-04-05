import type { Static } from "elysia";

import {
	ApprovalActionStatus,
	type CreateExtendedRequestRequestBody,
	type CreateExtendedRequestResponse,
	type CreateRequestRequestBody,
	type CreateRequestResponse,
	type GetExtendedRequestAuditLogsResponse,
	type GetExtendedRequestsRequestQuery,
	type GetExtendedRequestsResponse,
	type GetRequestAuditLogsResponse,
	type GetRequestsRequestQuery,
	type GetRequestsResponse,
	type UpdateExtendedRequestStatusRequestBody,
	type UpdateExtendedRequestStatusResponse,
	type UpdateRequestStatusRequestBody,
	type UpdateRequestStatusResponse,
} from "@momoi/model/request";
import { handlePrismaError, ServiceError } from "@momoi/utils/error";

import { RequestCacheKeys } from "../domain/cache-keys";
import type {
	JsonCacheStore,
	RequestDataAccess,
	RequestQueuePort,
	RequestTelemetryPort,
} from "./ports";
import { mapExtendedRequest, mapRequest } from "@momoi/service/request/mappers";
import {
	EXTENDED_REQUEST_SELECT,
	REQUEST_SELECT,
} from "@momoi/service/request/selects";
import {
	buildExtendedRequestFilter,
	buildRequestFilter,
	type CurrentUser,
} from "@momoi/service/request/types";

type AuditLogResponse = Static<typeof GetRequestAuditLogsResponse>;
type ExtendedAuditLogResponse = Static<
	typeof GetExtendedRequestAuditLogsResponse
>;
const STUDENT_REQUEST_CPU_MAX = 4;
const STUDENT_REQUEST_MEMORY_MB_MAX = 2048;
const STUDENT_REQUEST_DISK_GB_MAX = 8;

export class RequestUseCases {
	constructor(
		private readonly dataAccess: RequestDataAccess,
		private readonly cache: JsonCacheStore,
		private readonly queue: RequestQueuePort,
		private readonly telemetry: RequestTelemetryPort,
	) { }

	public async createRequest(
		userId: number,
		body: Static<typeof CreateRequestRequestBody>,
	): Promise<Static<typeof CreateRequestResponse>> {
		if (body.cpus > STUDENT_REQUEST_CPU_MAX) {
			throw new ServiceError(
				`Requested vCPU cannot exceed ${STUDENT_REQUEST_CPU_MAX}.`,
				400,
			);
		}

		if (body.memoryMB > STUDENT_REQUEST_MEMORY_MB_MAX) {
			throw new ServiceError(
				`Requested memory cannot exceed ${STUDENT_REQUEST_MEMORY_MB_MAX} MB.`,
				400,
			);
		}

		if (body.diskGB > STUDENT_REQUEST_DISK_GB_MAX) {
			throw new ServiceError(
				`Requested disk cannot exceed ${STUDENT_REQUEST_DISK_GB_MAX} GB.`,
				400,
			);
		}

		try {
			const request = await this.dataAccess.prisma.request.create({
				data: {
					title: body.title,
					description: body.description,
					courseOfferingId: body.courseOfferingId,
					pveTemplateId: body.pveTemplateId,
					cpus: body.cpus,
					memoryMB: body.memoryMB,
					diskGB: body.diskGB,
					requesterId: userId,
				},
				select: REQUEST_SELECT,
			});

			await this.invalidateRequestCaches();
			this.telemetry.recordRequestOperation("create", {
				"request.type": "standard",
			});

			return mapRequest(request);
		} catch (error: unknown) {
			handlePrismaError(error, "while creating the request", {
				notFoundMessage: "Related resource not found for request creation.",
			});
		}
	}

	public async getRequests(
		user: CurrentUser,
		query: Static<typeof GetRequestsRequestQuery>,
	): Promise<Static<typeof GetRequestsResponse>> {
		const { where, pagination } = buildRequestFilter(user, query);

		const [totalItems, items] = await Promise.all([
			this.dataAccess.prisma.request.count({ where }),
			this.dataAccess.prisma.request.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
				select: REQUEST_SELECT,
			}),
		]);

		return {
			values: items.map((item) => mapRequest(item)),
			totalItems,
			totalPages: Math.ceil(totalItems / pagination.take),
			currentPage: pagination.page,
			pageSize: pagination.take,
		};
	}

	public async updateRequestStatus(
		user: CurrentUser,
		requestId: number,
		body: Static<typeof UpdateRequestStatusRequestBody>,
	): Promise<Static<typeof UpdateRequestStatusResponse>> {
		const request = await this.dataAccess.prisma.request.findUnique({
			where: { id: requestId },
			include: {
				courseOffering: {
					include: {
						course: {
							select: {
								code: true,
								title: true,
								instructors: { select: { id: true } },
							},
						},
						semester: { select: { name: true } },
					},
				},
			},
		});

		if (!request) {
			throw new ServiceError("Request not found.", 404);
		}

		if (request.status !== "PENDING") {
			throw new ServiceError("Request has already been processed.", 400);
		}

		const isAdmin = user.role === "ADMIN";
		const isRequester = request.requesterId === user.id;
		const isInstructorForCourse =
			request.courseOffering?.course.instructors.some(
				(instr) => instr.id === user.id,
			) ?? false;

		if (body.status === "CANCELLED") {
			if (!isRequester) {
				throw new ServiceError(
					"Only the requester can cancel this request.",
					403,
				);
			}
		} else if (
			!isAdmin &&
			!(user.role === "INSTRUCTOR" && isInstructorForCourse)
		) {
			throw new ServiceError(
				"You are not authorized to act on this request.",
				403,
			);
		}

		const [updated] = await this.dataAccess.prisma.$transaction([
			this.dataAccess.prisma.request.update({
				where: { id: requestId },
				data: {
					status: body.status,
					reason: body.reason,
					reviewerId:
						body.status === "CANCELLED"
							? (request.reviewerId ?? undefined)
							: user.id,
				},
				select: REQUEST_SELECT,
			}),
			this.dataAccess.prisma.requestAuditLog.create({
				data: {
					requestId,
					action: body.status,
					performedById: user.id,
					notes: body.reason,
				},
			}),
		]);

		this.telemetry.recordRequestOperation("status_update", {
			"request.type": "standard",
			"request.status": updated.status,
			"user.role": user.role,
		});

		if (updated.status === "APPROVED") {
			const instance = await this.dataAccess.prisma.instance.create({
				data: {
					courseOfferingId: request.courseOfferingId,
					pveTemplateId: request.pveTemplateId,
					cpus: request.cpus,
					memoryMB: request.memoryMB,
					diskGB: request.diskGB,
					platformUserId: request.requesterId,
					requestId: request.id,
					semesterId: request.courseOffering?.semesterId,
				},
			});

			console.info(
				`Request ${request.id} approved, created instance ${instance.id}, enqueueing provisioning job.`,
			);

			await this.queue.enqueueProvisionInstance(
				instance.id,
				request.requesterId,
			);
			this.telemetry.recordQueueJobEnqueued("provision-instance", "provision", {
				"app.operation": "approve_request",
			});
		}

		await Promise.all([
			this.invalidateRequestCaches(),
			this.cache.invalidate(
				RequestCacheKeys.requestAuditLogsPattern(requestId),
			),
		]);

		return mapRequest(updated);
	}

	public async createExtendedRequest(
		userId: number,
		body: Static<typeof CreateExtendedRequestRequestBody>,
	): Promise<Static<typeof CreateExtendedRequestResponse>> {
		const targetInstance = await this.dataAccess.prisma.instance.findUnique({
			where: { id: body.targetInstanceId },
			select: {
				platformUserId: true,
				courseOffering: {
					select: {
						semester: {
							select: { id: true, endDate: true },
						},
					},
				},
				semesterId: true,
			},
		});

		if (!targetInstance || targetInstance.platformUserId !== userId) {
			throw new ServiceError(
				"Instance not found or not owned by the user.",
				404,
			);
		}

		const currentSemesterEndDate =
			targetInstance.courseOffering?.semester?.endDate;
		if (!currentSemesterEndDate) {
			throw new ServiceError(
				"Unable to determine current semester for the instance.",
				400,
			);
		}

		const currentDate = new Date();
		if (currentSemesterEndDate < currentDate) {
			throw new ServiceError(
				"Current semester has already ended. Extended request is not allowed.",
				400,
			);
		}

		const nextSemester = await this.dataAccess.prisma.semester.findFirst({
			where: { startDate: { gt: currentDate } },
			orderBy: { startDate: "asc" },
		});

		if (!nextSemester) {
			throw new ServiceError(
				"No upcoming semester found for this extended request.",
				404,
			);
		}

		if (targetInstance.semesterId !== nextSemester.id) {
			throw new ServiceError(
				"Target instance is not associated with the next upcoming semester.",
				400,
			);
		}

		try {
			const extendedRequest =
				await this.dataAccess.prisma.extendedRequest.create({
					data: {
						title: body.title,
						description: body.description,
						targetInstanceId: body.targetInstanceId,
						requesterId: userId,
						nextSemesterId: nextSemester.id,
					},
					select: EXTENDED_REQUEST_SELECT,
				});

			await this.invalidateExtendedRequestCaches();
			this.telemetry.recordRequestOperation("create", {
				"request.type": "extended",
			});

			return mapExtendedRequest(extendedRequest);
		} catch (error: unknown) {
			handlePrismaError(error, "while creating the extended request", {
				notFoundMessage:
					"Related resource not found for extended request creation.",
			});
		}
	}

	public async getExtendedRequests(
		user: CurrentUser,
		query: Static<typeof GetExtendedRequestsRequestQuery>,
	): Promise<Static<typeof GetExtendedRequestsResponse>> {
		const { where, pagination } = buildExtendedRequestFilter(user, query);

		const [totalItems, items] = await Promise.all([
			this.dataAccess.prisma.extendedRequest.count({ where }),
			this.dataAccess.prisma.extendedRequest.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
				select: EXTENDED_REQUEST_SELECT,
			}),
		]);

		return {
			values: items.map((item) => mapExtendedRequest(item)),
			totalItems,
			totalPages: Math.ceil(totalItems / pagination.take),
			currentPage: pagination.page,
			pageSize: pagination.take,
		};
	}

	public async updateExtendedRequestStatus(
		user: CurrentUser,
		extendedRequestId: number,
		body: Static<typeof UpdateExtendedRequestStatusRequestBody>,
	): Promise<Static<typeof UpdateExtendedRequestStatusResponse>> {
		const extendedRequest =
			await this.dataAccess.prisma.extendedRequest.findUnique({
				where: { id: extendedRequestId },
				include: {
					targetInstance: {
						include: {
							courseOffering: {
								include: {
									course: {
										select: {
											code: true,
											title: true,
											instructors: { select: { id: true } },
										},
									},
									semester: { select: { name: true } },
								},
							},
						},
					},
				},
			});

		if (!extendedRequest) {
			throw new ServiceError("Extended request not found.", 404);
		}

		if (extendedRequest.status !== "PENDING") {
			throw new ServiceError(
				"Extended request has already been processed.",
				400,
			);
		}

		const isAdmin = user.role === "ADMIN";
		const isRequester = extendedRequest.requesterId === user.id;
		const isInstructorForCourse =
			extendedRequest.targetInstance?.courseOffering?.course.instructors.some(
				(instr) => instr.id === user.id,
			) ?? false;

		if (body.status === "CANCELLED") {
			if (!isRequester) {
				throw new ServiceError(
					"Only the requester can cancel this extended request.",
					403,
				);
			}
		} else if (
			!isAdmin &&
			!(user.role === "INSTRUCTOR" && isInstructorForCourse)
		) {
			throw new ServiceError(
				"You are not authorized to act on this extended request.",
				403,
			);
		}

		const [updated] = await this.dataAccess.prisma.$transaction([
			this.dataAccess.prisma.extendedRequest.update({
				where: { id: extendedRequestId },
				data: {
					status: body.status,
					reason: body.reason,
					reviewerId:
						body.status === "CANCELLED"
							? (extendedRequest.reviewerId ?? undefined)
							: user.id,
				},
				select: EXTENDED_REQUEST_SELECT,
			}),
			this.dataAccess.prisma.extendedRequestAuditLog.create({
				data: {
					extendedRequestId,
					action: body.status,
					performedById: user.id,
					notes: body.reason,
				},
			}),
			this.dataAccess.prisma.instanceAuditLog.create({
				data: {
					instanceId: extendedRequest.targetInstanceId,
					action: `Extended request ${body.status}`,
					performedById: user.id,
					notes: body.reason,
				},
			}),
			this.dataAccess.prisma.instance.update({
				where: { id: extendedRequest.targetInstanceId },
				data: {
					...(
						body.status === "APPROVED"
							? { semesterId: extendedRequest.nextSemesterId }
							: {}
					)
				},
			}),
		]);

		this.telemetry.recordRequestOperation("status_update", {
			"request.type": "extended",
			"request.status": updated.status,
			"user.role": user.role,
		});

		if (updated.status === ApprovalActionStatus.APPROVED) {
			await this.dataAccess.prisma.instance.update({
				where: { id: extendedRequest.targetInstanceId },
				data: { semesterId: extendedRequest.nextSemesterId },
			});
		}

		await Promise.all([
			this.invalidateExtendedRequestCaches(),
			this.cache.invalidate(
				RequestCacheKeys.extendedRequestAuditLogsPattern(extendedRequestId),
			),
		]);

		return mapExtendedRequest(updated);
	}

	public async getRequestAuditLogs(
		requestId: number,
		page: number = 1,
		pageSize: number = 10,
	): Promise<AuditLogResponse> {
		try {
			const skip = (page - 1) * pageSize;
			const cacheKey = RequestCacheKeys.requestAuditLogs(
				requestId,
				page,
				pageSize,
			);
			const cached = await this.cache.get<AuditLogResponse>(cacheKey);
			if (cached) return cached;

			const request = await this.dataAccess.prisma.request.findUnique({
				where: { id: requestId },
				select: { id: true },
			});

			if (!request) {
				throw new ServiceError("Request not found.", 404);
			}

			const [totalItems, logs] = await Promise.all([
				this.dataAccess.prisma.requestAuditLog.count({ where: { requestId } }),
				this.dataAccess.prisma.requestAuditLog.findMany({
					where: { requestId },
					skip,
					take: pageSize,
					orderBy: { timestamp: "desc" },
					select: {
						id: true,
						action: true,
						performedBy: {
							select: {
								id: true,
								user: { select: { name: true, email: true } },
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
			} satisfies AuditLogResponse;

			await this.cache.set(cacheKey, response, 600);
			return response;
		} catch (error: unknown) {
			handlePrismaError(error, "while retrieving request audit logs", {
				notFoundMessage: "Request not found.",
			});
		}
	}

	public async getExtendedRequestAuditLogs(
		extendedRequestId: number,
		page: number = 1,
		pageSize: number = 10,
	): Promise<ExtendedAuditLogResponse> {
		try {
			const skip = (page - 1) * pageSize;
			const cacheKey = RequestCacheKeys.extendedRequestAuditLogs(
				extendedRequestId,
				page,
				pageSize,
			);
			const cached = await this.cache.get<ExtendedAuditLogResponse>(cacheKey);
			if (cached) return cached;

			const extendedRequest =
				await this.dataAccess.prisma.extendedRequest.findUnique({
					where: { id: extendedRequestId },
					select: { id: true },
				});

			if (!extendedRequest) {
				throw new ServiceError("Extended request not found.", 404);
			}

			const [totalItems, logs] = await Promise.all([
				this.dataAccess.prisma.extendedRequestAuditLog.count({
					where: { extendedRequestId },
				}),
				this.dataAccess.prisma.extendedRequestAuditLog.findMany({
					where: { extendedRequestId },
					skip,
					take: pageSize,
					orderBy: { timestamp: "desc" },
					select: {
						id: true,
						action: true,
						performedBy: {
							select: {
								id: true,
								user: { select: { name: true, email: true } },
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
			} satisfies ExtendedAuditLogResponse;

			await this.cache.set(cacheKey, response, 600);
			return response;
		} catch (error: unknown) {
			handlePrismaError(error, "while retrieving extended request audit logs", {
				notFoundMessage: "Extended request not found.",
			});
		}
	}

	private async invalidateRequestCaches() {
		await this.cache.invalidate(RequestCacheKeys.requestAuditLogsPattern());
	}

	private async invalidateExtendedRequestCaches() {
		await this.cache.invalidate(
			RequestCacheKeys.extendedRequestAuditLogsPattern(),
		);
	}
}
