// @ts-nocheck
/**
 * Practical Example: Testing a User Service
 * 
 * This demonstrates how to test real application code using the mock Prisma utilities.
 */

import { beforeEach, describe, expect, it } from "bun:test";

import {
  createMockPlatformUser, createMockPrisma, createMockUser, resetMockFactoryCounters
} from "./index";

import type { PrismaClient } from "@momoi/database";
// Example service that we want to test
class UserService {
  constructor(private prisma: PrismaClient) { }

  async getUserById(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: { platformUser: true },
    });
  }

  async createUserWithPlatformRole(
    email: string,
    name: string,
    role: "ADMIN" | "INSTRUCTOR" | "STUDENT" = "STUDENT"
  ) {
    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new Error("User already exists");
    }

    // Create user and platform user in a transaction
    return await this.prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          id: `user-${Date.now()}`,
          email,
          name,
          emailVerified: false,
        },
      });

      const platformUser = await tx.platformUser.create({
        data: {
          userId: user.id,
          role,
        },
      });

      return { user, platformUser };
    });
  }

  async listInstructors() {
    const platformUsers = await this.prisma.platformUser.findMany({
      where: { role: "INSTRUCTOR" },
      include: { user: true },
    });

    return platformUsers.map((pu) => ({
      id: pu.id,
      userId: pu.userId,
      name: pu.user.name,
      email: pu.user.email,
      role: pu.role,
    }));
  }

  async getUserStats() {
    const [totalUsers, verifiedUsers, instructorCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.platformUser.count({ where: { role: "INSTRUCTOR" } }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      instructorCount,
      unverifiedUsers: totalUsers - verifiedUsers,
    };
  }
}

// Tests
describe("UserService", () => {
  const mockPrisma = createMockPrisma();
  const userService = new UserService(mockPrisma as any);

  beforeEach(() => {
    resetMockFactoryCounters();

    // Reset all mocks
    Object.values(mockPrisma.user).forEach((fn: any) => {
      if (typeof fn?.mockReset === "function") fn.mockReset();
    });
    Object.values(mockPrisma.platformUser).forEach((fn: any) => {
      if (typeof fn?.mockReset === "function") fn.mockReset();
    });
  });

  describe("getUserById", () => {
    it("should return user with platform role", async () => {
      const mockUser = createMockUser({ id: "user-1", name: "John Doe" });
      const mockPlatformUser = createMockPlatformUser({
        userId: mockUser.id,
        role: "INSTRUCTOR",
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        platformUser: mockPlatformUser,
      } as any);

      const result = await userService.getUserById("user-1");

      expect(result).toBeDefined();
      expect(result?.name).toBe("John Doe");
      expect(result?.platformUser?.role).toBe("INSTRUCTOR");
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        include: { platformUser: true },
      });
    });

    it("should return null when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.getUserById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("createUserWithPlatformRole", () => {
    it("should create a new user with platform role", async () => {
      const mockUser = createMockUser({
        email: "new@example.com",
        name: "New User",
      });
      const mockPlatformUser = createMockPlatformUser({
        userId: mockUser.id,
        role: "STUDENT",
      });

      // User doesn't exist yet
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Mock transaction
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.platformUser.create.mockResolvedValue(mockPlatformUser);

      const result = await userService.createUserWithPlatformRole(
        "new@example.com",
        "New User"
      );

      expect(result.user.email).toBe("new@example.com");
      expect(result.platformUser.role).toBe("STUDENT");
    });

    it("should throw error if user already exists", async () => {
      const existingUser = createMockUser({ email: "existing@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        userService.createUserWithPlatformRole(
          "existing@example.com",
          "Some Name"
        )
      ).rejects.toThrow("User already exists");

      // Should not attempt to create
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("should create user with instructor role", async () => {
      const mockUser = createMockUser();
      const mockPlatformUser = createMockPlatformUser({
        userId: mockUser.id,
        role: "INSTRUCTOR",
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.platformUser.create.mockResolvedValue(mockPlatformUser);

      const result = await userService.createUserWithPlatformRole(
        "instructor@example.com",
        "Instructor Name",
        "INSTRUCTOR"
      );

      expect(result.platformUser.role).toBe("INSTRUCTOR");
    });
  });

  describe("listInstructors", () => {
    it("should return list of instructors", async () => {
      const instructors = [
        {
          ...createMockPlatformUser({ id: 1, role: "INSTRUCTOR" }),
          user: createMockUser({ name: "Instructor 1", email: "inst1@example.com" }),
        },
        {
          ...createMockPlatformUser({ id: 2, role: "INSTRUCTOR" }),
          user: createMockUser({ name: "Instructor 2", email: "inst2@example.com" }),
        },
      ];

      mockPrisma.platformUser.findMany.mockResolvedValue(instructors as any);

      const result = await userService.listInstructors();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Instructor 1");
      expect(result[0].role).toBe("INSTRUCTOR");
      expect(result[1].email).toBe("inst2@example.com");

      expect(mockPrisma.platformUser.findMany).toHaveBeenCalledWith({
        where: { role: "INSTRUCTOR" },
        include: { user: true },
      });
    });

    it("should return empty array when no instructors", async () => {
      mockPrisma.platformUser.findMany.mockResolvedValue([]);

      const result = await userService.listInstructors();

      expect(result).toHaveLength(0);
    });
  });

  describe("getUserStats", () => {
    it("should return user statistics", async () => {
      // Mock the count calls
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // Total users
        .mockResolvedValueOnce(75); // Verified users

      mockPrisma.platformUser.count.mockResolvedValue(10); // Instructors

      const stats = await userService.getUserStats();

      expect(stats.totalUsers).toBe(100);
      expect(stats.verifiedUsers).toBe(75);
      expect(stats.unverifiedUsers).toBe(25);
      expect(stats.instructorCount).toBe(10);
    });

    it("should handle zero users", async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockPrisma.platformUser.count.mockResolvedValue(0);

      const stats = await userService.getUserStats();

      expect(stats.totalUsers).toBe(0);
      expect(stats.verifiedUsers).toBe(0);
      expect(stats.unverifiedUsers).toBe(0);
      expect(stats.instructorCount).toBe(0);
    });
  });
});
