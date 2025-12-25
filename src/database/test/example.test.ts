// @ts-nocheck
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import {
  createMockInstance, createMockPlatformUser, createMockScenario, createMockUser,
  resetMockFactoryCounters
} from './mock-factory';
import { createMockPrisma } from './mock-prisma';

/**
 * Example unit tests demonstrating how to use the mock Prisma client.
 * 
 * These tests show various patterns for mocking Prisma operations:
 * 1. Basic CRUD operations
 * 2. Complex queries with relations
 * 3. Transaction handling
 * 4. Error scenarios
 */

describe("Mock Prisma Client Examples", () => {
  const mockPrisma = createMockPrisma();

  beforeEach(() => {
    // Reset all mocks before each test
    resetMockFactoryCounters();
    Object.values(mockPrisma.user).forEach((fn: any) => {
      if (typeof fn?.mockReset === "function") fn.mockReset();
    });
  });

  describe("Basic CRUD Operations", () => {
    it("should mock findUnique operation", async () => {
      const mockUser = createMockUser({
        id: "user-1",
        name: "John Doe"
      });

      // Setup mock to return our test user
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Execute the "query"
      const user = await mockPrisma.user.findUnique({
        where: { id: "user-1" },
      });

      // Verify results
      expect(user).toEqual(mockUser);
      expect(user?.name).toBe("John Doe");
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
    });

    it("should mock findMany operation", async () => {
      const mockUsers = [
        createMockUser({ id: "user-1", name: "Alice" }),
        createMockUser({ id: "user-2", name: "Bob" }),
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const users = await mockPrisma.user.findMany();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe("Alice");
      expect(users[1].name).toBe("Bob");
    });

    it("should mock create operation", async () => {
      const newUser = createMockUser({ name: "New User" });

      mockPrisma.user.create.mockResolvedValue(newUser);

      const user = await mockPrisma.user.create({
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      });

      expect(user.name).toBe("New User");
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it("should mock update operation", async () => {
      const updatedUser = createMockUser({
        id: "user-1",
        name: "Updated Name"
      });

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const user = await mockPrisma.user.update({
        where: { id: "user-1" },
        data: { name: "Updated Name" },
      });

      expect(user.name).toBe("Updated Name");
    });

    it("should mock delete operation", async () => {
      const deletedUser = createMockUser({ id: "user-1" });

      mockPrisma.user.delete.mockResolvedValue(deletedUser);

      const user = await mockPrisma.user.delete({
        where: { id: "user-1" },
      });

      expect(user.id).toBe("user-1");
    });
  });

  describe("Complex Queries with Relations", () => {
    it("should mock queries with nested relations", async () => {
      const mockUser = createMockUser({ id: "user-1" });
      const mockPlatformUser = createMockPlatformUser({
        userId: mockUser.id,
        role: "INSTRUCTOR",
      });

      // Mock findUnique with include
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        platformUser: mockPlatformUser,
      } as any);

      const user = await mockPrisma.user.findUnique({
        where: { id: "user-1" },
        include: { platformUser: true },
      });

      expect(user?.platformUser).toBeDefined();
      expect(user?.platformUser?.role).toBe("INSTRUCTOR");
    });

    it("should mock findMany with where clause", async () => {
      const instructors = [
        createMockPlatformUser({ role: "INSTRUCTOR", id: 1 }),
        createMockPlatformUser({ role: "INSTRUCTOR", id: 2 }),
      ];

      mockPrisma.platformUser.findMany.mockResolvedValue(instructors);

      const users = await mockPrisma.platformUser.findMany({
        where: { role: "INSTRUCTOR" },
      });

      expect(users).toHaveLength(2);
      expect(users.every((u) => u.role === "INSTRUCTOR")).toBe(true);
    });
  });

  describe("Transaction Handling", () => {
    it("should mock transaction with callback", async () => {
      const mockUser = createMockUser();
      const mockPlatformUser = createMockPlatformUser({ userId: mockUser.id });

      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.platformUser.create.mockResolvedValue(mockPlatformUser);

      const result = await mockPrisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({ data: mockUser });
        const platformUser = await tx.platformUser.create({
          data: mockPlatformUser
        });
        return { user, platformUser };
      });

      expect(result.user).toEqual(mockUser);
      expect(result.platformUser).toEqual(mockPlatformUser);
    });

    it("should mock transaction with array of operations", async () => {
      const user1 = createMockUser({ id: "user-1" });
      const user2 = createMockUser({ id: "user-2" });

      mockPrisma.user.create.mockResolvedValueOnce(user1);
      mockPrisma.user.create.mockResolvedValueOnce(user2);

      const operations = [
        mockPrisma.user.create({ data: user1 }),
        mockPrisma.user.create({ data: user2 }),
      ];

      const results = await mockPrisma.$transaction(operations);

      expect(results).toHaveLength(2);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle findUniqueOrThrow when record not found", async () => {
      mockPrisma.user.findUniqueOrThrow.mockRejectedValue(
        new Error("Record not found")
      );

      await expect(
        mockPrisma.user.findUniqueOrThrow({
          where: { id: "non-existent" },
        })
      ).rejects.toThrow("Record not found");
    });

    it("should handle validation errors", async () => {
      mockPrisma.user.create.mockRejectedValue(
        new Error("Unique constraint failed on the fields: (`email`)")
      );

      await expect(
        mockPrisma.user.create({
          data: {
            id: "user-1",
            name: "Test",
            email: "duplicate@example.com",
          },
        })
      ).rejects.toThrow("Unique constraint failed");
    });
  });

  describe("Using Mock Factory Helpers", () => {
    it("should create a complete scenario with related entities", () => {
      const scenario = createMockScenario();

      expect(scenario.user).toBeDefined();
      expect(scenario.platformUser.userId).toBe(scenario.user.id);
      expect(scenario.courseOffering.courseId).toBe(scenario.course.id);
      expect(scenario.instance.platformUserId).toBe(scenario.platformUser.id);
    });

    it("should create multiple users with unique IDs", () => {
      const user1 = createMockUser();
      const user2 = createMockUser();
      const user3 = createMockUser();

      expect(user1.id).not.toBe(user2.id);
      expect(user2.id).not.toBe(user3.id);
    });
  });

  describe("Count and Aggregate Operations", () => {
    it("should mock count operation", async () => {
      mockPrisma.user.count.mockResolvedValue(42);

      const count = await mockPrisma.user.count({
        where: { emailVerified: true },
      });

      expect(count).toBe(42);
    });

    it("should mock aggregate operation", async () => {
      mockPrisma.instance.aggregate.mockResolvedValue({
        _avg: { cpus: 4, memoryMB: 8192 },
        _sum: { cpus: 100, memoryMB: 204800 },
        _count: 25,
      } as any);

      const stats = await mockPrisma.instance.aggregate({
        _avg: { cpus: true, memoryMB: true },
        _sum: { cpus: true, memoryMB: true },
        _count: true,
      });

      expect(stats._avg?.cpus).toBe(4);
      expect(stats._count).toBe(25);
    });
  });
});

/**
 * Example: Testing a service function that uses Prisma
 */
describe("Service Function Example", () => {
  const mockPrisma = createMockPrisma();

  // Example service function
  async function getUserWithPlatformRole(userId: string) {
    const user = await mockPrisma.user.findUnique({
      where: { id: userId },
      include: { platformUser: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return {
      ...user,
      role: user.platformUser?.role || "STUDENT",
    };
  }

  beforeEach(() => {
    resetMockFactoryCounters();
    Object.values(mockPrisma.user).forEach((fn: any) => {
      if (typeof fn?.mockReset === "function") fn.mockReset();
    });
  });

  it("should return user with platform role", async () => {
    const mockUser = createMockUser({ id: "user-1" });
    const mockPlatformUser = createMockPlatformUser({
      userId: mockUser.id,
      role: "INSTRUCTOR"
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      platformUser: mockPlatformUser,
    } as any);

    const result = await getUserWithPlatformRole("user-1");

    expect(result.role).toBe("INSTRUCTOR");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      include: { platformUser: true },
    });
  });

  it("should throw error when user not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(getUserWithPlatformRole("non-existent")).rejects.toThrow(
      "User not found"
    );
  });
});
