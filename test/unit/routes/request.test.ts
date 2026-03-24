import { beforeEach, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import {
	mockAdminAuth,
	mockInstructorAuth,
	mockStudentAuth,
} from "@momoi/auth/mock";
import { MockCache } from "@momoi/cache/mock";
import { createMockPrisma } from "@test/mocks";
import {
	createMockCourse,
	createMockCourseOffering,
	createMockInstance,
	createMockPVETemplate,
	createMockRequest,
	resetMockFactoryCounters,
} from "@test/mocks";
import { MockQueueModule } from "@momoi/queue/mock";

import { requestRoute } from "@momoi/routes/request";

describe("Request Route", () => {
	let mockPrisma: any;
	let mockCache: MockCache;
	let mockQueue: MockQueueModule;

	beforeEach(() => {
		resetMockFactoryCounters();
		mockPrisma = createMockPrisma() as any;
		mockCache = new MockCache();
		mockQueue = new MockQueueModule();
	});

	it("student can create request", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		const course = createMockCourse({ id: 1 });
		const courseOffering = createMockCourseOffering({
			id: 1,
			courseId: course.id,
			semesterId: 1,
		});
		const template = createMockPVETemplate({ id: 2, name: "Ubuntu" });
		const created = createMockRequest({
			id: 10,
			requesterId: 3,
			courseOfferingId: courseOffering.id,
			pveTemplateId: template.id,
		});

		mockPrisma.request.create.mockResolvedValueOnce({
			...created,
			courseOffering: {
				course: { code: course.code, title: course.title },
				semester: { name: "Fall" },
			},
			pveTemplate: { name: template.name },
		});

		const response = await client.requests.post({
			title: created.title,
			description: created.description ?? undefined,
			courseOfferingId: created.courseOfferingId,
			pveTemplateId: created.pveTemplateId,
			cpus: created.cpus,
			memoryMB: created.memoryMB,
			diskGB: created.diskGB,
		});

		expect(response.status).toBe(200);
		expect(response.data).not.toBeNull();
		expect(response.data?.id).toBe(created.id);
		expect(response.data?.courseOffering?.courseCode).toBe(course.code);
	});

	it("instructor can approve request for their course", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockInstructorAuth,
				mockQueue as any,
			),
		);

		const course = createMockCourse({ id: 1 });
		const requestRecord = createMockRequest({
			id: 11,
			requesterId: 3,
			courseOfferingId: 1,
		});

		mockPrisma.request.findUnique.mockResolvedValueOnce({
			...requestRecord,
			courseOffering: {
				course: {
					code: course.code,
					title: course.title,
					instructors: [{ id: 2 }],
				},
				semester: { name: "Fall" },
			},
		});

		mockPrisma.request.update.mockResolvedValueOnce({
			...requestRecord,
			status: "APPROVED",
			reviewerId: 2,
			courseOffering: {
				course: { code: course.code, title: course.title },
				semester: { name: "Fall" },
			},
			pveTemplate: { name: "Ubuntu" },
		});

		mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

		const response = await client
			.requests({ requestId: requestRecord.id })
			.status.patch({
				status: "APPROVED",
				reason: "ok",
			});

		expect(response.status).toBe(200);
		expect(response.data).not.toBeNull();
		expect(response.data?.status).toBe("APPROVED");
	});

	it("student cannot create extended request for others instance", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		// Instance is owned by someone else
		mockPrisma.instance.findUnique.mockResolvedValueOnce({
			platformUserId: 999,
		});

		const response = await client["extended-requests"].post({
			title: "Extend",
			description: "more time",
			targetInstanceId: 123,
		});

		expect(response.status).toBe(404);
	});

	it("requester can cancel their request", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		const course = createMockCourse({ id: 1 });
		const requestRecord = createMockRequest({
			id: 12,
			requesterId: 3,
			courseOfferingId: 1,
		});

		mockPrisma.request.findUnique.mockResolvedValueOnce({
			...requestRecord,
			courseOffering: {
				course: {
					code: course.code,
					title: course.title,
					instructors: [{ id: 2 }],
				},
				semester: { name: "Fall" },
			},
		});

		mockPrisma.request.update.mockResolvedValueOnce({
			...requestRecord,
			status: "CANCELLED",
			reviewerId: null,
			courseOffering: {
				course: { code: course.code, title: course.title },
				semester: { name: "Fall" },
			},
			pveTemplate: { name: "Ubuntu" },
		});

		mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

		const response = await client
			.requests({ requestId: requestRecord.id })
			.status.patch({
				status: "CANCELLED",
				reason: "cancel",
			});

		expect(response.status).toBe(200);
		expect(response.data).not.toBeNull();
		expect(response.data?.status).toBe("CANCELLED");
	});

	it("instructor cannot act on unrelated course request", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockInstructorAuth,
				mockQueue as any,
			),
		);

		const requestRecord = createMockRequest({
			id: 13,
			requesterId: 3,
			courseOfferingId: 1,
		});
		mockPrisma.request.findUnique.mockResolvedValueOnce({
			...requestRecord,
			courseOffering: {
				course: { code: "CS999", title: "Other", instructors: [{ id: 99 }] },
				semester: { name: "Fall" },
			},
		});

		const response = await client
			.requests({ requestId: requestRecord.id })
			.status.patch({
				status: "APPROVED",
				reason: "no",
			});

		expect(response.status).toBe(403);
	});

	it("non-student cannot create request (403)", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockInstructorAuth,
				mockQueue as any,
			),
		);

		const response = await client.requests.post({
			title: "Need VM",
			description: "For lab",
			courseOfferingId: 1,
			pveTemplateId: 1,
			cpus: 2,
			memoryMB: 2048,
			diskGB: 8,
		});

		expect(response.status).toBe(403);
		expect(response.data).toBeNull();
	});

	it("student cannot create request above resource limits", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		const response = await client.requests.post({
			title: "Need more storage",
			description: "For lab",
			courseOfferingId: 1,
			pveTemplateId: 1,
			cpus: 8,
			memoryMB: 4096,
			diskGB: 16,
		});

		expect(response.status).toBe(422);
	});

	it("get request audit logs returns 404 when request missing", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		mockPrisma.request.findUnique.mockResolvedValueOnce(null);

		const response = await client
			.requests({ requestId: 999 })
			["audit-logs"].get({ page: 1, pageSize: 10 });

		expect(response.status).toBe(404);
	});

	it("get extended request audit logs returns 404 when extended request missing", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce(null);

		const response = await client["extended-requests"]({
			extendedRequestId: 888,
		})["audit-logs"].get({ page: 1, pageSize: 10 });

		expect(response.status).toBe(404);
	});

	it("admin can approve any request", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockAdminAuth,
				mockQueue as any,
			),
		);

		const course = createMockCourse({ id: 1 });
		const requestRecord = createMockRequest({
			id: 14,
			requesterId: 5,
			courseOfferingId: 1,
		});

		mockPrisma.request.findUnique.mockResolvedValueOnce({
			...requestRecord,
			courseOffering: {
				course: {
					code: course.code,
					title: course.title,
					instructors: [{ id: 99 }],
				},
				semester: { name: "Fall" },
			},
		});

		mockPrisma.request.update.mockResolvedValueOnce({
			...requestRecord,
			status: "APPROVED",
			reviewerId: 1,
			courseOffering: {
				course: { code: course.code, title: course.title },
				semester: { name: "Fall" },
			},
			pveTemplate: { name: "Ubuntu" },
		});

		mockPrisma.requestAuditLog.create.mockResolvedValueOnce({});

		const response = await client
			.requests({ requestId: requestRecord.id })
			.status.patch({
				status: "APPROVED",
				reason: "ok",
			});

		expect(response.status).toBe(200);
		expect(response.data).not.toBeNull();
		expect(response.data?.reviewerId).toBe(1);
	});

	it("student can create extended request for own instance", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		const instance = createMockInstance({ id: 50, platformUserId: 3 });
		const currentSemesterEnd = new Date("2024-05-30T00:00:00.000Z");
		mockPrisma.instance.findUnique.mockResolvedValueOnce({
			platformUserId: instance.platformUserId,
			courseOffering: {
				semester: { id: 201, endDate: currentSemesterEnd },
			},
		});

		const nextSemester = {
			id: 202,
			name: "Fall 2024",
			startDate: new Date("2024-08-15T00:00:00.000Z"),
			endDate: new Date("2024-12-20T00:00:00.000Z"),
		};
		mockPrisma.semester.findFirst.mockResolvedValueOnce(nextSemester);

		mockPrisma.extendedRequest.create.mockResolvedValueOnce({
			id: 60,
			title: "Extend",
			description: "need more time",
			status: "PENDING",
			reason: null,
			targetInstanceId: instance.id,
			requesterId: 3,
			reviewerId: null,
			nextSemester,
			targetInstance: {
				id: instance.id,
				courseOffering: {
					course: { code: "CS301", title: "Net" },
					semester: { name: "Fall" },
				},
			},
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const response = await client["extended-requests"].post({
			title: "Extend",
			description: "need more time",
			targetInstanceId: instance.id,
		});

		expect(response.status).toBe(200);
		expect(response.data).not.toBeNull();
		expect(response.data?.targetInstanceId).toBe(instance.id);
	});

	it("instructor can approve extended request for their course", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockInstructorAuth,
				mockQueue as any,
			),
		);

		const extendedRequest = createMockRequest({ id: 70, requesterId: 3 });

		mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
			id: extendedRequest.id,
			title: "Extend",
			description: "desc",
			status: "PENDING",
			reason: null,
			targetInstanceId: 80,
			requesterId: extendedRequest.requesterId,
			reviewerId: null,
			targetInstance: {
				courseOffering: {
					course: { code: "CS302", title: "OS", instructors: [{ id: 2 }] },
					semester: { name: "Fall" },
				},
			},
		});

		mockPrisma.extendedRequest.update.mockResolvedValueOnce({
			id: extendedRequest.id,
			title: "Extend",
			description: "desc",
			status: "APPROVED",
			reason: "ok",
			targetInstanceId: 80,
			requesterId: extendedRequest.requesterId,
			reviewerId: 2,
			targetInstance: {
				courseOffering: {
					course: { code: "CS302", title: "OS" },
					semester: { name: "Fall" },
				},
			},
		});

		mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

		const response = await client["extended-requests"]({
			extendedRequestId: extendedRequest.id,
		}).status.patch({
			status: "APPROVED",
			reason: "ok",
		});

		expect(response.status).toBe(200);
		expect(response.data).not.toBeNull();
		expect(response.data?.status).toBe("APPROVED");
	});

	it("requester can cancel extended request", async () => {
		const client = treaty(
			requestRoute(
				mockPrisma,
				mockCache as any,
				mockStudentAuth,
				mockQueue as any,
			),
		);

		mockPrisma.extendedRequest.findUnique.mockResolvedValueOnce({
			id: 81,
			title: "Extend",
			description: "desc",
			status: "PENDING",
			reason: null,
			targetInstanceId: 80,
			requesterId: 3,
			reviewerId: null,
			targetInstance: {
				courseOffering: {
					course: { code: "CS303", title: "AI", instructors: [{ id: 2 }] },
					semester: { name: "Fall" },
				},
			},
		});

		mockPrisma.extendedRequest.update.mockResolvedValueOnce({
			id: 81,
			title: "Extend",
			description: "desc",
			status: "CANCELLED",
			reason: "cancel",
			targetInstanceId: 80,
			requesterId: 3,
			reviewerId: null,
			targetInstance: {
				courseOffering: {
					course: { code: "CS303", title: "AI" },
					semester: { name: "Fall" },
				},
			},
		});

		mockPrisma.extendedRequestAuditLog.create.mockResolvedValueOnce({});

		const response = await client["extended-requests"]({
			extendedRequestId: 81,
		}).status.patch({
			status: "CANCELLED",
			reason: "cancel",
		});

		expect(response.status).toBe(200);
		expect(response.data).not.toBeNull();
		expect(response.data?.status).toBe("CANCELLED");
	});
});
