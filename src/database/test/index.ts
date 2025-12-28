/**
 * Test utilities for mocking Prisma client and generating test data.
 * 
 * @example Basic usage
 * ```typescript
 * import { describe, it, beforeEach } from "bun:test";
 * import { createMockPrisma, createMockUser } from "@momoi/database/test";
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
} from "./mock-factory";
