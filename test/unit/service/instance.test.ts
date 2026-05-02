import { beforeEach, describe, expect, it, mock } from "bun:test";

import { MockCache } from "@momoi/cache/mock";
import { PrismaClientKnownRequestError } from "@momoi/database/prisma/generated/internal/prismaNamespace";
import { createMockPrisma } from "@test/mocks";
import { createMockScenario, resetMockFactoryCounters } from "@test/mocks";

import { createInstanceUseCases } from "@momoi/modules/instance";
import { InstanceService } from "@momoi/service/instance";

// Mock queue module
const createMockQueue = () => ({
	provisionInstanceQueue: {
		add: mock(async () => ({ id: "mock-job-id" })),
	},
	deprovisionInstanceQueue: {
		add: mock(async () => ({ id: "mock-job-id" })),
	},
	toggleInstanceStatusQueue: {
		add: mock(async () => ({ id: "mock-job-id" })),
	},
});

describe("InstanceService", () => {
	let mockPrisma: any;
	let mockCache: MockCache;
	let mockQueue: any;
	let instanceService: InstanceService;

	beforeEach(() => {
		resetMockFactoryCounters();
		mockPrisma = createMockPrisma() as any;
		mockCache = new MockCache();
		mockQueue = createMockQueue();
		instanceService = new InstanceService(
			mockPrisma,
			mockCache as any,
			mockQueue as any,
		);
	});

	describe("createInstance", () => {
		it("should create an instance with provided data", async () => {
			const scenario = createMockScenario();
			const userId = scenario.platformUser.id;
			const createBody = {
				pveTemplateId: scenario.template.id,
				courseOfferingId: scenario.courseOffering.id,
				cpus: 8,
				memoryMB: 8192,
				diskGB: 32,
			};

			const mockInstanceData = {
				id: 1,
				courseOffering: {
					course: {
						code: scenario.course.code,
						title: scenario.course.title,
					},
					semester: {
						name: scenario.semester.name,
					},
				},
				status: "PENDING",
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPrisma.instance.create.mockResolvedValueOnce(mockInstanceData);

			const result = await instanceService.createInstanceByInstructor(
				userId,
				"INSTRUCTOR",
				createBody,
			);

			expect(result.id).toBe(1);
			expect(result.courseOffering?.courseCode).toBe(scenario.course.code);
			expect(result.courseOffering?.courseTitle).toBe(scenario.course.title);
			expect(result.status).toBe("PENDING");
		});

		it("should throw error when related resource not found (P2025)", async () => {
			const userId = 999;
			const createBody = {
				pveTemplateId: 999,
				courseOfferingId: 999,
				cpus: 8,
				memoryMB: 8192,
				diskGB: 32,
			};

			const error = new PrismaClientKnownRequestError("Record not found", {
				code: "P2025",
				clientVersion: "0.0.1",
			});
			mockPrisma.instance.create.mockRejectedValueOnce(error);

			try {
				await instanceService.createInstanceByInstructor(
					userId,
					"INSTRUCTOR",
					createBody,
				);
				expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toBe("Related resource not found.");
			}
		});

		it("should throw error on database error", async () => {
			const userId = 1;
			const createBody = {
				pveTemplateId: 1,
				courseOfferingId: 1,
				cpus: 8,
				memoryMB: 8192,
				diskGB: 32,
			};

			// Use P2003 (foreign key constraint) for generic database error testing
			const error = new PrismaClientKnownRequestError(
				"Database connection failed",
				{ code: "P2003", clientVersion: "0.0.1" },
			);
			mockPrisma.instance.create.mockRejectedValueOnce(error);

			try {
				await instanceService.createInstanceByInstructor(
					userId,
					"INSTRUCTOR",
					createBody,
				);
				expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toContain("Database error:");
			}
		});

		it("should throw error on unexpected error", async () => {
			const userId = 1;
			const createBody = {
				pveTemplateId: 1,
				courseOfferingId: 1,
				cpus: 8,
				memoryMB: 8192,
				diskGB: 32,
			};

			mockPrisma.instance.create.mockRejectedValueOnce(
				new Error("Unexpected error"),
			);

			try {
				await instanceService.createInstanceByInstructor(
					userId,
					"INSTRUCTOR",
					createBody,
				);
			expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toBe(
					"An unexpected error occurred while creating the instance.",
				);
			}
		});

		it("should reject instance cpu above limit", async () => {
			await expect(
				instanceService.createInstanceByInstructor(1, "INSTRUCTOR", {
					pveTemplateId: 1,
					courseOfferingId: 1,
					cpus: 16,
					memoryMB: 8192,
					diskGB: 32,
				}),
			).rejects.toThrow("Instance vCPU cannot exceed 8.");
		});

		it("should reject instance memory above limit", async () => {
			await expect(
				instanceService.createInstanceByInstructor(1, "INSTRUCTOR", {
					pveTemplateId: 1,
					courseOfferingId: 1,
					cpus: 8,
					memoryMB: 16384,
					diskGB: 32,
				}),
			).rejects.toThrow("Instance memory cannot exceed 8192 MB.");
		});

		it("should reject instance disk above limit", async () => {
			await expect(
				instanceService.createInstanceByInstructor(1, "ADMIN", {
					pveTemplateId: 1,
					courseOfferingId: 1,
					cpus: 8,
					memoryMB: 8192,
					diskGB: 64,
				}),
			).rejects.toThrow("Instance disk cannot exceed 32 GB.");
		});
	});

	describe("getInstancesByUser", () => {
		it("should retrieve instances for a user with pagination", async () => {
			const scenario = createMockScenario();
			const userId = scenario.platformUser.id;
			const query = { page: 1, pageSize: 10 };

			const mockInstances = [
				{
					id: 1,
					platformUser: {
						id: scenario.platformUser.id,
						user: {
							name: scenario.user.name,
							email: scenario.user.email,
						},
					},
					courseOffering: {
						course: {
							code: scenario.course.code,
							title: scenario.course.title,
						},
						semester: {
							name: scenario.semester.name,
						},
					},
					status: "ACTIVE",
					pveVM: {
						hostname: "vm-1",
						status: "RUNNING",
						pveNetworkIP: {
							ipAddress: "192.168.1.100",
						},
					},
					cpus: 2,
					memoryMB: 4096,
					diskGB: 50,
					pveTemplate: {
						name: "Ubuntu 22.04",
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			mockPrisma.instance.count.mockResolvedValueOnce(1);
			mockPrisma.instance.findMany.mockResolvedValueOnce(mockInstances);

			const result = await instanceService.getInstancesByUser(userId, query);

			expect(result.values).toHaveLength(1);
			expect(result.values[0].id).toBe(1);
			expect(result.values[0].owner.email).toBe(scenario.user.email);
			expect(result.totalItems).toBe(1);
			expect(result.currentPage).toBe(1);
		});

		it("should return cached data if available", async () => {
			const userId = 1;
			const query = { page: 1, pageSize: 10 };
			const _cachedResponse = JSON.stringify({
				values: [],
				totalItems: 0,
				totalPages: 0,
				currentPage: 1,
				pageSize: 10,
			});

			const result = await instanceService.getInstancesByUser(userId, query);

			expect(result.totalItems).toBe(0);
		});

		it("should filter instances by courseId and semesterId", async () => {
			const userId = 1;
			const query = { page: 1, pageSize: 10, courseId: 1, semesterId: 1 };

			mockPrisma.instance.count.mockResolvedValueOnce(0);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByUser(userId, query);

			expect(result.values).toHaveLength(0);
			expect(result.totalItems).toBe(0);
		});

		it("should handle pagination correctly", async () => {
			const userId = 1;
			const query = { page: 2, pageSize: 5 };

			mockPrisma.instance.count.mockResolvedValueOnce(15);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByUser(userId, query);

			expect(result.currentPage).toBe(2);
			expect(result.totalPages).toBe(3);
			expect(result.pageSize).toBe(5);
		});

		it("should throw error on database error", async () => {
			const userId = 1;
			const query = { page: 1, pageSize: 10 };

			mockPrisma.instance.count.mockRejectedValueOnce(
				new PrismaClientKnownRequestError("DB error", {
					code: "P2003",
					clientVersion: "0.0.1",
				}),
			);

			try {
				await instanceService.getInstancesByUser(userId, query);
				expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toContain("Database error:");
			}
		});
	});

	describe("getInstancesByInstructor", () => {
		it("should retrieve instances for instructor's courses with pagination", async () => {
			const instructorId = 1;
			const query = { page: 1, pageSize: 10 };

			const mockInstances = [
				{
					id: 1,
					platformUser: {
						id: 1,
						user: {
							name: "Instructor User",
							email: "instructor@example.com",
						},
					},
					courseOffering: {
						course: {
							code: "CS101",
							title: "Intro to CS",
						},
						semester: {
							name: "Spring 2024",
						},
					},
					status: "ACTIVE",
					pveVM: {
						hostname: "vm-1",
						status: "RUNNING",
						pveNetworkIP: {
							ipAddress: "192.168.1.100",
						},
					},
					cpus: 2,
					memoryMB: 4096,
					diskGB: 50,
					pveTemplate: {
						name: "Ubuntu 22.04",
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			mockPrisma.instance.count.mockResolvedValueOnce(1);
			mockPrisma.instance.findMany.mockResolvedValueOnce(mockInstances);

			const result = await instanceService.getInstancesByInstructor(
				instructorId,
				query,
			);

			expect(result.values).toHaveLength(1);
			expect(result.totalItems).toBe(1);
		});

		it("should filter by courseId and semesterId for instructor", async () => {
			const instructorId = 1;
			const query = { page: 1, pageSize: 10, courseId: 5, semesterId: 3 };

			mockPrisma.instance.count.mockResolvedValueOnce(0);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByInstructor(
				instructorId,
				query,
			);

			expect(result.values).toHaveLength(0);
		});

		it("should handle pagination for instructor instances", async () => {
			const instructorId = 1;
			const query = { page: 3, pageSize: 5 };

			mockPrisma.instance.count.mockResolvedValueOnce(20);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByInstructor(
				instructorId,
				query,
			);

			expect(result.totalPages).toBe(4);
			expect(result.currentPage).toBe(3);
		});

		it("should return empty list when instructor has no instances", async () => {
			const instructorId = 999;
			const query = { page: 1, pageSize: 10 };

			mockPrisma.instance.count.mockResolvedValueOnce(0);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByInstructor(
				instructorId,
				query,
			);

			expect(result.values).toHaveLength(0);
			expect(result.totalItems).toBe(0);
		});
	});

	describe("getInstances", () => {
		it("should retrieve all instances with pagination", async () => {
			const query = { page: 1, pageSize: 10 };

			const mockInstances = [
				{
					id: 1,
					platformUser: {
						id: 1,
						user: {
							name: "Student User",
							email: "student@example.com",
						},
					},
					courseOffering: {
						course: {
							code: "CS101",
							title: "Intro to CS",
						},
						semester: {
							name: "Spring 2024",
						},
					},
					status: "ACTIVE",
					pveVM: {
						hostname: "vm-1",
						status: "RUNNING",
						pveNetworkIP: {
							ipAddress: "192.168.1.100",
						},
					},
					cpus: 2,
					memoryMB: 4096,
					diskGB: 50,
					pveTemplate: {
						name: "Ubuntu 22.04",
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			];

			mockPrisma.instance.count.mockResolvedValueOnce(1);
			mockPrisma.instance.findMany.mockResolvedValueOnce(mockInstances);

			const result = await instanceService.getInstancesByAdmin(query);

			expect(result.values).toHaveLength(1);
			expect(result.totalItems).toBe(1);
			expect(result.currentPage).toBe(1);
		});

		it("should filter instances by courseId", async () => {
			const query = { page: 1, pageSize: 10, courseId: 1 };

			mockPrisma.instance.count.mockResolvedValueOnce(0);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByAdmin(query);

			expect(result.values).toHaveLength(0);
		});

		it("should filter instances by semesterId", async () => {
			const query = { page: 1, pageSize: 10, semesterId: 1 };

			mockPrisma.instance.count.mockResolvedValueOnce(0);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByAdmin(query);

			expect(result.values).toHaveLength(0);
		});

		it("should handle default pagination values", async () => {
			const query = {};

			mockPrisma.instance.count.mockResolvedValueOnce(25);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			const result = await instanceService.getInstancesByAdmin(query);

			expect(result.pageSize).toBe(10);
			expect(result.currentPage).toBe(1);
			expect(result.totalPages).toBe(3);
		});

		it("should order instances by createdAt descending", async () => {
			const query = { page: 1, pageSize: 10 };

			mockPrisma.instance.count.mockResolvedValueOnce(0);
			mockPrisma.instance.findMany.mockResolvedValueOnce([]);

			await instanceService.getInstancesByAdmin(query);

			expect(mockPrisma.instance.findMany).toHaveBeenCalled();
		});
	});

	describe("getInstanceById", () => {
		it("should retrieve instance by id", async () => {
			const instanceId = 1;
			const mockInstance = {
				id: 1,
				platformUser: {
					id: 1,
					user: {
						name: "Student User",
						email: "student@example.com",
					},
				},
				courseOffering: {
					course: {
						code: "CS101",
						title: "Intro to CS",
					},
					semester: {
						name: "Spring 2024",
					},
				},
				status: "ACTIVE",
				pveVM: {
					hostname: "vm-1",
					status: "RUNNING",
					pveNetworkIP: {
						ipAddress: "192.168.1.100",
					},
				},
				cpus: 2,
				memoryMB: 4096,
				diskGB: 50,
				pveTemplate: {
					name: "Ubuntu 22.04",
				},
				defaultPassword: "generated-pass-123",
				instanceReverseProxies: [
					{ id: 1, targetPort: 8080 },
					{ id: 2, targetPort: 8443 },
				],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPrisma.instance.findUnique.mockResolvedValueOnce(mockInstance);

			const result = await instanceService.getInstanceById(instanceId);

			expect(result.id).toBe(1);
			expect(result.owner.email).toBe("student@example.com");
			expect(result.defaultUser).toBe("user");
			expect(result.defaultPassword).toBe("generated-pass-123");
			expect(result.reverseProxy).toHaveLength(2);
			expect(result.reverseProxy[0].targetPort).toBe(8080);
		});

		it("should throw error when instance not found", async () => {
			const instanceId = 999;

			mockPrisma.instance.findUnique.mockResolvedValueOnce(null);

			try {
				await instanceService.getInstanceById(instanceId);
				expect.unreachable();
			} catch (err: unknown) {
				// ServiceError is now properly re-thrown with its original message
				expect((err as Error).message).toBe("Instance not found.");
			}
		});

		it("should return cached data if available", async () => {
			const instanceId = 1;
			const cachedData = JSON.stringify({
				id: 1,
				courseOffering: undefined,
				status: "ACTIVE",
				vmDetails: undefined,
				reverseProxy: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			mockCache.getCacheValue.mockResolvedValueOnce(cachedData);

			const result = await instanceService.getInstanceById(instanceId);

			expect(result.id).toBe(1);
		});

		it("should handle PrismaClientKnownRequestError with P2025 code", async () => {
			const instanceId = 1;

			const error = new PrismaClientKnownRequestError("Record not found", {
				code: "P2025",
				clientVersion: "0.0.1",
			});
			mockPrisma.instance.findUnique.mockRejectedValueOnce(error);

			try {
				await instanceService.getInstanceById(instanceId);
				expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toBe("Instance not found.");
			}
		});

		it("should include reverse proxy information", async () => {
			const instanceId = 1;
			const mockInstance = {
				id: 1,
				platformUser: {
					id: 1,
					user: {
						name: "Student User",
						email: "student@example.com",
					},
				},
				courseOffering: null,
				status: "PENDING",
				pveVM: null,
				cpus: 2,
				memoryMB: 4096,
				diskGB: 50,
				pveTemplate: null,
				defaultPassword: null,
				instanceReverseProxies: [{ id: 5, targetPort: 3000 }],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			mockPrisma.instance.findUnique.mockResolvedValueOnce(mockInstance);

			const result = await instanceService.getInstanceById(instanceId);

			expect(result.defaultUser).toBe("user");
			expect(result.defaultPassword).toBeUndefined();
			expect(result.reverseProxy).toHaveLength(1);
			expect(result.reverseProxy[0].id).toBe(5);
			expect(result.reverseProxy[0].targetPort).toBe(3000);
		});
	});

	describe("instance status actions", () => {
		it("should stop a running instance", async () => {
			const instanceId = 1;
			const performedById = 42;
			const instanceUseCases = createInstanceUseCases(
				mockPrisma as any,
				mockCache as any,
				mockQueue as any,
			);

			mockPrisma.instance.findUnique.mockResolvedValueOnce({
				id: instanceId,
				status: "ACTIVE",
				pveVM: {
					status: "RUNNING",
				},
			});
			mockPrisma.instance.update.mockResolvedValueOnce({
				id: instanceId,
				pveVM: {
					status: "STOPPED",
				},
			});
			mockPrisma.instanceAuditLog.create.mockResolvedValueOnce({ id: 1 });

			const result = await instanceUseCases.stopInstance(
				instanceId,
				performedById,
			);

			expect(result.id).toBe(instanceId);
			expect(result.status).toBe("STOPPED");
			expect(result.message).toBe("Instance successfully stopped.");
			expect(mockQueue.toggleInstanceStatusQueue.add).toHaveBeenCalledTimes(1);
			expect(mockQueue.toggleInstanceStatusQueue.add).toHaveBeenCalledWith(
				"toggle",
				{ instanceId, userId: performedById, status: "STOP" },
				expect.objectContaining({ jobId: `toggle-stop-${instanceId}` }),
			);
		});
	});

	describe("deleteInstance", () => {
		it("should delete an instance", async () => {
			const instanceId = 1;

			mockPrisma.instance.findUnique.mockResolvedValueOnce({
				id: instanceId,
				platformUserId: 1,
				status: true,
			});
			mockPrisma.instance.delete.mockResolvedValueOnce({ id: instanceId });

			const result = await instanceService.deleteInstance(instanceId);

			expect(result.success).toBe(true);
		});

		it("should clear cache after deletion", async () => {
			const instanceId = 1;

			mockPrisma.instance.findUnique.mockResolvedValueOnce({
				id: instanceId,
				platformUserId: 1,
				status: true,
			});
			mockPrisma.instance.delete.mockResolvedValueOnce({ id: instanceId });

			await instanceService.deleteInstance(instanceId);

			expect(mockCache.deleteCacheByPattern).toHaveBeenCalled();
		});

		it("should throw error when instance not found (P2025)", async () => {
			const instanceId = 999;

			const error = new PrismaClientKnownRequestError("Record not found", {
				code: "P2025",
				clientVersion: "0.0.1",
			});
			mockPrisma.instance.delete.mockRejectedValueOnce(error);

			try {
				await instanceService.deleteInstance(instanceId);
				expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toBe("Instance not found.");
			}
		});

		it("should throw error on database error during deletion", async () => {
			const instanceId = 1;

			mockPrisma.instance.findUnique.mockResolvedValueOnce({
				id: instanceId,
				platformUserId: 1,
				status: true,
			});
			const error = new PrismaClientKnownRequestError("Database error", {
				code: "P2003",
				clientVersion: "0.0.1",
			});
			mockPrisma.instance.delete.mockRejectedValueOnce(error);

			try {
				await instanceService.deleteInstance(instanceId);
				expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toContain("Database error:");
			}
		});

		it("should throw error on unexpected error", async () => {
			const instanceId = 1;

			mockPrisma.instance.findUnique.mockResolvedValueOnce({
				id: instanceId,
				platformUserId: 1,
				status: true,
			});
			mockPrisma.instance.delete.mockRejectedValueOnce(
				new Error("Unexpected error"),
			);

			try {
				await instanceService.deleteInstance(instanceId);
				expect.unreachable();
			} catch (err: unknown) {
				expect((err as Error).message).toBe(
					"An unexpected error occurred while deleting the instance.",
				);
			}
		});
	});
});
