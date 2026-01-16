import { Elysia } from "elysia";

import { treaty } from "@elysiajs/eden";
import {
  mockAdminAuth, mockInstructorAuth, mockOtherAuth, mockStudentAuth
} from "@momoi/auth/mock";
import { MockCache } from "@momoi/cache/mock";
import { MockQueueModule } from "@momoi/queue/mock";
import { academicRoute } from "@momoi/routes/academic";
import { autocompleteRoute } from "@momoi/routes/autocomplete";
import { instanceRoute } from "@momoi/routes/instance";
import { requestRoute } from "@momoi/routes/request";
import { userRoute } from "@momoi/routes/user";
import { ServiceError } from "@momoi/utils/error";

import { createMockPrisma, resetMockFactoryCounters } from "@test/mocks";

import type { MockAuth } from "@momoi/auth/mock";

export type TestRole = "admin" | "instructor" | "student" | "unauthenticated";

/**
 * Get the appropriate mock auth based on role
 */
function getMockAuth(role: TestRole): MockAuth {
  switch (role) {
    case "admin":
      return mockAdminAuth;
    case "instructor":
      return mockInstructorAuth;
    case "student":
      return mockStudentAuth;
    case "unauthenticated":
    default:
      return mockOtherAuth;
  }
}

/**
 * Creates a test app instance with all routes and mock dependencies.
 * Use this for e2e testing to test the full request/response cycle.
 */
export function createTestApp(role: TestRole = "admin") {
  const mockPrisma = createMockPrisma() as any;
  const mockCache = new MockCache();
  const mockQueue = new MockQueueModule();
  const mockAuth = getMockAuth(role);

  const app = new Elysia({ name: "test.app", prefix: "/api" })
    .onError(({ error, status }) => {
      if (error instanceof ServiceError) {
        return status(error.status, { status: error.status, message: error.message });
      }

      if (error instanceof Error) {
        return status(500, { status: 500, message: error.message });
      }

      return status(500, { status: 500, message: "An unexpected error occurred." });
    })
    .use(userRoute(mockPrisma, mockCache as any, mockAuth))
    .use(instanceRoute(mockPrisma, mockCache as any, mockAuth, mockQueue as any))
    .use(academicRoute(mockPrisma, mockCache as any, mockAuth))
    .use(requestRoute(mockPrisma, mockCache as any, mockAuth, mockQueue as any))
    .use(autocompleteRoute(mockPrisma, mockCache as any, mockAuth));

  return {
    app,
    client: treaty(app),
    mockPrisma,
    mockCache,
    mockQueue,
    mockAuth,
  };
}

/**
 * Helper function to create test context
 * Resets all mock counters and returns a fresh test setup
 */
export function setupTestContext(role: TestRole = "admin") {
  resetMockFactoryCounters();
  return createTestApp(role);
}

/**
 * Type helper for the test app client
 */
export type TestAppClient = ReturnType<typeof createTestApp>["client"];

/**
 * Type helper for the mock prisma instance
 */
export type TestMockPrisma = ReturnType<typeof createTestApp>["mockPrisma"];

export {
  mockAdminAuth,
  mockInstructorAuth,
  mockStudentAuth,
  mockOtherAuth,
  resetMockFactoryCounters,
};
