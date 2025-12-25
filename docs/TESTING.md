# Testing with Mock Prisma Client

## Quick Start

```typescript
import { describe, it, beforeEach, expect } from "bun:test";
import { createMockPrisma, createMockUser, resetMockFactoryCounters } from "@momoi/database/test";

describe("My Feature", () => {
  const mockPrisma = createMockPrisma();

  beforeEach(() => {
    resetMockFactoryCounters();
    mockPrisma.user.findUnique.mockReset();
  });

  it("should work", async () => {
    const user = createMockUser({ name: "Test User" });
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const result = await mockPrisma.user.findUnique({ where: { id: "1" } });
    
    expect(result?.name).toBe("Test User");
  });
});
```

## What's Available

### Mock Prisma Client
- `createMockPrisma()` - Creates a fully mocked Prisma client
- All models and CRUD operations are mocked
- Supports transactions, raw queries, and aggregations

### Mock Data Factories
- `createMockUser(overrides?)` - User (BetterAuth)
- `createMockPlatformUser(overrides?)` - Platform user with role
- `createMockCourse(overrides?)` - Course
- `createMockSemester(overrides?)` - Semester  
- `createMockCourseOffering(overrides?)` - Course offering
- `createMockInstance(overrides?)` - VM instance
- `createMockRequest(overrides?)` - Instance request
- `createMockPVEVM(overrides?)` - Proxmox VM
- `createMockPVETemplate(overrides?)` - VM template
- `createMockPVENode(overrides?)` - Proxmox node
- `createMockScenario()` - Complete set of related entities
- `resetMockFactoryCounters()` - Reset ID counters between tests

## Usage Patterns

### Basic Mocking
```typescript
mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
```

### Multiple Calls
```typescript
mockPrisma.user.findUnique
  .mockResolvedValueOnce(user1)
  .mockResolvedValueOnce(user2);
```

### Testing Relations
```typescript
mockPrisma.user.findUnique.mockResolvedValue({
  ...user,
  platformUser: createMockPlatformUser()
} as any);
```

### Testing Errors
```typescript
mockPrisma.user.findUnique.mockRejectedValue(
  new Error("Record not found")
);
```

## Full Documentation

See [src/database/test/README.md](src/database/test/README.md) for comprehensive documentation with examples.

## Running Tests

```bash
# All tests
bun test

# Specific file
bun test src/path/to/file.test.ts

# Watch mode
bun test --watch
```
