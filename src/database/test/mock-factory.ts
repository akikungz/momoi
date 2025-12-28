import type {
  User,
  Session,
  Account,
  PlatformUser,
  Course,
  Semester,
  CourseOffering,
  Instance,
  Request,
  PVETemplate,
  PVEVM,
  PVENode,
  PlatformFile,
  PlatformFileVersion,
  PlatformFilePermission,
} from "../prisma/generated/client";

import type { PlatformRole, InstanceStatus, ApprovalStatus, PVEVMStatus, PVEVMType, InstanceProvisionStatus, PlatformFileType, PlatformFileViewerRole } from "../prisma/generated/enums";

/**
 * Factory functions to create mock data for testing.
 * These provide realistic test data with sensible defaults.
 */

let userIdCounter = 1;
let platformUserIdCounter = 1;
let courseIdCounter = 1;
let semesterIdCounter = 1;
let instanceIdCounter = 1;
let requestIdCounter = 1;
let templateIdCounter = 1;
let vmIdCounter = 1000;
let nodeIdCounter = 1;
let platformFileIdCounter = 1;
let platformFileVersionIdCounter = 1;
let platformFilePermissionIdCounter = 1;

/**
 * Reset all ID counters. Call this in beforeEach to ensure test isolation.
 */
export function resetMockFactoryCounters() {
  userIdCounter = 1;
  platformUserIdCounter = 1;
  courseIdCounter = 1;
  semesterIdCounter = 1;
  instanceIdCounter = 1;
  requestIdCounter = 1;
  templateIdCounter = 1;
  vmIdCounter = 1000;
  nodeIdCounter = 1;
  platformFileIdCounter = 1;
  platformFileVersionIdCounter = 1;
  platformFilePermissionIdCounter = 1;
}

/**
 * Creates a mock User (BetterAuth)
 */
export function createMockUser(overrides?: Partial<User>): User {
  const id = `user-${userIdCounter++}`;
  return {
    id,
    name: "Test User",
    email: `test${userIdCounter}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock Session (BetterAuth)
 */
export function createMockSession(overrides?: Partial<Session>): Session {
  const userId = overrides?.userId || `user-${userIdCounter}`;
  return {
    id: `session-${Math.random().toString(36).substr(2, 9)}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    token: `token-${Math.random().toString(36).substr(2, 16)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    userId,
    ...overrides,
  };
}

/**
 * Creates a mock Account (BetterAuth)
 */
export function createMockAccount(overrides?: Partial<Account>): Account {
  const userId = overrides?.userId || `user-${userIdCounter}`;
  return {
    id: `account-${Math.random().toString(36).substr(2, 9)}`,
    accountId: `google-${Math.random().toString(36).substr(2, 9)}`,
    providerId: "google",
    userId,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: "email profile",
    password: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock PlatformUser
 */
export function createMockPlatformUser(overrides?: Partial<PlatformUser>): PlatformUser {
  const id = platformUserIdCounter++;
  const userId = overrides?.userId || `user-${userIdCounter}`;
  return {
    id,
    userId,
    role: "STUDENT" as PlatformRole,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock Course
 */
export function createMockCourse(overrides?: Partial<Course>): Course {
  const id = courseIdCounter++;
  return {
    id,
    code: `CS${1000 + id}`,
    title: `Test Course ${id}`,
    description: `Description for course ${id}`,
    isActive: overrides?.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock Semester
 */
export function createMockSemester(overrides?: Partial<Semester>): Semester {
  const id = semesterIdCounter++;
  const year = 2024 + Math.floor((id - 1) / 3);
  const term = ["Spring", "Summer", "Fall"][(id - 1) % 3];
  return {
    id,
    name: `${term} ${year}`,
    startDate: new Date(`${year}-01-01`),
    endDate: new Date(`${year}-12-31`),
    isCurrent: overrides?.isCurrent ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock CourseOffering
 */
export function createMockCourseOffering(overrides?: Partial<CourseOffering>): CourseOffering {
  const id = Math.max(courseIdCounter, 1);
  return {
    id: id,
    courseId: overrides?.courseId || 1,
    semesterId: overrides?.semesterId || 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock PVENode
 */
export function createMockPVENode(overrides?: Partial<PVENode>): PVENode {
  const id = nodeIdCounter++;
  return {
    id,
    name: `pve-node-${id}`,
    ipAddress: `192.168.1.${10 + id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock PVETemplate
 */
export function createMockPVETemplate(overrides?: Partial<PVETemplate>): PVETemplate {
  const id = templateIdCounter++;
  return {
    id,
    name: `Ubuntu 22.04 Template ${id}`,
    description: `Template ${id} description`,
    vmId: 9000 + id,
    type: "QEMU" as PVEVMType,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock PVEVM
 */
export function createMockPVEVM(overrides?: Partial<PVEVM>): PVEVM {
  const id = vmIdCounter++;
  return {
    id,
    vmId: id,
    hostname: `vm-${id}.local`,
    status: "RUNNING" as PVEVMStatus,
    type: "QEMU" as PVEVMType,
    pveNodeId: overrides?.pveNodeId || 1,
    pveNetworkIPId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock Request
 */
export function createMockRequest(overrides?: Partial<Request>): Request {
  const id = requestIdCounter++;
  return {
    id,
    title: `Test Request ${id}`,
    description: `Description for request ${id}`,
    courseOfferingId: overrides?.courseOfferingId || 1,
    pveTemplateId: overrides?.pveTemplateId || 1,
    cpus: 2,
    memoryMB: 4096,
    diskGB: 50,
    requesterId: overrides?.requesterId || 1,
    reviewerId: null,
    status: "PENDING" as ApprovalStatus,
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock Instance
 */
export function createMockInstance(overrides?: Partial<Instance>): Instance {
  const id = instanceIdCounter++;
  return {
    id,
    platformUserId: overrides?.platformUserId || 1,
    pveVMId: null,
    pveTemplateId: overrides?.pveTemplateId || 1,
    cpus: 2,
    memoryMB: 4096,
    diskGB: 50,
    courseOfferingId: overrides?.courseOfferingId || 1,
    requestId: null,
    status: "PENDING" as InstanceStatus,
    provisionStatus: "NOT_STARTED" as InstanceProvisionStatus,
    provisionError: null,
    semesterId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a complete mock scenario with related entities
 */
export function createMockScenario() {
  const user = createMockUser();
  const platformUser = createMockPlatformUser({ userId: user.id });
  const course = createMockCourse();
  const semester = createMockSemester();
  const courseOffering = createMockCourseOffering({
    courseId: course.id,
    semesterId: semester.id
  });
  const template = createMockPVETemplate();
  const node = createMockPVENode();
  const vm = createMockPVEVM({ pveNodeId: node.id });
  const request = createMockRequest({
    courseOfferingId: courseOffering.id,
    pveTemplateId: template.id,
    requesterId: platformUser.id,
  });
  const instance = createMockInstance({
    platformUserId: platformUser.id,
    pveTemplateId: template.id,
    courseOfferingId: courseOffering.id,
    pveVMId: vm.id,
  });

  return {
    user,
    platformUser,
    course,
    semester,
    courseOffering,
    template,
    node,
    vm,
    request,
    instance,
  };
}

/**
 * Creates a mock PlatformFile
 */
export function createMockPlatformFile(overrides?: Partial<PlatformFile>): PlatformFile {
  const id = `file-${platformFileIdCounter++}`;
  return {
    id,
    name: `Test File ${platformFileIdCounter}`,
    type: "FILE" as PlatformFileType,
    sizeBytes: 1024,
    visibility: "OWNER" as PlatformFileViewerRole,
    parentId: null,
    platformUserId: overrides?.platformUserId || 1,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock PlatformFile folder
 */
export function createMockPlatformFolder(overrides?: Partial<PlatformFile>): PlatformFile {
  const id = `folder-${platformFileIdCounter++}`;
  return {
    id,
    name: `Test Folder ${platformFileIdCounter}`,
    type: "FOLDER" as PlatformFileType,
    sizeBytes: 0,
    visibility: "OWNER" as PlatformFileViewerRole,
    parentId: null,
    platformUserId: overrides?.platformUserId || 1,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock PlatformFileVersion
 */
export function createMockPlatformFileVersion(overrides?: Partial<PlatformFileVersion>): PlatformFileVersion {
  const id = platformFileVersionIdCounter++;
  return {
    id,
    platformFileId: overrides?.platformFileId || "file-1",
    versionNumber: overrides?.versionNumber || 1,
    sizeBytes: 1024,
    storagePath: `/storage/files/file-1/v${id}`,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock PlatformFilePermission
 */
export function createMockPlatformFilePermission(overrides?: Partial<PlatformFilePermission>): PlatformFilePermission {
  const id = platformFilePermissionIdCounter++;
  return {
    id,
    platformFileId: overrides?.platformFileId || "file-1",
    platformUserId: overrides?.platformUserId || 2,
    permission: "VIEWER" as PlatformFileViewerRole,
    ...overrides,
  };
}

/**
 * Creates a mock file hierarchy scenario
 */
export function createMockFileHierarchy(platformUserId: number = 1) {
  const rootFolder = createMockPlatformFolder({
    id: "folder-root",
    name: "Root Folder",
    platformUserId,
  });

  const subFolder = createMockPlatformFolder({
    id: "folder-sub",
    name: "Sub Folder",
    parentId: rootFolder.id,
    platformUserId,
  });

  const file1 = createMockPlatformFile({
    id: "file-1",
    name: "document.txt",
    parentId: rootFolder.id,
    platformUserId,
  });

  const file2 = createMockPlatformFile({
    id: "file-2",
    name: "image.png",
    parentId: subFolder.id,
    platformUserId,
    sizeBytes: 2048,
  });

  const version1 = createMockPlatformFileVersion({
    platformFileId: file1.id,
    versionNumber: 1,
  });

  const version2 = createMockPlatformFileVersion({
    platformFileId: file1.id,
    versionNumber: 2,
  });

  return {
    rootFolder,
    subFolder,
    file1,
    file2,
    version1,
    version2,
  };
}
