# End-to-End (E2E) Testing Guide

This guide explains how to write and run end-to-end tests for the Momoi API.

## Overview

E2E tests verify the complete request/response cycle of the API, testing:
- Request routing
- Input validation
- Authentication & authorization
- Service layer integration
- Response formatting

## Quick Start

```typescript
import { describe, expect, it } from "bun:test";
import { setupTestContext } from "@momoi/e2e";

describe("My E2E Test", () => {
  it("should work as admin", async () => {
    const { client, mockPrisma } = setupTestContext("admin");

    // Setup mock data
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
    });

    // Make API request
    const response = await client.api.user.me.get();

    // Assert response
    expect(response.status).toBe(200);
    expect(response.data?.name).toBe("Admin User");
  });
});
```

## Test Setup

### `setupTestContext(role)`

Creates a fresh test context with all mock dependencies. Always call this to get a clean slate for each test.

**Parameters:**
- `role`: The user role to simulate
  - `"admin"` - Admin user (full access)
  - `"instructor"` - Instructor user (limited access)
  - `"student"` - Student user (restricted access)
  - `"unauthenticated"` - No authentication (returns 401)

**Returns:**
```typescript
{
  app,         // The Elysia app instance
  client,      // Eden treaty client for making requests
  mockPrisma,  // Mocked Prisma client
  mockCache,   // Mocked cache module
  mockQueue,   // Mocked queue module
  mockAuth,    // The auth macro being used
}
```

## Making Requests

Use the `client` from the test context to make type-safe API requests:

```typescript
// GET request
const response = await client.api.user.me.get();

// GET with query parameters
const response = await client.api.user["ssh-keys"].get({
  query: { page: 1, pageSize: 10 },
});

// POST request with body
const response = await client.api.user["ssh-keys"].post({
  name: "My Key",
  publicKey: "ssh-rsa AAAAB3...",
});

// DELETE request with body
const response = await client.api.user["ssh-keys"].delete({
  keyIds: [1, 2, 3],
});

// PATCH request with route parameters
const response = await client.api.instances({ instanceId: 1 }).promote.patch({});

// Dynamic route parameters
const response = await client.api.academic.courses({ courseId: 1 }).get();
```

## Mocking Data

### Setting Up Mock Responses

```typescript
const { client, mockPrisma } = setupTestContext("admin");

// Single response
mockPrisma.user.findUnique.mockResolvedValueOnce({
  id: "user-1",
  name: "Test User",
});

// Multiple sequential responses
mockPrisma.user.findUnique
  .mockResolvedValueOnce(user1)
  .mockResolvedValueOnce(user2);

// Error response
mockPrisma.user.findUnique.mockRejectedValueOnce(
  new Error("User not found")
);
```

### Using Mock Factories

Import factory functions for creating realistic test data:

```typescript
import {
  createMockUser,
  createMockPlatformUser,
  createMockCourse,
  createMockSemester,
  createMockInstance,
  createMockRequest,
  createMockPVETemplate,
  createMockScenario,
} from "@momoi/database/test";

// Create single entity
const user = createMockUser({ name: "Custom Name" });

// Create complete scenario
const scenario = createMockScenario();
// scenario.user, scenario.platformUser, scenario.course, etc.
```

## Testing Different Roles

Always test endpoints with different user roles to verify authorization:

```typescript
describe("GET /api/academic/courses", () => {
  describe("As Admin", () => {
    it("should return courses", async () => {
      const { client, mockPrisma } = setupTestContext("admin");
      // ... test implementation
      expect(response.status).toBe(200);
    });
  });

  describe("As Instructor", () => {
    it("should return 403 Forbidden", async () => {
      const { client } = setupTestContext("instructor");
      // ... test implementation
      expect(response.status).toBe(403);
    });
  });

  describe("As Student", () => {
    it("should return 403 Forbidden", async () => {
      const { client } = setupTestContext("student");
      // ... test implementation
      expect(response.status).toBe(403);
    });
  });

  describe("As Unauthenticated", () => {
    it("should return 401 Unauthorized", async () => {
      const { client } = setupTestContext("unauthenticated");
      // ... test implementation
      expect(response.status).toBe(401);
    });
  });
});
```

## Common Assertions

```typescript
// Status code
expect(response.status).toBe(200);
expect(response.status).toBe(401);
expect(response.status).toBe(403);

// Response data exists
expect(response.data).toBeDefined();

// Specific properties
expect(response.data!.id).toBe(1);
expect(response.data!.name).toBe("Test");

// Arrays
expect(response.data!.values).toHaveLength(2);
expect(response.data!.values).toContain(expected);

// Pagination
expect(response.data!.totalItems).toBe(10);
expect(response.data!.currentPage).toBe(1);
expect(response.data!.pageSize).toBe(10);

// Error responses
expect(response.error?.value).toHaveProperty("message");
```

## Test Organization

E2E tests are organized by route in the `src/e2e/` directory:

```
src/e2e/
├── index.ts              # Module exports
├── setup.ts              # Test setup utilities
├── user.e2e.test.ts      # User route tests
├── instance.e2e.test.ts  # Instance route tests
├── academic.e2e.test.ts  # Academic route tests
└── request.e2e.test.ts   # Request route tests
```

## Running Tests

```bash
# Run all tests
bun test

# Run only e2e tests
bun test src/e2e/

# Run specific e2e test file
bun test src/e2e/user.e2e.test.ts

# Watch mode
bun test --watch

# With coverage
bun test --coverage
```

## Best Practices

1. **Reset state between tests**: Always use `setupTestContext()` in each test to get a fresh context.

2. **Test all user roles**: Verify that authorization works correctly for all roles.

3. **Test edge cases**: Include tests for empty results, validation errors, and error conditions.

4. **Use descriptive test names**: Clearly describe what each test verifies.

5. **Mock at the right level**: Mock Prisma responses, not service methods.

6. **Keep tests independent**: Each test should be able to run in isolation.

7. **Group related tests**: Use nested `describe` blocks to organize tests by endpoint and role.

## Example: Complete Test Suite

```typescript
import { describe, expect, it } from "bun:test";
import { setupTestContext } from "@momoi/e2e";
import { createMockCourse } from "@momoi/database/test";

describe("E2E: Course Management", () => {
  describe("GET /api/academic/courses", () => {
    describe("As Admin", () => {
      it("should return paginated courses", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.course.count.mockResolvedValueOnce(2);
        mockPrisma.course.findMany.mockResolvedValueOnce([
          createMockCourse({ code: "CS101" }),
          createMockCourse({ code: "CS102" }),
        ]);

        const response = await client.api.academic.courses.get();

        expect(response.status).toBe(200);
        expect(response.data!.values).toHaveLength(2);
        expect(response.data!.totalItems).toBe(2);
      });

      it("should return empty list when no courses", async () => {
        const { client, mockPrisma } = setupTestContext("admin");

        mockPrisma.course.count.mockResolvedValueOnce(0);
        mockPrisma.course.findMany.mockResolvedValueOnce([]);

        const response = await client.api.academic.courses.get();

        expect(response.status).toBe(200);
        expect(response.data!.values).toHaveLength(0);
      });
    });

    describe("As Student", () => {
      it("should return 403 Forbidden", async () => {
        const { client } = setupTestContext("student");

        const response = await client.api.academic.courses.get();

        expect(response.status).toBe(403);
      });
    });
  });
});
```

## Troubleshooting

### Tests timing out
- Ensure all mock responses are set up before making requests
- Check for missing `mockResolvedValueOnce` calls

### Unexpected 500 errors
- Check the mock setup matches what the service expects
- Ensure related data (relations) are mocked correctly

### Type errors with client
- The Eden treaty client is fully typed based on the route definitions
- Check that route parameters match the expected types

### Mock not being called
- Verify the mock is set up before the API call
- Check the method name matches (e.g., `findUnique` vs `findFirst`)
