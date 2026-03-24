import { describe, expect, it } from "bun:test";

import { setupTestContext } from "@test/e2e/setup";

/**
 * E2E Tests for User Routes
 *
 * These tests verify the complete request/response cycle for user-related endpoints.
 * Tests are organized by role (Admin, Instructor, Student) and by endpoint.
 */

describe("E2E: User Routes", () => {
	describe("GET /api/user/me", () => {
		describe("As Admin", () => {
			it("should return admin user profile with role ADMIN", async () => {
				const { client } = setupTestContext("admin");

				const response = await client.api.user.me.get();

				expect(response.status).toBe(200);
				expect(response.data).toBeDefined();
				expect(response.data?.id).toBe(1);
				expect(response.data?.email).toBe("admin.t@itm.kmutnb.ac.th");
				expect(response.data?.name).toBe("Admin User");
				expect(response.data?.role).toBe("ADMIN");
			});
		});

		describe("As Instructor", () => {
			it("should return instructor user profile with role INSTRUCTOR", async () => {
				const { client } = setupTestContext("instructor");

				const response = await client.api.user.me.get();

				expect(response.status).toBe(200);
				expect(response.data).toBeDefined();
				expect(response.data?.id).toBe(2);
				expect(response.data?.email).toBe("instructor.t@itm.kmutnb.ac.th");
				expect(response.data?.name).toBe("Instructor User");
				expect(response.data?.role).toBe("INSTRUCTOR");
			});
		});

		describe("As Student", () => {
			it("should return student user profile with role STUDENT", async () => {
				const { client } = setupTestContext("student");

				const response = await client.api.user.me.get();

				expect(response.status).toBe(200);
				expect(response.data).toBeDefined();
				expect(response.data?.id).toBe(3);
				expect(response.data?.email).toBe("s0006020000000@email.kmutnb.ac.th");
				expect(response.data?.name).toBe("Student User");
				expect(response.data?.role).toBe("STUDENT");
			});
		});

		describe("As Unauthenticated", () => {
			it("should return 401 Unauthorized", async () => {
				const { client } = setupTestContext("unauthenticated");

				const response = await client.api.user.me.get();

				expect(response.status).toBe(401);
			});
		});
	});

	describe("GET /api/user/ssh-keys", () => {
		describe("As Admin", () => {
			it("should return paginated SSH keys", async () => {
				const { client, mockPrisma } = setupTestContext("admin");

				const mockSSHKeys = [
					{
						id: 1,
						ownerId: 1,
						name: "Admin Key 1",
						publicKey: "ssh-rsa AAAAB3NzaC1...",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
					{
						id: 2,
						ownerId: 1,
						name: "Admin Key 2",
						publicKey: "ssh-rsa AAAAB3NzaC2...",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				];

				mockPrisma.platformSSHKey.count.mockResolvedValueOnce(2);
				mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce(mockSSHKeys);

				const response = await client.api.user["ssh-keys"].get();

				expect(response.status).toBe(200);
				expect(response.data).toBeDefined();
				expect(response.data?.values).toHaveLength(2);
				expect(response.data?.totalItems).toBe(2);
				expect(response.data?.currentPage).toBe(1);
				expect(response.data?.pageSize).toBe(10);
			});

			it("should support pagination parameters", async () => {
				const { client, mockPrisma } = setupTestContext("admin");

				mockPrisma.platformSSHKey.count.mockResolvedValueOnce(25);
				mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce([]);

				const response = await client.api.user["ssh-keys"].get({
					query: { page: 2, pageSize: 5 },
				});

				expect(response.status).toBe(200);
				expect(response.data?.currentPage).toBe(2);
				expect(response.data?.pageSize).toBe(5);
			});

			it("should return empty list when no SSH keys exist", async () => {
				const { client, mockPrisma } = setupTestContext("admin");

				mockPrisma.platformSSHKey.count.mockResolvedValueOnce(0);
				mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce([]);

				const response = await client.api.user["ssh-keys"].get();

				expect(response.status).toBe(200);
				expect(response.data?.values).toHaveLength(0);
				expect(response.data?.totalItems).toBe(0);
			});
		});

		describe("As Student", () => {
			it("should return student's SSH keys", async () => {
				const { client, mockPrisma } = setupTestContext("student");

				const mockSSHKeys = [
					{
						id: 1,
						ownerId: 3, // Student ID
						name: "Student Key",
						publicKey: "ssh-rsa AAAAB3NzaC1...",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				];

				mockPrisma.platformSSHKey.count.mockResolvedValueOnce(1);
				mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce(mockSSHKeys);

				const response = await client.api.user["ssh-keys"].get();

				expect(response.status).toBe(200);
				expect(response.data?.values).toHaveLength(1);
				expect(response.data?.values[0].name).toBe("Student Key");
			});
		});

		describe("As Unauthenticated", () => {
			it("should return 401 Unauthorized", async () => {
				const { client } = setupTestContext("unauthenticated");

				const response = await client.api.user["ssh-keys"].get();

				expect(response.status).toBe(401);
			});
		});
	});

	describe("POST /api/user/ssh-keys", () => {
		describe("As Admin", () => {
			it("should create a new SSH key", async () => {
				const { client, mockPrisma } = setupTestContext("admin");

				const newSSHKey = {
					id: 1,
					ownerId: 1,
					name: "New SSH Key",
					publicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...",
					createdAt: new Date(),
					updatedAt: new Date(),
				};

				mockPrisma.platformSSHKey.create.mockResolvedValueOnce(newSSHKey);

				const response = await client.api.user["ssh-keys"].post({
					name: "New SSH Key",
					publicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...",
				});

				expect(response.status).toBe(200);
				expect(response.data).toBeDefined();
				expect(response.data?.id).toBe(1);
				expect(response.data?.name).toBe("New SSH Key");
				expect(response.data?.publicKey).toBe(
					"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...",
				);
			});

			it("should require name field", async () => {
				const { client } = setupTestContext("admin");

				// Test with missing name field entirely
				const response = await client.api.user["ssh-keys"].post({
					publicKey: "ssh-rsa AAAAB3...",
				} as any);

				// Elysia validation should fail for missing required field
				expect(response.status).not.toBe(200);
			});
		});

		describe("As Student", () => {
			it("should create a new SSH key for student", async () => {
				const { client, mockPrisma } = setupTestContext("student");

				const newSSHKey = {
					id: 1,
					ownerId: 3, // Student ID
					name: "Student SSH Key",
					publicKey: "ssh-rsa AAAAB3...",
					createdAt: new Date(),
					updatedAt: new Date(),
				};

				mockPrisma.platformSSHKey.create.mockResolvedValueOnce(newSSHKey);

				const response = await client.api.user["ssh-keys"].post({
					name: "Student SSH Key",
					publicKey: "ssh-rsa AAAAB3...",
				});

				expect(response.status).toBe(200);
				expect(response.data?.name).toBe("Student SSH Key");
			});
		});

		describe("As Unauthenticated", () => {
			it("should return 401 Unauthorized", async () => {
				const { client } = setupTestContext("unauthenticated");

				const response = await client.api.user["ssh-keys"].post({
					name: "Test Key",
					publicKey: "ssh-rsa AAAAB3...",
				});

				expect(response.status).toBe(401);
			});
		});
	});

	describe("DELETE /api/user/ssh-keys", () => {
		describe("As Admin", () => {
			it("should delete SSH keys by IDs", async () => {
				const { client, mockPrisma } = setupTestContext("admin");

				mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({
					count: 2,
				});

				const response = await client.api.user["ssh-keys"].delete({
					keyIds: [1, 2],
				});

				expect(response.status).toBe(200);
				expect(response.data).toBe(2);
			});

			it("should return 0 when no keys are deleted", async () => {
				const { client, mockPrisma } = setupTestContext("admin");

				mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({
					count: 0,
				});

				const response = await client.api.user["ssh-keys"].delete({
					keyIds: [999],
				});

				expect(response.status).toBe(200);
				expect(response.data).toBe(0);
			});

			it("should handle deletion of single key", async () => {
				const { client, mockPrisma } = setupTestContext("admin");

				mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({
					count: 1,
				});

				const response = await client.api.user["ssh-keys"].delete({
					keyIds: [1],
				});

				expect(response.status).toBe(200);
				expect(response.data).toBe(1);
			});
		});

		describe("As Student", () => {
			it("should delete student's SSH keys", async () => {
				const { client, mockPrisma } = setupTestContext("student");

				mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({
					count: 1,
				});

				const response = await client.api.user["ssh-keys"].delete({
					keyIds: [1],
				});

				expect(response.status).toBe(200);
				expect(response.data).toBe(1);
			});
		});

		describe("As Unauthenticated", () => {
			it("should return 401 Unauthorized", async () => {
				const { client } = setupTestContext("unauthenticated");

				const response = await client.api.user["ssh-keys"].delete({
					keyIds: [1],
				});

				expect(response.status).toBe(401);
			});
		});
	});
});
