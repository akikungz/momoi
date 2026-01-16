/**
 * E2E Test Utilities
 * 
 * This module provides utilities for running end-to-end tests against the API.
 * 
 * @example
 * ```typescript
 * import { setupTestContext } from "@test/e2e";
 * 
 * describe("My E2E Test", () => {
 *   it("should work", async () => {
 *     const { client, mockPrisma } = setupTestContext("admin");
 *     
 *     mockPrisma.user.findUnique.mockResolvedValueOnce({ ... });
 *     
 *     const response = await client.api.user.me.get();
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 */

export {
  createTestApp,
  setupTestContext,
  mockAdminAuth,
  mockInstructorAuth,
  mockStudentAuth,
  mockOtherAuth,
  resetMockFactoryCounters,
  type TestRole,
  type TestAppClient,
  type TestMockPrisma,
} from "./setup";
