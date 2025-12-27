import { beforeEach, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import {
  mockAdminAuth, mockInstructorAuth, mockOtherAuth, mockStudentAuth
} from "@momoi/auth/mock";
import { MockCache } from "@momoi/cache/mock";
import { createMockPrisma } from "@momoi/database/test";

import { userRoute } from "../user";

describe("User Route - Admin", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  it("should get user profile", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockAdminAuth));
    const response = await client.user.me.get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("email");
    expect(response.data).toHaveProperty("name");
    expect(response.data).toHaveProperty("role");
    expect(response.data!.role).toBe("ADMIN");
  });

  it("should get SSH keys with pagination", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const mockSSHKeys = [
      {
        id: 1,
        ownerId: 1,
        name: "Admin Key",
        publicKey: "ssh-rsa AAAAB3...",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockPrisma.platformSSHKey.count.mockResolvedValueOnce(1);
    mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce(mockSSHKeys);

    const response = await client.user["ssh-keys"].get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("values");
    expect(response.data).toHaveProperty("totalItems");
    expect(response.data).toHaveProperty("currentPage");
    expect(response.data).toHaveProperty("pageSize");
    expect(response.data!.values).toHaveLength(1);
  });

  it("should add SSH key", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockAdminAuth));

    const mockSSHKeyData = {
      id: 1,
      ownerId: 1,
      name: "New Key",
      publicKey: "ssh-rsa AAAAB3...",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.platformSSHKey.create.mockResolvedValueOnce(mockSSHKeyData);

    const response = await client.user["ssh-keys"].post({
      name: "New Key",
      publicKey: "ssh-rsa AAAAB3...",
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("name", "New Key");
    expect(response.data).toHaveProperty("publicKey");
  });

  it("should remove SSH keys", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockAdminAuth));

    mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({ count: 1 });

    const response = await client.user["ssh-keys"].delete({
      keyIds: [1],
    });

    expect(response.status).toBe(200);
    expect(response.data).toBe(1);
  });
});

describe("User Route - Instructor", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  it("should get user profile", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockInstructorAuth));
    const response = await client.user.me.get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("email");
    expect(response.data).toHaveProperty("name");
    expect(response.data).toHaveProperty("role");
    expect(response.data!.role).toBe("INSTRUCTOR");
  });

  it("should get SSH keys", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    mockPrisma.platformSSHKey.count.mockResolvedValueOnce(0);
    mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce([]);

    const response = await client.user["ssh-keys"].get();

    expect(response.status).toBe(200);
    expect(response.data!.values).toHaveLength(0);
    expect(response.data!.totalItems).toBe(0);
  });

  it("should add SSH key", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    const mockSSHKeyData = {
      id: 2,
      ownerId: 2,
      name: "Instructor Key",
      publicKey: "ssh-rsa AAAAB3...",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.platformSSHKey.create.mockResolvedValueOnce(mockSSHKeyData);

    const response = await client.user["ssh-keys"].post({
      name: "Instructor Key",
      publicKey: "ssh-rsa AAAAB3...",
    });

    expect(response.status).toBe(200);
    expect(response.data!.name).toBe("Instructor Key");
  });

  it("should remove SSH keys", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockInstructorAuth));

    mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({ count: 2 });

    const response = await client.user["ssh-keys"].delete({
      keyIds: [1, 2],
    });

    expect(response.status).toBe(200);
    expect(response.data).toBe(2);
  });
});

describe("User Route - Student", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  it("should get user profile", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockStudentAuth));
    const response = await client.user.me.get();

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("id");
    expect(response.data).toHaveProperty("email");
    expect(response.data).toHaveProperty("name");
    expect(response.data).toHaveProperty("role");
    expect(response.data!.role).toBe("STUDENT");
  });

  it("should get SSH keys", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockStudentAuth));

    const mockSSHKeys = [
      {
        id: 1,
        ownerId: 3,
        name: "Student Key",
        publicKey: "ssh-rsa AAAAB3...",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockPrisma.platformSSHKey.count.mockResolvedValueOnce(1);
    mockPrisma.platformSSHKey.findMany.mockResolvedValueOnce(mockSSHKeys);

    const response = await client.user["ssh-keys"].get();

    expect(response.status).toBe(200);
    expect(response.data!.values).toHaveLength(1);
    expect(response.data!.currentPage).toBe(1);
  });

  it("should add SSH key", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockStudentAuth));

    const mockSSHKeyData = {
      id: 3,
      ownerId: 3,
      name: "Student SSH Key",
      publicKey: "ssh-rsa AAAAB3...",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.platformSSHKey.create.mockResolvedValueOnce(mockSSHKeyData);

    const response = await client.user["ssh-keys"].post({
      name: "Student SSH Key",
      publicKey: "ssh-rsa AAAAB3...",
    });

    expect(response.status).toBe(200);
    expect(response.data!.name).toBe("Student SSH Key");
  });

  it("should remove SSH keys", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockStudentAuth));

    mockPrisma.platformSSHKey.deleteMany.mockResolvedValueOnce({ count: 1 });

    const response = await client.user["ssh-keys"].delete({
      keyIds: [1],
    });

    expect(response.status).toBe(200);
    expect(response.data).toBe(1);
  });
});

describe("User Route - Unauthenticated", () => {
  let mockPrisma: any;
  let mockCache: MockCache;

  beforeEach(() => {
    mockPrisma = createMockPrisma() as any;
    mockCache = new MockCache();
  });

  it("should reject unauthorized access to /me", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockOtherAuth));
    const response = await client.user.me.get();

    expect(response.status).toBe(401);
  });

  it("should reject unauthorized access to /ssh-keys GET", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockOtherAuth));
    const response = await client.user["ssh-keys"].get();

    expect(response.status).toBe(401);
  });

  it("should reject unauthorized access to /ssh-keys POST", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockOtherAuth));
    const response = await client.user["ssh-keys"].post({
      name: "Test Key",
      publicKey: "ssh-rsa AAAAB3...",
    });

    expect(response.status).toBe(401);
  });

  it("should reject unauthorized access to /ssh-keys DELETE", async () => {
    const client = treaty(userRoute(mockPrisma, mockCache as any, mockOtherAuth));
    const response = await client.user["ssh-keys"].delete({
      keyIds: [1],
    });

    expect(response.status).toBe(401);
  });
});