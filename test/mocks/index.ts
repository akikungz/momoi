/**
 * Test mocks for Prisma client and data factories.
 * 
 * @example Basic usage
 * ```typescript
 * import { describe, it, beforeEach } from "bun:test";
 * import { createMockPrisma, createMockUser } from "@test/mocks";
 * 
 * describe("My test", () => {
 *   const mockPrisma = createMockPrisma();
 *   
 *   beforeEach(() => {
 *     mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
 *   });
 * });
 * ```
 */

export { createMockPrisma, type MockedFunction } from "./mock-prisma";
export {
  createMockUser,
  createMockSession,
  createMockAccount,
  createMockPlatformUser,
  createMockCourse,
  createMockSemester,
  createMockCourseOffering,
  createMockPVENode,
  createMockPVETemplate,
  createMockPVEVM,
  createMockRequest,
  createMockInstance,
  createMockScenario,
  resetMockFactoryCounters,
  createMockPlatformFile,
  createMockPlatformFolder,
  createMockPlatformFileVersion,
  createMockPlatformFilePermission,
  createMockFileHierarchy,
} from "./mock-factory";
