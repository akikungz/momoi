import { mock } from "bun:test";
import type { PrismaClient } from "../prisma/generated/client";

/**
 * Creates a mock Prisma client with all model methods stubbed.
 * 
 * Usage:
 * ```typescript
 * import { describe, it, beforeEach, expect } from "bun:test";
 * import { createMockPrisma } from "@momoi/database/test/mock-prisma";
 * 
 * describe("My test", () => {
 *   const mockPrisma = createMockPrisma();
 *   
 *   beforeEach(() => {
 *     mockPrisma.user.findUnique.mockResolvedValue({ id: "1", name: "Test" });
 *   });
 *   
 *   it("should work", async () => {
 *     const user = await mockPrisma.user.findUnique({ where: { id: "1" } });
 *     expect(user?.name).toBe("Test");
 *   });
 * });
 * ```
 */
export function createMockPrisma() {
  // Create base mock client
  const mockPrisma = {
    $connect: mock(async () => { }),
    $disconnect: mock(async () => { }),
    $transaction: mock(async (fn: any) => {
      if (typeof fn === 'function') {
        return fn(mockPrisma);
      }
      return Promise.all(fn);
    }),
    $executeRaw: mock(async () => 0),
    $executeRawUnsafe: mock(async () => 0),
    $queryRaw: mock(async () => []),
    $queryRawUnsafe: mock(async () => []),

    // BetterAuth Models
    user: createModelMock(),
    session: createModelMock(),
    account: createModelMock(),
    verification: createModelMock(),

    // Platform Models
    platformUser: createModelMock(),
    instructorSearch: createModelMock(),

    // Academic Models
    course: createModelMock(),
    semester: createModelMock(),
    courseOffering: createModelMock(),

    // Proxmox Models
    pVENode: createModelMock(),
    pVENetwork: createModelMock(),
    pVENetworkIP: createModelMock(),
    pVETemplate: createModelMock(),
    pVEVM: createModelMock(),

    // Instance Models
    instance: createModelMock(),
    instanceReverseProxy: createModelMock(),
    instanceAuditLog: createModelMock(),

    // Approval Models
    request: createModelMock(),
    extendedRequest: createModelMock(),
    requestAuditLog: createModelMock(),
    extendedRequestAuditLog: createModelMock(),

    // Platform SSH Key Models
    platformSSHKey: createModelMock(),
  } as unknown as PrismaClient;

  return mockPrisma;
}

/**
 * Creates a mock for a Prisma model with all standard CRUD operations.
 */
function createModelMock() {
  return {
    findUnique: mock(async () => null),
    findUniqueOrThrow: mock(async () => {
      throw new Error("Record not found");
    }),
    findFirst: mock(async () => null),
    findFirstOrThrow: mock(async () => {
      throw new Error("Record not found");
    }),
    findMany: mock(async () => []),
    create: mock(async (data: any) => data.data),
    createMany: mock(async () => ({ count: 0 })),
    update: mock(async (data: any) => data.data),
    updateMany: mock(async () => ({ count: 0 })),
    upsert: mock(async (data: any) => data.create),
    delete: mock(async (data: any) => data.where),
    deleteMany: mock(async () => ({ count: 0 })),
    count: mock(async () => 0),
    aggregate: mock(async () => ({})),
    groupBy: mock(async () => []),
  };
}

/**
 * Type helper for mock functions with typed return values.
 */
export type MockedFunction<T extends (...args: any[]) => any> = ReturnType<typeof mock<T>>;
