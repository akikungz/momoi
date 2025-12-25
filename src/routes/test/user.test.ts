import { beforeEach, describe, expect, it, mock } from "bun:test";

import { treaty } from "@elysiajs/eden";

import { mockAdminAuth, mockInstructorAuth, mockStudentAuth, mockOtherAuth } from "@momoi/auth/mock";
import { createMockPrisma } from "@momoi/database/test";

import { userRoute } from "../user";
import { CacheModule } from "@momoi/cache";

const mockPrisma = createMockPrisma();
const mockCache = new CacheModule();

describe("User Route - Admin", () => {
  const client = treaty(userRoute(mockPrisma, mockCache, mockAdminAuth));

  it("should get user profile", async () => {
    const response = await client.user.me.get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("email");
    expect(response.data).toHaveProperty("name");
    expect(response.data).toHaveProperty("role");
    expect(response.data!.role).toBe("ADMIN");
  });
});

describe("User Route - Instructor", () => {
  const client = treaty(userRoute(mockPrisma, mockCache, mockInstructorAuth));

  it("should get user profile", async () => {
    const response = await client.user.me.get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("email");
    expect(response.data).toHaveProperty("name");
    expect(response.data).toHaveProperty("role");
    expect(response.data!.role).toBe("INSTRUCTOR");
  });
});

describe("User Route - Student", () => {
  const client = treaty(userRoute(mockPrisma, mockCache, mockStudentAuth));
  it("should get user profile", async () => {
    const response = await client.user.me.get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("email");
    expect(response.data).toHaveProperty("name");
    expect(response.data).toHaveProperty("role");
    expect(response.data!.role).toBe("STUDENT");
  });
});

describe("User Route - Other", () => {
  const client = treaty(userRoute(mockPrisma, mockCache, mockOtherAuth));

  it("should get user profile", async () => {
    const response = await client.user.me.get();

    expect(response.status).toBe(401);
  });
});