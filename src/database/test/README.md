# Prisma Mock Testing Utilities

This directory contains utilities for mocking Prisma client in unit tests.

## Overview

The testing utilities provide:

1. **Mock Prisma Client** (`mock-prisma.ts`) - A fully mocked Prisma client with all CRUD operations
2. **Mock Data Factories** (`mock-factory.ts`) - Helper functions to generate realistic test data
3. **Example Tests** (`example.test.ts`) - Comprehensive examples showing various testing patterns

## Quick Start

### Basic Usage

```typescript
import { describe, it, beforeEach, expect } from "bun:test";
import { createMockPrisma, createMockUser } from "@momoi/database/test";

describe("User Service", () => {
  const mockPrisma = createMockPrisma();

  beforeEach(() => {
    // Reset mocks before each test
    mockPrisma.user.findUnique.mockReset();
  });

  it("should find a user by id", async () => {
    const mockUser = createMockUser({ id: "user-1", name: "John" });
    
    // Setup the mock
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    // Test your code
    const user = await mockPrisma.user.findUnique({
      where: { id: "user-1" }
    });

    // Assertions
    expect(user?.name).toBe("John");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
```

## Mock Prisma Client

The `createMockPrisma()` function creates a fully mocked Prisma client with all models and operations.

### Available Operations

Each model mock includes:
- `findUnique` / `findUniqueOrThrow`
- `findFirst` / `findFirstOrThrow`
- `findMany`
- `create` / `createMany`
- `update` / `updateMany`
- `upsert`
- `delete` / `deleteMany`
- `count`
- `aggregate`
- `groupBy`

### Mocked Models

All models from your Prisma schema are available:

#### BetterAuth Models
- `user`
- `session`
- `account`
- `verification`

#### Platform Models
- `platformUser`
- `instructorSearch`

#### Academic Models
- `course`
- `semester`
- `courseOffering`

#### Proxmox Models
- `pVENode`
- `pVENetwork`
- `pVENetworkIP`
- `pVETemplate`
- `pVEVM`

#### Instance Models
- `instance`
- `instanceReverseProxy`
- `instanceAuditLog`

#### Approval Models
- `request`
- `extendedRequest`
- `requestAuditLog`
- `extendedRequestAuditLog`

#### Platform SSH Keys
- `platformSSHKey`

## Mock Data Factories

Factory functions create realistic test data with sensible defaults.

### Available Factories

```typescript
import {
  createMockUser,
  createMockPlatformUser,
  createMockCourse,
  createMockInstance,
  // ... and more
} from "@momoi/database/test";
```

### Factory Functions

- `createMockUser(overrides?)` - Create a BetterAuth user
- `createMockSession(overrides?)` - Create a session
- `createMockAccount(overrides?)` - Create an OAuth account
- `createMockPlatformUser(overrides?)` - Create a platform user
- `createMockCourse(overrides?)` - Create a course
- `createMockSemester(overrides?)` - Create a semester
- `createMockCourseOffering(overrides?)` - Create a course offering
- `createMockPVENode(overrides?)` - Create a Proxmox node
- `createMockPVETemplate(overrides?)` - Create a VM template
- `createMockPVEVM(overrides?)` - Create a VM
- `createMockRequest(overrides?)` - Create an instance request
- `createMockInstance(overrides?)` - Create an instance

### Creating Complete Scenarios

Use `createMockScenario()` to create a full set of related entities:

```typescript
const scenario = createMockScenario();

// Returns:
// {
//   user,
//   platformUser,
//   course,
//   semester,
//   courseOffering,
//   template,
//   node,
//   vm,
//   request,
//   instance
// }
```

### Resetting Counters

Factory functions use internal counters for IDs. Reset them in `beforeEach`:

```typescript
import { resetMockFactoryCounters } from "@momoi/database/test";

beforeEach(() => {
  resetMockFactoryCounters();
});
```

## Testing Patterns

### 1. Simple CRUD Test

```typescript
it("should create a user", async () => {
  const newUser = createMockUser({ name: "Alice" });
  mockPrisma.user.create.mockResolvedValue(newUser);

  const user = await mockPrisma.user.create({
    data: newUser
  });

  expect(user.name).toBe("Alice");
});
```

### 2. Testing with Relations

```typescript
it("should find user with platform role", async () => {
  const user = createMockUser();
  const platformUser = createMockPlatformUser({ 
    userId: user.id,
    role: "INSTRUCTOR" 
  });

  mockPrisma.user.findUnique.mockResolvedValue({
    ...user,
    platformUser
  } as any);

  const result = await mockPrisma.user.findUnique({
    where: { id: user.id },
    include: { platformUser: true }
  });

  expect(result?.platformUser?.role).toBe("INSTRUCTOR");
});
```

### 3. Testing Transactions

```typescript
it("should handle transactions", async () => {
  const user = createMockUser();
  const platformUser = createMockPlatformUser({ userId: user.id });

  mockPrisma.user.create.mockResolvedValue(user);
  mockPrisma.platformUser.create.mockResolvedValue(platformUser);

  const result = await mockPrisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({ data: user });
    const newPlatformUser = await tx.platformUser.create({ 
      data: platformUser 
    });
    return { newUser, newPlatformUser };
  });

  expect(result.newUser).toEqual(user);
});
```

### 4. Testing Error Cases

```typescript
it("should handle not found errors", async () => {
  mockPrisma.user.findUniqueOrThrow.mockRejectedValue(
    new Error("Record not found")
  );

  await expect(
    mockPrisma.user.findUniqueOrThrow({ where: { id: "xyz" } })
  ).rejects.toThrow("Record not found");
});
```

### 5. Testing Multiple Calls

```typescript
it("should handle multiple sequential calls", async () => {
  const user1 = createMockUser({ name: "Alice" });
  const user2 = createMockUser({ name: "Bob" });

  mockPrisma.user.findUnique
    .mockResolvedValueOnce(user1)
    .mockResolvedValueOnce(user2);

  const firstCall = await mockPrisma.user.findUnique({ 
    where: { id: "1" } 
  });
  const secondCall = await mockPrisma.user.findUnique({ 
    where: { id: "2" } 
  });

  expect(firstCall?.name).toBe("Alice");
  expect(secondCall?.name).toBe("Bob");
});
```

## Best Practices

### 1. Reset Mocks Between Tests

```typescript
beforeEach(() => {
  resetMockFactoryCounters();
  
  // Reset all mocks for a model
  Object.values(mockPrisma.user).forEach((fn: any) => {
    if (typeof fn?.mockReset === "function") fn.mockReset();
  });
});
```

### 2. Use Factory Overrides

```typescript
// Good: Override only what's needed
const user = createMockUser({ name: "Specific Name" });

// Avoid: Creating objects manually
const user = {
  id: "user-1",
  name: "Test",
  email: "test@example.com",
  // ... many more fields
};
```

### 3. Test Actual Service Functions

```typescript
// my-service.ts
export async function getUserRole(userId: string, prisma: PrismaClient) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { platformUser: true }
  });
  return user?.platformUser?.role || "STUDENT";
}

// my-service.test.ts
it("should return user role", async () => {
  const mockUser = createMockUser();
  const mockPlatformUser = createMockPlatformUser({ 
    userId: mockUser.id,
    role: "INSTRUCTOR" 
  });

  mockPrisma.user.findUnique.mockResolvedValue({
    ...mockUser,
    platformUser: mockPlatformUser
  } as any);

  const role = await getUserRole(mockUser.id, mockPrisma as any);
  expect(role).toBe("INSTRUCTOR");
});
```

### 4. Verify Call Arguments

```typescript
it("should call findMany with correct filters", async () => {
  mockPrisma.user.findMany.mockResolvedValue([]);

  await mockPrisma.user.findMany({
    where: { emailVerified: true },
    take: 10
  });

  expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
    where: { emailVerified: true },
    take: 10
  });
});
```

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/database/test/example.test.ts

# Watch mode
bun test --watch
```

## Examples

See [example.test.ts](./example.test.ts) for comprehensive examples covering:
- Basic CRUD operations
- Complex queries with relations
- Transaction handling
- Error scenarios
- Count and aggregate operations
- Service function testing

## Additional Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Prisma Client API Reference](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
